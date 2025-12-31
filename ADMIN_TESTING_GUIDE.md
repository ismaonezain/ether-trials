hahaha
\# Admin Testing Guide - v6 Contract

Contract Address: `0x9515Da0cf0352f260A20828bBA8848eA7Ec175Bb`

## 🔧 Admin Testing Function: `adminEnterTournament()`

Function khusus untuk owner/admin untuk testing swap functionality dan prize pool mechanics.

---

## ✨ Key Features

1. **Owner-Only Access**: Hanya address owner yang bisa call function ini
2. **No Entry Limits**: Bypass minEntry/maxEntry checks (bisa kirim ETH berapapun > 0)
3. **Same Swap Logic**: Tetap swap ETH → TRIA via Uniswap V3
4. **100% to Prize Pool**: Semua TRIA masuk prize pool, sama seperti `enterTournament()`
5. **Full Testing**: Bisa test semua functionality tanpa restrictions

---

## 🚀 How to Test via Remix

### Step 1: Connect to Contract
1. Go to https://remix.ethereum.org
2. Connect wallet dengan address owner yang deploy contract
3. Load contract di address `0x9515Da0cf0352f260A20828bBA8848eA7Ec175Bb`

### Step 2: Call `adminEnterTournament()`

**Via Remix UI:**
```javascript
// In "Value" field, enter ETH amount (e.g., 0.00001)
// Click "adminEnterTournament" button
// Confirm transaction in wallet
```

**Via Web3.js:**
```javascript
const contract = new web3.eth.Contract(ABI, '0x9515Da0cf0352f260A20828bBA8848eA7Ec175Bb');

// Enter with 0.00001 ETH
await contract.methods.adminEnterTournament().send({
  from: ownerAddress,
  value: web3.utils.toWei('0.00001', 'ether')
});
```

**Via Ethers.js:**
```javascript
const contract = new ethers.Contract(
  '0x9515Da0cf0352f260A20828bBA8848eA7Ec175Bb',
  ABI,
  signer
);

// Enter with 0.00001 ETH
await contract.adminEnterTournament({
  value: ethers.utils.parseEther('0.00001')
});
```

---

## 🧪 Testing Scenarios

### Test 1: Minimum Entry (0.00001 ETH)
```javascript
// Test dengan minimum amount
value: "0.00001" ETH
// Expected: Success, TRIA received added to prize pool
```

### Test 2: Small Entry (0.0001 ETH)
```javascript
// Test dengan small amount
value: "0.0001" ETH
// Expected: Success, more TRIA received
```

### Test 3: Medium Entry (0.001 ETH)
```javascript
// Test dengan medium amount
value: "0.001" ETH
// Expected: Success, even more TRIA
```

### Test 4: Custom Amount
```javascript
// Test dengan any custom amount
value: "0.000123" ETH
// Expected: Success, proportional TRIA
```

---

## 📊 What to Check After Testing

### 1. Check Prize Pool Increased
```javascript
const info = await contract.getCurrentPeriodInfo();
console.log('Prize Pool TRIA:', info.prizePoolTRIA);
console.log('Participants:', info.participants);
console.log('Total Points:', info.totalPoints);
```

### 2. Check Player Entry
```javascript
const playerInfo = await contract.getPlayerInfo(ownerAddress, currentPeriod);
console.log('Has Entered:', playerInfo.hasEntered);
console.log('Entry Amount:', playerInfo.entryAmount);
console.log('Score:', playerInfo.score);
console.log('Points:', playerInfo.points);
```

### 3. Check Event Logs
Look for `EntryPaid` event:
```javascript
event EntryPaid(
  address indexed player,  // Your owner address
  uint256 ethAmount,       // ETH you sent
  uint256 triaAmount,      // TRIA received from swap
  uint256 period,          // Current period number
  uint256 timestamp        // Block timestamp
)
```

### 4. Check TRIA Balance
```javascript
// Check contract's TRIA balance
const triaBalance = await triaToken.balanceOf(contractAddress);
console.log('Contract TRIA Balance:', triaBalance);
```

---

## ⚠️ Important Notes

### 1. **Owner Verification**
- Make sure you're connected dengan wallet yang deploy contract
- Kalau bukan owner, transaction akan revert dengan "Only owner"

### 2. **Period Must Be Active**
- Period harus belum ended
- Check `getCurrentPeriodInfo()` untuk verify period masih active

### 3. **Can Only Enter Once Per Period**
- Admin juga cuma bisa enter 1x per period
- Kalau sudah enter, akan revert dengan "Already entered"

### 4. **ETH Must Be > 0**
- Harus kirim ETH > 0
- Kalau kirim 0, akan revert dengan "Must send ETH"

### 5. **TRIA Pool Must Exist**
- Make sure WETH/TRIA pool exists di Uniswap V3
- Pool harus punya liquidity yang cukup
- Kalau swap fails, transaction akan revert

---

## 🔍 Troubleshooting

### Error: "Only owner"
**Problem**: Bukan owner address yang call function  
**Solution**: Connect dengan wallet owner yang deploy contract

### Error: "Period ended"
**Problem**: Current period sudah ended  
**Solution**: Owner call `allocatePrizes()` untuk start new period

### Error: "Already entered"
**Problem**: Owner sudah enter di current period  
**Solution**: Wait for next period atau test dengan regular `enterTournament()`

### Error: "Swap failed"
**Problem**: Uniswap V3 swap gagal (no liquidity, wrong pool fee, etc.)  
**Solution**: 
- Check WETH/TRIA pool exists
- Verify pool fee setting (default 3000 = 0.3%)
- Make sure pool has sufficient liquidity

### Error: "Must send ETH"
**Problem**: Kirim 0 ETH  
**Solution**: Kirim ETH amount > 0

---

## 🎯 Quick Test Checklist

- [ ] Connected dengan owner wallet
- [ ] Contract loaded di Remix
- [ ] Period masih active (not ended)
- [ ] Haven't entered yet di current period
- [ ] WETH/TRIA pool exists dengan liquidity
- [ ] Kirim ETH > 0
- [ ] Call `adminEnterTournament()`
- [ ] Transaction success
- [ ] Check `EntryPaid` event emitted
- [ ] Verify prize pool increased
- [ ] Verify player data recorded

---

## 💡 Next Steps After Testing

### 1. Test Regular Entry
Test juga `enterTournament()` dengan non-owner address untuk compare behavior

### 2. Test Score Submission
```javascript
// Owner submit score for testing
await contract.submitScore(ownerAddress, 1000);
```

### 3. Test Prize Allocation
```javascript
// After period ends + reveal window
await contract.allocatePrizes(periodNumber);
```

### 4. Test Prize Claiming
```javascript
// Claim TRIA prize
await contract.claimPrize(periodNumber);
```

---

## 📝 Example Full Test Flow

```javascript
// 1. Admin enters tournament
await contract.adminEnterTournament({ value: parseEther('0.0001') });

// 2. Check entry successful
const info = await contract.getPlayerInfo(ownerAddress, currentPeriod);
console.log('Entered:', info.hasEntered);
console.log('Entry Amount:', info.entryAmount);

// 3. Submit score for admin
await contract.submitScore(ownerAddress, 1500);

// 4. Check score & points recorded
const updatedInfo = await contract.getPlayerInfo(ownerAddress, currentPeriod);
console.log('Score:', updatedInfo.score);
console.log('Points:', updatedInfo.points);

// 5. Wait for period to end...

// 6. Allocate prizes
await contract.allocatePrizes(currentPeriod);

// 7. Claim prize
await contract.claimPrize(currentPeriod);

// 8. Verify TRIA received
const triaBalance = await triaToken.balanceOf(ownerAddress);
console.log('TRIA Balance:', triaBalance);
```

---

## 🎊 Success Indicators

✅ **Transaction Success**
- Transaction confirmed without revert
- Gas used ~200-300k (includes swap)

✅ **Event Emitted**
- `EntryPaid` event in transaction logs
- Shows ETH amount and TRIA received

✅ **State Updated**
- Prize pool increased by TRIA amount
- Player data recorded correctly
- Participant count increased

✅ **TRIA Balance**
- Contract TRIA balance increased
- Amount matches swap output

---

Ready to test! 🚀

Kalau ada error atau butuh help troubleshooting, let me know!
