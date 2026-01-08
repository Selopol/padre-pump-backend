/**
 * Wallet Tracker - Real-time WebSocket monitoring via Helius
 * Tracks developer wallets for INSTANT token creation detection
 */

import WebSocket from 'ws';
import config from '../../config/config.js';
import { getDeveloperByAddress, getAllDevelopers } from '../db/queries.js';
import { createAlert } from '../services/developer.js';

class WalletTracker {
  constructor() {
    this.ws = null;
    this.trackedWallets = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.isConnected = false;
  }

  /**
   * Start tracking wallets
   */
  async start() {
    console.log('\n🔍 Starting Helius WebSocket Wallet Tracker...');
    
    // Load developers to track
    await this.loadDevelopersToTrack();
    
    // Connect to Helius WebSocket
    this.connect();
    
    // Refresh tracked wallets every 10 minutes
    setInterval(() => this.loadDevelopersToTrack(), 10 * 60 * 1000);
  }

  /**
   * Load developers with migrations to track
   */
  async loadDevelopersToTrack() {
    try {
      const developers = await getAllDevelopers(10000, 0); // Get all developers
      const walletsToTrack = developers
        .filter(dev => dev.migration_count > 0)
        .map(dev => dev.address);
      
      this.trackedWallets = new Set(walletsToTrack);
      
      console.log(`📋 Tracking ${this.trackedWallets.size} developer wallets with migrations`);
      
      // If already connected, update subscription
      if (this.isConnected) {
        this.subscribe();
      }
    } catch (error) {
      console.error('❌ Error loading developers to track:', error.message);
    }
  }

  /**
   * Connect to Helius WebSocket
   */
  connect() {
    try {
      // Extract API key from Helius RPC URL
      const apiKey = this.extractApiKey(config.helius.rpcUrl);
      
      if (!apiKey) {
        console.error('❌ Cannot extract Helius API key from RPC URL');
        return;
      }

      const wsUrl = `wss://atlas-mainnet.helius-rpc.com/?api-key=${apiKey}`;
      
      console.log('🔌 Connecting to Helius WebSocket...');
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('✅ Connected to Helius WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.subscribe();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        this.isConnected = false;
      });

      this.ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        this.isConnected = false;
        this.reconnect();
      });

    } catch (error) {
      console.error('❌ Error connecting to WebSocket:', error.message);
      this.reconnect();
    }
  }

  /**
   * Extract API key from Helius RPC URL
   */
  extractApiKey(url) {
    try {
      const match = url.match(/api-key=([^&]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Subscribe to wallet transactions
   */
  subscribe() {
    if (!this.ws || !this.isConnected || this.trackedWallets.size === 0) {
      return;
    }

    // Subscribe to all tracked wallets
    // Note: Helius has a limit on subscriptions, so we batch them
    const wallets = Array.from(this.trackedWallets);
    
    console.log(`📡 Subscribing to ${wallets.length} wallets...`);

    // Helius transactionSubscribe for account activity
    const subscribeMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'transactionSubscribe',
      params: [
        {
          accountInclude: wallets,
          accountRequired: wallets,
        },
        {
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          transactionDetails: 'full',
          showRewards: false,
          maxSupportedTransactionVersion: 0,
        },
      ],
    };

    try {
      this.ws.send(JSON.stringify(subscribeMessage));
      console.log('✅ Subscription request sent');
    } catch (error) {
      console.error('❌ Error subscribing:', error.message);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());

      // Handle subscription confirmation
      if (message.result && message.id === 1) {
        console.log('✅ Subscription confirmed:', message.result);
        return;
      }

      // Handle transaction notifications
      if (message.method === 'transactionNotification') {
        await this.handleTransaction(message.params);
      }

    } catch (error) {
      console.error('❌ Error handling message:', error.message);
    }
  }

  /**
   * Handle transaction notification
   */
  async handleTransaction(params) {
    try {
      const { result } = params;
      const { transaction } = result;

      // Extract account keys (wallets involved)
      const accountKeys = transaction?.transaction?.message?.accountKeys || [];
      
      // Check if any tracked wallet is involved
      for (const account of accountKeys) {
        const wallet = account.pubkey || account;
        
        if (this.trackedWallets.has(wallet)) {
          console.log(`\n🚨 INSTANT ALERT: Transaction detected for tracked wallet ${wallet.slice(0, 8)}...`);
          
          // Check if this is a Pump.fun token creation
          // (You can add more sophisticated detection here)
          await this.checkForNewToken(wallet);
          break;
        }
      }

    } catch (error) {
      console.error('❌ Error handling transaction:', error.message);
    }
  }

  /**
   * Check if wallet created a new token
   */
  async checkForNewToken(wallet) {
    try {
      // Fetch latest coins from this developer via Pump.fun API
      const response = await fetch(
        `${config.pumpfun.apiUrl}/coins/user-created-coins/${wallet}?limit=1&offset=0`
      );

      if (!response.ok) {
        return;
      }

      const coins = await response.json();
      
      if (coins && coins.length > 0) {
        const latestCoin = coins[0];
        
        // Check if this is a very recent coin (within last 30 seconds)
        const now = Date.now();
        const coinAge = now - latestCoin.created_timestamp;
        
        if (coinAge < 30000) { // Less than 30 seconds old
          console.log(`🎯 NEW TOKEN DETECTED: ${latestCoin.symbol} by ${wallet.slice(0, 8)}...`);
          
          // Get developer stats
          const developer = await getDeveloperByAddress(wallet);
          
          if (developer && developer.migration_count > 0) {
            // Create alert
            await createAlert(latestCoin.mint, wallet);
            
            console.log(`✅ Alert created for ${latestCoin.symbol}`);
            console.log(`   Developer: ${developer.migration_count} migrations (${developer.migration_rate}%)`);
          }
        }
      }

    } catch (error) {
      console.error('❌ Error checking for new token:', error.message);
    }
  }

  /**
   * Reconnect to WebSocket
   */
  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`🔄 Reconnecting in ${delay / 1000}s... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Stop tracking
   */
  stop() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    console.log('🛑 Wallet tracker stopped');
  }
}

// Export singleton instance
export const walletTracker = new WalletTracker();
