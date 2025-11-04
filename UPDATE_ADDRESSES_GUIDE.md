# 📍 How to Update Contract Addresses After Deployment

## Quick Guide: 3 Steps to Update

After you deploy your EtherTrialsTRIAv2 smart contract to Base network, you need to update the contract address in your frontend code so the app can interact with it.

---

## Step 1: Deploy Your Contract

Using Hardhat or your preferred deployment tool:

```bash
npx hardhat run scripts/deploy-tria-v2.js --network base
```

You'll get output like:
```
✅ EtherTrialsTRIAv2 deployed to: 0xABCDEF123456789...
```

**Copy this address!** 📋

---

## Step 2: Update the ABI File

Open the file: **`src/lib/contracts/etherTrialsTRIAv2ABI.ts`**

Find this section (around line 500-512):

```typescript
export const CONTRACT_ADDRESSES_V2 = {
  base: {
    etherTrialsTRIAv2: '0x...', // ⚠️ UPDATE THIS AFTER DEPLOYMENT
    triaToken: '0x...', // ⚠️ UPDATE WITH YOUR CLANKER $TRIA TOKEN ADDRESS
    uniswapRouter: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', // ✅ Already correct
  },
  baseGoerli: {
    etherTrialsTRIAv2: '0x...', // Testnet address
    triaToken: '0x...', // Testnet token
    uniswapRouter: '0x...',
  }
} as const;
```

**Replace with your addresses:**

```typescript
export const CONTRACT_ADDRESSES_V2 = {
  base: {
    etherTrialsTRIAv2: '0xABCDEF123456789...', // ✅ Your deployed contract
    triaToken: '0xYOUR_TRIA_TOKEN_FROM_CLANKER', // ✅ From Clanker deployment
    uniswapRouter: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24', // ✅ BaseSwap (don't change)
  },
  baseGoerli: {
    // Leave empty or add testnet addresses
    etherTrialsTRIAv2: '0x...',
    triaToken: '0x...',
    uniswapRouter: '0x...',
  }
} as const;
```

---

## Step 3: Save and Test

1. **Save the file** (`Ctrl+S` / `Cmd+S`)
2. **The app will auto-reload** (hot reload is enabled)
3. **Test the connection:**
   - Try entering a tournament
   - Check if wallet management works
   - Verify mini games load correctly

---

## 🔍 Where Are These Addresses Used?

The addresses you updated are automatically used by:

### `useTRIAContractV2` Hook
Located at: `src/hooks/useTRIAContractv2.ts`

```typescript
// This hook reads from CONTRACT_ADDRESSES_V2 automatically
const contractAddress = chainId === base.id 
  ? CONTRACT_ADDRESSES_V2.base.etherTrialsTRIAv2 as Address
  : CONTRACT_ADDRESSES_V2.baseGoerli.etherTrialsTRIAv2 as Address;
```

So once you update the ABI file, **everything works automatically!**

---

## 🎯 Getting Your Addresses

### 1. EtherTrialsTRIAv2 Contract Address
**Where to find:** After deployment, copy from terminal output or find on BaseScan
**Example:** `0x1234567890abcdef1234567890abcdef12345678`

### 2. $TRIA Token Address (from Clanker)
**Where to find:** 
- Check the Farcaster cast where you deployed $TRIA via Clanker
- Or search for your token on BaseScan
**Example:** `0xabcdefabcdefabcdefabcdefabcdefabcdefabcd`

### 3. Uniswap Router (BaseSwap)
**Already correct:** `0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24`
**Don't change this!** It's the official BaseSwap router on Base network.

---

## ⚠️ Common Mistakes

### ❌ Wrong: Not removing placeholder
```typescript
etherTrialsTRIAv2: '0x...', // Still placeholder!
```

### ✅ Correct: Full address
```typescript
etherTrialsTRIAv2: '0xABCDEF123456789ABCDEF123456789ABCDEF1234',
```

### ❌ Wrong: Missing '0x' prefix
```typescript
etherTrialsTRIAv2: 'ABCDEF123456789...',
```

### ✅ Correct: Has '0x' prefix
```typescript
etherTrialsTRIAv2: '0xABCDEF123456789...',
```

### ❌ Wrong: Quotes around address are wrong type
```typescript
etherTrialsTRIAv2: "0x...", // Wrong quotes in TS
```

### ✅ Correct: Single quotes
```typescript
etherTrialsTRIAv2: '0x...', // Correct
```

---

## 🧪 How to Verify It's Working

After updating addresses, open browser console (F12) and check:

1. **No address errors** - Should not see "invalid address" errors
2. **Contract calls work** - Try reading contract data:
   ```typescript
   // In your component:
   const { currentPeriod, periodInfo } = useTRIAContractV2(fid);
   console.log('Current period:', currentPeriod);
   console.log('Period info:', periodInfo);
   ```

3. **Check BaseScan** - Visit `https://basescan.org/address/YOUR_CONTRACT_ADDRESS`
   - Should show your deployed contract
   - Can see transactions when users interact

---

## 📞 Need Help?

**Contract not responding?**
- ✅ Check address is correct (no typos)
- ✅ Check you're on Base network (not testnet)
- ✅ Check contract is verified on BaseScan
- ✅ Check $TRIA has liquidity on Uniswap

**Mini games not working?**
- ✅ Check miniGameBalance in contract (needs initial funding)
- ✅ Check luckyBurstBalance (needs funding for lucky burst)

**Swaps failing?**
- ✅ Check $TRIA/WETH liquidity pool exists on BaseSwap
- ✅ Check slippage tolerance (2% is default)

---

## 🚀 Next Steps After Updating

1. ✅ Update addresses (this guide)
2. ✅ Test on testnet first (optional but recommended)
3. ✅ Deploy to mainnet
4. ✅ Update addresses in production
5. ✅ Test all features:
   - Tournament entry
   - Wallet management
   - Mini games (dice & spin)
   - Claims
   - Owner functions (if you're owner)

---

## 📝 Quick Checklist

Before going live, verify:

- [ ] Contract deployed to Base mainnet
- [ ] Contract verified on BaseScan
- [ ] Addresses updated in `etherTrialsTRIAv2ABI.ts`
- [ ] $TRIA token has liquidity on BaseSwap
- [ ] Backend server address configured correctly
- [ ] Mini game balance funded (for instant prizes)
- [ ] Lucky burst balance funded (for big wins)
- [ ] Tested tournament entry with small amount
- [ ] Tested mini games with 0.00001 ETH
- [ ] Tested wallet management (add/remove)
- [ ] Tested claiming rewards

---

**That's it! Your Ether Trials TRIA v2 contract is now connected and ready to use.** 🎮🚀

For technical details about the contract itself, see: `EtherTrialsTRIAv2_DEPLOYMENT.md`
