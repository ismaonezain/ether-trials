// anjing
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { formatEther, parseEther, type Address } from 'viem';
import { ETHER_TRIALS_V3_ABI, ETHER_TRIALS_V3_ADDRESS } from '@/lib/contracts/etherTrialsPointBasedV3ABI';

export function useEtherTrialsV3() {
  const { address: walletAddress } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // ===== READ: Current Period =====
  const { data: currentPeriodRaw } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'currentPeriod',
  });
  const currentPeriod = currentPeriodRaw ? Number(currentPeriodRaw) : 0;

  // ===== READ: Period Info =====
  const { data: periodData } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'periods',
    args: currentPeriod > 0 ? [BigInt(currentPeriod)] : undefined,
  });

  const periodInfo = periodData
    ? {
        prizePoolTRIA: periodData[0],
        totalPoints: periodData[1],
        participantCount: periodData[2],
        startTime: periodData[3],
        endTime: periodData[4],
        distributed: periodData[5],
      }
    : null;

  // ===== READ: Player Data =====
  const { data: playerDataRaw } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'playerData',
    args:
      currentPeriod > 0 && walletAddress
        ? [BigInt(currentPeriod), walletAddress]
        : undefined,
  });

  const playerData = playerDataRaw
    ? {
        score: playerDataRaw[0],
        pendingPrizeTRIA: playerDataRaw[1],
        claimed: playerDataRaw[2],
        hasEntered: playerDataRaw[3],
      }
    : null;

  // ===== READ: User Points =====
  const { data: userPointsRaw } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'userPoints',
    args:
      currentPeriod > 0 && walletAddress
        ? [BigInt(currentPeriod), walletAddress]
        : undefined,
  });
  const userPoints = userPointsRaw ? Number(userPointsRaw) : 0;

  // ===== READ: Constants =====
  const { data: entryFeeRaw } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'ENTRY_FEE',
  });
  const { data: maxScoreRaw } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'MAX_SCORE',
  });
  const { data: distributionIntervalRaw } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'DISTRIBUTION_INTERVAL',
  });

  const constants = {
    entryFee: entryFeeRaw ? formatEther(entryFeeRaw) : '0',
    maxScore: maxScoreRaw ? Number(maxScoreRaw) : 0,
    distributionInterval: distributionIntervalRaw ? Number(distributionIntervalRaw) : 0,
  };

  // ===== READ: Platform Fees =====
  const { data: platformFeesRaw } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'platformFeesTRIA',
  });
  const { data: totalPrizeOwedRaw } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'totalPrizeOwedTRIA',
  });

  const balances = {
    platformFees: platformFeesRaw ? formatEther(platformFeesRaw) : '0',
    totalPrizeOwed: totalPrizeOwedRaw ? formatEther(totalPrizeOwedRaw) : '0',
  };

  // ===== READ: v3Fee =====
  const { data: v3FeeRaw } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'v3Fee',
  });
  const v3Fee = v3FeeRaw ? Number(v3FeeRaw) : 3000;

  // ===== READ: Owner =====
  const { data: ownerAddress } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'owner',
  });

  // ===== WRITE FUNCTIONS =====

  const payEntryFee = (amountOutMinimum: bigint) => {
    if (!entryFeeRaw) return;
    writeContract({
      address: ETHER_TRIALS_V3_ADDRESS,
      abi: ETHER_TRIALS_V3_ABI,
      functionName: 'payEntryFee',
      args: [amountOutMinimum],
      value: entryFeeRaw, // Fixed 0.00002 ETH
    });
  };

  const submitScore = (player: Address, score: number) => {
    writeContract({
      address: ETHER_TRIALS_V3_ADDRESS,
      abi: ETHER_TRIALS_V3_ABI,
      functionName: 'submitScore',
      args: [player, BigInt(score)],
      gas: 300000n,
    });
  };

  const submitScoresBatch = (players: Address[], scores: number[]) => {
    writeContract({
      address: ETHER_TRIALS_V3_ADDRESS,
      abi: ETHER_TRIALS_V3_ABI,
      functionName: 'submitScoresBatch',
      args: [players, scores.map((s) => BigInt(s))],
      gas: 1000000n,
    });
  };

  const allocatePrizes = () => {
    writeContract({
      address: ETHER_TRIALS_V3_ADDRESS,
      abi: ETHER_TRIALS_V3_ABI,
      functionName: 'allocatePrizes',
      gas: 1000000n,
    });
  };

  const claimPrize = (period: number) => {
    writeContract({
      address: ETHER_TRIALS_V3_ADDRESS,
      abi: ETHER_TRIALS_V3_ABI,
      functionName: 'claimPrize',
      args: [BigInt(period)],
      gas: 500000n,
    });
  };

  const withdrawPlatformFees = () => {
    writeContract({
      address: ETHER_TRIALS_V3_ADDRESS,
      abi: ETHER_TRIALS_V3_ABI,
      functionName: 'withdrawPlatformFees',
      gas: 300000n,
    });
  };

  const setV3Fee = (fee: number) => {
    writeContract({
      address: ETHER_TRIALS_V3_ADDRESS,
      abi: ETHER_TRIALS_V3_ABI,
      functionName: 'setV3Fee',
      args: [fee],
      gas: 200000n,
    });
  };

  // ===== HELPER FUNCTIONS =====

  const isOwner = (address: Address | undefined) => {
    if (!address || !ownerAddress) return false;
    return address.toLowerCase() === ownerAddress.toLowerCase();
  };

  return {
    // Read data
    currentPeriod,
    periodInfo,
    playerData,
    userPoints,
    constants,
    balances,
    v3Fee,
    ownerAddress,

    // Write functions
    payEntryFee,
    submitScore,
    submitScoresBatch,
    allocatePrizes,
    claimPrize,
    withdrawPlatformFees,
    setV3Fee,

    // Helpers
    isOwner,

    // Transaction state
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}
