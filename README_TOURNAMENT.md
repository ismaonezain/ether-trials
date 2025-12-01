# Tournament Smart Contract Integration

## Overview
Game ini sekarang sudah terintegrasi dengan Base Network untuk tournament entry fees dan prize distribution.

## Contract Address
**Base Mainnet**: `0x70Ad1125767E7721023cf43c8809c52c1B507E0a`

## Features

### 1. Wallet Connection
- Menggunakan OnchainKit untuk koneksi ke Base Network
- Support untuk Coinbase Wallet, MetaMask, dan wallet lainnya
- Otomatis connect ke Base Mainnet

### 2. Entry Fee Payment
- Entry fee: 0.00001 ETH
- Payment langsung ke smart contract
- Verifikasi on-chain sebelum game dimulai

### 3. Score Submission
Setelah game over, score otomatis di-submit ke:
- **SpacetimeDB**: Untuk real-time leaderboard
- **Smart Contract**: Untuk prize distribution

Score submission ke contract mencakup:
- Final score
- Completion time (dalam detik)
- Tier (0=S, 1=A, 2=B, 3=C berdasarkan score)

### 4. Prize Distribution
Contract mendukung fungsi `distributePrizes()` yang:
- Bisa dipanggil setelah 24 jam
- Distribute prizes ke top 1000 players
- Prize distribution berdasarkan ranking

## Smart Contract ABI

Contract memiliki fungsi-fungsi berikut:

### Write Functions
- `enterTournament()` - Payable, untuk pay entry fee
- `submitScore(uint256 score, uint256 time, uint8 tier)` - Submit hasil game
- `distributePrizes()` - Trigger prize distribution (bisa diatur auto via backend)

### Read Functions
- `entryFee()` - Cek entry fee amount
- `prizePool()` - Cek total prize pool saat ini
- `hasEntered(address)` - Cek apakah address sudah enter
- `playerScores(address)` - Get score player tertentu

## Cara Menggunakan

### Untuk Player:
1. Klik "Start Game"
2. Pilih class dan element
3. Pilih "Prize Pool Mode"
4. Connect wallet (akan muncul OnchainKit wallet modal)
5. Confirm payment 0.00001 ETH
6. Main game
7. Score otomatis submit ke blockchain setelah game over

### Untuk Free Mode:
- Tidak perlu connect wallet
- Score tetap tersimpan di SpacetimeDB
- Tidak eligible untuk prize pool

## Auto Distribution

Prize distribution bisa dilakukan dengan 2 cara:

### 1. Manual (via frontend)
Bisa buat button untuk admin yang panggil `distributePrizes()` setelah 24 jam

### 2. Automated (recommended)
Setup backend service atau script yang:
- Check contract every hour
- Panggil `distributePrizes()` jika sudah 24 jam
- Bisa pakai Gelato Network atau Chainlink Automation

## Files Yang Ditambahkan

1. **src/lib/contracts/tournamentABI.ts** - Contract ABI definition
2. **src/hooks/useTournamentContract.ts** - Hook untuk interact dengan contract
3. **src/components/game/WalletStatus.tsx** - Display wallet connection status
4. **src/components/game/TournamentInfo.tsx** - Show tournament info dan wallet connect

## Environment Variables

Tidak perlu tambahan env variables. OnchainKit sudah dikonfigurasi dengan:
- API Key: Sudah hardcoded di providers.tsx
- Chain: Base Mainnet
- Contract Address: 0x70Ad1125767E7721023cf43c8809c52c1B507E0a

## Testing

Untuk testing di testnet:
1. Ganti contract address di `src/lib/game/constants.ts`
2. Ganti chain di `src/app/providers.tsx` dari `base` ke `baseSepolia`
3. Get testnet ETH dari Base Sepolia faucet

## Notes

- Smart contract harus sudah deployed dan verified di Base Network
- Contract harus memiliki fungsi-fungsi sesuai ABI yang didefinisikan
- Pastikan contract owner setup prize distribution logic dengan benar
- Consider gas fees saat submit score (bisa disubsidi via paymaster)
