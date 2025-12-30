// anjing
'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { formatEther, keccak256, encodePacked } from 'viem';
import { ETHER_TRIALS_V4_ABI, ETHER_TRIALS_V4_ADDRESS } from '@/lib/contracts/etherTrialsPointBasedV4ABI';
import type { Address } from 'viem';

export function usePointBasedContractV4() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Read Functions
  const { data: periodInfo, refetch: refetchPeriodInfo } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS as Address,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'getCurrentPeriodInfo',
  });

  const { data: platformBalanceRaw } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS as Address,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'platformFeesETH',
  });

  const { data: totalPrizesOwedRaw } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS as Address,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'totalPrizeOwedETH',
  });

  const { data: currentPeriod } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS as Address,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'currentPeriod',
  });

  const { data: minEntry } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS as Address,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'minEntry',
  });

  const { data: maxEntry } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS as Address,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'maxEntry',
  });

  const { data: contractOwner } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS as Address,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'owner',
  });

  // Get dice usage for current user
  const { data: diceUsage, refetch: refetchDiceUsage } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS as Address,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'diceUsage',
    args: currentPeriod && address ? [currentPeriod, address] : undefined,
  });

  // Get score commit for current user
  const { data: scoreCommit, refetch: refetchScoreCommit } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS as Address,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'scoreCommits',
    args: currentPeriod && address ? [currentPeriod, address] : undefined,
  });

  // Get user periods
  const { data: userPeriodsData } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS as Address,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'getUserPeriods',
    args: address ? [address] : undefined,
  });

  // Helper Functions
  const checkIsOwner = (userAddress: Address | undefined) => {
    if (!userAddress || !contractOwner) return false;
    return userAddress.toLowerCase() === (contractOwner as string).toLowerCase();
  };

  const getPlatformBalance = async (): Promise<bigint> => {
    if (!platformBalanceRaw) return BigInt(0);
    return platformBalanceRaw as bigint;
  };

  const canAllocate = () => {
    if (!periodInfo) return false;
    const [, , totalPoints, , , , distributed] = periodInfo as [bigint, bigint, bigint, bigint, bigint, bigint, boolean];
    return !distributed && totalPoints > BigInt(0);
  };

  // Write Functions - Entry
  const enterTournament = async (entryAmount: bigint) => {
    console.log('🎮 Entering tournament (V4):', {
      entryAmount: entryAmount.toString(),
      inEth: Number(entryAmount) / 1e18,
      minEntry: minEntry?.toString(),
      maxEntry: maxEntry?.toString(),
    });

    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'enterTournament',
      value: entryAmount,
    });
  };

  // Write Functions - Dice
  const rollDice = async (isFree: boolean, price: bigint = BigInt(0)) => {
    console.log('🎲 Rolling dice:', { isFree, price: price.toString() });

    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'rollDice',
      value: isFree ? BigInt(0) : price,
    });
  };

  // Write Functions - Commit/Reveal Score
  const commitScore = async (score: bigint, nonce: bigint) => {
    if (!address) throw new Error('Wallet not connected');
    
    // Generate commit hash: keccak256(score, nonce, sender)
    const commitHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'address'],
        [score, nonce, address]
      )
    );

    console.log('📝 Committing score:', {
      score: score.toString(),
      nonce: nonce.toString(),
      commitHash,
    });

    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'commitScore',
      args: [commitHash],
    });
  };

  const revealScore = async (score: bigint, nonce: bigint) => {
    console.log('🔓 Revealing score:', {
      score: score.toString(),
      nonce: nonce.toString(),
    });

    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'revealScore',
      args: [score, nonce],
    });
  };

  // Write Functions - Claim
  const claimPrize = async (period: bigint) => {
    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'claimPrize',
      args: [period],
    });
  };

  const claimMultiple = async (periods: bigint[]) => {
    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'claimMultiple',
      args: [periods],
    });
  };

  const claimAllForUser = async () => {
    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'claimAllForUser',
    });
  };

  // Admin Functions - Score Submission
  const submitScore = async (player: Address, score: bigint) => {
    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'submitScore',
      args: [player, score],
    });
  };

  const submitScoresBatch = async (players: Address[], scores: bigint[]) => {
    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'submitScoresBatch',
      args: [players, scores],
    });
  };

  // Admin Functions - Prize Allocation
  const allocatePrizes = async (period: bigint) => {
    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'allocatePrizes',
      args: [period],
    });
  };

  const withdrawPlatformFees = async () => {
    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'withdrawPlatformFees',
    });
  };

  const setEntryBounds = async (newMin: bigint, newMax: bigint) => {
    return writeContract({
      address: ETHER_TRIALS_V4_ADDRESS as Address,
      abi: ETHER_TRIALS_V4_ABI,
      functionName: 'setEntryBounds',
      args: [newMin, newMax],
    });
  };

  // Helper function to format pool info
  const formatPrizePoolInfo = () => {
    if (!periodInfo) return null;

    const [period, prizePool, totalPoints, participants, startTime, endTime, distributed] = periodInfo as [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      boolean
    ];

    // Constants from contract
    const REVEAL_WINDOW = 20 * 60; // 20 minutes in seconds
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const endTimeSeconds = Number(endTime);
    
    // Check all requirements from smart contract allocatePrizes function:
    // 1. block.timestamp >= p.endTime + REVEAL_WINDOW
    // 2. !p.distributed
    // 3. p.prizePoolETH > 0
    // 4. p.totalPoints > 0
    const canDistribute = 
      !distributed && 
      totalPoints > BigInt(0) && 
      prizePool > BigInt(0) &&
      currentTimestamp >= (endTimeSeconds + REVEAL_WINDOW);

    return {
      currentPool: formatEther(prizePool),
      currentPoolRaw: prizePool,
      totalPoints: Number(totalPoints),
      participants: Number(participants),
      platformBalance: formatEther(platformBalanceRaw || BigInt(0)),
      platformBalanceRaw: platformBalanceRaw || BigInt(0),
      lastDistribution: new Date(Number(startTime) * 1000),
      nextDistribution: new Date(Number(endTime) * 1000),
      period: Number(period),
      canDistribute,
      timeUntilDistribution: Math.max(0, Number(endTime) - Math.floor(Date.now() / 1000)),
      timeUntilCanAllocate: Math.max(0, (endTimeSeconds + REVEAL_WINDOW) - currentTimestamp),
      startTime: new Date(Number(startTime) * 1000),
      endTime: new Date(Number(endTime) * 1000),
      distributed: distributed,
    };
  };

  // Helper to format dice info
  const formatDiceInfo = () => {
    if (!diceUsage) return null;
    const [freeRollsUsed, paidRollsUsed] = diceUsage as [bigint, bigint];
    return {
      freeRollsUsed: Number(freeRollsUsed),
      paidRollsUsed: Number(paidRollsUsed),
      freeRollsRemaining: Math.max(0, 3 - Number(freeRollsUsed)),
      paidRollsRemaining: Math.max(0, 60 - Number(paidRollsUsed)),
    };
  };

  // Helper to format score commit info
  const formatScoreCommitInfo = () => {
    if (!scoreCommit) return null;
    const [commitHash, commitTime, score, revealed] = scoreCommit as [string, bigint, bigint, boolean];
    return {
      commitHash,
      commitTime: Number(commitTime),
      score: Number(score),
      revealed,
      hasCommit: commitHash !== '0x0000000000000000000000000000000000000000000000000000000000000000',
    };
  };

  // Helper to estimate prize for a score
  const estimatePrizeForScore = (score: bigint): bigint => {
    if (!periodInfo) return BigInt(0);
    
    const [, prizePool, totalPoints] = periodInfo as [bigint, bigint, bigint, bigint, bigint, bigint, boolean];
    
    if (totalPoints === BigInt(0) || prizePool === BigInt(0)) return BigInt(0);
    
    const hypotheticalTotal = totalPoints + score;
    return (score * prizePool) / hypotheticalTotal;
  };

  return {
    // Read data
    prizePoolInfo: formatPrizePoolInfo(),
    diceInfo: formatDiceInfo(),
    scoreCommitInfo: formatScoreCommitInfo(),
    currentPeriod,
    minEntry,
    maxEntry,
    contractOwner,
    userPeriods: userPeriodsData as bigint[] | undefined,
    totalPrizesOwed: formatEther(totalPrizesOwedRaw || BigInt(0)),
    
    // Read functions
    checkIsOwner,
    getPlatformBalance,
    canAllocate,
    estimatePrizeForScore,
    
    // Write functions - Entry
    enterTournament,
    
    // Write functions - Dice
    rollDice,
    
    // Write functions - Commit/Reveal
    commitScore,
    revealScore,
    
    // Write functions - Claim
    claimPrize,
    claimMultiple,
    claimAllForUser,
    
    // Admin functions
    submitScore,
    submitScoresBatch,
    allocatePrizes,
    withdrawPlatformFees,
    setEntryBounds,
    
    // Helpers
    refetchPrizePoolInfo: refetchPeriodInfo,
    refetchDiceUsage,
    refetchScoreCommit,
    
    // Transaction state
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}
