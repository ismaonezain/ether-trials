hahaha
# EtherTrials TRIA Smart Contract

## 📋 Overview

Smart contract untuk Ether Trials tournament system dengan integrasi $TRIA token. Contract ini menggunakan **Farcaster FID** sebagai identifier player dan mendukung **multiple wallets per FID** (max 3).

## 🎯 Key Features

### 1. **FID-Based Entry System**
- Player identified by Farcaster FID, bukan wallet address
- 1 FID = 1 entry per 24-hour period
- FID lebih secure dari Sybil attacks karena storage rent

### 2. **Multi-Wallet Support (Max 3 per FID)**
- Setiap FID bisa approve sampai 3 wallet addresses
- Wallet manapun yang approved bisa claim rewards
- Cooldown 7 hari antara adding wallets (untuk security)
- Minimum 1 wallet harus tetap approved

### 3. **Automatic ETH → TRIA Swap**
- Saat entry, 45% ETH otomatis swap ke $TRIA via Uniswap V2
- 45% tetap sebagai ETH
- 10% platform fee untuk owner
- Slippage protection 2%

### 4. **Period-Based Tournament**
- Each period = 24 hours
- Player ranked by score
- Prize pool distributed to top 10%

### 5. **Flexible Claiming**
- Claim rewards dari any approved wallet
- Bisa claim all periods sekaligus atau per period
- Rewards: TRIA + ETH

## 📦 Contract Parameters

```solidity
MIN_ENTRY = 0.00001 ETH
MAX_ENTRY = 1 ETH
PERIOD_DURATION = 24 hours
TRIA_ALLOCATION = 45%
ETH_ALLOCATION = 45%
PLATFORM_FEE = 10%
MAX_WALLETS_PER_FID = 3
WALLET_ADD_COOLDOWN = 7 days
```

## 🚀 Deployment Steps

### Prerequisites
1. Deploy $TRIA token contract di Base
2. Setup liquidity pool untuk TRIA/WETH di Uniswap V2 (Base)
3. Prepare backend server address untuk submit scores

### Deployment Script

```bash
# Install dependencies
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Create hardhat.config.js
```

**hardhat.config.js:**
```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    base: {
      url: "https://mainnet.base.org",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 8453
    },
    baseGoerli: {
      url: "https://goerli.base.org",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 84531
    }
  }
};
```

**Deploy script (scripts/deploy.js):**
```javascript
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying with account:", deployer.address);
  
  // Base Mainnet addresses
  const TRIA_TOKEN = "0x..."; // Your TRIA token address
  const UNISWAP_ROUTER = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"; // BaseSwap Router
  const BACKEND_SERVER = "0x..."; // Your backend address
  
  const EtherTrialsTRIA = await ethers.getContractFactory("EtherTrialsTRIA");
  const contract = await EtherTrialsTRIA.deploy(
    TRIA_TOKEN,
    UNISWAP_ROUTER,
    BACKEND_SERVER
  );
  
  await contract.waitForDeployment();
  
  console.log("Contract deployed to:", await contract.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

**Deploy command:**
```bash
npx hardhat run scripts/deploy.js --network base
```

## 🔧 Contract Addresses (Base Mainnet)

| Contract | Address |
|----------|---------|
| EtherTrialsTRIA | `TBD` |
| $TRIA Token | `TBD` |
| Uniswap V2 Router | `0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24` |

## 📖 Usage Guide

### 1. **Add Wallet to FID**

Player harus approve wallet dulu sebelum bisa enter tournament:

```typescript
// First wallet - auto approved on first entry
await contract.enterTournament(fid, { value: ethers.parseEther("0.0001") });

// Add additional wallets (max 3 total)
await contract.addWallet(fid, newWalletAddress);
```

**Rules:**
- First wallet: auto-approved saat entry pertama
- Additional wallets: must be called by existing approved wallet
- Max 3 wallets per FID
- 7-day cooldown between adding wallets

### 2. **Enter Tournament**

```typescript
const fid = 12345; // Farcaster FID
const entryAmount = ethers.parseEther("0.0001"); // 0.0001 ETH

await contract.enterTournament(fid, { value: entryAmount });
```

**What happens:**
- ✅ 45% swapped to TRIA → added to TRIA prize pool
- ✅ 45% kept as ETH → added to ETH prize pool
- ✅ 10% taken as platform fee
- ✅ Entry recorded with timestamp

### 3. **Submit Score (Backend Only)**

Backend server submits score after game ends:

```typescript
await contract.submitScore(periodNumber, fid, score);
```

### 4. **Finalize Period**

Anyone can trigger period finalization after 24 hours:

```typescript
await contract.finalizePeriod(periodNumber);
```

**What happens:**
- ✅ All participants ranked by score
- ✅ Prize distribution calculated
- ✅ Next period starts automatically

### 5. **Claim Rewards**

Player bisa claim dari any approved wallet:

```typescript
// Claim all periods
await contract.claimAllRewards(fid);

// Or claim specific period
await contract.claimPeriodRewards(periodNumber, fid);
```

**Requirements:**
- ✅ Must call from approved wallet
- ✅ Period must be finalized
- ✅ FID must have ranking (top 10%)

### 6. **Check Claimable Rewards**

```typescript
const [triaAmount, ethAmount] = await contract.getClaimableRewards(fid);
console.log(`Claimable: ${ethers.formatEther(triaAmount)} TRIA + ${ethers.formatEther(ethAmount)} ETH`);
```

### 7. **View Approved Wallets**

```typescript
const wallets = await contract.getApprovedWallets(fid);
console.log("Approved wallets:", wallets);
```

## 🏆 Prize Distribution

Top 10% players mendapat rewards:

| Rank | TRIA Share | ETH Share |
|------|-----------|----------|
| 1st | 30% | 30% |
| 2nd | 20% | 20% |
| 3rd | 15% | 15% |
| 4th-10% | Split 35% | Split 35% |

**Example:**
- 100 players enter
- Top 10 players get rewards
- Prize pool: 100 TRIA + 1 ETH
- 1st place: 30 TRIA + 0.3 ETH
- 2nd place: 20 TRIA + 0.2 ETH
- 3rd place: 15 TRIA + 0.15 ETH
- 4th-10th: Split 35 TRIA + 0.35 ETH (7 players = ~5 TRIA + 0.05 ETH each)

## 🔒 Security Features

### 1. **Wallet Management Security**
- 7-day cooldown prevents rapid wallet switching
- Minimum 1 wallet required (can't remove all)
- Only approved wallets can add new wallets

### 2. **Sybil Protection**
- FID-based (Farcaster storage rent makes multiple FIDs expensive)
- 1 FID = 1 entry per period
- Social reputation via Farcaster

### 3. **Swap Protection**
- 2% slippage tolerance
- 5-minute deadline for swaps
- Reverts if swap fails

### 4. **Access Control**
- Owner: withdraw platform fees, change backend
- Backend: submit scores only
- Anyone: can finalize periods (trustless)

## 🛠️ Owner Functions

### Withdraw Platform Fees
```typescript
await contract.withdrawPlatformFees();
```

### Update Backend Server
```typescript
await contract.setBackendServer(newBackendAddress);
```

### Transfer Ownership
```typescript
await contract.transferOwnership(newOwnerAddress);
```

## 📊 Events

```solidity
event TournamentEntry(uint256 indexed period, uint256 indexed fid, uint256 amount, uint256 timestamp);
event ScoreSubmitted(uint256 indexed period, uint256 indexed fid, uint256 score, uint256 timestamp);
event PeriodFinalized(uint256 indexed period, uint256 triaPool, uint256 ethPool, uint256 totalParticipants);
event WalletAdded(uint256 indexed fid, address indexed wallet, uint256 totalWallets);
event WalletRemoved(uint256 indexed fid, address indexed wallet);
event RewardsClaimed(uint256 indexed period, uint256 indexed fid, address indexed claimer, uint256 triaAmount, uint256 ethAmount);
event TokenSwapped(uint256 indexed period, uint256 ethAmount, uint256 triaAmount);
event PlatformFeeWithdrawn(address indexed owner, uint256 amount);
```

## ⚠️ Important Notes

### Gas Costs
- Entry with swap: ~200k-300k gas (depending on Uniswap state)
- Add wallet: ~50k gas
- Claim rewards: ~100k-150k gas
- Finalize period: Varies by participant count

### Liquidity Requirements
- Must have sufficient TRIA/WETH liquidity on Base
- Recommend at least 10 ETH liquidity to handle swaps

### Backend Integration
- Backend must monitor game completions
- Submit scores via `submitScore()`
- Can batch submit for efficiency

### Period Finalization
- Can be automated via Chainlink Keepers
- Or triggered by backend cron job
- Or by first player of new period (gas refund incentive)

## 🧪 Testing Checklist

- [ ] Deploy contract on Base Goerli testnet
- [ ] Add test FID with multiple wallets
- [ ] Enter tournament with different amounts
- [ ] Verify swap executed correctly
- [ ] Submit test scores
- [ ] Finalize period
- [ ] Check rankings
- [ ] Claim rewards from different approved wallets
- [ ] Test wallet cooldown
- [ ] Test max 3 wallet limit
- [ ] Test owner functions

## 🔗 Resources

- [Base Network Docs](https://docs.base.org/)
- [Uniswap V2 Docs](https://docs.uniswap.org/contracts/v2/overview)
- [Farcaster FID System](https://docs.farcaster.xyz/)
- [Hardhat Docs](https://hardhat.org/docs)

## 📞 Support

For questions or issues, contact:
- Telegram: @ethertrialsSupport
- Discord: EtherTrials Official
