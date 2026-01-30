kotnopl
# EtherTrialsPointBased_v5 Deployment Guide

## 🎯 Contract Overview

**Contract Name:** `EtherTrialsPointBased_v5`  
**Purpose:** Production-ready tournament contract with 100% prize pool distribution  
**Network:** Base Mainnet (or any EVM-compatible chain)

---

## ✨ Key Features

### 1. **100% Prize Pool Distribution**
- **NO PLATFORM FEE** - All entry payments go directly to prize pool
- Players compete for 100% of collected ETH
- Mathematical fairness guaranteed by smart contract

### 2. **Weighted Point System**
```
Points = Score × (Entry Amount / 1e18)
Prize = (Prize Pool × Your Points) / Total Points
```

**Examples:**
- Player A: score=1000, entry=0.0001 ETH → points = 0.1
- Player B: score=500, entry=0.0002 ETH → points = 0.1
- Equal points = Equal prize share!

### 3. **Daily UTC Tournaments**
- 24-hour periods starting at 00:00 UTC
- 20-minute reveal window after period ends
- Automatic period transitions

### 4. **Commit-Reveal Security**
- Phase 1: Commit score hash (hidden)
- Phase 2: Reveal actual score within 20 minutes
- Oracle fallback if players don't reveal

### 5. **Dice Mechanics**
- 3 FREE dice rolls per period
- Paid rolls: exponential pricing (0.00001 × 2^n ETH)
- All dice payments → 100% to prize pool

---

## 🚀 Deployment Steps

### Prerequisites
- Remix IDE: https://remix.ethereum.org
- MetaMask wallet with Base ETH for gas
- Contract source code: `EtherTrialsPointBased_v5.sol`

### Step 1: Open Remix
1. Go to https://remix.ethereum.org
2. Create new file: `EtherTrialsPointBased_v5.sol`
3. Copy entire contract code into the file

### Step 2: Compile Contract
1. Click "Solidity Compiler" tab (left sidebar)
2. Select compiler version: `0.8.20` or higher
3. Enable optimization: 200 runs (recommended)
4. Click "Compile EtherTrialsPointBased_v5.sol"
5. Verify no errors (warnings are OK)

### Step 3: Deploy to Base
1. Click "Deploy & Run Transactions" tab
2. Select Environment: **"Injected Provider - MetaMask"**
3. Ensure MetaMask is connected to **Base Mainnet**
4. Select contract: `EtherTrialsPointBased_v5`
5. Click **"Deploy"**
6. Confirm transaction in MetaMask
7. Wait for confirmation (~2-5 seconds)

### Step 4: Verify Deployment
After deployment, you'll see the contract address in Remix console.

**Important:** Save this address! You'll need it for frontend integration.

Example: `0x1234567890abcdef1234567890abcdef12345678`

---

## 🔍 Contract Verification (Optional but Recommended)

### Verify on BaseScan
1. Go to: https://basescan.org
2. Search for your contract address
3. Click "Contract" tab → "Verify and Publish"
4. Fill in details:
   - Compiler: `v0.8.20+commit.a1b79de6`
   - Optimization: Yes, 200 runs
   - License: MIT
5. Paste contract source code
6. Click "Verify and Publish"

---

## ⚙️ Initial Configuration

### 1. Set Entry Bounds (Optional)
Default values are already set:
- Minimum: 0.00001 ETH
- Maximum: 1 ETH

To change:
```solidity
setEntryBounds(0.00001 ether, 2 ether) // Example: increase max to 2 ETH
```

### 2. Test First Period
The first period starts automatically upon deployment.

Check current period:
```solidity
getCurrentPeriodInfo()
```

Returns:
- period: 1
- prizePoolETH: 0
- totalPoints: 0
- participants: 0
- startTime: deployment timestamp
- endTime: startTime + 24 hours
- distributed: false

---

## 📋 Admin Functions

### Prize Distribution
```solidity
allocatePrizes(periodNumber)
```
- Call after period ends + reveal window (20 min)
- Distributes prizes proportionally to all players
- Automatically starts next period

### Batch Score Submission (Oracle)
```solidity
submitScoresBatch(
    [player1, player2, player3],
    [score1, score2, score3]
)
```
- Useful for players who don't reveal in time
- Owner can submit scores directly

### Emergency Functions
```solidity
emergencyWithdrawETH(address, amount)
```
- Only withdraws ETH NOT allocated to prizes
- Safety mechanism for accidentally sent funds

---

## 🎮 Player Flow

### 1. Enter Tournament
```solidity
enterTournament() payable
```
- Send 0.00001 to 1 ETH
- 100% goes to prize pool
- Gets 3 FREE dice rolls

### 2. Roll Dice (Optional)
```solidity
rollDice() payable
```
- First 3 rolls: FREE
- Paid rolls: exponential pricing
- All payments → prize pool

### 3. Commit Score
```solidity
commitScore(bytes32 hash)
```
- Submit keccak256(score, nonce, address)
- Hides actual score from competitors

### 4. Reveal Score
```solidity
revealScore(score, nonce)
```
- Must reveal within 20 minutes of commit
- Score × Entry Amount = Points
- Points determine prize share

### 5. Claim Prize
```solidity
claimPrize(periodNumber)        // Single period
claimMultiple([1, 2, 3])        // Multiple periods
claimAllForUser()                // All periods
```

---

## 📊 View Functions

### Get Current Period Info
```solidity
getCurrentPeriodInfo()
```
Returns: period, prizePool, totalPoints, participants, times, distributed

### Get Player Info
```solidity
getPlayerInfo(address, period)
```
Returns: hasEntered, score, entryAmount, points, pendingPrize, claimed

### Get Dice Info
```solidity
getDiceInfo(address, period)
```
Returns: freeUsed, paidUsed, freeRemaining, nextPaidPrice

### Get User's All Periods
```solidity
getUserPeriods(address)
```
Returns: array of period numbers user participated in

---

## 🔐 Security Features

### 1. Reentrancy Protection
- All state-changing functions use `nonReentrant` modifier
- Protects against reentrancy attacks

### 2. Overflow Protection
- Solidity 0.8.20+ has built-in overflow checks
- All arithmetic operations are safe

### 3. Access Control
- Owner-only functions for admin operations
- Players can only interact with their own data

### 4. Prize Pool Isolation
- Prize funds are tracked separately
- Cannot be withdrawn as platform fees
- Emergency withdraw cannot touch prize funds

---

## 💡 Testing Checklist

Before going live, test these scenarios:

- [ ] Deploy contract successfully
- [ ] Enter tournament with minimum amount (0.00001 ETH)
- [ ] Enter tournament with maximum amount (1 ETH)
- [ ] Try entering twice (should fail)
- [ ] Roll free dice (3 times)
- [ ] Roll paid dice (check pricing)
- [ ] Commit score hash
- [ ] Reveal score successfully
- [ ] Try revealing after window (should fail)
- [ ] Owner submit score for player
- [ ] Allocate prizes after period ends
- [ ] Claim prize successfully
- [ ] Try claiming twice (should return 0)

---

## 🌐 Frontend Integration

After deployment, update your frontend config:

```typescript
// src/lib/contracts/pointBasedV5Config.ts
export const POINT_BASED_V5_ADDRESS = '0xYOUR_CONTRACT_ADDRESS_HERE';

export const POINT_BASED_V5_ABI = [
  // Copy ABI from Remix after compilation
];
```

---

## 📞 Support & Resources

- **Contract Source:** `src/contracts/EtherTrialsPointBased_v5.sol`
- **Prize Distribution Guide:** `PRIZE_DISTRIBUTION_EXPLAINED.md`
- **Base Network:** https://base.org
- **BaseScan Explorer:** https://basescan.org

---

## 🎉 Key Advantages

1. **Zero Platform Fees** - Players get 100% of prize pool
2. **Fair & Transparent** - All logic on-chain, verifiable
3. **Weighted Scoring** - Rewards both skill (score) and commitment (entry)
4. **Flexible Entry** - Choose your own entry amount (0.00001 to 1 ETH)
5. **Daily Competitions** - New tournament every 24 hours
6. **Secure** - Commit-reveal prevents cheating
7. **Gas Efficient** - Optimized for low transaction costs

---

## 🚨 Important Notes

1. **Test First:** Deploy to Base Sepolia testnet before mainnet
2. **Gas Costs:** Estimate ~$0.10-0.50 per transaction on Base
3. **Oracle Role:** Owner should monitor and submit scores if needed
4. **Period Management:** Call `allocatePrizes()` after each period ends
5. **Player Claims:** Players must claim prizes themselves (not auto-sent)

---

## 📈 Example Tournament Scenario

### Period 1:
- 10 players enter with 0.0001 ETH each
- Prize pool: 10 × 0.0001 = **0.001 ETH** (100% of entries)

### Player Scores:
- Alice: score=1500, entry=0.0001 → points = 0.15
- Bob: score=1000, entry=0.0001 → points = 0.10
- Carol: score=500, entry=0.0001 → points = 0.05
- ... (7 more players)
- Total Points: 1.00

### Prize Distribution:
- Alice: (0.15 / 1.00) × 0.001 = **0.00015 ETH** (15%)
- Bob: (0.10 / 1.00) × 0.001 = **0.0001 ETH** (10%)
- Carol: (0.05 / 1.00) × 0.001 = **0.00005 ETH** (5%)
- ... (remaining 70% split among others)

**Total Distributed: 100% of prize pool** ✅

---

## 🎯 Ready to Deploy!

You now have everything needed to deploy and run EtherTrialsPointBased_v5.

**Next Steps:**
1. Deploy contract to Base Mainnet
2. Verify on BaseScan
3. Update frontend with contract address
4. Test with small amounts first
5. Monitor first few periods
6. Scale up marketing once stable

Good luck! 🚀
