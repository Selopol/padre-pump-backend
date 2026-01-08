# Deployment Guide - Padre Pump.fun Backend

Complete guide for deploying the 24/7 backend service.

---

## Quick Start (Docker)

### Prerequisites
- Docker and Docker Compose installed
- At least 2GB RAM
- 10GB disk space

### Steps

1. **Clone or copy the backend folder to your server**

2. **Create .env file** (optional, docker-compose has defaults)
```bash
cd backend
cp config/README.md .env
# Edit .env with your settings
```

3. **Start services**
```bash
docker-compose up -d
```

4. **Check logs**
```bash
docker-compose logs -f backend
```

5. **Verify it's running**
```bash
curl http://localhost:3001/api/health
```

6. **Stop services**
```bash
docker-compose down
```

---

## Deployment Options

### Option 1: Docker on VPS (Recommended)

**Best for:** Production deployment, easy management, scalability

**Providers:**
- **Hetzner** (€4.51/month) - Best value
- **DigitalOcean** ($6/month)
- **Vultr** ($6/month)
- **Linode** ($5/month)

**Steps:**

1. **Get a VPS**
   - Ubuntu 22.04 or later
   - 2GB RAM minimum
   - 20GB disk

2. **Install Docker**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

3. **Upload backend folder**
```bash
# On your local machine
scp -r backend user@your-server-ip:/home/user/
```

4. **SSH into server and start**
```bash
ssh user@your-server-ip
cd backend
docker-compose up -d
```

5. **Enable auto-start on reboot**
```bash
docker update --restart unless-stopped padre-pump-backend
docker update --restart unless-stopped padre-pump-db
```

---

### Option 2: Railway.app (Free Tier)

**Best for:** Testing, MVP, no credit card needed

**Steps:**

1. **Create Railway account** at https://railway.app

2. **Create new project** → "Deploy from GitHub"

3. **Connect your repository**

4. **Add PostgreSQL service**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will auto-configure DATABASE_URL

5. **Configure backend service**
   - Add environment variables:
     ```
     HELIUS_RPC_URL=your-helius-url
     HISTORICAL_SCAN_ENABLED=true
     REALTIME_MONITOR_ENABLED=true
     ```

6. **Deploy**
   - Railway auto-deploys on git push
   - Get public URL from Railway dashboard

7. **Update Chrome extension**
   - Change API_BASE_URL in `extension/src/api-client.js`
   - Replace `http://localhost:3001/api` with Railway URL

**Free Tier Limits:**
- 500 hours/month execution time
- $5 credit/month
- Good for testing and low traffic

---

### Option 3: Manual Installation (No Docker)

**Best for:** Custom setups, existing infrastructure

**Prerequisites:**
- Node.js 22+
- PostgreSQL 16+
- PM2 (process manager)

**Steps:**

1. **Install PostgreSQL**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

2. **Create database**
```bash
sudo -u postgres psql
CREATE DATABASE padre_pump;
CREATE USER padre_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE padre_pump TO padre_user;
\q
```

3. **Install Node.js 22**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

4. **Install PM2**
```bash
sudo npm install -g pm2
```

5. **Setup backend**
```bash
cd backend
npm install
```

6. **Create .env file**
```bash
cat > .env << EOF
DATABASE_URL=postgresql://padre_user:your_password@localhost:5432/padre_pump
DB_HOST=localhost
DB_PORT=5432
DB_NAME=padre_pump
DB_USER=padre_user
DB_PASSWORD=your_password
HELIUS_RPC_URL=your-helius-url
PORT=3001
NODE_ENV=production
HISTORICAL_SCAN_ENABLED=true
REALTIME_MONITOR_ENABLED=true
EOF
```

7. **Run database migration**
```bash
npm run migrate
```

8. **Start with PM2**
```bash
pm2 start src/index.js --name padre-pump-backend
pm2 save
pm2 startup
```

9. **Check status**
```bash
pm2 status
pm2 logs padre-pump-backend
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `HELIUS_RPC_URL` | Helius RPC endpoint with API key | Required |
| `PORT` | API server port | 3001 |
| `NODE_ENV` | Environment (development/production) | development |
| `HISTORICAL_SCAN_ENABLED` | Run initial scan on startup | true |
| `HISTORICAL_SCAN_LIMIT` | Max coins to scan initially | 10000 |
| `REALTIME_MONITOR_ENABLED` | Enable real-time monitoring | true |
| `SCAN_INTERVAL_MS` | New coin check interval | 10000 (10s) |
| `MIGRATION_SCAN_INTERVAL_MS` | Migration check interval | 60000 (60s) |
| `CORS_ORIGIN` | CORS allowed origins | * |

### Performance Tuning

**For high traffic:**
```env
SCAN_INTERVAL_MS=5000          # Check every 5s
HISTORICAL_SCAN_LIMIT=50000    # Scan more coins
API_RATE_LIMIT=1000            # Higher rate limit
```

**For low resources:**
```env
SCAN_INTERVAL_MS=30000         # Check every 30s
HISTORICAL_SCAN_LIMIT=5000     # Scan fewer coins
API_RATE_LIMIT=50              # Lower rate limit
```

---

## Monitoring

### Health Check

```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "success": true,
  "status": "healthy",
  "database": "connected",
  "stats": {
    "totalDevelopers": 897,
    "totalCoins": 12543,
    "totalMigrations": 1234
  }
}
```

### Logs

**Docker:**
```bash
docker-compose logs -f backend
docker-compose logs -f postgres
```

**PM2:**
```bash
pm2 logs padre-pump-backend
pm2 monit
```

### System Stats

```bash
curl http://localhost:3001/api/stats
```

---

## Updating Chrome Extension

After deploying backend, update the extension:

1. **Edit `extension/src/api-client.js`**
```javascript
// Change this line:
const API_BASE_URL = 'http://localhost:3001/api';

// To your deployed URL:
const API_BASE_URL = 'https://your-domain.com/api';
```

2. **Reload extension in Chrome**
   - Go to `chrome://extensions`
   - Click "Reload" on Padre Pump Extension

---

## Backup & Restore

### Backup Database

**Docker:**
```bash
docker exec padre-pump-db pg_dump -U postgres padre_pump > backup.sql
```

**Manual:**
```bash
pg_dump -U padre_user padre_pump > backup.sql
```

### Restore Database

**Docker:**
```bash
docker exec -i padre-pump-db psql -U postgres padre_pump < backup.sql
```

**Manual:**
```bash
psql -U padre_user padre_pump < backup.sql
```

### Automated Backups

Add to crontab:
```bash
# Backup every day at 2 AM
0 2 * * * docker exec padre-pump-db pg_dump -U postgres padre_pump > /backups/padre_pump_$(date +\%Y\%m\%d).sql
```

---

## Troubleshooting

### Backend won't start

1. **Check logs:**
```bash
docker-compose logs backend
```

2. **Verify database connection:**
```bash
docker-compose exec postgres psql -U postgres -c "SELECT 1"
```

3. **Check ports:**
```bash
netstat -tulpn | grep 3001
```

### Database connection errors

1. **Verify credentials in .env**
2. **Check PostgreSQL is running:**
```bash
docker-compose ps
```

3. **Test connection:**
```bash
docker-compose exec postgres psql -U postgres padre_pump
```

### Extension can't connect

1. **Check backend is running:**
```bash
curl http://localhost:3001/api/health
```

2. **Verify CORS settings** in backend config

3. **Check API_BASE_URL** in extension

### High memory usage

1. **Reduce scan limits** in .env
2. **Increase scan intervals**
3. **Add more RAM to server**

---

## Security

### Production Checklist

- [ ] Change default PostgreSQL password
- [ ] Use strong passwords (20+ characters)
- [ ] Enable firewall (UFW)
- [ ] Use HTTPS (Nginx + Let's Encrypt)
- [ ] Restrict CORS to extension origin only
- [ ] Enable PostgreSQL SSL
- [ ] Regular backups
- [ ] Monitor logs for errors
- [ ] Keep Node.js and dependencies updated

### Firewall Setup

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3001/tcp  # API (or use Nginx reverse proxy)
sudo ufw enable
```

### Nginx Reverse Proxy (Optional)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3001/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Cost Estimates

### VPS Hosting (24/7)

| Provider | Plan | Price | Specs |
|----------|------|-------|-------|
| Hetzner | CPX11 | €4.51/mo | 2 vCPU, 2GB RAM, 40GB SSD |
| DigitalOcean | Basic | $6/mo | 1 vCPU, 1GB RAM, 25GB SSD |
| Vultr | Cloud Compute | $6/mo | 1 vCPU, 1GB RAM, 25GB SSD |

**Recommended:** Hetzner CPX11 (best value)

### Free Options

| Provider | Limits | Good For |
|----------|--------|----------|
| Railway.app | 500 hrs/mo, $5 credit | Testing, MVP |
| Render.com | 750 hrs/mo | Testing |
| Fly.io | 3 VMs free | Small projects |

---

## Scaling

### Horizontal Scaling

1. **Add read replicas** for PostgreSQL
2. **Load balance** multiple backend instances
3. **Use Redis** for caching
4. **Separate scanners** from API server

### Vertical Scaling

1. **Upgrade VPS** to more RAM/CPU
2. **Optimize database** indexes
3. **Increase connection pool** size

---

## Support

For issues or questions:
- Check logs first
- Review this deployment guide
- Test with `curl` commands
- Verify environment variables

---

**Next Steps:**
1. Choose deployment option
2. Deploy backend
3. Update Chrome extension with backend URL
4. Test end-to-end
5. Monitor and enjoy 24/7 tracking!
