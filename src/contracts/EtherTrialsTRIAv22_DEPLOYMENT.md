# EtherTrialsTRIAv22 Deployment Guide

## 🎯 Contract Version: v22.0.0-auto-reset-no-reveal-limit

### ✨ Key Features from User Request

1. ✅ **Commit & Reveal Same Value** - Both use value "1", actual score submitted after via `submitPoints`
2. ✅ **No Reveal Window Limit** - Players can reveal anytime after commit (removed 20-minute restriction)
3. ✅ **Automatic Period Reset** - No manual `allocate

Prizes` needed! Period resets automatically when:
   - Someone enters tournament after period ends
   - Someone rolls dice after period ends
   - Someone commits/reveals after period ends
4. ✅ **Owner Deposit Function** - `depositTRIA(amount)` - Owner can deposit 100M TRIA upfront for prize pool
5. ✅ **Claim All Past Periods Only** - `claimAllForUser` and `claimMultiple` only work for past periods (period < currentPeriod)

### 📋 Deployment Steps

1. **Compile Contract**
   ```bash
   # Using Remix IDE or Hardhat
   solc --optimize --bin --abi EtherTrialsTRIAv22.sol
   ```

2. **Deploy to Base Mainnet**
   - Network: Base Mainnet
   - Chain ID: 8453
   - RPC: https://mainnet.base.org
   - Constructor: No parameters needed

3. **After Deployment - Initial Setup**
   ```solidity
   // 1. Approve TRIA tokens for contract
   TRIA.approve(contractAddress, 100_000_000 ether); // 100M TRIA
   
   // 2. Deposit initial pool
   contract.depositTRIA(100_000_000 ether); // 100M TRIA
   
   // 3. Verify settings (optional)
   contract.minEntry(); // Should be 50,000 TRIA
   contract.maxEntry(); // Should be 6B TRIA
   ```

4. **Update Frontend**
   - Update contract address in `src/lib/contracts/etherTrialsTRIAv22ABI.ts`
   - Update `src/hooks/useTRIAContractv22.ts` to use new contract
   - Update `src/app/page.tsx` to use v22 hook

### 🔄 Migration from V21

**NO MIGRATION NEEDED!**
- V21 and V22 are separate contracts
- Users can claim old V21 rewards anytime
- New entries go to V22
- Old periods remain claimable in V21

### 🎮 User Flow

1. **Entry** → Auto-reset checks → Enter tournament
2. **Commit** → Commit hash (value=1) → Play game
3. **Reveal** → Reveal (value=1, anytime!) → Wait for owner to submit actual score
4. **Score Submit** → Owner calls `submitPoints(player, actualWeightedScore)`
5. **Auto-Allocate** → When next player enters/commits/reveals after period ends
6. **Claim** → Users claim rewards from past periods only

### 📊 Contract Changes Summary

| Feature | V21 | V22 |
|---------|-----|-----|
| Reveal Window | 20 minutes | ❌ No limit! |
| Period Reset | Manual `allocatePrizes` | ✅ Automatic |
| Owner Deposit | ❌ Not available | ✅ `depositTRIA` |
| Claim Current Period | ❌ Blocked | ❌ Still blocked |
| Auto-Reset Triggers | None | Enter/Roll/Commit/Reveal |

### 🔐 Security Notes

1. **Auto-Reset Safety**:
   - Only triggers if period ended AND has participants
   - Safe from reentrancy (nonReentrant modifier)
   - Gas-optimized (single check at start of each function)

2. **Deposit Safety**:
   - Only owner can deposit
   - Tracked separately in `depositedTRIA`
   - Cannot be withdrawn (protected by `totalPrizeOwedTRIA`)

3. **Claim Safety**:
   - Only past periods can be claimed
   - Current period always blocked
   - Double-claim protection via `claimed` flag

### 📝 Admin Functions

```solidity
// Deposit TRIA for prize pool
depositTRIA(100_000_000 ether);

// Submit actual weighted scores from database
submitPoints(playerAddress, actualWeightedScore);
submitPointsBatch([player1, player2], [score1, score2]);

// Optional manual allocation (auto-reset handles this)
allocatePrizes(periodNumber);

// Adjust entry bounds
setEntryBounds(newMin, newMax);

// Emergency withdrawal (only excess funds)
emergencyWithdrawTRIA(toAddress, amount);
```

### 🚨 Important Notes

1. **No Reveal Window** - Players can reveal ANYTIME after commit! This removes time pressure.
2. **Auto-Reset** - Period resets automatically when anyone interacts after period ends.
3. **Score Flow**: Commit (1) → Play → Reveal (1) → Owner submits actual weighted score
4. **Initial Deposit** - Deposit 100M TRIA at start so users can claim before joining

### ✅ Testing Checklist

- [ ] Deploy contract to Base Mainnet
- [ ] Approve 100M TRIA
- [ ] Deposit 100M TRIA via `depositTRIA`
- [ ] Test entry (auto-reset trigger)
- [ ] Test commit/reveal (no time limit)
- [ ] Test score submission (owner)
- [ ] Test period auto-reset
- [ ] Test claim (only past periods)
- [ ] Verify auto-allocate on period end
- [ ] Update frontend to v22

### 📱 Frontend Updates Required

1. Replace `useTRIAContractv21` with `useTRIAContractv22`
2. Update contract address in ABI file
3. Remove reveal window countdown UI
4. Add "Deposit TRIA" admin button
5. Update claim modals to show "past periods only"

---

**Deployed Address**: `TBD - Update after deployment`

**Deployment Date**: TBD

**Deployer**: Owner address

**Initial Deposit**: 100,000,000 TRIA

