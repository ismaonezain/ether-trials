# 📍 Contract Addresses - Base Mainnet

## Token & Router Addresses

### $TRIA Token (from Clanker)
```
0xd852713dd8ddf61316da19383d0c427adb85eb07
```
- **Network**: Base Mainnet
- **Decimals**: 18 (standard ERC20)
- **Liquidity**: Available on Uniswap V2/BaseSwap
- **Explorer**: https://basescan.org/token/0xd852713dd8ddf61316da19383d0c427adb85eb07

### BaseSwap V2 Router (Uniswap V2 Fork)
```
0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
```
- **Network**: Base Mainnet
- **Type**: Uniswap V2 compatible router
- **Used for**: ETH ↔ $TRIA swaps
- **Explorer**: https://basescan.org/address/0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24

---

## EtherTrials Contract

### Contract Address (After Deployment)
```
[PENDING - WILL BE FILLED AFTER DEPLOYMENT]
```

**To update after deployment:**
1. Deploy contract via Remix
2. Copy deployed contract address
3. Paste here
4. Update in frontend: `src/lib/contracts/etherTrialsTRIAv4ABI.ts`

---

## Frontend Integration

Update `src/lib/contracts/etherTrialsTRIAv4ABI.ts`:

```typescript
export const CONTRACT_ADDRESSES_V4 = {
  base: {
    etherTrialsTRIA: '0xYOUR_DEPLOYED_CONTRACT', // ⚠️ UPDATE AFTER DEPLOYMENT
    triaToken: '0xd852713dd8ddf61316da19383d0c427adb85eb07',
    uniswapRouter: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24'
  }
};
```

---

## Verification Links

After deployment, verify contract at:
- **BaseScan**: https://basescan.org/verifyContract
- **Contract code**: Should match `EtherTrialsTRIAv4_Sustainable.sol`
- **Constructor args**: (_triaToken, _uniswapRouter)

---

## Quick Copy (for Remix deployment)

**Constructor Parameters:**
```
_triaToken: 0xd852713dd8ddf61316da19383d0c427adb85eb07
_uniswapRouter: 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
```

**Network:**
- Chain ID: 8453
- RPC: https://mainnet.base.org
- Explorer: https://basescan.org

---

## Post-Deployment TODO

- [ ] Deploy contract via Remix
- [ ] Save contract address here
- [ ] Verify on BaseScan
- [ ] Update frontend ABI file
- [ ] Test basic functions (getCurrentPeriod, owner, etc.)
- [ ] (Optional) Fund mini games with 0.01 ETH
- [ ] Test 1 small entry (0.00001 ETH)
- [ ] Monitor first swap on BaseScan
- [ ] Celebrate! 🎉
