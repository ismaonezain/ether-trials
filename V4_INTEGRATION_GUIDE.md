# V4 Universal Router Integration Guide

## Quick Reference

### Deployment Parameters

When deploying the EtherTrialsTRIAv5 contract with V4 support:

```solidity
constructor(
    address _triaToken,      // Your TRIA token address
    address _uniswapRouter,  // V2 Router for fallback (optional)
    address _universalRouter // V4 Universal Router
)
```

### Base Mainnet Addresses

```
TRIA Token:       0xd852713dd8ddf61316da19383d0c427adb85eb07
V2 Router:        0x327Df1E6de05895d2ab08513aaDD9313Fe505d86 (BaseSwap)
Universal Router: 0x6ff5693b99212da76ad316178a184ab56d299b43 (Uniswap V4)
```

## How It Works

### The Three-Step V4 Swap Process

```solidity
function _swapETHToTRIAV4(uint256 ethAmount) internal returns (uint256)
```

**Step 1: V4_SWAP (0x00)**
- Initiates the swap calculation through the V4 PoolManager
- Determines output amount based on pool liquidity and fees
- Records the debt and credit with the PoolManager

**Step 2: SETTLE (0x09)**
- Settles the input currency (ETH/WETH) to the PoolManager
- Transfers ETH from the contract to the PoolManager
- Clears the debt recorded in step 1

**Step 3: TAKE (0x0a)**
- Takes the output currency (TRIA) from the PoolManager
- Transfers TRIA from the PoolManager to the contract
- Completes the swap transaction

### Command Encoding

```solidity
bytes memory commands = abi.encodePacked(
    V4_SWAP,  // 0x00
    SETTLE,   // 0x09
    TAKE      // 0x0a
);
```

### Input Encoding

```solidity
bytes[] memory inputs = new bytes[](3);

// Input 0 - V4_SWAP parameters
inputs[0] = abi.encode(
    address(this),  // recipient
    ethAmount,      // amountIn
    minOutput,      // amountOutMin
    path,           // encoded path
    true            // payerIsUser
);

// Input 1 - SETTLE parameters
inputs[1] = abi.encode(
    WETH_ADDRESS,   // currency
    ethAmount,      // amount
    true            // payerIsUser
);

// Input 2 - TAKE parameters
inputs[2] = abi.encode(
    TRIA_ADDRESS,   // currency
    address(this),  // recipient
    minOutput       // amount
);
```

## Usage Example

### Updating Tournament Entry to Use V4

The `enterTournament` function can optionally use V4:

```solidity
function enterTournament(uint256 fid) external payable {
    // ... entry validation ...
    
    // Swap to TRIA using V4
    uint256 triaReceived = _swapETHToTRIAV4(swapAmount);
    
    // ... rest of entry logic ...
}
```

### Choosing Between V2 and V4

You could implement a fallback mechanism:

```solidity
function _swapETHForTRIA(uint256 ethAmount) internal returns (uint256) {
    // Try V4 first
    try this._swapETHToTRIAV4(ethAmount) returns (uint256 amount) {
        return amount;
    } catch {
        // Fallback to V2
        return _swapETHForTRIAV2(ethAmount);
    }
}
```

## Testing Your Integration

### 1. Testnet Deployment

Deploy to Base Goerli/Sepolia first:

```bash
# Update your deployment script with testnet addresses
const TRIA_TOKEN = "0x..."; // Your test TRIA
const UNIVERSAL_ROUTER = "0x..."; // Testnet Universal Router

# Deploy
npx hardhat run scripts/deploy.js --network baseGoerli
```

### 2. Simple Swap Test

```javascript
// Test with small amount
const tx = await contract.enterTournament(12345n, {
  value: ethers.parseEther("0.001")
});

await tx.wait();

// Check TRIA received
const triaBalance = await triaToken.balanceOf(contractAddress);
console.log("TRIA received:", ethers.formatEther(triaBalance));
```

### 3. Verify Encoding

You can verify the encoding in a standalone test:

```javascript
const commands = ethers.solidityPacked(
  ["bytes1", "bytes1", "bytes1"],
  ["0x00", "0x09", "0x0a"]
);

const input0 = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address", "uint256", "uint256", "bytes", "bool"],
  [recipient, amountIn, minOut, path, true]
);

// ... encode input1 and input2 ...

const inputs = [input0, input1, input2];

// Call Universal Router
await universalRouter.execute(commands, inputs, { value: amountIn });
```

## Troubleshooting

### Common Issues

**"SwapFailed" Error**
- Check TRIA/WETH V4 pool exists and has liquidity
- Verify slippage tolerance (MIN_SLIPPAGE_TOLERANCE = 98%)
- Ensure contract has enough ETH
- Check Universal Router address is correct

**"Execution reverted" from Universal Router**
- Path encoding may be incorrect
- V4 pool may require additional parameters (fees, hooks)
- Check command codes match your Universal Router version

**Insufficient Output**
- Increase slippage tolerance (carefully!)
- Check pool liquidity
- May need larger trade to overcome fixed costs

### Debugging Tips

1. **Test Path Encoding**
   ```solidity
   // Try different path encodings
   bytes memory path = abi.encodePacked(WETH, TRIA);
   // or with fee tier
   bytes memory path = abi.encodePacked(WETH, uint24(3000), TRIA);
   ```

2. **Check Pool State**
   - Use V4 explorer to verify pool exists
   - Check liquidity amount
   - Verify pool is not paused

3. **Monitor Events**
   - Add events to track swap attempts
   - Log received amounts
   - Track failures for analysis

## Migration from V2

If you're updating from V2-only to V4:

### 1. Update Constructor

```solidity
// Old
constructor(address _tria, address _router)

// New
constructor(address _tria, address _router, address _universalRouter)
```

### 2. Deploy New Contract

You cannot upgrade the existing contract since it has immutable variables. Must deploy new contract.

### 3. Update Frontend

```typescript
// Old ABI
const CONTRACT_ABI = [...]; // V2 only

// New ABI
const CONTRACT_ABI = [...]; // Include universalRouter

// Update contract address
const CONTRACT_ADDRESS = "0x..."; // New deployment
```

### 4. Migrate State (Optional)

If you want to preserve tournament history:
- Keep old contract running
- Deploy new contract for new periods
- Users can claim old rewards from old contract
- New entries go to new contract

## Best Practices

1. **Always Test First**
   - Deploy to testnet
   - Test with small amounts
   - Verify all swap paths work

2. **Monitor Gas Costs**
   - V4 may have different gas costs
   - Three commands vs one swap
   - Factor into user pricing

3. **Have a Fallback**
   - Keep V2 router functional
   - Implement fallback logic
   - Don't rely solely on V4

4. **Document Your Deployment**
   - Record all addresses used
   - Save deployment transaction
   - Document any custom configurations

## Additional Resources

- [Uniswap V4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [Universal Router GitHub](https://github.com/Uniswap/universal-router)
- [Base Network Docs](https://docs.base.org)
- [V4 Pool Manager](https://docs.uniswap.org/contracts/v4/reference/core/PoolManager)

## Support

For issues with:
- **Encoding**: See `V4_SWAP_ENCODING_EXPLAINED.md`
- **Security**: See `SECURITY_SUMMARY.md`
- **Deployment**: See `REMIX_DEPLOYMENT_GUIDE.md`

---

**Remember:** V4 is a significant architectural change from V2/V3. Always test thoroughly before production use!
