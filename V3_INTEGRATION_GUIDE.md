# EtherTrials PointBased V3 - Integration Guide

## 🎯 Contract Overview

**Contract Address (Base Mainnet):** `0x925857e29e775e4091a7997eb0d57aebd0cf3220`

**Key Changes from Previous Versions:**

### ✅ What's New in V3:
1. **Fixed Entry Fee:** 0.00002 ETH (no user selection)
2. **Owner-Managed Scores:** Owner submits scores instead of commit-reveal
3. **Slippage Protection:** Frontend must provide `amountOutMinimum` parameter
4. **Simplified Flow:** No dice rolling, no commit-reveal complexity
5. **Pure Score System:** Points = score (no modal influence)
6. **TRIA Payouts:** All prizes paid in TRIA token

### ❌ What's Removed:
- Commit-reveal mechanism
- Dice rolling system
- User-selectable entry amounts
- Modal-based points calculation

---

## 📋 Contract Functions

### User Functions

#### `payEntryFee(uint256 amountOutMinimum) payable`
Pay tournament entry fee (0.00002 ETH).

**Parameters:**
- `amountOutMinimum`: Minimum TRIA output expected from swap (slippage protection)
  - Frontend should calculate this using Uniswap V3 Quoter
  - Passing `0` disables slippage protection (not recommended for production)

**Returns:** None (reverts on failure)

**Example:**
```typescript
// Calculate slippage (e.g., 1% tolerance)
const expectedOutput = await quoter.quoteExactInputSingle(...);
const amountOutMinimum = expectedOutput * 99n / 100n; // 1% slippage

await payEntryFee(amountOutMinimum);
```

#### `claimPrize(uint256 period)`
Claim TRIA rewards for a specific period.

**Parameters:**
- `period`: Period number to claim

**Requirements:**
- Period must be distributed
- User must have pending prize
- User hasn't claimed yet

---

### Owner Functions

#### `submitScore(address player, uint256 score)`
Submit single player's score.

**Parameters:**
- `player`: Player wallet address
- `score`: Final score (max 2,000,000)

**Requirements:**
- Caller must be owner
- Player must have entered tournament
- Period not yet distributed

#### `submitScoresBatch(address[] players, uint256[] scores)`
Submit multiple scores in one transaction (gas-efficient).

**Parameters:**
- `players`: Array of player addresses
- `scores`: Array of corresponding scores

**Requirements:**
- Arrays must be same length
- Caller must be owner
- Period not yet distributed

#### `allocatePrizes()`
Calculate and allocate prizes for current period.

**Requirements:**
- 24 hours passed since last distribution
- Period not yet distributed
- Prize pool > 0
- Total points > 0

**What it does:**
1. Calculate each player's share: `prize = (playerScore * prizePool) / totalPoints`
2. Mark prizes as pending for each player
3. Mark period as distributed
4. Start new period automatically

#### `withdrawPlatformFees()`
Withdraw accumulated platform fees (TRIA).

**Requirements:**
- Caller must be owner
- Platform fees > 0

---

## 🔧 View Functions

### `getCurrentPeriodInfo()`
Returns current period information.

**Returns:**
```solidity
(
  uint256 period,           // Current period number
  uint256 prizePoolTRIA,    // Prize pool in TRIA
  uint256 totalPoints,      // Sum of all scores
  uint256 participants,     // Number of entrants
  uint256 startTime,        // Period start timestamp
  uint256 endTime,          // Period end timestamp
  bool distributed          // Whether prizes allocated
)
```

### `getPlayerInfo(address player, uint256 period)`
Returns player's info for specific period.

**Returns:**
```solidity
(
  bool hasEntered,          // Whether player entered
  uint256 score,            // Player's submitted score
  uint256 pendingPrizeTRIA, // Claimable TRIA amount
  bool claimed,             // Whether player claimed
  uint256 points            // Player's points (= score in V3)
)
```

### Constants

```solidity
ENTRY_FEE = 0.00002 ether (20000000000000 wei)
MAX_SCORE = 2,000,000
DISTRIBUTION_INTERVAL = 24 hours
PRIZE_PERCENT = 80 (80% to prize pool)
PLATFORM_PERCENT = 20 (20% platform fees)
```

---

## 🎮 Player Flow

```
1. Pay Entry Fee (0.00002 ETH)
   ↓
2. Play Game & Achieve Score
   ↓
3. [OWNER] Submit Score to Contract
   ↓
4. [OWNER] Allocate Prizes (after 24h)
   ↓
5. Claim TRIA Rewards
```

---

## 🔐 Security Considerations

### Slippage Protection
**CRITICAL:** Always calculate and provide `amountOutMinimum` when calling `payEntryFee()`.

**Recommended Implementation:**
```typescript
import { QUOTER_V2_ADDRESS } from '@uniswap/v3-sdk';

// 1. Get quote from Uniswap V3 Quoter
const quoter = new ethers.Contract(QUOTER_V2_ADDRESS, quoterABI, provider);

const quote = await quoter.callStatic.quoteExactInputSingle({
  tokenIn: WETH_ADDRESS,
  tokenOut: TRIA_ADDRESS,
  fee: 3000, // 0.3%
  amountIn: ethers.utils.parseEther('0.00002'),
  sqrtPriceLimitX96: 0
});

// 2. Apply slippage tolerance (1-5%)
const slippageTolerance = 100; // 1%
const amountOutMinimum = quote.amountOut.mul(10000 - slippageTolerance).div(10000);

// 3. Call payEntryFee with protection
await contract.payEntryFee(amountOutMinimum, {
  value: ethers.utils.parseEther('0.00002')
});
```

### Owner Responsibilities
- Submit scores accurately from SpacetimeDB
- Allocate prizes within 24-48h of period end
- Verify score submissions before allocation

---

## 📊 Prize Calculation Example

**Scenario:**
- Prize Pool: 1000 TRIA
- Player A Score: 500,000
- Player B Score: 300,000
- Player C Score: 200,000
- Total Points: 1,000,000

**Prizes:**
- Player A: `(500,000 / 1,000,000) * 1000 = 500 TRIA`
- Player B: `(300,000 / 1,000,000) * 1000 = 300 TRIA`
- Player C: `(200,000 / 1,000,000) * 1000 = 200 TRIA`

---

## 🚀 Frontend Integration Checklist

### Essential Components

- [x] `TournamentEntryModalV3.tsx` - Entry payment modal
- [x] `usePointBasedContract.ts` - Contract interaction hook
- [x] `etherTrialsPointBasedV3ABI.ts` - Contract ABI
- [x] `ScoreSubmissionPanel.tsx` - Admin score submission UI

### Integration Steps

1. **Update Imports:**
```typescript
import { ETHER_TRIALS_V3_ABI, ETHER_TRIALS_V3_ADDRESS } from '@/lib/contracts/etherTrialsPointBasedV3ABI';
import { TournamentEntryModalV3 } from '@/components/game/TournamentEntryModalV3';
import { usePointBasedContract } from '@/hooks/usePointBasedContract';
```

2. **Entry Fee Payment:**
```typescript
const { payEntryFee, entryFee } = usePointBasedContract();

// Calculate slippage (placeholder - implement Quoter in production)
const amountOutMinimum = BigInt(0); // TODO: Use Quoter

await payEntryFee(amountOutMinimum);
```

3. **Admin Panel - Score Submission:**
```typescript
const { submitScoresBatch } = usePointBasedContract();

// Submit all scores from SpacetimeDB
await submitScoresBatch(playerAddresses, playerScores);
```

4. **Admin Panel - Prize Allocation:**
```typescript
const { allocatePrizes, prizePoolInfo } = usePointBasedContract();

// Check if can allocate
if (prizePoolInfo?.canDistribute) {
  await allocatePrizes();
}
```

5. **Prize Claiming:**
```typescript
const { claimPrize } = usePointBasedContract();

await claimPrize(BigInt(periodNumber));
```

---

## ⚠️ Known Limitations

1. **No Automatic Slippage:** Frontend must implement Quoter integration
2. **Manual Score Submission:** Owner must manually submit scores from SpacetimeDB
3. **24h Lock:** Cannot allocate prizes until 24h after previous distribution
4. **No Partial Claims:** Must claim entire prize for a period at once

---

## 🔄 Migration from V9/V10

### Key Differences

| Feature | V9/V10 | V3 |
|---------|--------|-----|
| Entry Amount | Variable | Fixed 0.00002 ETH |
| Score System | Commit-Reveal | Owner Submit |
| Points | Score × Modal | Pure Score |
| Dice Rolling | Yes | No |
| Slippage Param | No | Yes (required) |

### Migration Steps

1. Update contract address to V3
2. Remove commit/reveal modal code
3. Remove dice rolling components
4. Update entry modal to use fixed fee
5. Add owner score submission panel
6. Implement slippage calculation (Quoter)

---

## 📞 Support

**Contract Deployed:** ✅  
**Address:** `0x925857e29e775e4091a7997eb0d57aebd0cf3220`  
**Network:** Base Mainnet  
**Verified:** Yes (check BaseScan)

For questions or issues, refer to contract source code or contact development team.
