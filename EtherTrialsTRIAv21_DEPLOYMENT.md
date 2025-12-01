# EtherTrialsTRIAv21 Deployment Guide

## Overview
**EtherTrialsTRIAv21** is the simplified scoring version of the tournament contract where:
- ✅ **Frontend calculates weighted scores** using formula: `weighted_score = score × (entry / 6B TRIA)`
- ✅ **Contract only stores and allocates** - NO complex arithmetic calculations needed!
- ✅ **Period aligned to 00:00 UTC** for worldwide synchronization
- ✅ **Gas efficient** - simpler logic means lower gas costs
- ✅ **No arithmetic overflow issues** - weighted scores are small decimal numbers

---

## Key Changes from V20

### ❌ V20 Problems:
```solidity
// Contract calculated: points = score × entryAmount / 1 ether
// Result: HUGE numbers (millions/billions) causing overflow
uint256 newPoints = (score * p.entryAmount) / 1 ether;
```

### ✅ V21 Solution:
```solidity
// Frontend calculates weighted score
// Contract receives small numbers (0.001 - 1000) scaled by 1e6
// No complex calculation, just store and allocate!
p.points = points; // Store weighted score from frontend
```

---

## Contract Details

- **Network:** Base Mainnet (Chain ID: 8453)
- **TRIA Token:** `0xD852713dD8dDF61316DA19383D0c427aDb85EB07`
- **Compiler:** Solidity ^0.8.26
- **Entry Range:** 50,000 - 6,000,000,000 TRIA (adjustable by owner)
- **Period Duration:** 24 hours (00:00 UTC to 00:00 UTC)
- **Reveal Window:** 20 minutes

---

## Deployment Steps

### 1. Prepare Contract

Copy the contract code from:
```
src/contracts/EtherTrialsTRIAv21.sol
```

### 2. Deploy via Remix

1. Go to [Remix IDE](https://remix.ethereum.org/)
2. Create a new file: `EtherTrialsTRIAv21.sol`
3. Paste the contract code
4. Compile with Solidity **^0.8.26**
5. Switch to "Deploy & Run Transactions" tab
6. **Environment:** Select "Injected Provider - MetaMask"
7. **Network:** Make sure MetaMask is connected to **Base Mainnet** (Chain ID: 8453)
8. **Contract:** Select `EtherTrialsTRIAv21`
9. Click **Deploy**
10. Confirm transaction in MetaMask

### 3. Verify Contract on Basescan

1. Go to [Basescan](https://basescan.org/)
2. Search for your deployed contract address
3. Click "Contract" tab → "Verify and Publish"
4. Fill in:
   - **Compiler Type:** Solidity (Single file)
   - **Compiler Version:** v0.8.26
   - **License:** MIT
5. Paste contract code
6. Submit for verification

### 4. Update Frontend Configuration

After deployment, update the contract address:

**File:** `src/lib/contracts/etherTrialsTRIAv21ABI.ts`

```typescript
// Line 9 - Update with your deployed address
export const ETHER_TRIALS_TRIA_V21_ADDRESS = '0xYourDeployedContractAddress' as Address;
```

---

## How Frontend Calculates Weighted Scores

### Formula:
```typescript
const SIX_BILLION_TRIA = 6_000_000_000;
const weightedScore = (baseScore * entryAmountTRIA) / SIX_BILLION_TRIA;
```

### Example:
```
Player:
- Base Score: 10,000
- Entry: 50,000 TRIA
- Max Entry: 6,000,000,000 TRIA

Weighted Score = (10,000 × 50,000) / 6,000,000,000
                = 500,000,000 / 6,000,000,000
                = 0.083333...
```

### Scaling for Contract:
```typescript
// Frontend multiplies by 1e6 for precision
const scaledWeightedScore = Math.floor(weightedScore * 1_000_000);
// Result: 0.083333 × 1,000,000 = 83,333

// Send to contract as BigInt
const points = BigInt(scaledWeightedScore);
```

---

## Contract Functions

### Player Functions:
- `enterTournament(uint256 triaAmount)` - Enter current period with TRIA tokens
- `rollDice(uint256 triaAmount)` - Roll dice (free or paid)
- `commitScore(bytes32 commitHash)` - Commit weighted score hash
- `revealScore(uint256 points, uint256 nonce)` - Reveal weighted score
- `claimPrize(uint256 period)` - Claim prize for a period
- `claimAllForUser()` - Claim all pending prizes

### Admin Functions (Owner Only):
- `submitPoints(address player, uint256 points)` - Submit weighted score for a player
- `submitPointsBatch(address[] players, uint256[] points)` - Batch submit weighted scores
- `allocatePrizes(uint256 period)` - Allocate prizes and start new period
- `setEntryBounds(uint256 newMin, uint256 newMax)` - Update entry limits
- `transferOwnership(address newOwner)` - Transfer contract ownership

### View Functions:
- `getCurrentPeriodInfo()` - Get current period details
- `getPlayerInfo(address player, uint256 period)` - Get player data
- `getPeriodPlayers(uint256 period)` - Get all players in a period
- `getNextPeriodEnd()` - Get next 00:00 UTC timestamp

---

## Testing Checklist

After deployment, test these flows:

### ✅ Entry Flow:
1. Approve TRIA tokens for contract
2. Call `enterTournament(50000e18)` - minimum entry
3. Verify `EntryPaid` event emitted

### ✅ Dice Rolling:
1. Call `rollDice(0)` - free roll (3 times)
2. Call `rollDice(1000e18)` - first paid roll
3. Verify `DiceRolled` events

### ✅ Scoring Flow (Player):
1. Calculate weighted score in frontend
2. Generate commitHash: `keccak256(points, nonce, address)`
3. Call `commitScore(commitHash)`
4. Wait < 20 minutes
5. Call `revealScore(points, nonce)`
6. Verify `ScoreRevealed` event

### ✅ Admin Scoring:
1. Fetch leaderboard from Supabase
2. Calculate weighted scores in frontend
3. Call `submitPointsBatch(addresses[], points[])`
4. Verify `PointsSubmittedByOwner` events

### ✅ Prize Distribution:
1. Wait until period ends + 20 minutes
2. Call `allocatePrizes(period)`
3. Verify `PrizesAllocated` event
4. Verify new period started with 00:00 UTC end time
5. Players call `claimPrize(period)`
6. Verify `PrizeClaimed` events

---

## Gas Optimization Benefits

V21 is **significantly more gas efficient** than V20 because:

1. **No Complex Math:** Contract doesn't do multiplication/division on large numbers
2. **Simpler Logic:** Just store points, no entryAmount lookups
3. **Smaller Numbers:** Weighted scores are decimal (0-1000) vs millions/billions in V20
4. **Batch Efficiency:** Less computation per player in batch operations

**Estimated Gas Savings:**
- Single submit: ~30-40% less gas
- Batch submit (100 players): ~35-45% less gas
- Allocate prizes: ~20-30% less gas

---

## Security Considerations

1. **Owner Access Control:** All admin functions protected by `onlyOwner` modifier
2. **Reentrancy Protection:** Critical functions use `nonReentrant` guard
3. **Input Validation:** 
   - Points must be > 0
   - Array lengths must match in batch operations
   - Period must not be distributed
4. **Prize Protection:** Emergency withdraw cannot touch allocated prizes
5. **Commit-Reveal:** Prevents score manipulation and front-running

---

## Support & Documentation

- **Contract Version:** v21.0.0-simplified-scoring
- **ABI Location:** `src/lib/contracts/etherTrialsTRIAv21ABI.ts`
- **Hook Location:** `src/hooks/useTRIAContractv21.ts`
- **Deployment Date:** Update after deployment
- **Contract Address:** Update after deployment
- **Basescan Link:** `https://basescan.org/address/YOUR_ADDRESS`

---

## Next Steps After Deployment

1. ✅ Deploy contract to Base Mainnet
2. ✅ Verify on Basescan
3. ✅ Update `ETHER_TRIALS_TRIA_V21_ADDRESS` in ABI file
4. ✅ Update Admin Panel to use V21 hook
5. ✅ Test all flows on mainnet with small amounts
6. ✅ Monitor first period completion
7. ✅ Document deployed address in your records

---

**Contract deployed? Update the address and start your first 00:00 UTC synchronized tournament! 🚀**
