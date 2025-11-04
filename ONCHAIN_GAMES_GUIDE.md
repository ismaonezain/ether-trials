# 🎮 Full Onchain Mini Games - Complete Guide

## Overview

EtherTrials v3 includes **two fully onchain mini games**: Ether Dice and Ether Spin. All game logic, randomness, and prize distribution happen directly on the blockchain.

---

## 🎲 **Ether Dice Game**

### Game Mechanics

**Entry Cost:** 0.00001 ETH  
**How to Play:** Roll 2 dice (1-6 each) and try to hit winning combinations

### Win Conditions & Multipliers

| Result | Condition | Multiplier | Example Prize |
|--------|-----------|------------|---------------|
| **Lucky Seven** | Sum = 7 | 2x | 0.00002 ETH |
| **Snake Eyes / Boxcars** | Sum = 2 or 12 | 5x | 0.00005 ETH |
| **Doubles** | Both dice same | 3x | 0.00003 ETH |
| **Lucky Burst** | 1:500 chance | 100x | 0.001 ETH |

### Smart Contract Function

```solidity
function playDice(uint256 fid) external payable returns (DiceResult memory)

struct DiceResult {
    uint8 dice1;        // First die (1-6)
    uint8 dice2;        // Second die (1-6)
    uint8 total;        // Sum of both dice
    bool isWin;         // Did user win?
    uint256 prizeAmount; // Prize in ETH
    bool isLuckyBurst;  // Was it lucky burst?
    bool isTRIA;        // Prize in TRIA? (future)
}
```

### Example Frontend Call

```typescript
const result = await contract.playDice(userFID, {
  value: ethers.utils.parseEther("0.00001")
});

console.log(`Rolled: ${result.dice1} + ${result.dice2} = ${result.total}`);
if (result.isWin) {
  console.log(`Won ${ethers.utils.formatEther(result.prizeAmount)} ETH!`);
}
```

---

## 🎡 **Ether Spin Game**

### Game Mechanics

**Entry Cost:** 0.00001 ETH  
**How to Play:** Spin a roulette-style wheel (0-36) and bet on either:
- **Exact number** (0-36)
- **Color** (red, black, green)

### Win Conditions & Multipliers

| Bet Type | Condition | Multiplier | Example Prize |
|----------|-----------|------------|---------------|
| **Green Zero** | Hit 0 exactly | 35x | 0.00035 ETH |
| **Exact Number** | Hit 1-36 exactly | 10x | 0.0001 ETH |
| **Color Match** | Red or Black | 1.5x | 0.000015 ETH |
| **Lucky Burst** | 1:500 chance | 100x | 0.001 ETH |

### Roulette Color Pattern

Based on real roulette wheel:
- **Green:** 0
- **Red:** 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
- **Black:** All other numbers (1-36)

### Smart Contract Function

```solidity
function playSpin(
    uint256 fid, 
    uint8 betNumber,    // 0-36
    string memory betColor  // "red", "black", or "green"
) external payable returns (SpinResult memory)

struct SpinResult {
    uint8 number;       // Spun number (0-36)
    string color;       // Result color
    bool isWin;         // Did user win?
    uint256 prizeAmount; // Prize in ETH
    uint256 multiplier; // Win multiplier
    bool isLuckyBurst;  // Was it lucky burst?
    bool isTRIA;        // Prize in TRIA? (future)
}
```

### Example Frontend Call

```typescript
// Bet on number 7
const result = await contract.playSpin(
  userFID, 
  7,      // bet number
  "red",  // bet color
  { value: ethers.utils.parseEther("0.00001") }
);

console.log(`Spun: ${result.number} (${result.color})`);
if (result.isWin) {
  console.log(`Won ${ethers.utils.formatEther(result.prizeAmount)} ETH! (${result.multiplier}x)`);
}

// Or bet on color only
const result2 = await contract.playSpin(
  userFID,
  0,      // number doesn't matter for color bet
  "black", // bet on black
  { value: ethers.utils.parseEther("0.00001") }
);
```

---

## 💰 **Prize Pool Economics**

### Entry Fee Distribution (0.00001 ETH)

```
60% → Instant Prizes (0.000006 ETH)
├─ 10% → Lucky Burst Pool (0.0000006 ETH)
└─ 90% → Game prizes (0.0000054 ETH)

15% → Buyback $TRIA (0.0000015 ETH)
20% → Inject to Main Prize Pool (0.000002 ETH)
5%  → Maintenance (0.0000005 ETH)
```

### Lucky Burst Pool

- **10% of prize allocation** goes to lucky burst
- Builds up over time
- **1:500 chance** to win (configurable by owner)
- **Minimum payout:** 0.001 ETH
- Triggers independently of game result

---

## 🔐 **Randomness & Fairness**

### Current Implementation (v3)

Uses **blockhash-based randomness**:
```solidity
uint256 random = uint256(keccak256(abi.encodePacked(
    block.timestamp,
    block.prevrandao,    // New in Ethereum PoS
    block.number,
    fid,
    msg.sender,
    fidMiniGamePlays[fid]
)));
```

**Security Features:**
✅ Multiple entropy sources  
✅ User-specific seed (FID)  
✅ Play counter prevents prediction  
✅ Cannot be manipulated by miners post-merge  

**Limitations:**
⚠️ Not cryptographically secure for high-stakes  
⚠️ Miners could theoretically manipulate (very expensive)  

### Future Upgrade: Chainlink VRF

For production with larger prizes, upgrade to **Chainlink VRF** (Verifiable Random Function):

```solidity
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

// Request randomness
uint256 requestId = COORDINATOR.requestRandomWords(
    keyHash,
    subscriptionId,
    requestConfirmations,
    callbackGasLimit,
    numWords
);

// Receive in callback
function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
    // Use randomWords for dice/spin
}
```

**Why VRF for production:**
✅ Cryptographically secure  
✅ Verifiable onchain  
✅ Cannot be manipulated  
❌ Costs ~0.001 ETH per request  
❌ 1-2 block delay  

---

## 🛡️ **Anti-Abuse Mechanisms**

### Rate Limiting
- **1 second cooldown** between plays per wallet
- Prevents spam and bot attacks

### Balance Checks
- Prizes automatically capped by available balance
- Contract never pays more than it has
- Prevents underflow attacks

### Anti-Frontrunning
- Randomness includes `msg.sender`
- Each player gets different random seed
- Cannot predict others' results

---

## 📊 **Owner Controls**

### Lucky Burst Configuration

```solidity
// Set chance (default 500 = 1:500)
function setLuckyBurstChance(uint256 newChance) external onlyOwner

// Examples:
setLuckyBurstChance(1000); // 1:1000 (harder)
setLuckyBurstChance(250);  // 1:250 (easier)
setLuckyBurstChance(100);  // 1:100 (very easy)
```

### Withdraw Buyback

```solidity
// Withdraw all buyback $TRIA for redistribution
function withdrawBuyback() external onlyOwner
```

**Use cases:**
- Giveaways & contests
- Incentive programs
- Inject back to main prize pool
- Liquidity management

### Maintenance

```solidity
// Withdraw mini game maintenance fees
function withdrawMiniMaintenance() external onlyOwner
```

**Use cases:**
- Server costs
- Development
- Marketing

### Emergency

```solidity
// Emergency ETH withdrawal (only owner)
function emergencyWithdrawETH() external onlyOwner
```

---

## 📈 **View Functions for Frontend**

### Check Balances

```solidity
function getBalances() external view returns (
    uint256 buybackTRIA,
    uint256 treasury,
    uint256 miniGame,
    uint256 luckyBurst,
    uint256 miniMaintenance,
    uint256 miniBuyback
)
```

### User Stats

```typescript
// Get user's total mini game plays
const plays = await contract.fidMiniGamePlays(userFID);

// Check last play timestamp (anti-spam)
const lastPlay = await contract.lastMiniGamePlay(userWallet);
const canPlayAgain = Date.now() / 1000 > lastPlay + 1;
```

---

## 🎨 **Frontend Integration Example**

```typescript
import { useTRIAContractv3 } from '@/hooks/useTRIAContractv3';

function MiniGames() {
  const fid = useFID(); // Get user's Farcaster ID
  const { playDice, playSpin } = useTRIAContractv3();
  
  const handleDiceRoll = async () => {
    try {
      const result = await playDice(fid);
      
      if (result.isLuckyBurst) {
        toast.success(`🎉 LUCKY BURST! Won ${formatEther(result.prizeAmount)} ETH!`);
      } else if (result.isWin) {
        toast.success(`You rolled ${result.dice1} + ${result.dice2} = ${result.total}! Won ${formatEther(result.prizeAmount)} ETH`);
      } else {
        toast.info(`Rolled ${result.dice1} + ${result.dice2} = ${result.total}. Try again!`);
      }
    } catch (error) {
      toast.error('Failed to play dice');
    }
  };
  
  const handleSpin = async (number: number, color: string) => {
    try {
      const result = await playSpin(fid, number, color);
      
      if (result.isLuckyBurst) {
        toast.success(`🎉 LUCKY BURST! Won ${formatEther(result.prizeAmount)} ETH!`);
      } else if (result.isWin) {
        toast.success(`Spun ${result.number} (${result.color})! Won ${formatEther(result.prizeAmount)} ETH (${result.multiplier}x)!`);
      } else {
        toast.info(`Spun ${result.number} (${result.color}). Better luck next time!`);
      }
    } catch (error) {
      toast.error('Failed to play spin');
    }
  };
  
  return (
    <div>
      <button onClick={handleDiceRoll}>
        🎲 Roll Dice (0.00001 ETH)
      </button>
      <button onClick={() => handleSpin(7, "red")}>
        🎡 Spin (Bet #7 Red)
      </button>
    </div>
  );
}
```

---

## 🚀 **Deployment Checklist**

### Before Deploy

- [ ] $TRIA token deployed with liquidity
- [ ] Uniswap router address ready
- [ ] Backend server wallet ready
- [ ] Private key secured

### Deploy Contract

```bash
npx hardhat run scripts/deploy-tria-v3.js --network baseGoerli
```

### After Deploy

- [ ] **Initial funding**: Send 0.1-1 ETH to contract for mini game prizes
- [ ] Verify contract on Basescan
- [ ] Update frontend with contract address
- [ ] Test all functions on testnet
- [ ] Set lucky burst chance if desired
- [ ] Monitor mini game balance

### Initial Funding Guide

**Recommended**: **0.1 ETH** minimum

```bash
# Send ETH to contract
cast send <CONTRACT_ADDRESS> --value 0.1ether --private-key $PRIVATE_KEY --rpc-url https://goerli.base.org
```

**Why 0.1 ETH?**
- Average prize: 0.00002 ETH (dice) to 0.00035 ETH (spin)
- Lucky burst: 0.001 ETH
- **0.1 ETH** = ~5,000 regular plays or ~100 lucky bursts
- Auto-replenishes from 60% of each entry fee

**Monitoring:**
```typescript
const balances = await contract.getBalances();
console.log('Mini game balance:', ethers.utils.formatEther(balances.miniGame));
console.log('Lucky burst balance:', ethers.utils.formatEther(balances.luckyBurst));

// Alert if low
if (balances.miniGame < ethers.utils.parseEther("0.01")) {
  console.warn("⚠️ Mini game balance low! Consider adding more ETH");
}
```

---

## 🔧 **Testing on Testnet**

### Base Goerli Testnet

1. **Get testnet ETH**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
2. **Deploy contract**: `npx hardhat run scripts/deploy-tria-v3.js --network baseGoerli`
3. **Fund contract**: Send 0.1 test ETH
4. **Test games**:
   - Play dice 20 times (0.0002 ETH total)
   - Play spin with different bets
   - Check for lucky burst (may take ~500 plays to see)
5. **Verify economics**:
   - Check balances match expected distributions
   - Verify buyback accumulation
   - Test owner withdrawals

### Quick Test Script

```typescript
// Test both games
for (let i = 0; i < 10; i++) {
  const diceResult = await contract.playDice(testFID, {
    value: ethers.utils.parseEther("0.00001")
  });
  console.log(`Dice #${i+1}: ${diceResult.dice1}+${diceResult.dice2}=${diceResult.total}, Win: ${diceResult.isWin}`);
  
  const spinResult = await contract.playSpin(testFID, 7, "red", {
    value: ethers.utils.parseEther("0.00001")
  });
  console.log(`Spin #${i+1}: ${spinResult.number} (${spinResult.color}), Win: ${spinResult.isWin}`);
  
  await new Promise(r => setTimeout(r, 2000)); // Wait 2s for cooldown
}
```

---

## 📞 **Support & Upgrades**

### Common Issues

**"TooSoon" error**
- Wait 1 second between plays
- Anti-spam protection

**"InsufficientBalance" when winning**
- Contract needs more ETH
- Owner should fund contract

**Prizes seem low**
- Prize pool builds from 60% of entries
- Lucky burst requires 0.001 ETH minimum in pool

### Future Upgrades

1. **Chainlink VRF** for cryptographic randomness
2. **Prize in $TRIA** option (toggle ETH/TRIA prizes)
3. **Progressive jackpot** system
4. **Tournament integration** (mini game scores affect main tournament)
5. **NFT rewards** for high rollers

---

## 📊 **Economics Summary**

| Metric | Value | Notes |
|--------|-------|-------|
| Entry Cost | 0.00001 ETH | Fixed for all games |
| Avg Dice Prize | ~0.00002 ETH | 2x-5x multipliers |
| Avg Spin Prize | ~0.00001-0.0003 ETH | 1.5x-35x multipliers |
| Lucky Burst | 0.001 ETH | 1:500 chance |
| House Edge | ~40% | 60% returned to players |
| Recommended Initial Funding | 0.1 ETH | ~5,000 plays |
| Buyback Rate | 15% | Owner can withdraw |
| Main Pool Injection | 20% | Boosts tournament prizes |

**Note:** Economics designed to be sustainable while rewarding players and building main tournament prize pool!

---

Built with ❤️ for EtherTrials on Base
