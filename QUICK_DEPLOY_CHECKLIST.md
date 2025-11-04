# ⚡ QUICK DEPLOY CHECKLIST

## 🎯 ONE-PAGE DEPLOYMENT GUIDE

### ✅ PRE-FLIGHT CHECK
```
✅ $TRIA Address: 0xd852713dd8ddf61316da19383d0c427adb85eb07
✅ V3 Router: 0x2626664c2603336E57B271c5C0b26F421741e481
✅ Liquidity: $5 on Uniswap V3
✅ Network: Base Mainnet (8453)
✅ Gas: ~0.01 ETH in wallet
```

---

## 🚀 DEPLOY IN 5 STEPS

### 1. REMIX SETUP
```
→ Open: https://remix.ethereum.org
→ File: EtherTrialsTRIAv4.sol
→ Paste: Contract from src/contracts/
→ Compile: Ctrl+S (0.8.20+, Optimization ON)
```

### 2. METAMASK
```
→ Network: Base Mainnet
→ Balance: Check ~0.01 ETH available
→ Confirm: Wallet address correct
```

### 3. DEPLOY TAB
```
→ Environment: Injected Provider - MetaMask
→ Contract: EtherTrialsTRIAv4
→ Constructor: 
   0xd852713dd8ddf61316da19383d0c427adb85eb07,0x2626664c2603336E57B271c5C0b26F421741e481
```

### 4. DEPLOY!
```
→ Click: DEPLOY button
→ MetaMask: Confirm transaction
→ Wait: 5-10 seconds
→ Copy: Contract address from console
```

### 5. VERIFY
```
→ BaseScan: Paste address
→ Contract Tab: Verify and Publish
→ Test: Call getCurrentPeriod() → should return 0
```

---

## 📋 QUICK TEST

```javascript
// Test Entry (0.00001 ETH)
enterTournament(YOUR_FID, { value: "10000000000000" })

// Check it worked
getEntry(0, YOUR_FID)  // Should show entry data

// Check balances
getBalances()  // Should show pools populated
```

---

## 🆘 QUICK FIXES

| Error | Fix |
|-------|-----|
| "Insufficient liquidity" | Entry amount too large for $5 liquidity. Try 0.000001 ETH |
| "Transaction failed" | Increase gas limit in MetaMask |
| "Already entered" | Correct! 1 FID = 1 entry per 24h |
| Can't verify | Use auto-detect on BaseScan |

---

## 📞 NEXT STEPS

After deployment:
1. ✅ Save contract address
2. ✅ Verify on BaseScan  
3. ✅ Test with 0.00001 ETH
4. ✅ Update frontend
5. ✅ Launch! 🎉

---

**Constructor (Copy/Paste):**
```
0xd852713dd8ddf61316da19383d0c427adb85eb07,0x2626664c2603336E57B271c5C0b26F421741e481
```

**GO DEPLOY NOW! 🚀**
