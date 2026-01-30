oke langsung
# EtherTrialsTRIAv22 Implementation Guide

## 🎯 Perubahan dari Permintaan User

### ✅ Semua Fitur Terimplementasi!

1. **Nilai Commit dan Reveal Sama** ✅
   - Commit: hash(1, nonce, address)
   - Reveal: (1, nonce)
   - Score sebenarnya submit via `submitPoints` setelah reveal
   - Otomatis input score dari database

2. **Tidak Ada Batasan Durasi Reveal** ✅
   - Hapus `REVEAL_WINDOW` check di contract
   - Player bisa reveal kapan saja setelah commit!
   - Tidak ada time pressure
   - UI tidak tampilkan countdown

3. **Reset Harian Otomatis** ✅
   - Tidak perlu `allocatePrizes` manual
   - Period reset otomatis saat:
     - Player enter tournament
     - Player roll dice
     - Player commit/reveal score
   - Gas-efficient (single check di awal function)

4. **Deposit 100M TRIA di Awal** ✅
   - Fungsi `depositTRIA(amount)` untuk owner
   - Owner bisa deposit TRIA ke prize pool
   - Tracked di `depositedTRIA` state variable
   - Protected dari withdrawal

5. **Claim All Hanya Period Lalu** ✅
   - `claimAllForUser` skip current period
   - `claimMultiple` hanya accept period < currentPeriod
   - `_internalClaim` check `require(period < currentPeriod)`
   - Current period TIDAK BISA di-claim

---

## 📋 Step-by-Step Implementation

### 1. Deploy Contract v22

```bash
# Di Remix IDE atau Hardhat
# Network: Base Mainnet (Chain ID: 8453)
# Deploy EtherTrialsTRIAv22.sol
# No constructor parameters needed
```

**Setelah Deploy:**
1. Copy contract address
2. Update di `src/lib/contracts/etherTrialsTRIAv22ABI.ts`:
   ```typescript
   export const ETHER_TRIALS_TRIA_V22_ADDRESS = '0xYOUR_DEPLOYED_ADDRESS' as Address;
   ```

### 2. Initial Deposit 100M TRIA

```solidity
// 1. Approve TRIA tokens
TRIA.approve(v22Address, 100_000_000 ether);

// 2. Deposit to contract
contract.depositTRIA(100_000_000 ether);

// 3. Verify deposit
contract.depositedTRIA(); // Should show 100M TRIA
contract.periods(1).prizePoolTRIA; // Should show 100M TRIA in current period
```

### 3. Update Frontend Files

#### A. Update Contract Address
File: `src/lib/contracts/etherTrialsTRIAv22ABI.ts`
```typescript
// Line 11 - UPDATE THIS!
export const ETHER_TRIALS_TRIA_V22_ADDRESS = '0xYOUR_DEPLOYED_ADDRESS' as Address;
```

#### B. Update Main Page to Use V22
File: `src/app/page.tsx`

**Ganti import:**
```typescript
// OLD
import { useTRIAContractv21 } from '@/hooks/useTRIAContractv21';
import { CommitScoreModalV20 } from '@/components/game/CommitScoreModalV20';
import { RevealScoreModalV20 } from '@/components/game/RevealScoreModalV20';

// NEW
import { useTRIAContractv22 } from '@/hooks/useTRIAContractv22';
import { CommitScoreModalV20 } from '@/components/game/CommitScoreModalV20'; // Bisa pakai V20
import { RevealScoreModalV22 } from '@/components/game/RevealScoreModalV22'; // HARUS V22!
```

**Ganti hook usage:**
```typescript
// OLD
const triaContract = useTRIAContractv21();

// NEW
const triaContract = useTRIAContractv22();
```

**Update localStorage key di Commit Modal:**
```typescript
// Di CommitScoreModalV20.tsx line 55-59
localStorage.setItem('commitDataV22', JSON.stringify({ // Ganti dari V21 ke V22
  nonce: randomNonce.toString(),
  period: currentPeriod?.toString() || '0',
}));
```

#### C. Update Admin Panel for Deposit
File: `src/components/admin/AdminPanelV22.tsx` (Create new or modify existing)

**Add Deposit Button:**
```typescript
import { useTRIAContractv22 } from '@/hooks/useTRIAContractv22';
import { parseUnits } from 'viem';

function AdminPanelV22() {
  const { depositTRIA, approveTria, useDepositedTRIA } = useTRIAContractv22();
  const { data: currentDeposit } = useDepositedTRIA();
  
  const handleDeposit100M = async () => {
    try {
      // 1. Approve
      const amount = parseUnits('100000000', 18); // 100M TRIA
      await approveTria(amount);
      
      // 2. Deposit
      await depositTRIA(amount);
      
      toast.success('✅ Deposited 100M TRIA!');
    } catch (err) {
      toast.error('Failed to deposit');
    }
  };
  
  return (
    <div>
      <div className="mb-4">
        <p>Current Deposit: {formatUnits(currentDeposit || BigInt(0), 18)} TRIA</p>
      </div>
      <Button onClick={handleDeposit100M}>
        💰 Deposit 100M TRIA
      </Button>
    </div>
  );
}
```

### 4. Update Prize Claim Modal (Optional)

Claim modal sudah handle "only past periods" di v21, tapi bisa update message:

```typescript
// Di PrizeClaimModalV21.tsx atau buat V22 version
<div className="text-xs text-gray-400">
  ⚠️ Only past periods can be claimed (current period excluded)
</div>
```

---

## 🔄 User Flow dengan V22

### Flow Normal Player:

1. **Enter Tournament** (Auto-Reset Check ✅)
   ```typescript
   // User enter dengan 1M TRIA
   enterTournament(parseUnits('1000000', 18));
   // Contract auto-check: Period expired? → Reset!
   ```

2. **Commit Score** (Auto-Reset Check ✅)
   ```typescript
   // Frontend generate nonce
   const nonce = BigInt(Math.random() * 1000000000);
   
   // Commit hash(1, nonce, address)
   const hash = keccak256(encodePacked(['uint256', 'uint256', 'address'], [BigInt(1), nonce, address]));
   commitScore({ args: [hash] });
   
   // Save nonce untuk reveal nanti
   localStorage.setItem('commitDataV22', JSON.stringify({ nonce, period }));
   ```

3. **Play Game**
   - Player main game
   - Score disimpan di SpacetimeDB/Supabase
   - Weighted score = score × (entry / 6B TRIA)

4. **Reveal Score** (NO TIME LIMIT! ⏰✅)
   ```typescript
   // Player bisa reveal kapan saja!
   // 1 hari kemudian? OK!
   // 1 minggu kemudian? OK!
   // Selama period belum di-distribute, bisa reveal!
   
   revealScore({ args: [BigInt(1), nonce] }); // Always reveal 1
   ```

5. **Owner Submit Actual Score**
   ```typescript
   // Owner ambil score dari database
   const actualWeightedScore = getWeightedScoreFromDB(player, period);
   
   // Submit ke contract
   submitPoints(player, actualWeightedScore);
   ```

6. **Auto-Allocate** (Automatic! ✅)
   ```typescript
   // Saat player lain enter/commit/reveal setelah period end:
   // Contract otomatis:
   // - Allocate prizes untuk period lama
   // - Start period baru
   // - No manual action needed!
   ```

7. **Claim Rewards** (Only Past Periods ✅)
   ```typescript
   // Player claim rewards
   claimAllForUser(); // Skip current period otomatis!
   
   // Or claim specific past periods
   claimMultiple([period1, period2, period3]); // All must be < currentPeriod
   ```

---

## 🎮 Admin Flow

### 1. Setup Awal (One Time)
```typescript
// 1. Deploy contract
// 2. Approve 100M TRIA
await approveTria(parseUnits('100000000', 18));

// 3. Deposit 100M TRIA
await depositTRIA(parseUnits('100000000', 18));

// 4. Verify
const deposited = await useDepositedTRIA();
console.log('Deposited:', formatUnits(deposited, 18), 'TRIA');
```

### 2. Setelah Each Period (Auto + Manual)

**Option A: Biarkan Auto (Recommended)**
- Contract otomatis reset saat ada interaksi
- No action needed!

**Option B: Manual Reset (Optional)**
```typescript
// Jika ingin force reset period tertentu
await allocatePrizes(periodNumber);
```

### 3. Submit Scores dari Database
```typescript
// Batch submit scores setelah period end
const players = getPlayersFromDB(period);
const scores = players.map(p => calculateWeightedScore(p));

await submitScoresBatch(players, scores);
```

---

## 📊 Comparison Table

| Feature | V21 | V22 |
|---------|-----|-----|
| **Reveal Window** | 20 minutes | ❌ No limit! |
| **Period Reset** | Manual `allocatePrizes` | ✅ Automatic |
| **Owner Deposit** | ❌ Not available | ✅ `depositTRIA` |
| **Claim Current Period** | ❌ Blocked | ❌ Still blocked |
| **Auto-Reset Triggers** | None | Enter/Roll/Commit/Reveal |
| **Commit/Reveal** | Both use 1 | ✅ Both use 1 |
| **Score Submit** | Manual after reveal | ✅ Manual after reveal |
| **Gas Efficiency** | Good | ✅ Better (auto-reset) |

---

## 🔐 Security Notes

### 1. Auto-Reset Safety
- ✅ Only triggers if period ended AND has participants
- ✅ Protected by nonReentrant modifier
- ✅ Gas-optimized (single check at function start)
- ✅ Safe from front-running

### 2. Deposit Safety
- ✅ Only owner can deposit
- ✅ Tracked in separate `depositedTRIA` variable
- ✅ Cannot be withdrawn (protected by `totalPrizeOwedTRIA`)
- ✅ Increases prize pool for fairness

### 3. Claim Safety
- ✅ Only past periods can be claimed
- ✅ Current period always blocked: `require(period < currentPeriod)`
- ✅ Double-claim protection: `claimed` flag
- ✅ Balance protection: `totalPrizeOwedTRIA` tracking

### 4. No Reveal Window = No Time Attack
- ✅ Players can't be rushed into mistakes
- ✅ No advantage for automated bots
- ✅ Fairer for all timezones
- ✅ Less stress for players

---

## 🚨 Important Migration Notes

### DO NOT MIGRATE DATA!
- V21 dan V22 adalah contract terpisah
- Users masih bisa claim rewards di V21
- New entries masuk V22
- Old periods tetap claimable di V21

### Update Contract Address!
```typescript
// File: src/lib/contracts/etherTrialsTRIAv22ABI.ts
// Line 11 - UPDATE SETELAH DEPLOYMENT!
export const ETHER_TRIALS_TRIA_V22_ADDRESS = '0xYOUR_ADDRESS_HERE' as Address;
```

### Update localStorage Keys
```typescript
// Ganti semua 'commitDataV21' menjadi 'commitDataV22'
localStorage.setItem('commitDataV22', ...);
localStorage.getItem('commitDataV22');
```

---

## ✅ Testing Checklist

Before going live:

- [ ] Deploy contract to Base Mainnet
- [ ] Update contract address in ABI file
- [ ] Approve 100M TRIA
- [ ] Deposit 100M TRIA via `depositTRIA`
- [ ] Test entry (triggers auto-reset)
- [ ] Test commit score
- [ ] Test reveal score (no time limit!)
- [ ] Test score submission by owner
- [ ] Test period auto-reset on interaction
- [ ] Test claim (only past periods)
- [ ] Verify auto-allocate on period end
- [ ] Test with multiple players
- [ ] Monitor gas costs

---

## 📞 Support

Jika ada pertanyaan tentang implementasi v22:

1. **Smart Contract**: Lihat `EtherTrialsTRIAv22.sol` dan deployment guide
2. **Frontend**: Lihat hook `useTRIAContractv22.ts` dan modal files
3. **Testing**: Gunakan Remix IDE dengan Base Mainnet testnet dulu
4. **Deployment**: Follow `EtherTrialsTRIAv22_DEPLOYMENT.md`

---

**🎉 Selamat! Semua permintaan user sudah terimplementasi di v22! 🎉**

✅ Commit/Reveal sama (1)  
✅ No reveal window limit  
✅ Auto-reset harian  
✅ Deposit 100M TRIA  
✅ Claim only past periods
