// anjing
'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { ETHER_TRIALS_V3_ABI, ETHER_TRIALS_V3_ADDRESS } from '@/lib/contracts/etherTrialsPointBasedV3ABI';
import type { Address } from 'viem';

export function usePointBasedContract() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Read Functions
  const { data: periodInfo, refetch: refetchPeriodInfo } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS as Address,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'getCurrentPeriodInfo',
  });

  const { data: platformBalanceRaw } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS as Address,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'platformFeesTRIA',
  });

  const { data: currentPeriod } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS as Address,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'currentPeriod',
  });

  const { data: entryFee } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS as Address,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'ENTRY_FEE',
  });

  // Check if address is owner
  const { data: contractOwner } = useReadContract({
    address: ETHER_TRIALS_V3_ADDRESS as Address,
    abi: ETHER_TRIALS_V3_ABI,
    functionName: 'owner',
  });

  const checkIsOwner = (address: Address | undefined) => {
    if (!address || !contractOwner) return false;
    return address.toLowerCase() === (contractOwner as string).toLowerCase();
  };

  // Get platform balance
  const getPlatformBalance = async (): Promise<bigint> => {
    if (!platformBalanceRaw) return BigInt(0);
    return platformBalanceRaw as bigint;
  };

  // Check if can allocate prizes - V3 doesn't have canAllocate function
  // Check manually: distributed == false (allow allocation even if totalPoints is 0)
  const canAllocateFn = () => {
    if (!periodInfo) return false;
    const [, , , , , , distributed] = periodInfo as [bigint, bigint, bigint, bigint, bigint, bigint, boolean];
    return !distributed; // Allow allocation even if no scores submitted
  };

  // Write Functions
  // V3 requires amountOutMinimum parameter for slippage protection
  const payEntryFee = async (amountOutMinimum: bigint = BigInt(0)) => {
    // Hardcoded fallback - contract ENTRY_FEE is constant at 0.00002 ETH
    const HARDCODED_ENTRY_FEE = BigInt('20000000000000'); // 0.00002 ETH in wei
    
    // Use contract value if available, otherwise use hardcoded (more reliable)
    const valueToSend = entryFee || HARDCODED_ENTRY_FEE;
    
    console.log('💰 Paying entry fee (V3):', {
      entryFeeFromContract: entryFee?.toString(),
      valueToSend: valueToSend.toString(),
      inEth: Number(valueToSend) / 1e18,
      amountOutMinimum: amountOutMinimum.toString(),
    });
    
    // V3 requires amountOutMinimum parameter
    return writeContract({
      address: ETHER_TRIALS_V3_ADDRESS as Address,
      abi: ETHER_TRIALS_V3_ABI,
      functionName: 'payEntryFee',
      args: [amountOutMinimum],
      value: valueToSend,
    });
  };

  const claimPrize = async (period: bigint) => {
    return writeContract({
      address: ETHER_TRIALS_V3_ADDRESS as Address,
      abi: ETHER_TRIALS_V3_ABI,
      functionName: 'claimPrize',
      args: [period],
    });
  };

  // Batch claim multiple periods with prizes
  const claimAllPrizes = async (periods: bigint[]): Promise<{ 
    success: boolean; 
    claimed: number; 
    failed: number;
    errors: string[];
    hashes: string[];
  }> => {
    const results = {
      success: true,
      claimed: 0,
      failed: 0,
      errors: [] as string[],
      hashes: [] as string[],
    };

    for (const period of periods) {
      try {
        const txHash = await new Promise<string>((resolve, reject) => {
          writeContract(
            {
              address: ETHER_TRIALS_V3_ADDRESS as Address,
              abi: ETHER_TRIALS_V3_ABI,
              functionName: 'claimPrize',
              args: [period],
            },
            {
              onSuccess: (hash) => resolve(hash),
              onError: (error) => reject(error),
            }
          );
        });

        results.claimed++;
        results.hashes.push(txHash);
      } catch (error: unknown) {
        results.failed++;
        results.success = false;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Period ${period}: ${errorMessage}`);
      }
    }

    return results;
  };

  // Submit score (owner only)
  const submitScore = async (
    player: Address,
    score: bigint
  ): Promise<{ success: boolean; error?: string; hash?: string }> => {
    try {
      const txHash = await new Promise<string>((resolve, reject) => {
        writeContract(
          {
            address: ETHER_TRIALS_V3_ADDRESS as Address,
            abi: ETHER_TRIALS_V3_ABI,
            functionName: 'submitScore',
            args: [player, score],
          },
          {
            onSuccess: (hash) => resolve(hash),
            onError: (error) => reject(error),
          }
        );
      });

      return { success: true, hash: txHash };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  };

  // Submit scores in batch (owner only)
  const submitScoresBatch = async (
    players: Address[],
    scores: bigint[]
  ): Promise<{ success: boolean; error?: string; hash?: string }> => {
    try {
      const txHash = await new Promise<string>((resolve, reject) => {
        writeContract(
          {
            address: ETHER_TRIALS_V3_ADDRESS as Address,
            abi: ETHER_TRIALS_V3_ABI,
            functionName: 'submitScoresBatch',
            args: [players, scores],
          },
          {
            onSuccess: (hash) => resolve(hash),
            onError: (error) => reject(error),
          }
        );
      });

      return { success: true, hash: txHash };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  };

  // Admin Functions
  const allocatePrizes = async (): Promise<{ success: boolean; error?: string; period?: number; hash?: string }> => {
    try {
      const txHash = await new Promise<string>((resolve, reject) => {
        writeContract(
          {
            address: ETHER_TRIALS_V3_ADDRESS as Address,
            abi: ETHER_TRIALS_V3_ABI,
            functionName: 'allocatePrizes',
          },
          {
            onSuccess: (hash) => resolve(hash),
            onError: (error) => reject(error),
          }
        );
      });

      const period = currentPeriod ? Number(currentPeriod) : 0;
      return { success: true, period, hash: txHash };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  };

  const withdrawPlatformFees = async (): Promise<{ success: boolean; error?: string; amount?: string; hash?: string }> => {
    try {
      const balance = await getPlatformBalance();
      
      const txHash = await new Promise<string>((resolve, reject) => {
        writeContract(
          {
            address: ETHER_TRIALS_V3_ADDRESS as Address,
            abi: ETHER_TRIALS_V3_ABI,
            functionName: 'withdrawPlatformFees',
          },
          {
            onSuccess: (hash) => resolve(hash),
            onError: (error) => reject(error),
          }
        );
      });

      const amountEth = (Number(balance) / 1e18).toFixed(5);
      return { success: true, amount: amountEth, hash: txHash };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
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
      canDistribute: !distributed && totalPoints > BigInt(0),
      timeUntilDistribution: Math.max(0, Number(endTime) - Math.floor(Date.now() / 1000)),
      startTime: new Date(Number(startTime) * 1000),
      endTime: new Date(Number(endTime) * 1000),
      distributed: distributed,
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
    currentPeriod,
    entryFee,
    contractOwner,
    
    // Read functions
    checkIsOwner,
    getPlatformBalance,
    canAllocate: canAllocateFn,
    estimatePrizeForScore,
    
    // Write functions
    payEntryFee,
    claimPrize,
    claimAllPrizes,
    submitScore,
    submitScoresBatch,
    
    // Admin functions
    allocatePrizes,
    withdrawPlatformFees,
    
    // Helpers
    refetchPrizePoolInfo: refetchPeriodInfo,
    
    // Transaction state
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}
