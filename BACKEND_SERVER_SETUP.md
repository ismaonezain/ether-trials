# 🖥️ Backend Server Setup Guide

## Overview

The backend server is responsible for **submitting scores** to the smart contract after users complete the main RPG game. This prevents cheating and keeps gas costs manageable.

---

## 🎯 **Purpose**

### Why Backend for Scores?

**Security Reasons:**
- ✅ Prevent client-side score manipulation
- ✅ Verify game completion legitimately
- ✅ Anti-cheat protection

**Cost Reasons:**
- ✅ One backend transaction vs many user transactions
- ✅ Backend pays gas instead of users
- ✅ Bulk score submission possible

---

## 🔧 **Setup Steps**

### 1. Create Backend Wallet

```bash
# Generate new wallet for backend
npx hardhat console --network base

> const wallet = ethers.Wallet.createRandom();
> console.log("Address:", wallet.address);
> console.log("Private Key:", wallet.privateKey);
```

**Save these securely!**
- Address → Will be `BACKEND_SERVER` in contract constructor
- Private Key → Store in backend `.env` file

### 2. Fund Backend Wallet

Backend needs ETH for gas to submit scores:

```bash
# Send ETH to backend wallet (0.1 ETH recommended to start)
cast send <BACKEND_WALLET_ADDRESS> --value 0.1ether --private-key $YOUR_PRIVATE_KEY --rpc-url https://mainnet.base.org
```

**Gas Estimates:**
- `submitScore()`: ~50,000-100,000 gas
- At 0.1 gwei: ~0.000005-0.00001 ETH per submission
- **0.1 ETH** = ~10,000-20,000 score submissions

### 3. Backend Environment

Create `.env` file:

```bash
# Backend .env
BACKEND_PRIVATE_KEY=0xYOUR_BACKEND_WALLET_PRIVATE_KEY
CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
RPC_URL=https://mainnet.base.org
CHAIN_ID=8453
```

---

## 💻 **Backend Implementation**

### Option A: Node.js + Express

```typescript
import express from 'express';
import { ethers } from 'ethers';
import contractABI from './EtherTrialsTRIAv3_ABI.json';

const app = express();
app.use(express.json());

// Setup
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY!, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS!, contractABI, wallet);

// Score submission endpoint
app.post('/api/submit-score', async (req, res) => {
  try {
    const { fid, period, score, gameData } = req.body;
    
    // 1. Verify game data (anti-cheat)
    if (!verifyGameData(gameData)) {
      return res.status(400).json({ error: 'Invalid game data' });
    }
    
    // 2. Verify FID ownership (Farcaster signature)
    if (!verifyFarcasterSignature(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 3. Submit score onchain
    console.log(`Submitting score for FID ${fid}: ${score}`);
    
    const tx = await contract.submitScore(period, fid, score);
    await tx.wait();
    
    console.log(`Score submitted! TX: ${tx.hash}`);
    
    res.json({
      success: true,
      txHash: tx.hash,
      score,
      period,
      fid
    });
    
  } catch (error) {
    console.error('Score submission error:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

// Game verification logic
function verifyGameData(gameData: any): boolean {
  // Implement your anti-cheat logic here
  // Examples:
  // - Verify time taken matches score
  // - Check impossible score values
  // - Verify kill count vs time played
  // - Hash verification of game events
  
  const { score, timePlayed, kills, deaths } = gameData;
  
  // Example: Max score per second
  const maxScorePerSecond = 100;
  if (score / timePlayed > maxScorePerSecond) {
    return false; // Impossible score rate
  }
  
  // Example: Reasonable kill/death ratio
  if (kills > timePlayed * 10) {
    return false; // Too many kills
  }
  
  return true;
}

// Farcaster signature verification
function verifyFarcasterSignature(req: any): boolean {
  // Verify Farcaster Frame signature
  // https://docs.farcaster.xyz/developers/frames/spec#frame-signature-packet
  
  const signature = req.headers['x-farcaster-signature'];
  // Implement signature verification...
  
  return true; // Simplified for example
}

app.listen(3001, () => {
  console.log('Backend server running on port 3001');
});
```

### Option B: Cloudflare Workers (Serverless)

```typescript
import { ethers } from 'ethers';

export default {
  async fetch(request: Request, env: any) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    const { fid, period, score, gameData } = await request.json();
    
    // Setup ethers
    const provider = new ethers.providers.JsonRpcProvider(env.RPC_URL);
    const wallet = new ethers.Wallet(env.BACKEND_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(env.CONTRACT_ADDRESS, ABI, wallet);
    
    // Verify and submit
    if (!verifyGameData(gameData)) {
      return Response.json({ error: 'Invalid game data' }, { status: 400 });
    }
    
    const tx = await contract.submitScore(period, fid, score);
    await tx.wait();
    
    return Response.json({
      success: true,
      txHash: tx.hash
    });
  }
};
```

---

## 🔐 **Security Best Practices**

### 1. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Max 5 score submissions per minute per IP
  message: 'Too many score submissions, please try again later'
});

app.use('/api/submit-score', limiter);
```

### 2. FID Verification

```typescript
// Verify user owns the FID via Farcaster signature
import { verifyFrameSignature } from '@farcaster/frame-node';

async function verifyFID(req: any, fid: number): Promise<boolean> {
  const signature = req.body.trustedData?.messageBytes;
  
  if (!signature) return false;
  
  const result = await verifyFrameSignature(signature);
  
  return result.isValid && result.message.data.fid === fid;
}
```

### 3. Game Data Verification

```typescript
interface GameData {
  score: number;
  timePlayed: number;
  kills: number;
  deaths: number;
  checkpoints: string[]; // Hash of game checkpoints
  seed: string; // Random seed for run
}

function verifyGameData(data: GameData): boolean {
  // 1. Time bounds
  if (data.timePlayed < 10 || data.timePlayed > 3600) {
    return false; // Must play 10s-1hr
  }
  
  // 2. Score bounds
  const maxScore = data.timePlayed * 100; // Max 100 pts/sec
  if (data.score > maxScore) {
    return false;
  }
  
  // 3. Verify checkpoint hashes
  const expectedHash = computeCheckpointHash(data.checkpoints, data.seed);
  if (expectedHash !== data.checkpoints[data.checkpoints.length - 1]) {
    return false;
  }
  
  return true;
}
```

### 4. Prevent Double Submission

```typescript
// In-memory cache (or use Redis for production)
const submittedScores = new Map<string, boolean>();

app.post('/api/submit-score', async (req, res) => {
  const { fid, period } = req.body;
  const key = `${period}-${fid}`;
  
  // Check if already submitted
  if (submittedScores.has(key)) {
    return res.status(400).json({ error: 'Score already submitted for this period' });
  }
  
  // Submit to blockchain
  await contract.submitScore(period, fid, score);
  
  // Mark as submitted
  submittedScores.set(key, true);
  
  res.json({ success: true });
});
```

---

## 📊 **Monitoring & Maintenance**

### Gas Monitoring

```typescript
// Check backend wallet balance
async function checkBackendBalance() {
  const balance = await wallet.getBalance();
  const ethBalance = ethers.utils.formatEther(balance);
  
  console.log(`Backend balance: ${ethBalance} ETH`);
  
  // Alert if low
  if (parseFloat(ethBalance) < 0.01) {
    console.warn('⚠️ Backend wallet balance low! Refill needed.');
    // Send alert email/Telegram/Discord
  }
}

// Run every hour
setInterval(checkBackendBalance, 60 * 60 * 1000);
```

### Transaction Monitoring

```typescript
// Log all score submissions
app.post('/api/submit-score', async (req, res) => {
  const start = Date.now();
  
  try {
    const tx = await contract.submitScore(period, fid, score);
    const receipt = await tx.wait();
    
    const duration = Date.now() - start;
    
    console.log({
      timestamp: new Date().toISOString(),
      fid,
      period,
      score,
      txHash: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
      duration: `${duration}ms`,
      status: 'success'
    });
    
    res.json({ success: true, txHash: tx.hash });
  } catch (error) {
    console.error({
      timestamp: new Date().toISOString(),
      fid,
      period,
      score,
      error: error.message,
      status: 'failed'
    });
    
    res.status(500).json({ error: 'Submission failed' });
  }
});
```

### Database Logging (Optional)

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Log submissions to database
await prisma.scoreSubmission.create({
  data: {
    fid,
    period,
    score,
    txHash: tx.hash,
    gasUsed: receipt.gasUsed.toString(),
    timestamp: new Date(),
    status: 'success'
  }
});
```

---

## 🧪 **Testing**

### Local Testing

```bash
# 1. Start local hardhat node
npx hardhat node

# 2. Deploy contract to local
npx hardhat run scripts/deploy-tria-v3.js --network localhost

# 3. Start backend server
npm run dev

# 4. Test score submission
curl -X POST http://localhost:3001/api/submit-score \
  -H "Content-Type: application/json" \
  -d '{
    "fid": 12345,
    "period": 0,
    "score": 1000,
    "gameData": {
      "timePlayed": 120,
      "kills": 10,
      "deaths": 2
    }
  }'
```

### Testnet Testing

```bash
# 1. Deploy to Base Goerli
npx hardhat run scripts/deploy-tria-v3.js --network baseGoerli

# 2. Update backend .env with testnet RPC
RPC_URL=https://goerli.base.org

# 3. Fund backend wallet with testnet ETH
# Get from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

# 4. Test score submission
curl -X POST https://your-backend.com/api/submit-score \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## 🚀 **Deployment Options**

### Option 1: Traditional Server (VPS)

**Providers:** DigitalOcean, AWS EC2, Linode

**Setup:**
```bash
# 1. SSH into server
ssh user@your-server.com

# 2. Clone backend repo
git clone https://github.com/your-repo/ether-trials-backend.git
cd ether-trials-backend

# 3. Install dependencies
npm install

# 4. Setup environment
cp .env.example .env
nano .env # Edit with your values

# 5. Start with PM2 (process manager)
npm install -g pm2
pm2 start npm --name "ether-trials-backend" -- start
pm2 save
pm2 startup
```

### Option 2: Serverless (Vercel/Cloudflare)

**Vercel:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables
vercel env add BACKEND_PRIVATE_KEY
vercel env add CONTRACT_ADDRESS
vercel env add RPC_URL
```

**Cloudflare Workers:**
```bash
# Install Wrangler
npm i -g wrangler

# Deploy
wrangler publish

# Set secrets
wrangler secret put BACKEND_PRIVATE_KEY
wrangler secret put CONTRACT_ADDRESS
```

### Option 3: Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t ether-trials-backend .
docker run -d -p 3001:3001 --env-file .env ether-trials-backend
```

---

## 📈 **Cost Estimates**

### Infrastructure

| Option | Cost | Pros | Cons |
|--------|------|------|------|
| VPS (DigitalOcean) | $6-12/mo | Full control, simple | Maintenance required |
| Vercel Serverless | $0-20/mo | Auto-scaling, no maintenance | Function timeout limits |
| Cloudflare Workers | $0-5/mo | Very fast, global | 10ms CPU time limit |
| AWS Lambda | Pay per use | Scales infinitely | Complex setup |

### Blockchain Gas

| Activity | Gas | Cost (0.1 gwei) | Cost per 1000 |
|----------|-----|-----------------|---------------|
| Submit Score | 50,000-100,000 | 0.000005-0.00001 ETH | 0.005-0.01 ETH |
| **Backend Wallet Funding** | - | **0.1 ETH recommended** | **~10,000 submissions** |

---

## ✅ **Checklist**

### Before Launch

- [ ] Backend wallet created and funded (0.1 ETH)
- [ ] Backend server deployed and running
- [ ] Environment variables configured
- [ ] Anti-cheat verification implemented
- [ ] Rate limiting enabled
- [ ] FID verification working
- [ ] Monitoring and alerts setup
- [ ] Tested on testnet
- [ ] SSL certificate installed (HTTPS)
- [ ] Backup wallet ready

### Post-Launch Monitoring

- [ ] Check backend balance daily
- [ ] Monitor failed transactions
- [ ] Track submission rate
- [ ] Review anti-cheat logs
- [ ] Verify gas prices acceptable
- [ ] Backup logs regularly

---

## 🆘 **Troubleshooting**

### "Unauthorized" Error

**Problem:** Backend can't submit scores  
**Solution:** 
- Verify backend wallet address matches `backendServer` in contract
- Check private key is correct
- Use `contract.setBackendServer(newAddress)` if needed (owner only)

### "Insufficient Funds" Error

**Problem:** Backend wallet out of ETH  
**Solution:**
- Send more ETH to backend wallet
- Set up auto-refill monitoring

### Slow Submissions

**Problem:** Scores taking too long to submit  
**Solution:**
- Increase gas price: `{ gasPrice: ethers.utils.parseUnits('1', 'gwei') }`
- Use flashbots for faster inclusion
- Batch submissions (future upgrade)

### High Gas Costs

**Problem:** Gas costs higher than expected  
**Solution:**
- Optimize contract (already optimized in v3)
- Submit during low-traffic times
- Consider L2 deployment (Base is already L2!)

---

Built with ❤️ for EtherTrials Backend
