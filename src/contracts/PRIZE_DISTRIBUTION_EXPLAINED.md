toksi
# 🏆 Prize Distribution Mechanism

## Core Principle: PURE POINT-BASED DISTRIBUTION

**There are NO limits on points. Higher score + higher entry = more points = bigger share!**

---

## 📊 How It Works

### Step 1: Earning Points

When you reveal your score, you earn points based on:

```
Points = Score × (Total Modal / 1e18)
```

**Where:**
- **Score** = Your game score (0 to 2,000,000)
- **Total Modal** = Sum of all your ETH spent (entry fee + paid dice rolls)
- **1e18** = Normalization factor (WEI scale)

**Example:**
```
Player A:
  - Score: 100,000
  - Total Modal: 0.00002 ETH entry + 0.00001 ETH dice = 0.00003 ETH
  - Points = 100,000 × (0.00003 / 1) = 3

Player B:
  - Score: 100,000
  - Total Modal: 0.0001 ETH entry + 0.00005 ETH dice = 0.00015 ETH
  - Points = 100,000 × (0.00015 / 1) = 15

Player C:
  - Score: 200,000
  - Total Modal: 0.00002 ETH (entry only)
  - Points = 200,000 × (0.00002 / 1) = 4
```

---

### Step 2: Prize Distribution

After the period ends, the **ENTIRE prize pool** is distributed proportionally:

```
Your Prize = (Prize Pool × Your Points) / Total Points
```

**Using the example above:**
```
Total Points = 3 + 15 + 4 = 22
Prize Pool = 100 TRIA

Player A Prize = (100 × 3) / 22 = 13.64 TRIA
Player B Prize = (100 × 15) / 22 = 68.18 TRIA
Player C Prize = (100 × 4) / 22 = 18.18 TRIA
```

---

## ✅ Key Rules

### 1. **NO Point Cap**
- There is **NO maximum points** you can earn
- Higher score always means more points (proportional to modal)
- More modal always means more points (proportional to score)

### 2. **100% Distribution**
- **ENTIRE prize pool** is distributed to players
- No platform fee taken from prize pool (platform fee comes from the 20% split at entry)
- Every point counts toward your share

### 3. **Pure Proportional**
- If you have 10% of total points → you get 10% of prize pool
- If you have 50% of total points → you get 50% of prize pool
- Mathematical fairness guaranteed by smart contract

### 4. **Modal Matters**
- Entry fee = Your base modal
- Paid dice rolls = Add to your modal
- Higher modal = Each point of score counts more
- Strategy: Balance between skill (score) and investment (modal)

---

## 🎯 Strategic Implications

### For High-Skill Players:
- Focus on maximizing score
- Even with minimum entry, high score gives you advantage
- Buy dice rolls to amplify your score's impact

### For High-Investment Players:
- Higher entry fee means each point counts more
- Paid dice rolls increase your modal
- Even moderate scores can earn big with high modal

### For Balanced Players:
- Optimal strategy: Good score + reasonable investment
- Points = Score × Modal, so both matter!
- Find the sweet spot for your skill level

---

## 📈 Real Smart Contract Code

From `EtherTrialsTRIAv10.sol`:

```solidity
// Line 268-272: Points calculation during reveal
uint256 modal = userTotalModal[currentPeriod][msg.sender];
uint256 points = (score * modal) / WEI_SCALE;

userPoints[currentPeriod][msg.sender] = points;
periods[currentPeriod].totalPoints += points;
```

```solidity
// Line 291: Prize distribution during claim
uint256 amount = (p.triaPrizePool * pts) / p.totalPoints;
```

**This is the actual on-chain logic. No tricks, no hidden formulas!**

---

## 🚫 What This System DOES NOT Have

❌ **Ticket-based system** - Not based on number of entries
❌ **Point caps** - No maximum points limit
❌ **Winner-takes-all** - Everyone with points gets a share
❌ **Fixed payouts** - All prizes are proportional
❌ **Random selection** - Pure skill + investment formula

---

## ✅ What This System DOES Have

✅ **Pure meritocracy** - Better score = more points
✅ **Investment scaling** - More modal = more points per score
✅ **Mathematical fairness** - Exact proportional distribution
✅ **100% transparency** - Formula is public and immutable
✅ **No gatekeeping** - Anyone can win with any entry amount

---

## 💡 Example Scenarios

### Scenario 1: Whale vs Skill
```
Whale:
  - Entry: 1 ETH
  - Score: 50,000
  - Points: 50,000 × 1 = 50,000

Skilled Player:
  - Entry: 0.00002 ETH
  - Score: 2,000,000 (max)
  - Points: 2,000,000 × 0.00002 = 40

Result: Whale wins despite lower score!
```

### Scenario 2: Equal Investment, Different Skill
```
Player A:
  - Entry: 0.0001 ETH
  - Score: 100,000
  - Points: 10

Player B:
  - Entry: 0.0001 ETH
  - Score: 200,000
  - Points: 20

Result: Player B gets 2x the prize!
```

### Scenario 3: Balanced Approach
```
Player:
  - Entry: 0.0001 ETH
  - Dice rolls: 0.00005 ETH
  - Total Modal: 0.00015 ETH
  - Score: 500,000
  - Points: 500,000 × 0.00015 = 75

Result: Optimized both score and investment!
```

---

## 🎮 Optimal Strategy Guide

### 1. **Entry Amount Decision**
- Minimum entry (0.00002 ETH) = Low risk, need VERY high score
- Medium entry (0.0001-0.001 ETH) = Balanced risk/reward
- High entry (0.01+ ETH) = High risk, score matters less

### 2. **Dice Roll Strategy**
- Each paid roll adds to your modal
- Cost increases exponentially (0.00001, 0.00002, 0.00004...)
- More rolls = more attempts + higher modal weight

### 3. **Score Target**
- No point in score without modal (proportional)
- No point in modal without score (also proportional)
- Both must work together for max points!

---

## 📊 Prize Pool Composition

**Where does the prize pool come from?**

Every entry fee and dice roll payment:
1. ETH → Automatically swapped to TRIA via Uniswap V3
2. 80% TRIA → Added to prize pool
3. 20% TRIA → Platform fees

**Example:**
```
Total Revenue: 1 ETH worth of TRIA
  ├─ 0.8 TRIA → Prize Pool (distributed to players)
  └─ 0.2 TRIA → Platform Fees (not distributed)
```

**Prize pool grows with every:**
- Player entry
- Paid dice roll purchase

**100% of prize pool is distributed based on points!**

---

## 🔒 Security & Fairness

### On-Chain Enforcement
- All calculations happen in smart contract
- No admin can change point amounts
- No one can manipulate the formula
- Mathematical precision guaranteed

### Transparency
- All points are public on blockchain
- Formula is open source and verified
- Anyone can verify their prize calculation
- BaseScan shows all transactions

### Anti-Cheat (Commit-Reveal)
- Scores are committed as hashes first
- 20-minute window to reveal
- Hash mismatch = invalid reveal
- Prevents score manipulation after seeing others' scores

---

## 🎉 Summary

**Prize distribution is PURELY BASED ON POINTS with NO LIMITS:**

```
Points = Score × Total Modal
Prize = (Prize Pool × Your Points) / Total Points
```

**The more points you have relative to total points, the bigger your share!**

**Strategy Options:**
1. 🎯 Max out score (skill-based)
2. 💰 Invest more modal (capital-based)  
3. ⚖️ Balance both (optimal)

**There are no shortcuts, no caps, no tricks - just pure math!**

---

**Smart Contract:** `EtherTrialsTRIAv10.sol`  
**Network:** Base Mainnet  
**Verification:** View source on BaseScan
