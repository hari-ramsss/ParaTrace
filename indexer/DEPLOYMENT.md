# ParaTrace Indexer Deployment Guide (Free Options)

## 🎯 Option 1: Render (Recommended - Easiest)

### Step 1: Push to GitHub
```bash
cd ~/ParaTrace
git add .
git commit -m "Add deployment configs"
git push origin main
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com) and sign up (free, no credit card)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Render will detect `render.yaml` automatically
5. Add environment variables:
   - `RPC_WS_URL` - Your Westend Relay WebSocket URL
   - `ASSET_HUB_WSS` - Asset Hub WebSocket URL
   - `EVM_RPC_URL` - EVM RPC endpoint (e.g., Moonbeam)
   - `REGISTRY_ADDRESS` - Your deployed contract address
   - `PRIVATE_KEY` - Indexer wallet private key
6. Click **"Create Web Service"**

### Step 3: Keep It Alive (Prevent Spin-Down)

Render free tier spins down after 15 minutes. To prevent this, use **UptimeRobot** (free):

1. Go to [uptimerobot.com](https://uptimerobot.com) and sign up
2. Click **"Add New Monitor"**
3. Settings:
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `ParaTrace Indexer`
   - URL: `https://paratrace-indexer.onrender.com/health` (your Render URL)
   - Monitoring Interval: **5 minutes**
4. Click **Create Monitor**

✅ Your indexer will now stay alive 24/7!

---

## 🎯 Option 2: Oracle Cloud Free Tier (Best Long-Term)

### Requirements
- Oracle account (requires credit card for verification, but won't charge)
- More technical setup

### Step 1: Create Free Tier VM
1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)
2. Go to **Compute** → **Instances** → **Create Instance**
3. Choose **Always Free Eligible** shape:
   - VM.Standard.E2.1.Micro (1 CPU, 1GB RAM)
   - Oracle Linux or Ubuntu
4. Download SSH key for access

### Step 2: Set Up Node.js on VM
```bash
# SSH into your VM
ssh -i your-key.pem ubuntu@<your-vm-ip>

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Clone your repo
git clone https://github.com/yourusername/ParaTrace.git
cd ParaTrace/indexer

# Install dependencies
npm install

# Create .env file
nano .env
# (paste your environment variables)
```

### Step 3: Run with PM2 (Process Manager)
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start indexer
pm2 start src/index.js --name paratrace-indexer

# Make it start on boot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs paratrace-indexer
```

✅ Your indexer will now run 24/7 on Oracle Cloud forever free!

---

## 🎯 Option 3: Self-Host on Your Computer

### Requirements
- Old laptop/PC you can leave running
- Stable internet connection

### Step 1: Install Node.js
Download from [nodejs.org](https://nodejs.org) (v18 or v20 recommended)

### Step 2: Run Indexer
```bash
cd ~/ParaTrace/indexer
npm install
cp .env.example .env
# Edit .env with your values
npm start
```

### Step 3: Keep it Running (Optional)
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name paratrace
pm2 startup
pm2 save
```

✅ Your indexer runs on your own hardware!

---

## 🔥 Quick Comparison

| Platform | Cost | 24/7 Uptime | Setup Difficulty | Best For |
|----------|------|-------------|------------------|----------|
| **Render + UptimeRobot** | Free | ✅ Yes (with keepalive) | ⭐️ Easy | Quick start |
| **Oracle Cloud** | Free Forever | ✅ Yes | ⭐️⭐️⭐️ Medium | Production |
| **Self-Host** | Free (electricity) | ✅ Yes | ⭐️⭐️ Medium | Testing/Development |

---

## 📊 Monitoring Your Indexer

After deployment, check:
- Health endpoint: `https://your-url.com/health`
- Logs: Check Render dashboard or `pm2 logs`
- Contract events: Verify transactions are being recorded on-chain

---

## 🆘 Troubleshooting

### Indexer keeps crashing
- Check environment variables are set correctly
- Verify RPC URLs are accessible
- Check private key has enough gas for transactions

### No events being indexed
- Verify WebSocket connections to Polkadot/Asset Hub
- Check contract address is correct
- Ensure indexer wallet is contract owner

### Render service spinning down
- Verify UptimeRobot monitor is active
- Check monitor interval is ≤5 minutes
- Confirm health endpoint returns 200 OK

---

Need help? Check logs first, then review your configuration!
