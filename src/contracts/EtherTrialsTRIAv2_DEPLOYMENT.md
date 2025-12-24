# EtherTrials TRIA v2 - Deployment Guide

## 📋 Overview

**Comprehensive tournament system with:**
- 🎮 FID-based tournament entries (0.00001 - 1 ETH)
- ⚖️ Weighted reward system (fair distribution based on entry + skill)
- 🎲 Mini games (Ether Dice & Ether Spin)
- 💎 Lucky Burst mechanic (1:500 chance for 0.001 ETH)
- 🔄 Buyback mechanism for $TRIA redistribution
- 💰 Multi-pool system (prize, buyback, treasury, mini games)

---

## 🚀 Prerequisites

1. **$TRIA Token Address** - Already deployed via Clanker
2. **Uniswap V2 Router on Base** - `0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24` (BaseSwap)
3. **Backend Server Address** - For score submission
4. **Liquidity Pool** - TRIA/WETH must have sufficient liquidity

---

## 📦 Deployment Steps

### 1. Deploy Contract

```bash
# Install dependencies
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Create deployment script: scripts/deploy-tria-v2.js
```

```javascript
// scripts/deploy-tria-v2.js
const hre = require("hardhat");

async function main() {
  const TRIA_TOKEN = "0xYOUR_TRIA_TOKEN_ADDRESS"; // From Clanker
  const UNISWAP_ROUTER = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"; // BaseSwap on Base
  const BACKEND_SERVER = "0xYOUR_BACKEND_ADDRESS";

  console.log("Deploying EtherTrialsTRIAv2...");

  const EtherTrials = await hre.ethers.getContractFactory("EtherTrialsTRIAv2");
  const contract = await EtherTrials.deploy(
    TRIA_TOKEN,
    UNISWAP_ROUTER,
    BACKEND_SERVER
  );

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ EtherTrialsTRIAv2 deployed to:", address);
  console.log("🔗 Verify on BaseScan:", `https://basescan.org/address/${address}`);

  // Verify constructor args for Etherscan
  console.log("\n📝 Constructor args for verification:");
  console.log(JSON.stringify([TRIA_TOKEN, UNISWAP_ROUTER, BACKEND_SERVER]));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### 2. Deploy to Base

```bash
npx hardhat run scripts/deploy-tria-v2.js --network base
```

### 3. Verify on BaseScan

```bash
npx hardhat verify --network base DEPLOYED_CONTRACT_ADDRESS "TRIA_TOKEN" "UNISWAP_ROUTER" "BACKEND_SERVER"
```

---

## 🎯 Post-Deployment Setup

### Update Frontend ABI File

1. Open `src/lib/contracts/etherTrialsTRIAABI.ts`
2. Replace contract address:

```typescript
export const CONTRACT_ADDRESSES = {
  base: {
    etherTrialsTRIAv2: '0xYOUR_DEPLOYED_CONTRACT', // <-- UPDATE THIS
    triaToken: '0xYOUR_TRIA_TOKEN_FROM_CLANKER',
    uniswapRouter: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
  }
}
```

---

## 📊 Token Economics Breakdown

### Tournament Entry (0.00001 - 1 ETH)

**All ETH converted to $TRIA:**
- 80% → Prize Pool (in $TRIA)
- 10% → Buyback Pool (owner withdrawable for redistribution)
- 5% → Treasury (ETH kept, owner withdrawable)
- 5% → Mini Games Pool

**Example: 1 ETH Entry**
```
1 ETH → Swap 0.9 ETH to TRIA (90%)
├─ 0.80 ETH worth of TRIA → Prize Pool
├─ 0.10 ETH worth of TRIA → Buyback (owner can withdraw)
├─ 0.05 ETH → Treasury (stays as ETH)
└─ 0.05 ETH → Mini Games (stays as ETH)
```

### Mini Games (0.00001 ETH fixed)

- 60% → Instant prizes (ETH or $TRIA equivalent)
- 15% → Buyback $TRIA (owner withdrawable)
- 20% → Inject to main prize pool (as $TRIA)
- 5% → Maintenance (ETH, owner withdrawable)

**Lucky Burst:**
- 10% of mini game prizes → Lucky Burst pool
- 1:500 chance (configurable by owner)
- Minimum 0.001 ETH prize

---

## 🎮 Weighted Reward System

**How it works:**
- Entry weight = `(entry_amount / MIN_ENTRY) * 1e18`
- Weighted score = `user_score * entry_weight`
- Reward = `(weighted_score / total_weighted_score) * prize_pool`

**Example:**
```
Player A: 0.00001 ETH, score 1000
  Weight: 1e18
  Weighted score: 1000 * 1e18 = 1000e18

Player B: 1 ETH, score 1000
  Weight: 100,000e18
  Weighted score: 1000 * 100,000e18 = 100,000,000e18

Prize split:
  Player A: 0.001% of pool
  Player B: 99.999% of pool
```

**This ensures fairness:**
- Whales who pay more get proportionally more rewards
- Skill still matters (score multiplier)
- Small players can still compete in their tier

---

## 🔐 Owner Functions

### Withdraw Buyback $TRIA
```solidity
withdrawBuyback()
```
- Withdraws all buyback $TRIA from tournament + mini games
- Use for: giveaways, incentives, add to prize pool

### Inject $TRIA to Prize Pool
```solidity
injectTRIAToPrizePool(uint256 amount)
```
- Add $TRIA from buyback to current period prize pool
- Use for: boosting tournaments, marketing events

### Withdraw Treasury
```solidity
withdrawTreasury()
```
- Withdraws ETH treasury (5% of entries)
- Use for: operational costs, development

### Withdraw Mini Maintenance
```solidity
withdrawMiniMaintenance()
```
- Withdraws mini game maintenance (5% of mini entries)
- Use for: server costs, game development

### Set Lucky Burst Chance
```solidity
setLuckyBurstChance(uint256 newChance)
```
- Default: 500 (1:500)
- Can set to 1000 (1:1000) or any value

---

## 🎲 Mini Games Usage

### Frontend Integration

```typescript
// Play Dice
const result = await contract.playDice(fid, { value: parseEther("0.00001") });

// Play Spin
const result = await contract.playSpin(fid, { value: parseEther("0.00001") });

// Result structure
interface MiniGameResult {
  isWin: boolean;
  prizeAmount: bigint;
  isLuckyBurst: boolean;
  isTRIA: boolean; // Currently always false (ETH prizes)
}
```

### Event Monitoring

```typescript
// Listen for wins
contract.on("MiniGamePlayed", (fid, gameType, isWin, prize, isLuckyBurst) => {
  if (isLuckyBurst) {
    console.log(`🎉 LUCKY BURST! ${ethers.formatEther(prize)} ETH`);
  } else if (isWin) {
    console.log(`✅ Win! ${ethers.formatEther(prize)} ETH`);
  }
});
```

---

## ⚠️ Important Notes

### 1. FID Entry Limit
- **1 FID = 1 entry per 24-hour period**
- Once entered, cannot enter again until period ends
- Entry opens immediately when new period starts

### 2. Wallet Management
- **Max 3 wallets per FID**
- 7-day cooldown between adding wallets
- Must keep at least 1 wallet approved
- Any approved wallet can claim rewards

### 3. Prize Distribution
- Period must be finalized (after 24 hours)
- Backend submits scores during period
- Weighted rewards calculated on finalization
- Users claim manually for all periods

### 4. Mini Game Limits
- 1-second cooldown between plays (anti-spam)
- Must pay exactly 0.00001 ETH
- Lucky burst requires minimum balance in pool

---

## 🧪 Testing Checklist

- [ ] Deploy to Base testnet first
- [ ] Test tournament entry with various amounts (0.00001 - 1 ETH)
- [ ] Verify $TRIA swap works (check liquidity)
- [ ] Test wallet management (add/remove, max 3)
- [ ] Test score submission (backend)
- [ ] Test period finalization
- [ ] Test reward claims (weighted correctly)
- [ ] Test mini games (dice & spin)
- [ ] Test lucky burst (adjust chance to 2 for testing)
- [ ] Test owner withdrawals (buyback, treasury, maintenance)
- [ ] Verify all balances track correctly
- [ ] Load test with multiple concurrent players

---

## 📞 Support

**Contract Address (after deployment):** `0x...`  
**BaseScan:** `https://basescan.org/address/0x...`  
**TRIA Token:** `0x...` (from Clanker)

**Questions?**
- Check events on BaseScan for debugging
- Monitor balances with `getBalances()` view function
- Use `getPeriodInfo()` to check current period state
