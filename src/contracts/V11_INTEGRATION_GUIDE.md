siap
# 🚀 Contract V11 Integration Guide

## Overview
Contract V11 is a **full TRIA-based** tournament system deployed at:
```
0x8a7eA75b0F107b76A90BB690212E9cef6f02e0aB
```

**Key Changes from V10:**
- ❌ No more ETH → TRIA swap
- ✅ Direct TRIA deposits
- ✅ Min: 50,000 TRIA
- ✅ Max: 6,000,000,000 TRIA
- ✅ Same commit-reveal, dice roll, prize distribution logic

---

## 📁 Files Created

### 1. **ABI & Constants**
- **File:** `src/lib/contracts/etherTrialsTRIAv11ABI.ts`
- **Exports:**
  - `ETHER_TRIALS_TRIA_V11_ADDRESS`
  - `TRIA_TOKEN_ADDRESS`
  - `ETHER_TRIALS_TRIA_V11_ABI`
  - `ERC20_ABI` (for TRIA token approval)

### 2. **Contract Hook**
- **File:** `src/hooks/useTRIAContractv11.ts`
- **Key Functions:**
  - `useTriaBalance(address)` - Get TRIA balance
  - `useTriaAllowance(address)` - Check approval
  - `approveTria(amount)` - Approve TRIA spending
  - `enterTournament(triaAmount)` - Deposit TRIA to enter
  - All other functions same as V10

### 3. **Tournament Entry Modal**
- **File:** `src/components/game/TournamentEntryModalV11.tsx`
- **Features:**
  - TRIA balance display
  - **"Buy TRIA" button** → Opens DeFi Llama swap
  - Entry amount input (50k - 6B TRIA)
  - Automatic TRIA approval flow
  - Prize distribution preview

### 4. **Prize Pool Component**
- **File:** `src/components/game/RealtimePrizePoolV11.tsx`
- **Features:**
  - Live TRIA prize pool display
  - Participant count
  - Entry bounds info
  - Prize distribution (80/20 split)

---

## 🔧 How to Integrate

### Option 1: Replace V10 (Recommended for Production)

**Update `src/app/page.tsx`:**

```typescript
// BEFORE (V10 - ETH to TRIA swap)
import { TournamentEntryModalV10 } from '@/components/game/TournamentEntryModalV10';
const RealtimePrizePoolV10 = dynamic(() => import('@/components/game/RealtimePrizePoolV10').then(mod => ({ default: mod.RealtimePrizePoolV10 })), { ssr: false });
import { useTRIAContractv10 } from '@/hooks/useTRIAContractv10';

// AFTER (V11 - Direct TRIA)
import { TournamentEntryModalV11 } from '@/components/game/TournamentEntryModalV11';
const RealtimePrizePoolV11 = dynamic(() => import('@/components/game/RealtimePrizePoolV11').then(mod => ({ default: mod.RealtimePrizePoolV11 })), { ssr: false });
import { useTRIAContractv11 } from '@/hooks/useTRIAContractv11';
```

**Update Component Usage:**

```typescript
// Replace V10 modal with V11
<TournamentEntryModalV11
  isOpen={true}
  onClose={handlePaymentCancel}
  onSuccess={handlePaymentComplete}
/>

// Replace V10 prize pool with V11
<RealtimePrizePoolV11 />
```

### Option 2: Side-by-Side Testing

Keep both V10 and V11 components for testing:

```typescript
const [useV11, setUseV11] = useState(false); // Toggle in admin panel

{useV11 ? (
  <TournamentEntryModalV11 ... />
) : (
  <TournamentEntryModalV10 ... />
)}
```

---

## 🎯 User Flow

### 1. **Check TRIA Balance**
```typescript
const { data: triaBalance } = useTriaBalance(address);
// If insufficient, show "Buy TRIA" button
```

### 2. **Buy TRIA** (Optional)
- User clicks "Buy TRIA" button in modal
- Opens DeFi Llama swap: ETH → TRIA
- URL: `https://swap.defillama.com/?chain=base&from=0x0000000000000000000000000000000000000000&to=0xD852713dD8dDF61316DA19383D0c427aDb85EB07`

### 3. **Approve TRIA**
```typescript
const { data: allowance } = useTriaAllowance(address);
if (allowance < entryAmount) {
  await approveTria(entryAmount);
}
```

### 4. **Enter Tournament**
```typescript
await enterTournament(triaAmountInWei);
// 80% → Prize Pool
// 20% → Platform Fees
```

### 5. **Play Game**
- Same flow as V10: dice roll → commit → play → reveal

### 6. **Claim Rewards**
- Same as V10: `claimReward(period)` or `claimRewards([periods])`

---

## 📊 Entry Bounds

| Parameter | Value | Notes |
|-----------|-------|-------|
| Min Entry | 50,000 TRIA | Hardcoded in contract |
| Max Entry | 6,000,000,000 TRIA | 6 billion TRIA |
| Decimals | 18 | Standard ERC20 |

**Entry Amount Examples:**
- Min: `50000 * 10^18` wei
- 100k: `100000 * 10^18` wei
- 1M: `1000000 * 10^18` wei
- Max: `6000000000 * 10^18` wei

---

## 🔄 Migration Checklist

- [ ] Test TRIA approval flow on testnet
- [ ] Verify "Buy TRIA" button opens correct swap URL
- [ ] Test entry with various amounts (50k, 100k, 1M)
- [ ] Verify prize pool updates in real-time
- [ ] Test commit-reveal flow (same as V10)
- [ ] Test dice roll purchases with TRIA
- [ ] Test prize claiming
- [ ] Update admin panel to use V11 hooks
- [ ] Update all V10 references to V11
- [ ] Remove V10 components (optional, after testing)

---

## ⚠️ Important Notes

### 1. **TRIA Approval Required**
Unlike V10 (payable ETH), V11 requires:
1. User approves contract to spend TRIA
2. Then user calls `enterTournament(amount)`

### 2. **No ETH Swapping**
- V10: User sends ETH → Contract swaps to TRIA
- V11: User must own TRIA → Direct deposit

### 3. **"Buy TRIA" Button**
- Opens external swap interface (DeFi Llama)
- User completes swap outside app
- Returns to app with TRIA to enter

### 4. **Gas Costs**
- V11 is **cheaper** than V10!
- No Uniswap swap = ~100-200k gas savings
- Just approval + transfer ≈ 100-150k gas

---

## 🧪 Testing Contract (Mainnet)

```bash
# Contract Address
0x8a7eA75b0F107b76A90BB690212E9cef6f02e0aB

# TRIA Token
0xD852713dD8dDF61316DA19383D0c427aDb85EB07

# Test with minimum amount
1. Get TRIA from swap (50k minimum)
2. Approve contract: approve(0x8a7eA75b0F107b76A90BB690212E9cef6f02e0aB, 50000 * 10^18)
3. Enter tournament: enterTournament(50000 * 10^18)
4. Check period info
5. Play game & submit score
```

---

## 🎉 Ready to Deploy!

All V11 components are ready. To activate:

1. **Update `src/app/page.tsx`** imports (see Option 1 above)
2. **Update prize pool mode** from "MAINTENANCE" to "ACTIVE"
3. **Test thoroughly** with small amounts first
4. **Monitor** first few entries for any issues
5. **Scale up** once confirmed working

---

## 🆘 Troubleshooting

### "Insufficient TRIA balance"
- Show "Buy TRIA" button
- Guide user to swap ETH → TRIA

### "Insufficient allowance"
- Automatically trigger approval flow
- Modal handles this seamlessly

### "Entry amount too low/high"
- Enforce bounds in UI: 50k - 6B TRIA
- Show helpful error messages

### "Already entered this period"
- Check `userEntry.hasEntered` before showing modal
- Display period end time

---

## 📞 Support

If you encounter issues:
1. Check contract on BaseScan
2. Verify TRIA token address
3. Ensure user has sufficient TRIA
4. Test approval flow separately
5. Check console logs for errors

---

**Version:** V11  
**Network:** Base Mainnet  
**Status:** ✅ Ready for Integration  
**Last Updated:** 2025-01-17
