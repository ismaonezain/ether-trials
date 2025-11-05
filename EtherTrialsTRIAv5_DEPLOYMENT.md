# 🚀 EtherTrials TRIA v5 - Deployment Guide

## 📋 Overview

**Contract v5 - SIMPLIFIED & FIXED**

Major improvements over v4:
- ✅ **Simplified FID System** - Auto-add first wallet, no approval needed
- ✅ **Fixed Period Timing** - Guaranteed countdown works  
- ✅ **Removed Mini Games** - Focus on tournament only
- ✅ **Optimized RPC** - Reduced from 13 to 3-4 contract calls
- ✅ **Clear Period Status** - Easy to see if started or not
- ✅ **One-Call Data Fetch** - `getPeriodInfo()` and `getUserInfo()` return everything

---

## 🎯 Contract Features

### **Core Features**
- ✅ Variable ETH entry (0.00001 - 1 ETH)
- ✅ Auto-swap to TRIA via Uniswap V2
- ✅ Commit-reveal anti-cheat system
- ✅ Weighted rewards (higher entry = higher rewards)
- ✅ 24-hour periods with auto-start new period
- ✅ Multi-period claim support

### **Allocations**
- 85% → Prize Pool (TRIA)
- 10% → Buyback (TRIA)
- 5% → Treasury (ETH)

### **Removed from v4**
- ❌ Mini games (dice, spin)
- ❌ Wallet approval system (simplified to auto-add)
- ❌ Lucky burst mechanics
- ❌ Complex multi-wallet per FID

---

## 📝 Deployment Steps

### **1. Prerequisites**

```bash
# Install dependencies (if not already installed)
npm install

# Ensure you have:
# - Private key with Base ETH
# - TRIA token address on Base
# - Uniswap V2 Router address on Base
```

### **2. Contract Constructor Parameters**

```solidity
constructor(
    address _triaToken,      // TRIA token address on Base
    address _uniswapRouter   // Uniswap V2 Router on Base
)
```

**Base Mainnet Addresses:**
```
TRIA Token: [TO BE DEPLOYED]
Uniswap V2 Router: 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
```

### **3. Deploy via Remix**

1. Open [Remix IDE](https://remix.ethereum.org/)
2. Create new file: `EtherTrialsTRIAv5_Simple.sol`
3. Copy contract code from `src/contracts/EtherTrialsTRIAv5_Simple.sol`
4. Compile with Solidity 0.8.20+
5. Deploy with parameters:
   - `_triaToken`: TRIA token address
   - `_uniswapRouter`: Uniswap V2 Router address
6. **IMPORTANT:** Save deployed contract address!

### **4. Update Contract Address in Code**

Edit `src/lib/contracts/etherTrialsTRIAv5ABI.ts`:

```typescript
export const CONTRACT_ADDRESSES_V5 = {
  base: {
    etherTrialsTRIAv5: '0xYOUR_DEPLOYED_CONTRACT_ADDRESS' as Address,
  },
} as const;
```

### **5. Verify Contract (Optional but Recommended)**

```bash
# On Base Etherscan
# 1. Go to contract address on Base Etherscan
# 2. Click "Verify and Publish"
# 3. Select compiler version 0.8.20
# 4. Paste contract code
# 5. Add constructor arguments (ABI-encoded)
```

---

## 🧪 Testing Steps

### **1. Test Tournament Entry**

```bash
# From frontend:
# 1. Connect wallet
# 2. Click "Enter the Trials"
# 3. Select "Prize Pool Mode"
# 4. Enter amount (0.00001 - 1 ETH)
# 5. Confirm transaction
# 6. Check Period Info component shows:
#    - Status: "Active Now" (if period started)
#    - Status: "Not Started Yet" (if before startTime)
#    - TRIA Pool increased
#    - Participant count increased
```

### **2. Test Score Commit**

```bash
# After playing game:
# 1. Click "Commit Score" button
# 2. Confirm transaction
# 3. Wait for confirmation
# 4. Check localStorage for stored commit data
```

### **3. Test Score Reveal**

```bash
# Within 10 minutes of commit:
# 1. Click "Reveal Score" button
# 2. Confirm transaction
# 3. Check score is revealed on leaderboard
```

### **4. Test Period Finalization**

```bash
# After 24 hours:
# 1. Admin opens Admin Panel
# 2. Click "Finalize Period #N"
# 3. Confirm transaction
# 4. New period starts automatically
# 5. Check Period Info shows new period number
```

### **5. Test Rewards Claim**

```bash
# After period finalized:
# 1. Click "Claim Your Spoils"
# 2. Click "Claim All TRIA"
# 3. Confirm transaction
# 4. Check TRIA balance increased
```

---

## 📊 Key Contract Functions

### **For Users**

```solidity
// Enter tournament (auto-add wallet on first entry)
function enterTournament(uint256 fid) external payable

// Commit score (anti-cheat step 1)
function commitScore(uint256 period, uint256 fid, bytes32 commitHash) external

// Reveal score (anti-cheat step 2)
function revealScore(uint256 period, uint256 fid, uint256 score, uint256 nonce, uint256 timestamp) external

// Claim all rewards across all periods
function claimAllRewards(uint256 fid) external
```

### **For Admin**

```solidity
// Finalize period (starts new period)
function finalizePeriod(uint256 period) external

// Withdraw buyback TRIA
function withdrawBuyback() external onlyOwner

// Withdraw treasury ETH
function withdrawTreasury() external onlyOwner

// Inject TRIA to current period
function injectTRIAToPrizePool(uint256 amount) external onlyOwner
```

### **View Functions (Optimized!)**

```solidity
// Get complete period info (ALL IN ONE CALL!)
function getPeriodInfo(uint256 period) external view returns (
    uint256 startTime,
    uint256 endTime,
    uint256 triaPool,
    bool finalized,
    uint256 totalWeightedScore,
    uint256 participantCount,
    uint256 timeRemaining,
    string memory status
)

// Get complete user info (ALL IN ONE CALL!)
function getUserInfo(uint256 period, uint256 fid) external view returns (
    bool hasEntered,
    uint256 entryAmountETH,
    uint256 entryWeight,
    address wallet,
    bool hasCommitted,
    bool hasRevealed,
    uint256 score,
    bool hasClaimed,
    uint256 claimedAmount,
    uint256 pendingReward
)
```

---

## 🔍 Troubleshooting

### **Issue: "Period Not Started Yet" but no countdown**

**Solution:** Check `periodInfo.startTime` - if it's in the future, the countdown component will show "Period starts in: [time]"

### **Issue: Countdown not updating**

**Solution:** Fixed in v5! Countdown now uses local state that decrements every second. Refresh page to resync with blockchain time.

### **Issue: "Loading Tournament..." stuck**

**Solution:** Check wallet is connected and contract address is correct in `etherTrialsTRIAv5ABI.ts`

### **Issue: RPC errors or "Too many requests"**

**Solution:** v5 reduced RPC calls from 13 to 3-4! Should not happen anymore. If it does, check your RPC provider limits.

---

## 📈 Improvements Over v4

| Feature | v4 | v5 | Improvement |
|---------|----|----|-------------|
| **RPC Calls** | 13 calls | 3-4 calls | 70% reduction |
| **FID System** | Complex approval | Auto-add | Simplified |
| **Period Status** | Hard to see | Clear badges | User-friendly |
| **Countdown** | Sometimes stuck | Guaranteed works | Fixed |
| **Mini Games** | Included | Removed | Focus on core |
| **Data Fetch** | Multiple calls | Single call | Optimized |

---

## ✅ Post-Deployment Checklist

- [ ] Contract deployed and verified
- [ ] Contract address updated in `etherTrialsTRIAv5ABI.ts`
- [ ] Test tournament entry with 0.00001 ETH
- [ ] Check Period Info displays correctly
- [ ] Test score commit and reveal
- [ ] Verify countdown timer works
- [ ] Test period finalization (after 24h)
- [ ] Test rewards claim
- [ ] Monitor contract on Base Etherscan

---

## 🎉 Done!

Contract v5 is now deployed and ready for use! The simplified design should eliminate most of the issues from v4 while maintaining all core functionality.

**Next Steps:**
1. Deploy TRIA token (if not already deployed)
2. Add liquidity to Uniswap V2 (WETH/TRIA pair)
3. Announce tournament to users
4. Monitor first period closely

Good luck! 🚀
