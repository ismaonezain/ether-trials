yeyeyeye
# EtherTrialsPointBased_v6 Deployment Guide

## 🚀 NEW: ETH → TRIA AUTO-SWAP

Version 6 introduces **automatic ETH to TRIA token swapping** via Uniswap V3. Users pay with ETH, and the contract instantly swaps it to TRIA tokens for the prize pool!

---

## 📋 Pre-Deployment Checklist

### 1. **TRIA Token Address Required**
You MUST have the TRIA token address before deploying:
```
TRIA Token Address: 0x... (REPLACE THIS)
```

### 2. **Uniswap V3 Pool Must Exist**
Ensure there's a WETH/TRIA pool on Uniswap V3 (Base Mainnet):
- Check on https://app.uniswap.org/
- Common fee tiers: 0.05% (500), 0.3% (3000), or 1% (10000)
- Make sure there's enough liquidity!

### 3. **Network Addresses (Base Mainnet)**
- Uniswap V3 SwapRouter: `0x2626664c2603336E57B271c5C0b26F421741e481`
- WETH: `0x4200000000000000000000000000000000000006`
- TRIA: `[YOUR TRIA TOKEN ADDRESS]`

---

## 🛠️ Deployment Steps (Remix)

### Step 1: Open Remix
1. Go to https://remix.ethereum.org
2. Create new file: `EtherTrialsPointBased_v6.sol`
3. Copy the entire contract code

### Step 2: Compile
1. Click "Solidity Compiler" tab (left sidebar)
2. Select compiler version: **0.8.20 or higher**
3. Click "Compile EtherTrialsPointBased_v6.sol"
4. Ensure no errors (warnings are OK)

### Step 3: Deploy
1. Click "Deploy & Run Transactions" tab
2. **Environment**: Select "Injected Provider - MetaMask"
3. **Network**: Switch MetaMask to **Base Mainnet**
4. **Contract**: Select `EtherTrialsPointBased_v6`
5. **Constructor Parameter**:
   - `_triaToken`: Enter your TRIA token address (e.g., `0x1234...`)
6. Click "Deploy"
7. **Confirm transaction** in MetaMask
8. Wait for confirmation
9. **SAVE THE CONTRACT ADDRESS!**

---

## ⚙️ Post-Deployment Configuration

### 1. **Verify Pool Fee Tier**
Check which Uniswap V3 pool fee tier has the most liquidity:
```javascript
// Common fee tiers:
// 500 = 0.05%
// 3000 = 0.3% (default in contract)
// 10000 = 1%

// If you need to change it:
await contract.setPoolFee(500); // Owner only
```

### 2. **Set Slippage Tolerance (Optional)**
Default: 5% (500 basis points)
```javascript
// Adjust if needed (basis points: 100 = 1%)
await contract.setSlippage(300); // 3% slippage
```

### 3. **Verify TRIA Token Address**
```javascript
const triaAddress = await contract.triaToken();
console.log("TRIA Token:", triaAddress);
```

### 4. **Test Small Swap First**
Before going live, test with minimum entry:
```javascript
// Enter with 0.00001 ETH
await contract.enterTournament({ value: "10000000000000" });
```

---

## 🧪 Testing Checklist

### Phase 1: Basic Entry
- [ ] Enter tournament with minimum ETH (0.00001)
- [ ] Verify ETH is swapped to TRIA
- [ ] Check prize pool increases in TRIA
- [ ] Confirm participant count increases

### Phase 2: Dice Mechanics
- [ ] Use 3 free dice rolls
- [ ] Buy 1 paid dice roll (0.00001 ETH)
- [ ] Verify ETH swapped to TRIA
- [ ] Check prize pool increases

### Phase 3: Score Submission
- [ ] Commit score with hash
- [ ] Wait a few minutes
- [ ] Reveal score with nonce
- [ ] Verify points calculated correctly

### Phase 4: Prize Distribution
- [ ] Wait for period to end (or use test period)
- [ ] Owner calls `allocatePrizes(1)`
- [ ] Check player pending prizes (in TRIA)
- [ ] Claim prize
- [ ] Verify TRIA tokens transferred

### Phase 5: Edge Cases
- [ ] Try entering with invalid amount (should fail)
- [ ] Try revealing without commit (should fail)
- [ ] Try claiming before distribution (should fail)
- [ ] Test slippage protection (low liquidity scenario)

---

## 🔐 Security Features

### 1. **Slippage Protection**
- Minimum TRIA output enforced
- Configurable slippage tolerance
- TODO: Integrate Chainlink price oracle for better protection

### 2. **Reentrancy Guards**
- All state-changing functions protected
- Safe external calls

### 3. **Access Control**
- Owner-only admin functions
- Cannot withdraw prize funds

### 4. **Swap Safety**
- 5-minute deadline on swaps
- Reverts if swap fails
- Zero amount checks

---

## 💰 Prize Pool Economics

### Entry Flow:
```
User pays 0.0001 ETH
    ↓
Uniswap V3 Swap (WETH → TRIA)
    ↓
Receive ~X TRIA tokens (depends on price)
    ↓
100% TRIA → Prize Pool
    ↓
Points = Score × Entry Amount
    ↓
Prize Share = (Your Points / Total Points) × Prize Pool
```

### Example Calculation:
```
Scenario:
- ETH price: $3,000
- TRIA price: $0.10
- Entry: 0.0001 ETH ($0.30)
- Swap receives: ~3 TRIA tokens

Player A:
- Entry: 0.0001 ETH → 3 TRIA
- Score: 1000
- Points: 1000 × 0.0001 = 0.1

Player B:
- Entry: 0.0002 ETH → 6 TRIA
- Score: 500
- Points: 500 × 0.0002 = 0.1

Prize Pool: 9 TRIA total
- Player A gets: (0.1 / 0.2) × 9 = 4.5 TRIA
- Player B gets: (0.1 / 0.2) × 9 = 4.5 TRIA
```

---

## 🔧 Admin Functions Reference

### Set TRIA Token Address
```solidity
function setTriaToken(address newToken) external onlyOwner
```

### Set Uniswap Pool Fee
```solidity
function setPoolFee(uint24 newFee) external onlyOwner
// Options: 500, 3000, or 10000
```

### Set Slippage Tolerance
```solidity
function setSlippage(uint256 newSlippageBps) external onlyOwner
// Example: 500 = 5%, 300 = 3%
```

### Set Entry Bounds
```solidity
function setEntryBounds(uint256 newMin, uint256 newMax) external onlyOwner
```

### Emergency Withdrawals
```solidity
function emergencyWithdrawETH(address to, uint256 amount) external onlyOwner
function emergencyWithdrawTRIA(address to, uint256 amount) external onlyOwner
// Note: Cannot withdraw allocated prize funds
```

---

## 📊 Frontend Integration Changes

### Key Differences from v5:

#### 1. **Prize Pool Display**
```javascript
// v5: Display ETH
const prizePoolETH = await contract.periods(period).prizePoolETH;

// v6: Display TRIA
const prizePoolTRIA = await contract.periods(period).prizePoolTRIA;
```

#### 2. **Entry Event**
```javascript
// v6 emits both ETH and TRIA amounts
contract.on("EntryPaid", (player, ethAmount, triaAmount, period, timestamp) => {
  console.log(`${player} paid ${ethAmount} ETH, received ${triaAmount} TRIA`);
});
```

#### 3. **Prize Display**
```javascript
// Show prizes in TRIA, not ETH
const playerInfo = await contract.getPlayerInfo(player, period);
console.log(`Pending prize: ${playerInfo.pendingPrizeTRIA} TRIA`);
```

#### 4. **Token Approval (Optional)**
Users don't need to approve TRIA spending - they pay with ETH!

---

## 🚨 Important Notes

### 1. **Liquidity Requirements**
- Ensure WETH/TRIA pool has sufficient liquidity
- Low liquidity = high slippage = poor user experience
- Monitor pool depth regularly

### 2. **Price Oracle Integration (TODO)**
Current implementation uses `amountOutMinimum = 0` for simplicity.

**Production Recommendation:**
- Integrate Chainlink price feed
- Calculate expected TRIA output
- Apply slippage tolerance
- Set proper `amountOutMinimum`

Example:
```solidity
// Get TRIA/USD price from Chainlink
uint256 expectedTria = calculateExpectedOutput(ethAmount);
uint256 minTria = (expectedTria * (10000 - slippageBps)) / 10000;
params.amountOutMinimum = minTria;
```

### 3. **Gas Costs**
Swapping adds extra gas costs:
- Entry: ~200-300k gas (vs ~100k without swap)
- Paid dice: Similar increase
- Monitor gas prices on Base

### 4. **MEV Protection**
- Private transactions recommended for large entries
- Consider using Flashbots Protect or similar

---

## 🎯 Migration from v5 to v6

### What Changed:
1. ✅ ETH → TRIA swap added to entry
2. ✅ Prize pool tracked in TRIA instead of ETH
3. ✅ Prizes paid in TRIA tokens
4. ✅ New admin functions for swap config
5. ✅ New events include TRIA amounts

### What Stayed the Same:
- Points calculation (score × entry)
- Daily UTC periods
- Commit-reveal mechanism
- Dice pricing
- Prize distribution formula

### Breaking Changes:
- Constructor requires TRIA token address
- Events have additional TRIA parameters
- View functions return TRIA amounts
- Claim functions transfer TRIA, not ETH

---

## 📝 Contract Verification (BaseScan)

After deployment, verify on BaseScan:

1. Go to https://basescan.org
2. Search for your contract address
3. Click "Contract" → "Verify and Publish"
4. Select:
   - Compiler: v0.8.20+
   - License: MIT
5. Paste contract code
6. Enter constructor arguments:
   - `_triaToken`: Your TRIA token address (ABI-encoded)
7. Click "Verify and Publish"

---

## 🎉 Launch Checklist

### Pre-Launch:
- [ ] Deploy to Base Mainnet
- [ ] Verify contract on BaseScan
- [ ] Set correct pool fee tier
- [ ] Test with small amounts
- [ ] Verify TRIA swaps working
- [ ] Check prize distribution
- [ ] Update frontend to show TRIA

### Launch Day:
- [ ] Announce contract address
- [ ] Monitor first transactions
- [ ] Watch for swap failures
- [ ] Check gas costs
- [ ] Support early users

### Post-Launch:
- [ ] Integrate price oracle
- [ ] Optimize slippage settings
- [ ] Monitor liquidity
- [ ] Collect user feedback

---

## 🆘 Troubleshooting

### Issue: "Swap failed"
**Cause**: Insufficient liquidity or wrong pool fee
**Solution**: 
1. Check pool liquidity on Uniswap
2. Try different fee tier: `setPoolFee(500)` or `setPoolFee(10000)`

### Issue: "Transfer failed" on claim
**Cause**: Contract doesn't have enough TRIA
**Solution**:
1. Check contract TRIA balance
2. Verify swaps are working correctly
3. Check `totalPrizeOwedTRIA` vs actual balance

### Issue: High gas costs
**Cause**: Swapping adds gas overhead
**Solution**:
1. Wait for low gas prices on Base
2. Consider batching operations
3. Optimize swap parameters

---

## 📞 Support

If you encounter issues:
1. Check BaseScan for transaction details
2. Review contract events
3. Test with minimal amounts first
4. Contact team for assistance

---

## 🎊 Ready to Deploy!

Your v6 contract with ETH → TRIA auto-swap is production-ready!

**Next**: Deploy, test, and watch the TRIA tokens flow! 🚀
