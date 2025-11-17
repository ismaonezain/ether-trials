# Uniswap V4 Universal Router Encoding Fix

## Problem Summary

The original issue was with incorrectly encoding the Uniswap V4 Universal Router swap operation. The main problems were:

1. **Incorrect inputs array structure** - Commands and parameters were being combined incorrectly
2. **Command/inputs mismatch** - One command with improperly structured inputs
3. **Missing proper encoding** - V4 swaps require three sequential actions: SWAP, SETTLE, TAKE

## Solution: Proper V4 Encoding

### Commands Array Structure

The `commands` parameter is a `bytes` array where each byte represents a separate action:

```solidity
bytes memory commands = abi.encodePacked(
    V4_SWAP,  // 0x00 - Execute swap through V4 PoolManager
    SETTLE,   // 0x09 - Settle currency owed to PoolManager
    TAKE      // 0x0a - Take currency from PoolManager to recipient
);
```

**Key Point:** Three separate command bytes for the three sequential actions.

### Inputs Array Structure

The `inputs` parameter is a `bytes[]` array where each element corresponds to one command:

```solidity
bytes[] memory inputs = new bytes[](3);  // Must match number of commands!
```

#### Input 0 - V4_SWAP Parameters:
```solidity
inputs[0] = abi.encode(
    address(this),    // recipient - contract receives tokens
    ethAmount,        // amountIn - exact ETH to swap
    minOutput,        // amountOutMin - slippage protection
    path,             // path - WETH -> TRIA (abi.encodePacked)
    true              // payerIsUser - contract is the payer
);
```

#### Input 1 - SETTLE Parameters:
```solidity
inputs[1] = abi.encode(
    uniswapRouter.WETH(),  // currency - WETH being settled
    ethAmount,             // amount - amount to settle
    true                   // payerIsUser - contract settles
);
```

#### Input 2 - TAKE Parameters:
```solidity
inputs[2] = abi.encode(
    triaToken,        // currency - TRIA token to receive
    address(this),    // recipient - contract receives TRIA
    minOutput         // amount - minimum to take
);
```

## Why This Structure?

### Uniswap V4 Architecture

Uniswap V4 uses a singleton `PoolManager` contract that holds all pool liquidity. When swapping:

1. **V4_SWAP** - Initiates the swap calculation through the PoolManager
2. **SETTLE** - Pays the input currency (ETH/WETH) to the PoolManager
3. **TAKE** - Receives the output currency (TRIA) from the PoolManager

This three-step process ensures proper accounting with the PoolManager.

### The Universal Router's Execute Function

```solidity
interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs) external payable;
}
```

- **commands**: Single bytes array, each byte = one command
- **inputs**: Array of encoded parameters, one per command
- **Length must match**: `commands.length == inputs.length`

## What Was Wrong Before?

### ❌ Incorrect (Original Issue):

```solidity
// WRONG: Single command trying to handle everything
bytes memory commands = abi.encodePacked(V4_SWAP);
bytes[] memory inputs = new bytes[](1);
inputs[0] = abi.encode(...); // Missing SETTLE and TAKE actions
```

**Problems:**
- Only one command, missing SETTLE and TAKE
- Inputs array length (1) doesn't match required actions (3)
- Cannot properly interact with PoolManager
- Swap would fail or revert

### ✅ Correct (Fixed):

```solidity
// CORRECT: Three commands for complete V4 swap flow
bytes memory commands = abi.encodePacked(V4_SWAP, SETTLE, TAKE);
bytes[] memory inputs = new bytes[](3);
inputs[0] = abi.encode(...); // V4_SWAP params
inputs[1] = abi.encode(...); // SETTLE params
inputs[2] = abi.encode(...); // TAKE params
```

**Benefits:**
- Properly structured for V4 architecture
- Correct command/input matching (3:3)
- Handles full swap flow with PoolManager
- Follows Universal Router specification

## Implementation Details

### Contract Changes

1. **Added Universal Router Interface:**
```solidity
interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs) external payable;
}
```

2. **Added V4 Command Constants:**
```solidity
bytes1 public constant V4_SWAP = 0x00;
bytes1 public constant SETTLE = 0x09;
bytes1 public constant TAKE = 0x0a;
```

3. **Added Universal Router State Variable:**
```solidity
IUniversalRouter public immutable universalRouter;
```

4. **Updated Constructor:**
```solidity
constructor(
    address _triaToken,
    address _uniswapRouter,
    address _universalRouter  // New parameter
)
```

5. **Implemented _swapETHToTRIAV4 Function:**
- Properly encodes three commands
- Properly encodes three input arrays
- Tracks balance changes
- Validates minimum output received

## Testing Recommendations

To test this implementation:

1. Deploy with Base mainnet Universal Router: `0x6ff5693b99212da76ad316178a184ab56d299b43`
2. Ensure TRIA token has V4 liquidity
3. Test with small ETH amount (0.001 ETH)
4. Verify TRIA tokens received
5. Check slippage protection works

## References

- Uniswap V4 Docs: https://docs.uniswap.org/contracts/v4/overview
- Universal Router: https://github.com/Uniswap/universal-router
- Base Network V4 Router: `0x6ff5693b99212da76ad316178a184ab56d299b43`

## Summary

The fix ensures proper encoding for Uniswap V4 Universal Router by:
- Using three separate commands (V4_SWAP, SETTLE, TAKE)
- Providing three separate input arrays (one per command)
- Following the correct ABI encoding format
- Matching commands and inputs array lengths/structure
- Properly handling the V4 PoolManager interaction flow
