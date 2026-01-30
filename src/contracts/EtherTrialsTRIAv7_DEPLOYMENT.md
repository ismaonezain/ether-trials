kuyhhuih
# EtherTrialsTRIAv7 Deployment Guide

## Overview
Clean, optimized smart contract based on AnimeRPGPrizePoolV2 structure with:
- **Point-based prize distribution** (proportional to score)
- **Claim all periods** (one button for all rewards)
- **Commit-reveal score system** (20 min window)
- **Daily dice system** (3 free + exponential pricing)
- **Buyback TRIA + Treasury ETH**

---

## Deployment Steps

### 1. Prerequisites
- Remix IDE or Hardhat
- Base Network RPC configured
- Owner wallet with ETH for gas
- TRIA token deployed
- Uniswap V2 Router address (Base: `0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24`)

### 2. Deploy Contract

**Constructor Parameters:**
```solidity
constructor(
    address _triaToken,      // Your TRIA token address
    address _uniswapRouter   // 0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24 (Base)
)
```

**In Remix:**
1. Open `EtherTrialsTRIAv7_CommitReveal.sol`
2. Compiler: `0.8.20+`
3. Enable optimization: `200 runs`
4. Compile contract
5. Switch to "Deploy & Run Transactions"
6. Select "Injected Provider - MetaMask"
7. Enter constructor parameters
8. Deploy

### 3. Verify on BaseScan

```bash
# Constructor ABI-encoded arguments
_triaToken: 0xYOUR_TRIA_ADDRESS
_uniswapRouter: 0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24
```

**Settings:**
- Compiler: `0.8.20`
- Optimization: `Yes` (200 runs)
- License: `MIT`

---

## Contract Features

### Entry System
- **Entry Fee:** 0.0001 - 1 ETH
- **Fee Split:**
  - 85% → Prize pool (TRIA)
  - 10% → Buyback (TRIA)
  - 5% → Treasury (ETH)
- **One entry per period**

### Daily Dice System
- **3 free rolls per period**
- **Paid rolls:** Exponential pricing
  - 1st: 0.00001 ETH
  - 2nd: 0.00002 ETH
  - 3rd: 0.00004 ETH
  - 4th: 0.00008 ETH
  - Formula: `0.00001 * (2 ^ paidRollsUsed)`
- **Payment Split:**
  - 80% → Buyback TRIA
  - 20% → Treasury ETH

### Commit-Reveal Score (2-Step)

**Step 1: Commit Hash (Off-chain)**
```javascript
const score = 1000;
const nonce = Math.floor(Math.random() * 1000000);
const hash = ethers.solidityPackedKeccak256(
  ['uint256', 'uint256', 'address'],
  [score, nonce, playerAddress]
);
await contract.commitScore(hash);
```

**Step 2: Reveal Score (Within 20 min)**
```solidity
await contract.revealScore(score, nonce);
```

### Point-Based Prize Distribution

**How it works:**
1. Players reveal scores (scores = points)
2. Contract tracks `totalPoints` per period
3. Prize allocation: `userPrize = (userPoints / totalPoints) * totalPrize`
4. Anyone calls `allocatePrizes(period)` after period ends
5. Users claim with `claimAllRewards()` - gets all unclaimed rewards from all periods!

**Example:**
- Total prize pool: 1000 TRIA
- Total points: 10,000
- Player A score: 1,000 points → Gets 100 TRIA (10%)
- Player B score: 500 points → Gets 50 TRIA (5%)
- Player C score: 8,500 points → Gets 850 TRIA (85%)

### Claim All Periods

**Old way (V6):**
```solidity
claimPrize(period1);
claimPrize(period2);
claimPrize(period3);
// Multiple transactions = expensive!
```

**New way (V7):**
```solidity
claimAllRewards();
// One transaction = cheap!
// Claims ALL unclaimed rewards from ALL periods
```

---

## Contract Functions

### Write Functions (Players)

```solidity
// Enter tournament
enterTournament() payable
// Amount: 0.0001 - 1 ETH

// Roll dice
rollDice() payable
// Free: 0 ETH (3x per period)
// Paid: 0.00001, 0.00002, 0.00004, ...

// Commit score hash
commitScore(bytes32 commitHash)

// Reveal score (within 20 min)
revealScore(uint256 score, uint256 nonce)

// Claim all rewards from all periods
claimAllRewards()
```

### Write Functions (Anyone)

```solidity
// Allocate prizes after period ends
allocatePrizes(uint256 period)

// Start new period (after allocation)
startNewPeriod()
```

### Write Functions (Owner)

```solidity
// Withdraw buyback TRIA
withdrawBuyback()

// Withdraw treasury ETH
withdrawTreasury()

// Inject TRIA to boost prize pool
injectTRIAToPrizePool(uint256 amount)
```

### View Functions

```solidity
// Get current period
getCurrentPeriod() returns (uint256)

// Get period info
getPeriodInfo(uint256 period) returns (
    uint256 startTime,
    uint256 endTime,
    uint256 triaPool,
    uint256 participants,
    uint256 totalPoints,
    bool allocated,
    uint256 timeRemaining
)

// Get user entry
getUserEntry(uint256 period, address user) returns (
    uint256 amount,
    uint256 entryTime,
    bool hasEntered
)

// Get dice info
getDiceInfo(uint256 period, address user) returns (
    uint256 freeRollsUsed,
    uint256 freeRollsRemaining,
    uint256 paidRollsUsed,
    uint256 nextPaidPrice
)

// Get score commit
getScoreCommit(uint256 period, address user) returns (
    bytes32 commitHash,
    uint256 commitTime,
    uint256 score,
    bool revealed
)

// Get user points
getUserPoints(uint256 period, address user) returns (uint256)

// Get all user periods
getUserPeriods(address user) returns (uint256[])

// Get claimable rewards (all periods)
getClaimableRewards(address user) returns (uint256)

// Check if can reveal
canReveal(uint256 period, address user) returns (bool)

// Get next dice price
getNextDicePrice(uint256 period, address user) returns (uint256)

// Get balances
getBalances() returns (uint256 buyback, uint256 treasury)
```

---

## Game Flow

```
Period Start (24h)
    ↓
Players: enterTournament() with 0.0001-1 ETH
    ↓
Players: rollDice() (3 free, then paid)
    ↓
Players: Play game
    ↓
Players: commitScore(hash)
    ↓
Players: revealScore(score, nonce) within 20 min
    ↓
Contract: Auto-calculate points
    ↓
Period Ends (24h passed)
    ↓
Anyone: allocatePrizes(period)
    ↓
Players: claimAllRewards() - gets ALL unclaimed from ALL periods!
    ↓
Anyone: startNewPeriod()
    ↓
Repeat
```

---

## Testing Checklist

### Basic Flow
- [ ] Deploy contract successfully
- [ ] First period auto-created (period 1)
- [ ] Enter tournament with valid ETH amount
- [ ] Roll 3 free dice
- [ ] Roll paid dice (check exponential pricing)
- [ ] Commit score hash
- [ ] Reveal score within 20 min
- [ ] Check user points recorded

### Prize Allocation
- [ ] Wait for period to end (24h)
- [ ] Call allocatePrizes(1)
- [ ] Check getClaimableRewards(user) shows correct amount
- [ ] Call claimAllRewards()
- [ ] Verify TRIA transferred to user
- [ ] Check pendingPrizes updated

### Admin Functions
- [ ] withdrawBuyback() - get TRIA
- [ ] withdrawTreasury() - get ETH
- [ ] injectTRIAToPrizePool() - boost prize

### Period Management
- [ ] startNewPeriod() after allocation
- [ ] New period auto-increments
- [ ] User can enter new period

---

## Security Features

1. **Wallet-based auth** - Uses `msg.sender`, no FID spoofing
2. **Commit-reveal** - Prevents score manipulation
3. **20-min reveal window** - Enforces timely submission
4. **Hash verification** - Ensures score integrity
5. **One entry per period** - Prevents multi-entry
6. **Min/max entry limits** - Prevents extreme bets (0.0001-1 ETH)
7. **Point-based distribution** - Fair, proportional rewards
8. **Claim all** - Simple, gas-efficient claiming

---

## Constants

```solidity
PERIOD_DURATION = 24 hours
REVEAL_WINDOW = 20 minutes
MIN_ENTRY = 0.0001 ether
MAX_ENTRY = 1 ether
BASE_DICE_PRICE = 0.00001 ether
FREE_DICE_PER_PERIOD = 3

ENTRY_PRIZE_PERCENT = 85%
ENTRY_BUYBACK_PERCENT = 10%
ENTRY_TREASURY_PERCENT = 5%

DICE_BUYBACK_PERCENT = 80%
DICE_TREASURY_PERCENT = 20%
```

---

## Support

For issues or questions:
1. Check BaseScan for transaction details
2. Verify contract parameters match expected values
3. Ensure sufficient gas for transactions
4. Check TRIA token balance in contract for prize pool

---

## License

MIT
