# EtherTrials TRIA v2 Smart Contracts

Complete tournament system with FID-based entries, weighted rewards, mini games, and $TRIA token integration.

## 📁 Files Overview

```
src/contracts/
├── EtherTrialsTRIAv2.sol              # Main smart contract
├── EtherTrialsTRIAv2_DEPLOYMENT.md    # Detailed deployment guide
├── UPDATE_ADDRESSES_GUIDE.md          # How to update frontend after deployment
└── README.md                          # This file

src/lib/contracts/
└── etherTrialsTRIAv2ABI.ts           # TypeScript ABI + contract addresses

src/hooks/
└── useTRIAContractv2.ts              # React hook for contract interaction

scripts/
└── deploy-tria-v2.js                  # Hardhat deployment script

hardhat.config.js                      # Hardhat configuration
.env.example                           # Environment variables template
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-verify
```

### 2. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add:
# - Your deployer private key
# - BaseScan API key (for verification)
```

### 3. Configure Deployment Script

Edit `scripts/deploy-tria-v2.js`:

```javascript
const TRIA_TOKEN = "0xYOUR_TRIA_FROM_CLANKER"; // Update this
const BACKEND_SERVER = "0xYOUR_BACKEND_ADDRESS"; // Update this
```

### 4. Deploy to Base

```bash
# Deploy to Base mainnet
npx hardhat run scripts/deploy-tria-v2.js --network base

# Deploy to testnet first (recommended)
npx hardhat run scripts/deploy-tria-v2.js --network baseGoerli
```

### 5. Verify Contract

```bash
npx hardhat verify --network base DEPLOYED_ADDRESS "TRIA_TOKEN" "UNISWAP_ROUTER" "BACKEND_SERVER"
```

### 6. Update Frontend

Open `src/lib/contracts/etherTrialsTRIAv2ABI.ts` and update:

```typescript
export const CONTRACT_ADDRESSES_V2 = {
  base: {
    etherTrialsTRIAv2: '0xYOUR_DEPLOYED_CONTRACT', // Update here
    triaToken: '0xYOUR_TRIA_TOKEN',
    uniswapRouter: '0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24',
  }
};
```

See [UPDATE_ADDRESSES_GUIDE.md](./UPDATE_ADDRESSES_GUIDE.md) for detailed instructions.

---

## 📊 Contract Architecture

### Entry System (Tournament)
- **Entry Range:** 0.00001 - 1 ETH
- **100% ETH → $TRIA swap** via Uniswap
- **Weighted Rewards:** Higher entry = higher reward share
- **FID-Based:** 1 entry per FID per 24h period

### Token Distribution
```
Entry → 100% swapped to $TRIA:
├─ 80% → Prize Pool (in $TRIA)
├─ 10% → Buyback Pool (owner withdrawable)
├─ 5%  → Treasury (ETH kept)
└─ 5%  → Mini Games Pool (ETH)
```

### Mini Games (Dice & Spin)
- **Entry:** 0.00001 ETH (fixed)
- **Instant wins:** 50% chance, 0.5x-2x prize
- **Lucky Burst:** 1:500 chance, 0.001 ETH prize

### Weighted Reward Formula
```
Entry Weight = (entry_amount / MIN_ENTRY) * 1e18
Weighted Score = user_score * entry_weight
Reward = (weighted_score / total_weighted_score) * prize_pool
```

**Example:**
- Player A: 0.00001 ETH entry, score 1000 → Weight 1
- Player B: 1 ETH entry, score 1000 → Weight 100,000
- Prize split: A gets 0.001%, B gets 99.999%

This ensures fairness: whales pay more, get more, but skill still matters.

---

## 🎮 Key Features

### Tournament
- ✅ FID-based entry system (Farcaster integration)
- ✅ 24-hour periods with auto-rollover
- ✅ Weighted rewards (entry amount + score)
- ✅ Multi-period claiming
- ✅ Backend score submission
- ✅ Period finalization (anyone can trigger)

### Wallet Management
- ✅ Max 3 wallets per FID
- ✅ 7-day cooldown between additions
- ✅ Any approved wallet can claim rewards
- ✅ Must keep at least 1 wallet

### Mini Games
- ✅ Ether Dice game
- ✅ Ether Spin game
- ✅ Lucky Burst mechanic
- ✅ Instant prize distribution
- ✅ Auto-inject to main prize pool

### Owner Functions
- ✅ Withdraw buyback $TRIA (for giveaways)
- ✅ Withdraw treasury ETH (for ops)
- ✅ Inject $TRIA to prize pool
- ✅ Withdraw mini maintenance
- ✅ Set lucky burst chance

---

## 🔐 Security Features

1. **Access Control:**
   - Owner-only administrative functions
   - Backend-only score submission
   - FID-wallet verification

2. **Anti-Spam:**
   - 1-second cooldown between mini game plays
   - 1 entry per FID per period
   - 7-day wallet addition cooldown

3. **Fail-Safes:**
   - Slippage protection on swaps (2%)
   - Balance checks before withdrawals
   - Period finalization guards

4. **Auditing:**
   - All events logged on-chain
   - Transparent reward calculations
   - Public view functions

---

## 📞 Frontend Integration

### Using the Hook

```typescript
import { useTRIAContractV2 } from '@/hooks/useTRIAContractv2';

function TournamentPage() {
  const fid = 12345n; // User's Farcaster FID
  const {
    currentPeriod,
    periodInfo,
    balances,
    canEnterTournament,
    enterTournament,
    playDice,
    playSpin,
    claimAllRewards,
  } = useTRIAContractV2(fid);

  // Enter tournament
  const handleEntry = async () => {
    await enterTournament(fid, "0.001"); // 0.001 ETH
  };

  // Play mini game
  const handleDice = async () => {
    await playDice(fid); // 0.00001 ETH (auto)
  };

  return (
    <div>
      <h1>Period {currentPeriod.toString()}</h1>
      <p>Prize Pool: {formatEther(periodInfo?.triaPool || 0n)} $TRIA</p>
      
      <button onClick={handleEntry} disabled={!canEnterTournament}>
        Enter Tournament
      </button>
      
      <button onClick={handleDice}>
        Play Dice (0.00001 ETH)
      </button>
    </div>
  );
}
```

---

## 🧪 Testing Checklist

Before going live:

- [ ] Deploy to Base Goerli testnet
- [ ] Test tournament entry (various amounts)
- [ ] Test weighted reward calculations
- [ ] Test wallet management (add/remove)
- [ ] Test mini games (dice & spin)
- [ ] Test lucky burst (set chance to 2 for testing)
- [ ] Test period finalization
- [ ] Test claims (single & multi-period)
- [ ] Test owner functions
- [ ] Verify $TRIA swap works (check liquidity)
- [ ] Load test with multiple users
- [ ] Check all events emit correctly

---

## 📚 Additional Resources

- **Detailed Deployment:** [EtherTrialsTRIAv2_DEPLOYMENT.md](./EtherTrialsTRIAv2_DEPLOYMENT.md)
- **Address Update:** [UPDATE_ADDRESSES_GUIDE.md](./UPDATE_ADDRESSES_GUIDE.md)
- **BaseScan:** https://basescan.org
- **BaseSwap:** https://baseswap.fi
- **Base Docs:** https://docs.base.org

---

## ⚠️ Important Notes

1. **Liquidity Required:** $TRIA must have sufficient liquidity on BaseSwap before deployment
2. **Backend Setup:** Configure backend server to submit scores via `submitScore()`
3. **Initial Funding:** Send ETH to contract for mini game prizes and lucky burst
4. **Gas Costs:** Entry requires ~300k gas (higher than normal due to swap)
5. **Period Management:** Anyone can call `finalizePeriod()` after 24h

---

## 📝 Contract Addresses

After deployment, your addresses will be:

```
EtherTrialsTRIAv2: 0x... (from deployment)
$TRIA Token:       0x... (from Clanker)
BaseSwap Router:   0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24
Backend Server:    0x... (your backend)
```

**Update these in:** `src/lib/contracts/etherTrialsTRIAv2ABI.ts`

---

## 🎉 Ready to Deploy?

1. ✅ Read [EtherTrialsTRIAv2_DEPLOYMENT.md](./EtherTrialsTRIAv2_DEPLOYMENT.md)
2. ✅ Configure `scripts/deploy-tria-v2.js`
3. ✅ Setup `.env` file
4. ✅ Deploy to testnet first
5. ✅ Test thoroughly
6. ✅ Deploy to mainnet
7. ✅ Update frontend addresses
8. ✅ Go live! 🚀
