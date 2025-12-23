# 🔄 DEX Router Guide - Base Network

## 📍 Official Router Addresses on Base Mainnet

### **1. Uniswap V3 (Recommended)** ⭐
```
Router Address: 0x2626664c2603336E57B271c5C0b26F421741e481
```

**Why Use:**
- ✅ **Most liquid** DEX on Base
- ✅ Concentrated liquidity = better prices
- ✅ Officially deployed by Uniswap Labs
- ✅ Audited & battle-tested
- ✅ Best for tokens with established liquidity

**Compatible With:**
- ✅ Our contract (uses V2-compatible interface via quoter)
- ✅ $TRIA token (if liquidity exists on V3)

**Verification:**
- BaseScan: https://basescan.org/address/0x2626664c2603336E57B271c5C0b26F421741e481
- Official Docs: https://docs.base.org/

---

### **2. BaseSwap (Alternative)**
```
Router Address: 0x327Df1E6de05895d2ab08513aaDD9313Fe505d86
```

**Why Use:**
- ✅ **Uniswap V2 fork** - simple interface
- ✅ Native to Base ecosystem
- ✅ Lower fees than V3
- ✅ Good for new/smaller tokens

**Compatible With:**
- ✅ Our contract (perfect V2 interface match)
- ✅ Any ERC20 token with WETH pair

**Verification:**
- BaseScan: https://basescan.org/address/0x327Df1E6de05895d2ab08513aaDD9313Fe505d86
- Check on BaseSwap frontend

---

### **3. Uniswap V4 (Not Compatible)** ⚠️
```
Universal Router: 0x6ff5693b99212da76ad316178a184ab56d299b43
```

**Why NOT Use (Yet):**
- ❌ **Different architecture** - uses singleton PoolManager
- ❌ Requires hooks system integration
- ❌ NOT compatible with V2 router interface
- ❌ Would need complete contract redesign

**Future Consideration:**
- If your $TRIA liquidity is ONLY on V4, we need to redesign the swap function
- For now, recommend moving liquidity to V3 or using BaseSwap

---

## 🔍 How to Find Router Addresses

### Method 1: BaseScan Search
1. Go to: https://basescan.org
2. Search: "Uniswap Router" or "BaseSwap Router"
3. Look for **verified contracts** with "Router" label
4. Check contract functions for `swapExactETHForTokens`

### Method 2: DEX Documentation
- **Uniswap**: https://docs.uniswap.org/contracts/v3/reference/deployments
- **BaseSwap**: Check their official website
- **Base Docs**: https://docs.base.org/tools/block-explorers

### Method 3: Contract Verification
Check if router has these functions:
```solidity
function swapExactETHForTokens(
    uint amountOutMin,
    address[] calldata path,
    address to,
    uint deadline
) external payable returns (uint[] memory amounts);

function WETH() external pure returns (address);
```

---

## 💡 Which Router Should You Use?

### **Scenario 1: $TRIA has liquidity on Uniswap V3**
✅ **Use Uniswap V3**: `0x2626664c2603336E57B271c5C0b26F421741e481`
- Best prices, most liquid
- Deploy contract with this router

### **Scenario 2: $TRIA has liquidity on Uniswap V4 ONLY**
⚠️ **Problem**: Our contract not compatible with V4
**Solutions:**
1. **Add V3 liquidity** (recommended) - then use V3 router
2. **Use BaseSwap** (if TRIA/WETH pair exists)
3. **Contract redesign** for V4 (complex, needs time)

### **Scenario 3: $TRIA is new token with small liquidity**
✅ **Use BaseSwap**: `0x327Df1E6de05895d2ab08513aaDD9313Fe505d86`
- Lower fees
- Simple interface
- Good for new tokens

---

## 🚨 Important: Check Your $TRIA Liquidity

**Before deploying, verify where $TRIA liquidity exists:**

### Check on Uniswap V3:
```
1. Go to: https://app.uniswap.org/explore/pools
2. Search: TRIA/WETH on Base
3. Check pool size & volume
```

### Check on BaseSwap:
```
1. Go to BaseSwap website
2. Search: TRIA/WETH pair
3. Check liquidity
```

### Check on Uniswap V4:
```
1. Go to Uniswap V4 explorer
2. Search: 0xd852713dd8ddf61316da19383d0c427adb85eb07
3. Check pool manager
```

---

## 📝 Your $TRIA Token

```
Token Address: 0xd852713dd8ddf61316da19383d0c427adb85eb07
Network: Base Mainnet
Deployed via: Clanker (Farcaster)
```

**Next Step:** Check which DEX has your TRIA/WETH liquidity pool!

---

## 🎯 Recommendation for Your Deployment

Based on your situation:

1. **Check liquidity location** first:
   ```bash
   # On BaseScan, search your TRIA token
   # Look at "Transfers" tab
   # Find the pool contract address
   # Check which router that pool uses
   ```

2. **If V4 only:**
   - Consider adding V3 liquidity for better compatibility
   - OR use BaseSwap if available
   - Our contract works best with V2/V3 interfaces

3. **Deploy with correct router:**
   ```solidity
   // If TRIA on V3:
   _uniswapRouter: 0x2626664c2603336E57B271c5C0b26F421741e481
   
   // If TRIA on BaseSwap or prefer simplicity:
   _uniswapRouter: 0x327Df1E6de05895d2ab08513aaDD9313Fe505d86
   ```

---

## 🔗 Useful Links

- **BaseScan**: https://basescan.org
- **Uniswap V3 Docs**: https://docs.uniswap.org/contracts/v3/overview
- **Base Network Docs**: https://docs.base.org
- **BaseSwap**: Find on Base ecosystem list

---

## ❓ FAQ

**Q: Why not use Uniswap V4 if it's newest?**
A: V4 has completely different architecture (singleton pools, hooks). Our contract uses V2 interface which works with V3 but NOT V4. Redesign needed.

**Q: Can I switch router after deployment?**
A: No, router is `immutable` in contract. Must redeploy to change.

**Q: Which is cheaper, V3 or BaseSwap?**
A: BaseSwap usually cheaper gas, but V3 better prices on larger swaps due to liquidity.

**Q: How do I check if swap will work before deploying?**
A: Test swap on the DEX frontend first. If you can swap 0.001 ETH → TRIA successfully, router will work.

---

**✅ Summary:** Check where your $TRIA liquidity exists, then choose the matching router. Uniswap V3 recommended for established tokens, BaseSwap good for new tokens.
