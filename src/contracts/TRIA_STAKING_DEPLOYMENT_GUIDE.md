# 💰 TRIA Staking Deployment Guide

## 📋 Overview

This guide will help you deploy the TRIAStaking smart contract to Base Mainnet.

**Contract Features:**
- ✅ Flexible APY (10-20%, adjustable)
- ✅ 7-day unstaking cooldown
- ✅ Rewards calculated per second
- ✅ Pause/unpause functionality
- ✅ Owner-controlled reward pool

---

## 🚀 Deployment Steps

### 1. Prerequisites

- **Wallet:** MetaMask with ETH on Base Mainnet for gas
- **TRIA Tokens:** For reward pool (deposit after deployment)
- **Remix IDE:** https://remix.ethereum.org

### 2. Deploy Contract via Remix

1. **Open Remix IDE:**
   - Go to https://remix.ethereum.org

2. **Create New File:**
   - Create `TRIAStaking.sol`
   - Copy contents from `src/contracts/TRIAStaking.sol`

3. **Compile Contract:**
   - Click "Solidity Compiler" tab
   - Select Solidity version `0.8.26`
   - Click "Compile TRIAStaking.sol"

4. **Deploy:**
   - Click "Deploy & Run Transactions" tab
   - Environment: Select "Injected Provider - MetaMask"
   - Network: Make sure MetaMask is on **Base Mainnet (Chain ID: 8453)**
   - Contract: Select "TRIAStaking"
   - Click "Deploy"
   - Confirm transaction in MetaMask

5. **Copy Contract Address:**
   - After deployment, copy the contract address
   - Example: `0x1234567890abcdef1234567890abcdef12345678`

### 3. Update Frontend

1. **Update Contract Address:**
   ```typescript
   // File: src/lib/contracts/triaStakingABI.ts
   export const TRIA_STAKING_ADDRESS = '0xYOUR_DEPLOYED_CONTRACT_ADDRESS' as Address;
   ```

2. **Rebuild Application:**
   ```bash
   pnpm run build
   ```

---

## 🎯 Post-Deployment Setup

### 1. Approve TRIA for Reward Pool

Before depositing rewards, approve the staking contract to spend your TRIA:

1. Go to TRIA token contract on BaseScan:
   - https://basescan.org/address/0xD852713dD8dDF61316DA19383D0c427aDb85EB07

2. Connect your wallet

3. Call `approve` function:
   - **Spender:** Your staking contract address
   - **Amount:** Large number (e.g., 1,000,000,000,000 TRIA in wei = `1000000000000000000000000000000`)

### 2. Deposit Reward Pool

Deposit TRIA to the reward pool so users can claim rewards:

1. In Remix, find your deployed contract
2. Call `depositRewardPool` function:
   - **Amount:** Amount in wei (e.g., 100,000 TRIA = `100000000000000000000000`)
3. Confirm transaction

**Recommended Initial Deposit:**
- For testing: 10,000 TRIA
- For production: 100,000+ TRIA

### 3. Configure APY (Optional)

Default APY is 15%. To change:

1. Call `setAPY` function:
   - **newAPY:** Number between 10-20 (e.g., 15 for 15%)
2. Confirm transaction

---

## 📊 Monitoring & Management

### Check Contract Stats

Use these view functions in Remix:

1. **getContractInfo()** - Get all contract stats:
   - Total staked
   - Reward pool
   - Current APY
   - Staker count

2. **totalStaked()** - Total TRIA staked

3. **rewardPool()** - Remaining rewards

4. **currentAPY()** - Current APY

### User Management

1. **getAllStakers()** - Get list of all stakers
2. **getUserStakeInfo(address)** - Get specific user's info

### Emergency Actions

1. **togglePause()** - Pause/unpause staking
2. **emergencyWithdraw(address, amount)** - Withdraw excess funds (not user stakes)

---

## 🔒 Security Checklist

- [ ] Contract deployed on Base Mainnet
- [ ] Contract address updated in frontend
- [ ] Reward pool funded with TRIA
- [ ] APY set to desired rate (10-20%)
- [ ] Test stake/unstake with small amounts
- [ ] Verify contract on BaseScan (optional but recommended)

---

## 🧪 Testing Workflow

### Test on Base Testnet First (Recommended)

1. Deploy to Base Sepolia (testnet)
2. Get test TRIA tokens
3. Test all functions:
   - Stake
   - Claim rewards
   - Request unstake
   - Unstake after cooldown
4. Verify everything works
5. Deploy to mainnet

### Mainnet Testing

1. Start with small amounts (e.g., 100 TRIA)
2. Test stake → wait 1 hour → claim rewards
3. Test unstake flow (wait 7 days)
4. Monitor gas costs

---

## 📝 Contract Verification (Optional)

To verify on BaseScan:

1. Go to https://basescan.org/verifyContract
2. Enter contract address
3. Select:
   - Compiler: v0.8.26
   - License: MIT
4. Paste contract source code
5. Submit for verification

---

## 💡 Tips

1. **Gas Optimization:**
   - Approve large amounts once to save gas
   - Claim rewards periodically (e.g., weekly)

2. **Reward Pool Management:**
   - Monitor reward pool balance
   - Top up before it runs low
   - Calculate: `(Total Staked * APY * Days) / 365`

3. **User Communication:**
   - Announce staking launch
   - Explain 7-day cooldown clearly
   - Share contract address for transparency

---

## 🆘 Troubleshooting

**Problem:** Users can't stake
- Check if contract is paused
- Verify users have approved TRIA
- Check TRIA balance

**Problem:** Can't claim rewards
- Check reward pool balance
- Verify user has staked amount
- Check if rewards > 0

**Problem:** Can't unstake
- Verify 7 days have passed since request
- Check if unstake was requested

---

## 📞 Support

For issues or questions:
1. Check contract events on BaseScan
2. Review transaction logs
3. Contact dev team

---

**Contract Version:** v1.0.0-tria-staking
**Network:** Base Mainnet (Chain ID: 8453)
**TRIA Token:** 0xD852713dD8dDF61316DA19383D0c427aDb85EB07
