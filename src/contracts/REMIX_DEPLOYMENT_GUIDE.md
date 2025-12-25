# 🎮 EtherTrials TRIA v4 - Remix Deployment Guide

## 📋 Overview

This guide walks you through deploying the EtherTrials TRIA v4 smart contract using **Remix IDE**.

### ✨ Key Features
- ✅ **Player-submitted scores** with commitment scheme (anti-cheat)
- ✅ **Sustainable mini games** - only active when pool >= 0.01 ETH
- ✅ **Proper house edge** - Dice ~40%, Spin ~60%
- ✅ **FID-based entry** (max 3 wallets per FID)
- ✅ **Weighted rewards** - higher entry = higher potential reward
- ✅ **No initial funding needed** - mini games funded by tournament entries (5%)

---

## 🚀 Deployment Steps

### Step 1: Prepare Contract Address

You'll need:
1. **$TRIA Token Address** (from your Clanker deployment)
2. **Uniswap V2 Router Address** on Base:
   - **BaseSwap Router**: `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`
   - Or use official Uniswap V2 if available on Base

### Step 2: Open Remix

1. Go to **https://remix.ethereum.org**
2. Create new file: `EtherTrialsTRIAv4.sol`
3. Copy entire contract code from `src/contracts/EtherTrialsTRIAv4_Sustainable.sol`
4. Paste into Remix

### Step 3: Compile

1. Click **Solidity Compiler** tab (left sidebar)
2. Select compiler version: **0.8.20** or higher
3. Click **Compile EtherTrialsTRIAv4.sol**
4. ✅ Ensure no errors

### Step 4: Connect Wallet

1. Click **Deploy & Run Transactions** tab
2. Environment: Select **"Injected Provider - MetaMask"**
3. Ensure MetaMask is:
   - Connected to **Base network**
   - Has enough ETH for gas (~0.02 ETH should be plenty)

### Step 5: Deploy

1. Contract dropdown: Select **"EtherTrialsTRIAv4"**
2. Constructor parameters:
   ```
   _TRIATOKEN: "0xYOUR_TRIA_TOKEN_ADDRESS_FROM_CLANKER"
   _UNISWAPROUTER: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"
   ```
3. Click **Deploy**
4. Confirm transaction in MetaMask
5. Wait for confirmation (~2-5 seconds on Base)
6. ✅ Copy the deployed contract address!

---

## ⚙️ Post-Deployment Configuration

### 1. Verify Contract (Recommended)

**On BaseScan:**
1. Go to https://basescan.org/verifyContract
2. Enter contract address
3. Compiler type: Solidity (Single file)
4. Compiler version: v0.8.20
5. License: MIT
6. Paste contract code
7. Constructor arguments (ABI-encoded):
   - Use: https://abi.hashex.org/
   - Input types: `address, address`
   - Input values: `YOUR_TRIA_ADDRESS, ROUTER_ADDRESS`
8. Submit for verification

### 2. Initial Testing (Optional but Recommended)

Test on **Base Goerli** first:
1. Get test ETH from Base Goerli faucet
2. Deploy test version
3. Test all functions:
   - Enter tournament
   - Commit & reveal score
   - Play dice
   - Play spin
   - Claim rewards

### 3. Configure Frontend

Update contract address in your app:

**File: `src/lib/contracts/etherTrialsTRIAv4ABI.ts`**
```typescript
export const CONTRACT_ADDRESSES_V4 = {
  base: {
    etherTrialsTRIA: '0xYOUR_DEPLOYED_CONTRACT_ADDRESS', // ⚠️ UPDATE
    triaToken: '0xYOUR_TRIA_TOKEN_ADDRESS' // ⚠️ UPDATE
  }
};
```

---

## 🎮 How It Works

### Tournament Flow:

1. **User enters tournament** (0.00001 - 1 ETH)
   - Call: `enterTournament(fid)`
   - 80% → $TRIA prize pool
   - 10% → Buyback $TRIA
   - 5% → Treasury (ETH)
   - 5% → Mini games pool (ETH)

2. **User plays RPG game** (frontend)
   - Game calculates final score
   - No blockchain interaction during gameplay

3. **User commits score** (anti-cheat step 1)
   - Frontend: Generate `nonce` and `timestamp`
   - Calculate: `hash = keccak256(fid, score, nonce, timestamp)`
   - Call: `commitScore(period, fid, hash)`

4. **User reveals score** (anti-cheat step 2)
   - Within 10 minutes of commit
   - Call: `revealScore(period, fid, score, nonce, timestamp)`
   - Contract verifies hash matches

5. **Period ends** (24 hours)
   - Anyone can call: `finalizePeriod(period)`
   - Scores become final

6. **User claims rewards**
   - Call: `claimAllRewards(fid)`
   - Receives $TRIA based on weighted score

### Mini Games Flow:

1. **Check if active**
   - Call: `areMiniGamesActive()`
   - Returns `true` if `miniGameBalance >= 0.01 ETH`

2. **Play Dice**
   - Call: `playDice(fid)` with `0.00001 ETH`
   - Win conditions:
     - Sum = 7 → 4x prize (16.67% chance)
     - Snake eyes (2) → 20x prize (2.78% chance)
     - Boxcars (12) → 20x prize (2.78% chance)
     - Other doubles → 3x prize (11.11% chance)
     - **LOSE** → 66.67% chance
   - Lucky burst: 1:500 for 0.001 ETH

3. **Play Spin**
   - Call: `playSpin(fid, betNumber)` with `0.00001 ETH`
   - Choose number 0-36
   - Win conditions:
     - Exact match 0 → 20x prize (2.7% chance)
     - Exact match 1-36 → 8x prize (2.7% chance)
     - **LOSE** → 94.6% chance
   - Lucky burst: 1:500 for 0.001 ETH

---

## 👤 Owner Functions

After deployment, you (owner) can call:

### 1. **Withdraw Buyback $TRIA**
```solidity
withdrawBuyback()
```
- Withdraws all buyback $TRIA to owner
- Use for: giveaways, incentives, add to prize pool

### 2. **Withdraw Treasury ETH**
```solidity
withdrawTreasury()
```
- Withdraws 5% treasury (ETH) to owner
- Use for: operational costs, development

### 3. **Withdraw Mini Game Maintenance**
```solidity
withdrawMiniMaintenance()
```
- Withdraws 5% mini game maintenance (ETH)
- Use for: server costs, game development

### 4. **Inject $TRIA to Prize Pool**
```solidity
injectTRIAToPrizePool(amount)
```
- Add $TRIA from buyback to current prize pool
- Use for: boost tournaments, marketing events

### 5. **Set Lucky Burst Chance**
```solidity
setLuckyBurstChance(newChance)
```
- Default: 500 (1:500)
- Increase for harder odds, decrease for easier

### 6. **Transfer Ownership**
```solidity
transferOwnership(newOwner)
```
- Transfer contract ownership to new address

### 7. **Emergency Withdraw**
```solidity
emergencyWithdrawETH()
```
- Withdraw all ETH from contract (emergency only)

---

## 📊 Monitoring

### Check Balances:
```solidity
getBalances()
```
Returns:
- `buybackTRIA`: Withdrawable buyback $TRIA
- `treasury`: Withdrawable treasury ETH
- `miniGame`: Mini game pool balance
- `luckyBurst`: Lucky burst pool balance
- `miniMaintenance`: Mini game maintenance ETH
- `miniBuyback`: Mini game buyback $TRIA

### Check if Mini Games Active:
```solidity
areMiniGamesActive()
```
Returns `true` if `miniGameBalance >= 0.01 ETH`

### Get Period Info:
```solidity
getPeriodInfo(period)
```
Returns:
- `startTime`: Period start timestamp
- `endTime`: Period end timestamp
- `triaPool`: Total $TRIA prize pool
- `finalized`: Is period finalized?
- `totalWeightedScore`: Sum of all weighted scores

---

## ⚠️ Important Notes

### 1. **No Initial Funding Needed!**
- Contract starts with 0 balance
- Mini games funded by tournament entries (5%)
- Mini games inactive until `miniGameBalance >= 0.01 ETH`
- Sustainable model - tournament is primary focus

### 2. **Anti-Cheat System**
- Players MUST commit score before revealing
- 10 minute window to reveal after commit
- Hash verification prevents manipulation
- If player doesn't reveal, score = 0

### 3. **House Edge**
- Dice: ~40% house edge
- Spin: ~60% house edge
- This ensures mini game pool grows over time
- Lucky burst adds excitement without breaking economics

### 4. **Weighted Rewards**
- Entry 0.00001 ETH = weight 1
- Entry 1 ETH = weight 100,000
- Reward = `(score × weight) / totalWeightedScore × prizePool`
- Whales get more, but skill still matters!

### 5. **Security**
- Max 3 wallets per FID
- 7-day cooldown between adding wallets
- FID-based entry (1 per period)
- Slippage protection (2%)
- Balance checks on all withdrawals

---

## 🆘 Troubleshooting

### Transaction Fails:
- **Check gas limit**: Increase to 500,000+
- **Check ETH balance**: Need enough for gas
- **Check network**: Must be on Base mainnet

### Swap Fails:
- **Check liquidity**: $TRIA must have WETH pair on BaseSwap
- **Check slippage**: Increase if low liquidity
- **Check balance**: Contract needs ETH for swaps

### Mini Games Inactive:
- **Check balance**: `areMiniGamesActive()` must return `true`
- **Wait for funding**: Need tournament entries to build pool
- **Check threshold**: Pool must be >= 0.01 ETH

### Score Reveal Fails:
- **Check timing**: Must be within 10 minutes of commit
- **Check hash**: nonce/timestamp must match exactly
- **Check wallet**: Must be approved wallet for FID

---

## 📞 Support

If you encounter issues:
1. Check BaseScan for transaction details
2. Verify contract is deployed correctly
3. Ensure $TRIA has liquidity on BaseSwap
4. Test on Base Goerli first before mainnet

---

## ✅ Deployment Checklist

Before deploying to mainnet:

- [ ] $TRIA token deployed via Clanker
- [ ] $TRIA has liquidity pool on BaseSwap (TRIA/WETH)
- [ ] Tested on Base Goerli testnet
- [ ] Have 0.02+ ETH for deployment gas
- [ ] MetaMask connected to Base mainnet
- [ ] Contract compiled successfully in Remix
- [ ] Constructor parameters ready
- [ ] Plan to verify contract on BaseScan
- [ ] Frontend ready to integrate contract address
- [ ] Understand how anti-cheat commit/reveal works
- [ ] Understand mini games only active when funded

**Ready to deploy? Good luck! 🚀**
