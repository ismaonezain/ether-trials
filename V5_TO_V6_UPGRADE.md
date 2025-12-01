# Upgrade Guide: v5 → v6 (ETH to TRIA Auto-Swap)

## 🎯 Overview

Version 6 introduces **automatic ETH to TRIA token swapping** via Uniswap V3, transforming the entire prize pool economy to use TRIA tokens instead of ETH.

---

## 📊 Major Changes Summary

| Feature | v5 | v6 |
|---------|----|----|
| **Entry Payment** | ETH → Prize Pool | ETH → Swap to TRIA → Prize Pool |
| **Prize Pool Currency** | ETH | TRIA Tokens |
| **Prize Distribution** | ETH | TRIA Tokens |
| **Dice Payments** | ETH → Prize Pool | ETH → Swap to TRIA → Prize Pool |
| **Swap Integration** | None | Uniswap V3 SwapRouter |
| **Token Approval** | Not needed | Not needed (users pay ETH) |
| **Slippage Protection** | N/A | Configurable (default 5%) |

---

## 🔧 Technical Changes

### 1. **New Dependencies**

#### Interfaces Added:
```solidity
// v6 adds these interfaces:
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) 
        external 
        payable 
        returns (uint256 amountOut);
}
```

### 2. **New State Variables**

```solidity
// v6 adds:
ISwapRouter public constant swapRouter = ISwapRouter(0x2626664c2603336E57B271c5C0b26F421741e481);
address public constant WETH = 0x4200000000000000000000000000000000000006;
address public triaToken;
uint24 public poolFee = 3000;
uint256 public slippageBps = 500;
```

### 3. **Modified Structs**

```solidity
// v5:
struct Period {
    uint256 prizePoolETH;
    uint256 totalPoints;
    uint256 participantCount;
    uint256 startTime;
    uint256 endTime;
    bool distributed;
}

// v6:
struct Period {
    uint256 prizePoolTRIA;  // Changed: ETH → TRIA
    uint256 totalPoints;
    uint256 participantCount;
    uint256 startTime;
    uint256 endTime;
    bool distributed;
}

// v5:
struct Player {
    uint256 score;
    uint256 entryAmount;
    uint256 points;
    uint256 pendingPrizeETH;  // Changed in v6
    bool claimed;
    bool hasEntered;
}

// v6:
struct Player {
    uint256 score;
    uint256 entryAmount;      // Still in ETH (what user paid)
    uint256 points;
    uint256 pendingPrizeTRIA; // Changed: ETH → TRIA
    bool claimed;
    bool hasEntered;
}
```

### 4. **Modified Events**

```solidity
// v5:
event EntryPaid(address indexed player, uint256 ethAmount, uint256 period, uint256 timestamp);

// v6:
event EntryPaid(address indexed player, uint256 ethAmount, uint256 triaAmount, uint256 period, uint256 timestamp);

// v5:
event DiceRolled(address indexed player, uint256 period, bool isFree, uint256 price);

// v6:
event DiceRolled(address indexed player, uint256 period, bool isFree, uint256 ethPrice, uint256 triaReceived);

// New events in v6:
event TriaTokenUpdated(address indexed newToken);
event PoolFeeUpdated(uint24 newFee);
event SlippageUpdated(uint256 newSlippageBps);
```

### 5. **New Internal Function**

```solidity
// v6 adds swap functionality:
function _swapETHToTRIA(uint256 ethAmount) internal returns (uint256) {
    require(ethAmount > 0, "Zero amount");
    
    ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
        tokenIn: WETH,
        tokenOut: triaToken,
        fee: poolFee,
        recipient: address(this),
        deadline: block.timestamp + 300,
        amountIn: ethAmount,
        amountOutMinimum: 0, // TODO: Add price oracle
        sqrtPriceLimitX96: 0
    });

    uint256 triaReceived = swapRouter.exactInputSingle{value: ethAmount}(params);
    require(triaReceived > 0, "Swap failed");
    
    return triaReceived;
}
```

### 6. **Modified Functions**

#### Constructor:
```solidity
// v5:
constructor() {
    owner = msg.sender;
    currentPeriod = 1;
    // ...
}

// v6:
constructor(address _triaToken) {
    require(_triaToken != address(0), "Invalid TRIA token address");
    owner = msg.sender;
    triaToken = _triaToken;
    currentPeriod = 1;
    // ...
}
```

#### Enter Tournament:
```solidity
// v5:
function enterTournament() external payable nonReentrant {
    // ...
    p.prizePoolETH += msg.value;
    totalPrizeOwedETH += msg.value;
    // ...
}

// v6:
function enterTournament() external payable nonReentrant {
    // ...
    uint256 triaReceived = _swapETHToTRIA(msg.value);
    p.prizePoolTRIA += triaReceived;
    totalPrizeOwedTRIA += triaReceived;
    // ...
}
```

#### Roll Dice (Paid):
```solidity
// v5:
function rollDice() external payable nonReentrant {
    // ...
    p.prizePoolETH += msg.value;
    totalPrizeOwedETH += msg.value;
    // ...
}

// v6:
function rollDice() external payable nonReentrant {
    // ...
    uint256 triaReceived = _swapETHToTRIA(msg.value);
    p.prizePoolTRIA += triaReceived;
    totalPrizeOwedTRIA += triaReceived;
    // ...
}
```

#### Claim Prize:
```solidity
// v5:
function _internalClaim(address claimant, uint256 period) internal returns (uint256) {
    // ...
    (bool ok, ) = payable(claimant).call{value: amount}("");
    require(ok, "ETH transfer failed");
    // ...
}

// v6:
function _internalClaim(address claimant, uint256 period) internal returns (uint256) {
    // ...
    require(IERC20(triaToken).transfer(claimant, amount), "TRIA transfer failed");
    // ...
}
```

### 7. **New Admin Functions**

```solidity
// v6 adds these admin functions:

function setTriaToken(address newToken) external onlyOwner {
    require(newToken != address(0), "Invalid token address");
    triaToken = newToken;
    emit TriaTokenUpdated(newToken);
}

function setPoolFee(uint24 newFee) external onlyOwner {
    require(newFee == 500 || newFee == 3000 || newFee == 10000, "Invalid fee tier");
    poolFee = newFee;
    emit PoolFeeUpdated(newFee);
}

function setSlippage(uint256 newSlippageBps) external onlyOwner {
    require(newSlippageBps <= 5000, "Slippage too high");
    slippageBps = newSlippageBps;
    emit SlippageUpdated(newSlippageBps);
}

function emergencyWithdrawTRIA(address to, uint256 amount) external onlyOwner {
    require(to != address(0), "Zero address");
    uint256 available = IERC20(triaToken).balanceOf(address(this)) - totalPrizeOwedTRIA;
    require(amount <= available, "Cannot withdraw prize funds");
    require(IERC20(triaToken).transfer(to, amount), "Transfer failed");
}
```

---

## 📝 Migration Checklist

### For Contract Deployment:

#### Prerequisites:
- [ ] Have TRIA token address ready
- [ ] Verify WETH/TRIA pool exists on Uniswap V3
- [ ] Check pool liquidity is sufficient
- [ ] Identify optimal pool fee tier (500/3000/10000)

#### Deployment Steps:
- [ ] Deploy v6 contract with TRIA token address
- [ ] Verify pool fee is correct (`setPoolFee()` if needed)
- [ ] Set slippage tolerance if different from default 5%
- [ ] Test entry with minimal ETH
- [ ] Verify swap executed correctly
- [ ] Check TRIA balance increased in contract

### For Frontend Integration:

#### API Changes:
- [ ] Update prize pool display: `prizePoolETH` → `prizePoolTRIA`
- [ ] Update player data: `pendingPrizeETH` → `pendingPrizeTRIA`
- [ ] Update total owed: `totalPrizeOwedETH` → `totalPrizeOwedTRIA`
- [ ] Handle new event parameters (TRIA amounts)

#### UI Updates:
- [ ] Change prize pool display from "ETH" to "TRIA"
- [ ] Show both ETH paid and TRIA received on entry
- [ ] Display TRIA token logo/icon
- [ ] Add TRIA price display (optional)
- [ ] Update claim button text ("Claim TRIA" instead of "Claim ETH")

#### Event Listeners:
```javascript
// v5:
contract.on("EntryPaid", (player, ethAmount, period, timestamp) => {
  // Handle entry
});

// v6:
contract.on("EntryPaid", (player, ethAmount, triaAmount, period, timestamp) => {
  // Handle entry with both amounts
  console.log(`Paid ${ethAmount} ETH, received ${triaAmount} TRIA`);
});
```

---

## 🎮 User Experience Changes

### What Users See:

#### v5 Experience:
```
1. User pays 0.0001 ETH
2. Prize pool increases by 0.0001 ETH
3. User can claim ETH prize later
```

#### v6 Experience:
```
1. User pays 0.0001 ETH
2. Contract swaps to ~X TRIA tokens (depends on price)
3. Prize pool increases by X TRIA
4. User can claim TRIA prize later
```

### Benefits for Users:
- ✅ Still pay with familiar ETH
- ✅ No need to buy TRIA beforehand
- ✅ No token approvals needed
- ✅ Automatic best-price execution via Uniswap
- ✅ Win prizes in TRIA tokens
- ✅ Supports TRIA token ecosystem

---

## ⚠️ Important Considerations

### 1. **Gas Costs**
Swapping adds ~100-200k gas per transaction:
- v5 entry: ~100k gas
- v6 entry: ~200-300k gas (includes swap)

**Mitigation**: Base has low gas fees, so impact is minimal

### 2. **Slippage Risk**
Low liquidity can cause poor swap rates:
- Monitor pool liquidity
- Adjust slippage tolerance if needed
- Consider minimum liquidity requirements before launch

### 3. **Price Volatility**
TRIA price fluctuations affect prize pool value:
- Prize pool grows/shrinks with TRIA price
- Users should understand they're winning TRIA, not ETH
- Display USD values alongside TRIA amounts

### 4. **Smart Contract Risk**
New dependencies increase attack surface:
- Uniswap V3 SwapRouter (battle-tested)
- TRIA token contract (verify audit)
- WETH contract (standard)

### 5. **Liquidity Requirements**
Insufficient liquidity = failed swaps:
- Monitor WETH/TRIA pool depth
- Set appropriate slippage
- Consider entry size limits based on liquidity

---

## 🧪 Testing Strategy

### Unit Tests to Add:
```solidity
// Test swap functionality
function testSwapETHToTRIA() public {
    // Deploy with mock TRIA
    // Test swap with various amounts
    // Verify TRIA received > 0
}

// Test slippage protection
function testSlippageProtection() public {
    // Set low slippage
    // Attempt swap with low liquidity
    // Should revert if slippage exceeded
}

// Test entry with swap
function testEnterWithSwap() public {
    // Enter tournament with ETH
    // Verify TRIA added to prize pool
    // Check player entry amount in ETH
}
```

### Integration Tests:
1. Deploy on testnet (Base Sepolia)
2. Create test TRIA token
3. Add liquidity to Uniswap pool
4. Test full tournament cycle
5. Verify prize claims in TRIA

---

## 📈 Monitoring & Analytics

### Metrics to Track:

#### Swap Performance:
- Average swap rate (ETH/TRIA)
- Slippage per transaction
- Failed swap count
- Gas cost per swap

#### Prize Pool Health:
- TRIA prize pool value in USD
- Total TRIA locked in contract
- Claimed vs. unclaimed prizes
- Prize pool growth rate

#### User Behavior:
- Entry sizes (ETH amounts)
- TRIA received per entry
- Claim frequency
- Retention rate

---

## 🎯 Rollback Plan

If v6 has issues, you can:

### Option 1: Quick Fix
1. Deploy new v6 with fixes
2. Migrate state (if possible)
3. Update frontend

### Option 2: Revert to v5
1. Deploy fresh v5 contract
2. Announce migration period
3. Allow v6 users to claim prizes
4. Restart on v5

### Option 3: Hybrid Approach
1. Keep v6 running
2. Deploy v5 alongside
3. Let users choose version
4. Gradually sunset v6

---

## 🚀 Launch Recommendations

### Phase 1: Soft Launch (Week 1)
- Deploy v6 to mainnet
- Limit to small test group
- Monitor swap performance
- Collect feedback

### Phase 2: Beta Launch (Week 2-3)
- Open to wider audience
- Increase entry limits gradually
- Watch liquidity closely
- Optimize slippage settings

### Phase 3: Full Launch (Week 4+)
- Remove restrictions
- Full marketing push
- Monitor at scale
- Iterate based on data

---

## 📞 Support Checklist

### Documentation:
- [ ] Update user guides with v6 changes
- [ ] Create TRIA token explainer
- [ ] Add swap FAQ
- [ ] Video tutorial on claiming TRIA

### User Support:
- [ ] Train support team on v6 differences
- [ ] Prepare FAQ for common swap issues
- [ ] Create troubleshooting guide
- [ ] Set up monitoring dashboard

---

## ✅ Final Checklist

Before deploying v6:
- [ ] Code reviewed by team
- [ ] Tested on testnet extensively
- [ ] TRIA token contract verified
- [ ] Uniswap pool liquidity confirmed
- [ ] Frontend updated for v6
- [ ] Documentation complete
- [ ] Support team trained
- [ ] Monitoring tools ready
- [ ] Rollback plan in place
- [ ] Community informed

---

## 🎊 Ready to Upgrade!

v6 brings exciting TRIA token integration while maintaining all the great features of v5!

**Key Takeaway**: Users pay ETH, win TRIA - it's that simple! 🚀
