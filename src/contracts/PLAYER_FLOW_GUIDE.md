# 🎮 Ether Trials - Player Flow Guide

## ✅ Confirmed Specifications

### 1️⃣ **Player Submit Score Sendiri**
✅ **YES!** Player submit score sendiri setelah game selesai (no backend needed)

### 2️⃣ **Period System**
✅ **1 Period = 24 Jam**
✅ **1 FID = 1 Entry per Period**
✅ Setelah 24 jam, period baru dimulai

### 3️⃣ **Claiming**
✅ **Hanya ada `claimAllRewards()`** - Simple & efisien!
✅ Player tidak perlu claim per period - langsung claim semua periods sekaligus

---

## 🎯 Complete Player Journey

### **Phase 1: Tournament Entry**
1. Player connect wallet di Farcaster frame
2. Player pilih entry amount: **0.00001 ETH - 1 ETH**
3. Call `enterTournament(fid)` dengan value
4. Contract:
   - Checks: belum entry di period ini?
   - Auto-add wallet pertama ke FID profile
   - Swap 90% ETH → $TRIA via Uniswap
   - Split:
     - 80% → Prize Pool ($TRIA)
     - 10% → Buyback Pool ($TRIA)
     - 5% → Treasury (ETH)
     - 5% → Mini Games Pool (ETH)
   - Calculate entry weight: `weight = (amount / 0.00001) × 1e18`
   - Entry recorded! ✅

**Entry Weight Examples:**
- 0.00001 ETH → weight = 1
- 0.0001 ETH → weight = 10
- 0.001 ETH → weight = 100
- 0.01 ETH → weight = 1,000
- 0.1 ETH → weight = 10,000
- 1 ETH → weight = 100,000

---

### **Phase 2: Play Game**
1. Player main Ether Trials RPG
2. Frontend track:
   - Score (points earned)
   - Game events (untuk anti-cheat verification)
   - Nonce (random number untuk commit)
   - Timestamp (saat game selesai)

---

### **Phase 3: Submit Score (Anti-Cheat 2-Step)**

#### **Step 1: Commit Score Hash**
Frontend generates:
```typescript
const nonce = Math.floor(Math.random() * 1e18); // Random nonce
const timestamp = Date.now();
const commitHash = ethers.utils.solidityKeccak256(
  ['uint256', 'uint256', 'uint256', 'uint256'],
  [fid, score, nonce, timestamp]
);
```

Player clicks "Submit Score" → Call:
```solidity
commitScore(period, fid, commitHash)
```

Contract:
- ✅ Verifies player has entry
- ✅ Verifies wallet approved for FID
- ✅ Stores commit hash + commit time
- 🔒 **Score locked in!** Cannot change

---

#### **Step 2: Reveal Score (Within 10 Minutes)**
Player has **10 minutes** to reveal. Frontend automatically calls:
```solidity
revealScore(period, fid, score, nonce, timestamp)
```

Contract:
- ✅ Verifies within 10 minute window
- ✅ Recalculates hash from inputs
- ✅ Verifies hash matches commit
- ✅ If match: score accepted ✅
- ✅ If not match: REJECTED! ❌
- Updates weighted score: `weightedScore = score × weight`

**Why This Prevents Cheating:**
- Player cannot see other scores before committing
- Player cannot change score after committing (hash locked in blockchain)
- Player cannot submit fake score (hash won't match)
- 10 minute window prevents gaming the system

---

### **Phase 4: Period Finalization**
After 24 hours, anyone can call:
```solidity
finalizePeriod(period)
```

Contract:
- ✅ Marks period as finalized
- ✅ Locks prize pool
- ✅ Starts new period
- ✅ Enables claims for that period

---

### **Phase 5: Claim Rewards (SIMPLIFIED!)**
Player hanya perlu call **1 function** untuk claim ALL periods:

```solidity
claimAllRewards(fid)
```

Contract automatically:
- ✅ Loop through ALL finalized periods (0 → current)
- ✅ Check if player has entry
- ✅ Check if score revealed
- ✅ Check if not claimed yet
- ✅ Calculate reward based on weighted score:

**Reward Formula:**
```
reward = (player_weighted_score / total_weighted_score) × prize_pool
```

**Example:**
- Period prize pool: 1000 $TRIA
- Player weighted score: 50,000
- Total weighted score: 500,000
- Player reward: (50,000 / 500,000) × 1000 = **100 $TRIA**

- ✅ Transfer ALL $TRIA rewards in one transaction
- ✅ Mark all periods as claimed

**Simple for player!** One click, all rewards! 🎉

---

## 🎲 Bonus: Mini Games

### **When Active?**
Mini games only active when `miniGameBalance >= 0.01 ETH`
- Initially inactive (zero funding)
- Becomes active after ~200 tournament entries (5% × 200 = 0.01 ETH)
- **Self-sustaining!** No initial funding needed

### **Ether Dice**
```solidity
playDice(fid) // Send 0.00001 ETH
```

**Win Conditions:**
- Sum = 7 → **4x** prize (16.67% chance)
- Sum = 2 or 12 → **20x** prize (2.78% chance each)
- Other doubles → **3x** prize (11.11% chance)
- Lucky burst (1:500) → **0.001 ETH**
- **LOSE** → 66.67% chance ❌

### **Ether Spin (Roulette)**
```solidity
playSpin(fid, betNumber) // Send 0.00001 ETH, bet 0-36
```

**Win Conditions:**
- Exact match = 0 (green) → **20x** prize (2.7% chance)
- Exact match = 1-36 → **8x** prize (2.7% chance)
- Lucky burst (1:500) → **0.001 ETH**
- **LOSE** → 94.6% chance ❌

---

## 📊 Summary Timeline

| Time | Action | Who |
|------|--------|-----|
| **00:00** | Period starts | Auto |
| **00:05** | Player enters (0.1 ETH) | Player |
| **00:10** | Player plays RPG game | Player |
| **00:15** | Player commits score hash | Player |
| **00:25** | Player reveals score | Player (auto) |
| **23:59** | Period ends | Auto |
| **24:00** | Anyone finalizes period | Anyone |
| **24:01** | Player claims all rewards | Player |
| **48:00** | New period, repeat! | Player |

---

## 🔐 Security Features

✅ **Anti-Cheat:** Commit/reveal scheme prevents score manipulation
✅ **FID-Based:** 1 FID = 1 entry per period (prevents sybil)
✅ **Multi-Wallet:** Max 3 wallets per FID for flexibility
✅ **Cooldown:** 7 days between adding wallets
✅ **Time-Locked:** 10 minute reveal window
✅ **Weighted System:** Fair distribution (more entry = more potential)

---

## 💡 Key Differences from v3

| Feature | v3 (Backend) | v4 (Player Submit) |
|---------|-------------|-------------------|
| Score submission | Backend server | **Player (commit/reveal)** |
| Infrastructure cost | ~$10-50/month | **$0** |
| Decentralization | Semi-centralized | **Fully decentralized** |
| Initial funding | 0.1-1 ETH | **$0** |
| Claiming | claimAll + claimPeriod | **claimAll only** |
| Mini games | Always on | **Active when funded** |

---

## 🚀 Ready to Deploy!

Contract sudah production-ready dengan:
- ✅ Player submit score sendiri (no backend)
- ✅ Anti-cheat commitment scheme
- ✅ 1 period = 24 jam, 1 entry per FID
- ✅ Simple claiming: `claimAllRewards()` only
- ✅ Zero initial funding needed
- ✅ Sustainable mini games
- ✅ Proper house edge (dice 40%, spin 60%)

**Next:** Deploy via Remix → Test → Go live! 🎮
