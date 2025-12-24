# EtherTrialsTRIAv10 Deployment Guide

## ✨ What's New in V10?

**SIMPLIFIED FLOW:**
- ✅ 100% ETH → TRIA swap (no more buyback complexity)
- ✅ Clean 80/20 split (prize pool / platform fees)
- ✅ Constructor-injected addresses (flexible deployment)
- ✅ Points = score × (totalModal / 1e18)
- ✅ All rewards in TRIA

**REMOVED:**
- ❌ Buyback mechanism
- ❌ Treasury ETH
- ❌ Complex multi-step allocation

---

## 📋 Prerequisites

Before deploying, you need:

1. **Base Mainnet RPC** (e.g., Ankr: `https://rpc.ankr.com/base/...`)
2. **Deployer Wallet** with ETH on Base Mainnet (~0.01 ETH for gas)
3. **Contract Addresses** (Base Mainnet):
   - TRIA Token: `0xD852713dD8dDF61316DA19383D0c427aDb85EB07`
   - Uniswap V3 SwapRouter: `0x2626664c2603336E57B271c5C0b26F421741e481`
   - WETH9: `0x4200000000000000000000000000000000000006`

---

## 🚀 Deployment Steps

### Step 1: Deploy Contract via Remix

1. **Open Remix IDE**: https://remix.ethereum.org
2. **Create new file**: `EtherTrialsTRIAv10.sol`
3. **Copy contract code** from `src/contracts/EtherTrialsTRIAv10.sol`
4. **Compile**:
   - Compiler version: `0.8.20+`
   - Optimization: Enabled (200 runs)
5. **Deploy**:
   - Environment: "Injected Provider - MetaMask"
   - Connect to **Base Mainnet**
   - Constructor parameters:
     ```
     triaAddr:       0xD852713dD8dDF61316DA19383D0c427aDb85EB07
     swapRouterAddr: 0x2626664c2603336E57B271c5C0b26F421741e481
     wethAddr:       0x4200000000000000000000000000000000000006
     ```
   - Click "Deploy" and confirm in MetaMask

6. **Save Deployed Address**: Copy contract address (e.g., `0xABC...123`)

---

### Step 2: Add Liquidity to Uniswap V3

**CRITICAL**: The contract CANNOT function without liquidity in the WETH/TRIA pool!

1. **Go to Uniswap V3**: https://app.uniswap.org/add/v2
2. **Select Base Network**
3. **Add Liquidity**:
   - Token A: WETH (`0x4200000000000000000000000000000000000006`)
   - Token B: TRIA (`0xD852713dD8dDF61316DA19383D0c427aDb85EB07`)
   - Fee Tier: **0.3%** (3000 basis points) ← MATCHES CONTRACT DEFAULT
   - Price Range: Set based on current market price
   - Amount: Minimum 0.1 ETH + equivalent TRIA recommended

4. **Confirm Transaction**

⚠️ **IMPORTANT**: Make sure fee tier is 0.3% (3000) to match contract's `v3Fee` default!

---

### Step 3: Update Frontend Configuration

Update `src/lib/contracts/etherTrialsTRIAv10ABI.ts`:

```typescript
// Replace with your deployed contract address
export const ETHER_TRIALS_TRIA_V10_ADDRESS = '0xYourDeployedAddress' as Address;
```

---

### Step 4: Verify Contract (Optional but Recommended)

1. **Go to BaseScan**: https://basescan.org/verifyContract
2. **Enter**:
   - Contract Address: Your deployed address
   - Compiler Type: Solidity (Single file)
   - Compiler Version: v0.8.20+
   - License: MIT
3. **Paste contract code** from `EtherTrialsTRIAv10.sol`
4. **Constructor Arguments (ABI-encoded)**:
   ```
   0x000000000000000000000000D852713dD8dDF61316DA19383D0c427aDb85EB07
   0x0000000000000000000000002626664c2603336E57B271c5C0b26F421741e481
   0x0000000000000000000000004200000000000000000000000000000000000006
   ```
5. **Verify & Publish**

---

## 🧪 Testing Deployment

### Test 1: Check Initial State

```typescript
// Should return 1 (first period starts automatically)
await contract.currentPeriod();

// Should return 0.00002 ETH (default minEntry)
await contract.minEntry();

// Should return 3000 (0.3% fee tier)
await contract.v3Fee();
```

### Test 2: Make Test Entry

1. Connect wallet with small amount (~0.0001 ETH)
2. Call `enterTournament()` with `msg.value = 0.00002 ETH`
3. Check transaction:
   - Should emit `EntryPaid` event
   - Should show TRIA received
   - Prize pool should increase

### Test 3: Verify Swap

```typescript
// Check period prize pool (should have TRIA)
const periodInfo = await contract.periods(1);
console.log('TRIA Prize Pool:', periodInfo.triaPrizePool);

// Should be > 0 after entry
```

---

## 🔧 Admin Functions

After deployment, owner can:

### Change Fee Tier (if needed)
```solidity
setV3Fee(500)   // 0.05%
setV3Fee(3000)  // 0.3% (default)
setV3Fee(10000) // 1%
```

### Adjust Entry Bounds
```solidity
setEntryBounds(0.00001 ether, 2 ether)
```

### Start New Period
```solidity
// After period ends + prizes allocated
startNewPeriod()
```

### Withdraw Platform Fees
```solidity
// Withdraw accumulated 20% fees (in TRIA)
withdrawPlatformFees()
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: "Swap failed" Error

**Cause**: No liquidity in WETH/TRIA pool or wrong fee tier

**Solution**:
1. Check liquidity exists in Uniswap V3 WETH/TRIA 0.3% pool
2. Verify `v3Fee` matches pool fee tier (default 3000 = 0.3%)
3. Add more liquidity if needed

---

### Issue 2: "Invalid entry" Error

**Cause**: Entry amount outside min/max bounds

**Solution**:
1. Check `minEntry()` - default is 0.00002 ETH
2. Check `maxEntry()` - default is 1 ETH
3. Adjust bounds with `setEntryBounds()` if needed

---

### Issue 3: Period Not Starting

**Cause**: Constructor initializes period 1 automatically

**Solution**: 
- No action needed! Period 1 starts at deployment
- Check `currentPeriod()` and `periods(1)` for confirmation

---

## 📊 Contract Monitoring

### Key Metrics to Watch

```solidity
// Prize pool (in TRIA)
periods(currentPeriod).triaPrizePool

// Number of participants
periods(currentPeriod).participants

// Platform fees accumulated (in TRIA)
platformFeesBalance

// Prize owed to winners (in TRIA)
totalPrizeOwedTRIA
```

### Balances
```solidity
// TRIA balance
IERC20(TRIA_TOKEN).balanceOf(contractAddress)

// Should equal: totalPrizeOwedTRIA + platformFeesBalance
```

---

## 🎯 Next Steps After Deployment

1. ✅ **Update frontend** with deployed contract address
2. ✅ **Test entry flow** with small amount
3. ✅ **Verify swap works** (check prize pool increases in TRIA)
4. ✅ **Test dice rolls** (free and paid)
5. ✅ **Test commit-reveal** score submission
6. ✅ **Test prize allocation** after period ends
7. ✅ **Test claim rewards** for winners

---

## 📝 Constructor Parameters Summary

```solidity
constructor(
    address triaAddr,      // 0xD852713dD8dDF61316DA19383D0c427aDb85EB07
    address swapRouterAddr, // 0x2626664c2603336E57B271c5C0b26F421741e481
    address wethAddr       // 0x4200000000000000000000000000000000000006
)
```

All addresses are **Base Mainnet** verified contracts.

---

## 🎉 Success Checklist

- [ ] Contract deployed successfully
- [ ] Liquidity added to Uniswap V3 pool (0.3% fee tier)
- [ ] Frontend updated with contract address
- [ ] Test entry completed (ETH → TRIA swap works)
- [ ] Prize pool shows TRIA balance
- [ ] Contract verified on BaseScan
- [ ] Admin functions accessible

---

## 💡 Tips

1. **Always test with small amounts first** (~0.0001 ETH)
2. **Monitor gas prices** on Base - usually very cheap (~0.0001 ETH per tx)
3. **Keep some TRIA balance** in contract after deployment for testing
4. **Set realistic entry bounds** based on your user base
5. **Add liquidity gradually** as tournament grows

---

## 📞 Support

If you encounter issues:
1. Check BaseScan for transaction details
2. Verify liquidity pool exists and has volume
3. Ensure RPC is using Base Mainnet
4. Check constructor parameters match Base addresses

---

**Happy Deploying! 🚀**
