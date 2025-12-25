# 🛡️ Anti-Cheat System - Player-Submitted Scores

## 📋 Overview

In v4, **players submit their own scores** instead of requiring a backend server. To prevent cheating, we use a **commitment scheme** - a cryptographic method that locks in the score before revealing it.

---

## 🔒 How It Works

### The Problem:
If players can just call `submitScore(fid, 99999)`, they'll all cheat and claim max score.

### The Solution: Commitment Scheme

**Two-step process:**

1. **Commit** - Player locks in their score (hashed)
2. **Reveal** - Player proves their score (within time window)

The contract verifies the revealed score matches the committed hash, making it impossible to change the score after committing.

---

## 🎮 Implementation Flow

### Frontend (React/Next.js):

```typescript
import { ethers } from 'ethers';

// After user finishes game
const fid = 12345n;
const score = 8500; // User's final score
const period = await contract.getCurrentPeriod();

// Step 1: COMMIT SCORE
async function commitScore() {
  // Generate random nonce and timestamp
  const nonce = ethers.utils.randomBytes(32);
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Create hash
  const commitHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256', 'bytes32', 'uint256'],
      [fid, score, nonce, timestamp]
    )
  );
  
  // Submit commit transaction
  const tx = await contract.commitScore(period, fid, commitHash);
  await tx.wait();
  
  // IMPORTANT: Store nonce and timestamp for later!
  localStorage.setItem(`score_${period}_${fid}`, JSON.stringify({
    score,
    nonce: ethers.utils.hexlify(nonce),
    timestamp,
    commitHash
  }));
  
  console.log('Score committed! Must reveal within 10 minutes.');
  
  // Set timer to reveal
  setTimeout(() => revealScore(), 1000); // Reveal after 1 second
}

// Step 2: REVEAL SCORE (within 10 minutes)
async function revealScore() {
  // Retrieve stored data
  const stored = JSON.parse(localStorage.getItem(`score_${period}_${fid}`));
  
  const tx = await contract.revealScore(
    period,
    fid,
    stored.score,
    stored.nonce,
    stored.timestamp
  );
  await tx.wait();
  
  console.log('Score revealed and verified! ✅');
  
  // Clean up
  localStorage.removeItem(`score_${period}_${fid}`);
}
```

### Smart Contract:

```solidity
// Commitment structure
struct ScoreCommitment {
    bytes32 commitHash;
    uint256 commitTime;
    uint256 score;
    bool revealed;
}

// Step 1: Commit
function commitScore(uint256 period, uint256 fid, bytes32 commitHash) external {
    require(!entries[period][fid].exists, "No entry");
    require(commitHash == bytes32(0), "Already committed");
    
    scoreCommitments[period][fid] = ScoreCommitment({
        commitHash: commitHash,
        commitTime: block.timestamp,
        score: 0,
        revealed: false
    });
    
    emit ScoreCommitted(period, fid, commitHash);
}

// Step 2: Reveal (within 10 minutes)
function revealScore(
    uint256 period,
    uint256 fid,
    uint256 score,
    uint256 nonce,
    uint256 timestamp
) external {
    ScoreCommitment storage commitment = scoreCommitments[period][fid];
    
    require(commitment.commitHash != bytes32(0), "Not committed");
    require(!commitment.revealed, "Already revealed");
    require(block.timestamp <= commitment.commitTime + 10 minutes, "Window expired");
    
    // Verify hash matches
    bytes32 revealHash = keccak256(abi.encodePacked(fid, score, nonce, timestamp));
    require(revealHash == commitment.commitHash, "Hash mismatch");
    
    // Store score
    commitment.score = score;
    commitment.revealed = true;
    
    // Update weighted scores
    uint256 weight = entries[period][fid].entryWeight;
    periods[period].totalWeightedScore += (score * weight) / 1e18;
    
    emit ScoreRevealed(period, fid, score);
}
```

---

## 🔐 Security Guarantees

### ✅ What's Protected:

1. **Can't change score after commit**
   - Hash is locked in blockchain
   - Any different score will fail verification

2. **Can't see others' scores before committing**
   - Only hash is visible onchain
   - Can't reverse-engineer hash to see score

3. **Time-bound reveal**
   - Must reveal within 10 minutes
   - Prevents waiting to see others' scores

4. **One attempt only**
   - Can't commit multiple times
   - Can't reveal multiple times

### ⚠️ Potential Attacks & Mitigations:

**Attack 1: Front-running**
- Player sees high score in mempool, tries to submit higher
- **Mitigation**: Already committed! Can't change hash

**Attack 2: Griefing (commit but never reveal)**
- Player commits, then doesn't reveal to waste gas
- **Mitigation**: Only their own entry is affected, others unaffected

**Attack 3: Timestamp manipulation**
- Miner tries to manipulate block.timestamp
- **Mitigation**: 10-minute window is long enough that small variations don't matter

**Attack 4: Multiple FIDs**
- One person creates many FIDs
- **Mitigation**: Farcaster FIDs require storage rent (cost money), natural sybil resistance

---

## 🎯 User Experience Flow

### Perfect Flow:
1. User plays game (2-5 minutes)
2. Game ends, score calculated
3. User clicks "Submit Score"
4. **Commit transaction** sent (~2 seconds)
5. Wait 1 second
6. **Reveal transaction** sent (~2 seconds)
7. ✅ Score recorded!

**Total time: ~5 seconds for 2 transactions**

### Error Handling:

**If commit succeeds but reveal fails:**
- Frontend should retry reveal automatically
- User has 10 minutes to retry
- Show countdown timer: "Reveal score within X minutes"

**If user closes browser before reveal:**
- Score data saved in localStorage
- On return, check for pending reveals
- Prompt: "You have an unrevealed score! Reveal now?"

**If 10 minutes expires:**
- Score = 0 for that entry
- Entry fee already paid (not refundable)
- User can still play next period

---

## 💻 Complete Frontend Example

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

export function ScoreSubmission({ fid, gameScore }: { fid: bigint; gameScore: number }) {
  const [status, setStatus] = useState<'idle' | 'committing' | 'revealing' | 'done'>('idle');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const { address } = useAccount();

  // Check for pending reveals on mount
  useEffect(() => {
    checkPendingReveals();
  }, []);

  async function checkPendingReveals() {
    const period = await contract.getCurrentPeriod();
    const key = `score_${period}_${fid}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      const data = JSON.parse(stored);
      const commitTime = data.commitTime;
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - commitTime;
      
      if (elapsed < 600) {
        // Still within window
        setTimeLeft(600 - elapsed);
        setStatus('revealing');
        await revealScore(data);
      } else {
        // Expired
        localStorage.removeItem(key);
        alert('Score reveal expired. Score = 0 for this entry.');
      }
    }
  }

  async function handleSubmit() {
    try {
      setStatus('committing');
      
      // Generate commitment
      const period = await contract.getCurrentPeriod();
      const nonce = ethers.utils.randomBytes(32);
      const timestamp = Math.floor(Date.now() / 1000);
      
      const commitHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['uint256', 'uint256', 'bytes32', 'uint256'],
          [fid, gameScore, nonce, timestamp]
        )
      );
      
      // Commit transaction
      const commitTx = await contract.commitScore(period, fid, commitHash);
      await commitTx.wait();
      
      // Store for reveal
      const data = {
        score: gameScore,
        nonce: ethers.utils.hexlify(nonce),
        timestamp,
        commitHash,
        commitTime: Math.floor(Date.now() / 1000)
      };
      localStorage.setItem(`score_${period}_${fid}`, JSON.stringify(data));
      
      // Wait a moment then reveal
      setStatus('revealing');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reveal transaction
      await revealScore(data);
      
    } catch (error) {
      console.error('Submit failed:', error);
      setStatus('idle');
      alert('Submission failed. Please try again.');
    }
  }

  async function revealScore(data: any) {
    try {
      const period = await contract.getCurrentPeriod();
      
      const revealTx = await contract.revealScore(
        period,
        fid,
        data.score,
        data.nonce,
        data.timestamp
      );
      await revealTx.wait();
      
      // Success!
      localStorage.removeItem(`score_${period}_${fid}`);
      setStatus('done');
      
      alert(`Score ${data.score} submitted successfully! ✅`);
      
    } catch (error) {
      console.error('Reveal failed:', error);
      // Don't clear localStorage - user can retry
      alert('Reveal failed. You can retry.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-2xl font-bold">Your Score: {gameScore}</div>
      
      {status === 'idle' && (
        <button
          onClick={handleSubmit}
          className="px-6 py-3 bg-blue-600 text-white rounded"
        >
          Submit Score (2 transactions)
        </button>
      )}
      
      {status === 'committing' && (
        <div className="text-yellow-500">
          Committing score... (1/2)
        </div>
      )}
      
      {status === 'revealing' && (
        <div className="text-yellow-500">
          Revealing score... (2/2)
          {timeLeft && <div>Time left: {timeLeft}s</div>}
        </div>
      )}
      
      {status === 'done' && (
        <div className="text-green-500 font-bold">
          ✅ Score submitted successfully!
        </div>
      )}
      
      <div className="text-sm text-gray-500">
        Note: Requires 2 transactions for anti-cheat security
      </div>
    </div>
  );
}
```

---

## ❓ FAQ

### Q: Why 2 transactions instead of 1?
**A:** Security! If it's 1 transaction, you could see others' scores in mempool and submit higher. Commitment locks in your score first.

### Q: What if I lose internet after commit?
**A:** Score is saved in localStorage. When you reconnect within 10 minutes, the app will prompt you to reveal.

### Q: Can I commit with one wallet and reveal with another?
**A:** Yes! As long as both wallets are approved for your FID (max 3 wallets).

### Q: What happens if I don't reveal within 10 minutes?
**A:** Your score becomes 0 for that entry. Entry fee is not refundable. You can still enter next period.

### Q: Is this truly decentralized?
**A:** Yes! No backend server needed. All logic onchain. Players control their own scores (with cryptographic proof).

### Q: Can the owner manipulate scores?
**A:** No! Scores are cryptographically committed by players. Owner has zero control over score submission/verification.

---

## ✅ Benefits vs Backend Approach

| Feature | Backend Submit | Player Commit/Reveal |
|---------|----------------|---------------------|
| **Decentralization** | ❌ Centralized | ✅ Fully decentralized |
| **Backend needed** | ✅ Required | ❌ Not needed |
| **Server costs** | $$$ Monthly | $0 |
| **Censorship resistance** | ❌ Backend can block | ✅ Unstoppable |
| **User transactions** | 1 (cheap) | 2 (slightly more expensive) |
| **Anti-cheat** | ✅ Server validates | ✅ Crypto validates |
| **Owner control** | ⚠️ Owner controls backend | ✅ Zero owner control |

---

**Conclusion: Commitment scheme is more decentralized, secure, and sustainable. Perfect for fully onchain games! 🎮⛓️**
