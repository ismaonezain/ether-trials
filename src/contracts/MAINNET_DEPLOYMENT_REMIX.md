asgjll;
# 🚀 MAINNET DEPLOYMENT GUIDE - Base Network via Remix

## ⚠️ CRITICAL - READ BEFORE DEPLOYING

**This is REAL MONEY on BASE MAINNET!**
- Double-check all parameters
- Make sure you have enough ETH for gas (~0.01 ETH)
- Contract is IMMUTABLE after deployment
- NO UNDO button!

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### ✅ Confirm You Have:
- [ ] MetaMask connected to **Base Mainnet** (Chain ID: 8453)
- [ ] **~0.01 ETH on Base** for deployment gas
- [ ] **$TRIA Token Address**: `0xd852713dd8ddf61316da19383d0c427adb85eb07`
- [ ] **Verified $TRIA has liquidity** on Uniswap/BaseSwap
- [ ] Read and understood the contract code

### ✅ Network Details:
- **Network**: Base Mainnet
- **Chain ID**: 8453
- **RPC**: https://mainnet.base.org
- **Block Explorer**: https://basescan.org

---

## 🎯 STEP-BY-STEP DEPLOYMENT

### Step 1: Setup MetaMask
1. Open MetaMask
2. Switch to **Base Mainnet** network
3. Confirm you have **~0.01 ETH** for gas

**Add Base Mainnet if not present:**
- Network Name: Base Mainnet
- RPC URL: https://mainnet.base.org
- Chain ID: 8453
- Currency: ETH
- Block Explorer: https://basescan.org

---

### Step 2: Open Remix
1. Go to: **https://remix.ethereum.org**
2. Create new file: `EtherTrialsTRIAv4.sol`
3. Copy FULL contract from: `src/contracts/EtherTrialsTRIAv4_Sustainable.sol`
4. Paste into Remix

---

### Step 3: Compile Contract
1. Click **"Solidity Compiler"** tab (left sidebar)
2. Select compiler: **0.8.20** or higher
3. Enable **"Auto compile"** (optional)
4. Click **"Compile EtherTrialsTRIAv4.sol"**
5. ✅ Confirm: **Green checkmark** = successful compilation
6. ❌ If errors: Check you copied FULL contract

---

### Step 4: Prepare Constructor Parameters

**You need 2 parameters:**

#### Parameter 1: `_triaToken` (address)
```
0xd852713dd8ddf61316da19383d0c427adb85eb07
```
**This is your $TRIA token from Clanker**

#### Parameter 2: `_uniswapRouter` (address)

**⚠️ IMPORTANT: Check where your $TRIA liquidity exists first! See `DEX_ROUTER_GUIDE.md`**

**Option A: Uniswap V3 (Recommended if TRIA has V3 liquidity)** ⭐
```
0x2626664c2603336E57B271c5C0b26F421741e481
```

**Option B: BaseSwap (If TRIA on BaseSwap or smaller liquidity)**
```
0x327Df1E6de05895d2ab08513aaDD9313Fe505d86
```

**⚠️ Uniswap V4 is NOT compatible** - Contract uses V2/V3 interface only

**⚠️ VERIFY ROUTER ADDRESS MATCHES YOUR $TRIA LIQUIDITY LOCATION!**

---

### Step 5: Deploy Contract

1. Click **"Deploy & Run Transactions"** tab (left sidebar)

2. **Environment**: Select **"Injected Provider - MetaMask"**
   - MetaMask popup will appear → Click **"Connect"**
   - Confirm you see **"Base Mainnet"** at the top

3. **Contract**: Select **"EtherTrialsTRIAv4"** from dropdown

4. **Constructor Parameters**:
   - Click dropdown arrow next to **"Deploy"** button
   - You'll see 2 input fields:
   
   ```
   _TRIATOKEN (address): 0xd852713dd8ddf61316da19383d0c427adb85eb07
   _UNISWAPOROUTER (address): [USE UNISWAP V3 OR BASESWAP - SEE STEP 4]
   ```
   
   **⚠️ TRIPLE CHECK THESE ADDRESSES!**

5. **Gas Limit**: Leave default (Remix auto-calculates)

6. Click **"Deploy"** button (orange)

7. **MetaMask popup** will appear:
   - **Review transaction carefully**
   - Gas fee: ~0.005-0.01 ETH (depends on Base gas price)
   - Click **"Confirm"**

8. **Wait for deployment** (~5-10 seconds)
   - Remix console will show: "creation of EtherTrialsTRIAv4 pending..."
   - Then: "✅ Success" with contract address

9. **SAVE YOUR CONTRACT ADDRESS!**
   - Example: `0x1234...5678`
   - You'll need this for frontend integration

---

### Step 6: Verify Contract on BaseScan

**Option A: Using Remix Plugin** (Easiest)

1. Install **"Etherscan Contract Verification"** plugin in Remix
2. Click the plugin in left sidebar
3. Enter:
   - Contract Address: `YOUR_DEPLOYED_ADDRESS`
   - Contract Name: `EtherTrialsTRIAv4`
   - Constructor Arguments: (auto-filled by plugin)
4. Click **"Verify"**

**Option B: Manual Verification on BaseScan**

1. Go to: https://basescan.org/verifyContract
2. Enter **Contract Address**
3. Compiler Type: **Solidity (Single file)**
4. Compiler Version: **v0.8.20+commit.a1b79de6** (match your Remix version)
5. Open Source License Type: **MIT**
6. Paste **FULL contract code** from Remix
7. Constructor Arguments (ABI-encoded):
   ```
   Get from Remix console after deployment, or use BaseScan's constructor tool
   ```
8. Click **"Verify and Publish"**
9. Wait for verification (1-2 minutes)
10. ✅ Contract is now verified and readable on BaseScan!

---

## 🎉 POST-DEPLOYMENT STEPS

### 1. Test Basic Functions

In Remix **"Deployed Contracts"** section, expand your contract and test:

✅ **Read Functions** (free, no gas):
- `getCurrentPeriod()` → Should return `0`
- `areMiniGamesActive()` → Should return `false` (no funding yet)
- `owner()` → Should return **your wallet address**
- `triaToken()` → Should return `0xd852713dd8ddf61316da19383d0c427adb85eb07`

✅ **Write Functions** (costs gas):
- Do NOT test yet! Wait until frontend is integrated

---

### 2. Fund Mini Games (Optional)

**Remember:** Contract is **self-sustaining**, but you can jumpstart mini games:

Send ETH directly to contract:
```
To: YOUR_CONTRACT_ADDRESS
Value: 0.01 ETH (or more)
```

Then check: `areMiniGamesActive()` → Should return `true`

---

### 3. Update Frontend

Edit `src/lib/contracts/etherTrialsTRIAv2ABI.ts`:

```typescript
export const CONTRACT_ADDRESSES_V4 = {
  base: {
    etherTrialsTRIA: '0xYOUR_CONTRACT_ADDRESS', // ⚠️ UPDATE THIS
    triaToken: '0xd852713dd8ddf61316da19383d0c427adb85eb07',
    uniswapRouter: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'
  }
};
```

---

### 4. Monitor Contract

**BaseScan Dashboard:**
- View all transactions: `https://basescan.org/address/YOUR_CONTRACT_ADDRESS`
- Monitor balances
- Check events
- Verify swaps are working

**Key Metrics to Watch:**
- Tournament entries count
- Prize pool balance (in $TRIA)
- Mini game balance
- Lucky burst balance
- Buyback balance

---

## 🔍 TROUBLESHOOTING

### ❌ "Transaction Failed"
**Cause:** Insufficient gas or invalid parameters
**Fix:** 
- Check you have enough ETH
- Verify constructor parameters are correct addresses
- Increase gas limit manually in MetaMask

### ❌ "Swap Failed" during entry
**Cause:** $TRIA liquidity pool issues
**Fix:**
- Verify $TRIA has liquidity on BaseSwap
- Check slippage tolerance (2% in contract)
- Test with small amount first (0.00001 ETH)

### ❌ "Mini Games Inactive"
**Expected:** Mini games only activate when `miniGameBalance >= 0.01 ETH`
**Fix:**
- Wait for ~200 tournament entries (5% goes to mini games)
- OR send 0.01 ETH directly to contract

### ❌ "Already Entered" error
**Expected:** 1 FID can only enter once per 24-hour period
**Fix:** Wait for next period (check `getCurrentPeriod()`)

---

## 📊 CONTRACT OVERVIEW

### Addresses Used:
- **$TRIA Token**: `0xd852713dd8ddf61316da19383d0c427adb85eb07`
- **BaseSwap Router**: `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`
- **Your Contract**: `0x...` (after deployment)

### Key Functions:
- `enterTournament(uint256 fid)` - Entry with ETH (0.00001 - 1 ETH)
- `commitScore(uint256 period, uint256 fid, bytes32 hash)` - Submit score (step 1)
- `revealScore(...)` - Reveal score (step 2, within 10 min)
- `finalizePeriod(uint256 period)` - Anyone can call after 24 hours
- `claimAllRewards(uint256 fid)` - Claim all periods at once
- `playDice(uint256 fid)` - Play dice (when active)
- `playSpin(uint256 fid, uint8 betNumber)` - Play spin (when active)

### Owner Functions:
- `withdrawBuyback()` - Withdraw $TRIA buyback for redistribution
- `withdrawTreasury()` - Withdraw treasury ETH
- `withdrawMiniMaintenance()` - Withdraw mini game maintenance
- `injectTRIAToPrizePool(uint256 amount)` - Boost prize pool

---

## ⚠️ SECURITY REMINDERS

1. **Contract is immutable** - Can't change code after deploy
2. **Owner wallet** - Keep private key VERY safe
3. **Test with small amounts first** - Don't risk large sums immediately
4. **Monitor transactions** - Check BaseScan regularly
5. **Liquidity** - Ensure $TRIA pool has enough liquidity for swaps

---

## 🎯 QUICK REFERENCE

**Network:** Base Mainnet (8453)
**Gas for deployment:** ~0.005-0.01 ETH
**Contract size:** ~25 KB
**Expected deployment time:** 5-10 seconds

**Constructor:**
```solidity
constructor(
    address _triaToken,      // 0xd852713dd8ddf61316da19383d0c427adb85eb07
    address _uniswapRouter   // 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
)
```

---

## ✅ FINAL CHECKLIST BEFORE DEPLOY

- [ ] MetaMask on Base Mainnet
- [ ] 0.01 ETH available for gas
- [ ] $TRIA address confirmed: `0xd852713dd8ddf61316da19383d0c427adb85eb07`
- [ ] BaseSwap router confirmed: `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`
- [ ] Contract compiled successfully in Remix
- [ ] Constructor parameters double-checked
- [ ] Ready to click "Deploy"

**🚀 GOOD LUCK WITH YOUR DEPLOYMENT!**

---

## 📞 NEXT STEPS AFTER DEPLOYMENT

1. ✅ Save contract address
2. ✅ Verify on BaseScan
3. ✅ Test read functions
4. ✅ Update frontend with contract address
5. ✅ (Optional) Fund mini games with 0.01 ETH
6. ✅ Test with 1 small entry (0.00001 ETH)
7. ✅ Monitor on BaseScan
8. ✅ Celebrate! 🎉

---

**Remember:** This is production deployment. Take your time, double-check everything, and test thoroughly!
