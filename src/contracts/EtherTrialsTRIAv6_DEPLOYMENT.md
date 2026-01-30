pkpkpk
# EtherTrials TRIA v6 - Wallet-Based Deployment Guide

## 🔐 Security Improvement
**V6 uses wallet addresses instead of FID for better security!**
- No FID spoofing risk
- Cryptographic signature verification
- Direct wallet ownership proof
- Simpler and more secure architecture

## Contract Features

### 📊 Tournament System
- **Entry fee**: 0.00001 - 1 ETH
- **Allocations**:
  - 85% → TRIA prize pool
  - 10% → Buyback TRIA (admin withdraw)
  - 5% → Treasury ETH (admin withdraw)
- **Period**: 24 hours each
- **Score commitment**: 10 minute reveal window

### 🎲 Daily Dice System
- **Free dice**: 3 per day
- **Paid dice pricing** (exponential):
  - 1st paid: 0.00001 ETH
  - 2nd paid: 0.00002 ETH
  - 3rd paid: 0.00004 ETH
  - Formula: `price = 0.00001 * (2 ^ paidRollsUsed)`
- **Dice payment allocation**:
  - 80% → Buyback TRIA
  - 20% → Treasury ETH

### 💎 Buyback System
- Admin withdraws accumulated TRIA from:
  - Entry fees (10%)
  - Dice payments (80%)
- Use TRIA for liquidity, rewards, or strategic purposes

---

## 📋 Deployment Steps

### 1. Deploy on Remix IDE

**Constructor Parameters:**
```solidity
constructor(
    address _triaToken,      // Your TRIA token address
    address _uniswapRouter   // Uniswap V2 Router address
)
```

**Example for Base Network:**
```solidity
_triaToken: 0xYOUR_TRIA_TOKEN_ADDRESS
_uniswapRouter: 0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24
```

### 2. Verify Contract on Basescan

```bash
# Constructor arguments (ABI-encoded)
_triaToken: <your-tria-address>
_uniswapRouter: 0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24
```

### 3. Initial Setup

After deployment, the contract is ready to use! No additional setup needed.

---

## 🎮 Usage Examples

### For Players (Frontend Integration)

#### 1. Enter Tournament
```typescript
// User calls: enterTournament()
// No FID needed - uses msg.sender automatically!

const tx = await contract.enterTournament({
  value: ethers.parseEther("0.0001") // Entry amount
});
```

#### 2. Roll Dice (3 Free, Then Paid)

**Free Dice:**
```typescript
// First 3 rolls are free
const tx = await contract.rollDice({
  value: 0 // Free!
});
```

**Paid Dice:**
```typescript
// Get next price first
const diceInfo = await contract.getDiceInfo(period, userAddress);
const nextPrice = diceInfo.nextPaidPrice;

// Pay exact amount
const tx = await contract.rollDice({
  value: nextPrice // Must match exactly!
});
```

#### 3. Commit & Reveal Score

**Commit:**
```typescript
// Frontend generates commitment
const commitment = keccak256(
  abiCoder.encode(
    ["address", "uint256", "uint256", "uint256"],
    [userAddress, score, nonce, timestamp]
  )
);

const tx = await contract.commitScore(period, commitment);
```

**Reveal (within 10 minutes):**
```typescript
const tx = await contract.revealScore(
  period,
  score,
  nonce,
  timestamp
);
```

#### 4. Claim Rewards
```typescript
// Claims all unclaimed rewards from all periods
const tx = await contract.claimAllRewards();
```

---

## 🔧 Admin Functions

### 1. Withdraw Buyback TRIA
```solidity
// Admin withdraws accumulated TRIA
function withdrawBuyback() external onlyOwner
```

**Sources:**
- Entry fees: 10%
- Dice payments: 80%

### 2. Withdraw Treasury ETH
```solidity
// Admin withdraws accumulated ETH
function withdrawTreasury() external onlyOwner
```

**Sources:**
- Entry fees: 5%
- Dice payments: 20%

### 3. Inject TRIA to Prize Pool
```solidity
// Boost current period's prize pool using buyback balance
function injectTRIAToPrizePool(uint256 amount) external onlyOwner
```

### 4. Finalize Period
```solidity
// Anyone can call after period ends
function finalizePeriod(uint256 period) external
```

---

## 📊 View Functions

### Period Info
```solidity
function getPeriodInfo(uint256 period) external view returns (
    uint256 startTime,
    uint256 endTime,
    uint256 triaPool,
    bool finalized,
    uint256 totalWeightedScore,
    uint256 participantCount,
    uint256 timeRemaining,
    string memory status
)
```

### User Entry
```solidity
function getUserEntry(uint256 period, address user) external view returns (
    bool exists,
    uint256 entryAmountETH,
    uint256 entryWeight
)
```

### Dice Info
```solidity
function getDiceInfo(uint256 period, address user) external view returns (
    uint8 freeRollsUsed,
    uint8 freeRollsRemaining,
    uint8 paidRollsUsed,
    uint256 nextPaidPrice
)
```

### Claimable Rewards
```solidity
function getClaimableRewards(address user) external view returns (uint256 totalTRIA)
```

### Balances
```solidity
function getBalances() external view returns (
    uint256 buybackTRIA,
    uint256 treasury
)
```

---

## ✅ Testing Checklist

### Basic Flow
- [ ] Deploy contract with TRIA token and Uniswap router
- [ ] User enters tournament (check allocations)
- [ ] User rolls 3 free dice
- [ ] User rolls paid dice (check exponential pricing)
- [ ] User commits score
- [ ] User reveals score (within 10 minutes)
- [ ] Period ends → finalize
- [ ] User claims rewards

### Admin Flow
- [ ] Check buyback balance accumulation
- [ ] Withdraw buyback TRIA
- [ ] Check treasury balance accumulation
- [ ] Withdraw treasury ETH
- [ ] Inject TRIA to prize pool

### Edge Cases
- [ ] Try to enter twice (should revert)
- [ ] Try to roll dice without entry (should revert)
- [ ] Try free dice with payment (should revert)
- [ ] Try paid dice with wrong amount (should revert)
- [ ] Try to reveal after window expires (should revert)
- [ ] Try to claim with no rewards (should revert)

---

## 🚀 Key Differences from V5

| Feature | V5 (FID-based) | V6 (Wallet-based) |
|---------|----------------|-------------------|
| User Identity | FID parameter | msg.sender (wallet) |
| Security | FID spoofing risk | Cryptographic signature |
| Dice System | ❌ Not available | ✅ 3 free + exponential paid |
| Buyback | ❌ Not available | ✅ Admin withdrawal |
| Complexity | More mappings | Simpler architecture |
| Function Calls | `enterTournament(fid)` | `enterTournament()` |

---

## 📝 Notes

- **Bonus stats tracking**: Not in smart contract - handle in frontend/SpacetimeDB
- **Dice rolls reset**: Per period (24 hours)
- **Entry weight**: Higher entry = higher share of prize pool
- **Score commitment**: Prevents cheating via cryptographic commitment
- **Reveal window**: 10 minutes after commit
- **Slippage tolerance**: 2% for TRIA swaps

---

## 🔗 Contract Addresses

### Base Mainnet
- **TRIA Token**: `0xYOUR_TRIA_ADDRESS`
- **Uniswap V2 Router**: `0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24`
- **EtherTrials V6**: `<deploy-and-add-here>`

---

## 💡 Tips

1. **Test on testnet first** before mainnet deployment
2. **Verify contract** on Basescan for transparency
3. **Monitor buyback balance** to optimize withdrawal timing
4. **Track dice usage** to understand player behavior
5. **Use events** for real-time updates in frontend

---

Ready to deploy! 🚀
