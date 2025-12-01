# 🚀 EtherTrialsTRIAv10 Quick Start

## TL;DR - What Changed?

**SIMPLIFIED CONTRACT:**
- ✅ ETH entry → Swap 100% to TRIA immediately
- ✅ Clean 80/20 split (prize / fees)
- ✅ Constructor accepts parameters for flexible deployment
- ✅ No more buyback confusion
- ✅ All rewards in TRIA

---

## 🎯 5-Minute Deployment

### Step 1: Deploy Contract (2 min)

1. Open Remix: https://remix.ethereum.org
2. Create `EtherTrialsTRIAv10.sol`
3. Copy contract from `src/contracts/EtherTrialsTRIAv10.sol`
4. Compile with Solidity `0.8.20+`
5. Deploy with these **Base Mainnet** addresses:
   ```
   triaAddr:       0xD852713dD8dDF61316DA19383D0c427aDb85EB07
   swapRouterAddr: 0x2626664c2603336E57B271c5C0b26F421741e481
   wethAddr:       0x4200000000000000000000000000000000000006
   ```
6. **Save your contract address!**

---

### Step 2: Add Liquidity (2 min)

1. Go to Uniswap V3: https://app.uniswap.org/add
2. Select **Base Network**
3. Add liquidity:
   - **WETH**: `0x4200000000000000000000000000000000000006`
   - **TRIA**: `0xD852713dD8dDF61316DA19383D0c427aDb85EB07`
   - **Fee Tier**: 0.3% (3000) ← CRITICAL!
   - **Amount**: Min 0.1 ETH + equivalent TRIA

⚠️ **MUST USE 0.3% FEE TIER** to match contract default!

---

### Step 3: Update Frontend (1 min)

Edit `src/lib/contracts/etherTrialsTRIAv10ABI.ts`:

```typescript
export const ETHER_TRIALS_TRIA_V10_ADDRESS = '0xYourDeployedAddress' as Address;
```

---

## ✅ Test It Works

1. Open your app
2. Try entering tournament with 0.00002 ETH
3. Check transaction on BaseScan
4. Verify `EntryPaid` event shows `triaReceived > 0`
5. Check `periods(1).triaPrizePool` increased

---

## 🎮 Game Flow

```
1. User enters tournament
   └─ Pays 0.00002 ETH (or more)
   └─ Contract swaps 100% ETH → TRIA
   └─ 80% TRIA → Prize pool
   └─ 20% TRIA → Platform fees

2. User plays game
   └─ Can buy dice rolls (also swapped to TRIA)
   └─ Each roll adds to prize pool

3. User submits score
   └─ Commit score (hash)
   └─ Reveal score (within 20 min)
   └─ Points = score × (totalModal / 1e18)

4. Period ends (24 hours)
   └─ Admin calls allocatePrizes(1)
   └─ Users claim TRIA rewards based on points
```

---

## 🔧 Admin Functions

### Start New Period
```solidity
// After period ends + prizes allocated
startNewPeriod()
```

### Withdraw Platform Fees
```solidity
// Withdraw 20% fees in TRIA
withdrawPlatformFees()
```

### Change Fee Tier (if pool changes)
```solidity
setV3Fee(3000)  // 0.3%
setV3Fee(500)   // 0.05%
setV3Fee(10000) // 1%
```

### Adjust Entry Bounds
```solidity
setEntryBounds(0.00001 ether, 2 ether)
```

---

## 🚨 Common Issues

### "Swap failed" Error

**Cause**: No liquidity in Uniswap V3 pool

**Fix**: 
1. Check pool exists at https://info.uniswap.org/#/base/pools
2. Add more liquidity if needed
3. Verify fee tier matches (0.3% = 3000)

---

### "Invalid entry" Error

**Cause**: Entry amount outside bounds

**Fix**:
- Default min: 0.00002 ETH
- Default max: 1 ETH
- Adjust with `setEntryBounds()` if needed

---

### Period Not Ending

**Cause**: Period duration is 24 hours

**Fix**: Wait for `periods(1).endTime` to pass

---

## 📊 Key Contract Values

```solidity
minEntry = 0.00002 ether    // Lower barrier!
maxEntry = 1 ether
v3Fee = 3000                // 0.3% Uniswap fee tier

ENTRY_PRIZE_PERCENT = 80    // 80% to prize
ENTRY_PLATFORM_PERCENT = 20 // 20% fees

PERIOD_DURATION = 24 hours
REVEAL_WINDOW = 20 minutes
MAX_SCORE = 2_000_000
```

---

## 🎯 Testing Checklist

- [ ] Contract deployed with correct constructor params
- [ ] Liquidity added to Uniswap V3 (0.3% fee tier)
- [ ] Frontend updated with contract address
- [ ] Test entry works (0.00002 ETH minimum)
- [ ] Verify TRIA appears in prize pool
- [ ] Test dice roll (free + paid)
- [ ] Test commit + reveal score
- [ ] Wait for period end
- [ ] Admin allocates prizes
- [ ] User claims TRIA rewards

---

## 💡 Pro Tips

1. **Always add liquidity FIRST** before letting users enter
2. **Start with small test entry** (0.0001 ETH) to verify swap
3. **Monitor prize pool growth** in real-time (TRIA balance)
4. **Use 0.3% fee tier** unless you have specific reason to change
5. **Test on testnet first** if unsure about parameters

---

## 🔗 Contract Addresses (Base Mainnet)

```
TRIA Token:       0xD852713dD8dDF61316DA19383D0c427aDb85EB07
Uniswap V3 Router: 0x2626664c2603336E57B271c5C0b26F421741e481
WETH9:            0x4200000000000000000000000000000000000006

Your Contract:    [Update after deployment]
```

---

## 📞 Need Help?

1. Check BaseScan for transaction details
2. Verify pool liquidity on Uniswap Info
3. Ensure RPC is Base Mainnet
4. Test with very small amounts first

---

## 🎉 That's It!

Your tournament is now live with:
- ✅ Automatic ETH → TRIA swaps
- ✅ Real-time prize pool updates
- ✅ Simple 80/20 split
- ✅ Flexible constructor deployment

**Ready to compete! 🏆**
