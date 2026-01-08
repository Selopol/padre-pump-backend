# Railway.app Deployment Guide

Quick guide for deploying Padre Pump.fun Backend on Railway.app

---

## 🚀 Quick Deploy

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose this repository

### Step 3: Add PostgreSQL Database
1. Click "New" → "Database" → "Add PostgreSQL"
2. Railway will automatically create `DATABASE_URL` environment variable

### Step 4: Configure Environment Variables

Railway will auto-detect most settings, but you need to add:

**Required:**
```
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY_HERE
```

**Optional (with defaults):**
```
PORT=3001
NODE_ENV=production
HISTORICAL_SCAN_ENABLED=true
HISTORICAL_SCAN_LIMIT=10000
REALTIME_MONITOR_ENABLED=true
SCAN_INTERVAL_MS=10000
MIGRATION_SCAN_INTERVAL_MS=60000
```

### Step 5: Deploy
1. Railway will automatically deploy
2. Wait for build to complete (~2-3 minutes)
3. Click on service → "Settings" → "Generate Domain" to get public URL

### Step 6: Run Database Migration

**Option A: Use Railway CLI**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Run migration
railway run npm run migrate
```

**Option B: Add to package.json**

The `start` script already includes migration, so it will run automatically on deploy.

---

## 🔧 Environment Variables Explained

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection (auto-created by Railway) | - | ✅ Yes |
| `HELIUS_RPC_URL` | Your Helius RPC endpoint with API key | - | ✅ Yes |
| `PORT` | Server port | 3001 | No |
| `NODE_ENV` | Environment | production | No |
| `HISTORICAL_SCAN_ENABLED` | Run initial scan on startup | true | No |
| `HISTORICAL_SCAN_LIMIT` | Max coins to scan initially | 10000 | No |
| `REALTIME_MONITOR_ENABLED` | Enable real-time monitoring | true | No |
| `SCAN_INTERVAL_MS` | New coin check interval (ms) | 10000 | No |
| `MIGRATION_SCAN_INTERVAL_MS` | Migration check interval (ms) | 60000 | No |

---

## 📊 After Deployment

### Get Your API URL

1. Go to Railway dashboard
2. Click on your service
3. Go to "Settings" tab
4. Click "Generate Domain"
5. Copy the URL (e.g., `https://your-app.railway.app`)

### Update Chrome Extension

Edit `extension/src/api-client.js`:
```javascript
const API_BASE_URL = 'https://your-app.railway.app/api';
```

### Test Deployment

```bash
# Check health
curl https://your-app.railway.app/api/health

# Check stats
curl https://your-app.railway.app/api/stats

# Get developers
curl https://your-app.railway.app/api/developers
```

---

## 🐛 Troubleshooting

### Deployment Failed

**Check logs:**
1. Go to Railway dashboard
2. Click on service
3. View "Deployments" tab
4. Click on failed deployment
5. Read logs

**Common issues:**
- Missing `HELIUS_RPC_URL` environment variable
- Database not connected (wait for PostgreSQL to be ready)
- Port conflicts (Railway auto-assigns port via `PORT` env var)

### Database Connection Error

**Solution:**
1. Make sure PostgreSQL service is running
2. Check `DATABASE_URL` is set automatically by Railway
3. Wait 1-2 minutes for database to initialize

### Migration Not Running

**Run manually:**
```bash
railway run npm run migrate
```

Or check logs to see if it ran automatically.

---

## 💰 Pricing

### Free Tier
- **500 hours/month** execution time
- **$5 credit/month**
- Good for testing and low traffic

### Paid Plans
- **Developer:** $5/month
- **Team:** $20/month
- See https://railway.app/pricing

---

## 📈 Monitoring

### View Logs
1. Railway dashboard → Service → "Deployments"
2. Click on active deployment
3. View real-time logs

### Check Metrics
1. Railway dashboard → Service → "Metrics"
2. View CPU, Memory, Network usage

### Health Check
```bash
curl https://your-app.railway.app/api/health
```

---

## 🔄 Updates

### Auto-Deploy on Git Push

Railway automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "Update backend"
git push origin main
```

Railway will detect changes and redeploy automatically.

---

## 🔐 Security

### Environment Variables
- Never commit `.env` file
- Use Railway's environment variables UI
- Keep `HELIUS_RPC_URL` secret

### Database Backups
Railway doesn't provide automatic backups on free tier. For production:
1. Upgrade to paid plan
2. Or set up manual backups with cron job

---

## 📚 Resources

- **Railway Docs:** https://docs.railway.app
- **Railway CLI:** https://docs.railway.app/develop/cli
- **Railway Discord:** https://discord.gg/railway

---

## ✅ Checklist

- [ ] Created Railway account
- [ ] Deployed from GitHub
- [ ] Added PostgreSQL database
- [ ] Set `HELIUS_RPC_URL` environment variable
- [ ] Generated public domain
- [ ] Ran database migration
- [ ] Tested API endpoints
- [ ] Updated Chrome extension with Railway URL
- [ ] Verified alerts are working

---

**Ready to deploy!** 🚀
