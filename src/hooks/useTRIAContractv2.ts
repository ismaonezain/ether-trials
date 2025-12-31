'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther, type Address } from 'viem';
import { base } from 'wagmi/chains';
import { ETHER_TRIALS_TRIA_V2_ABI, CONTRACT_ADDRESSES_V2, type MiniGameResult, type ContractBalances } from '@/lib/contracts/etherTrialsTRIAv2ABI';

export interface TRIAContractV2Data {
  // Contract info
  currentPeriod: bigint;
  triaPool: bigint;
  
  // User specific
  approvedWallets: Address[];
  claimableTRIA: bigint;
  hasEntered: boolean;
  userScore: bigint;
  entryWeight: bigint;
  
  // Balances
  balances: ContractBalances | null;
}

export interface PeriodInfoV2 {
  periodNumber: bigint;
  startTime: bigint;
  endTime: bigint;
  triaPool: bigint;
  finalized: boolean;
  totalWeightedScore: bigint;
  timeRemaining: number; // seconds
}

export function useTRIAContractV2(fid?: bigint) {
  const { address, chainId } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get contract address
  const contractAddress = chainId === base.id 
    ? CONTRACT_ADDRESSES_V2.base.etherTrialsTRIAv2 as Address
    : CONTRACT_ADDRESSES_V2.baseGoerli.etherTrialsTRIAv2 as Address;

  // ============================================
  // READ FUNCTIONS - GENERAL
  // ============================================

  const { data: currentPeriod, refetch: refetchPeriod } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_V2_ABI,
    functionName: 'getCurrentPeriod',
    chainId: base.id,
  });

  const { data: periodInfo } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_V2_ABI,
    functionName: 'getPeriodInfo',
    args: currentPeriod !== undefined ? [currentPeriod] : undefined,
    chainId: base.id,
  });

  const { data: balances, refetch: refetchBalances } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_V2_ABI,
    functionName: 'getBalances',
    chainId: base.id,
  });

  // ============================================
  // READ FUNCTIONS - FID SPECIFIC
  // ============================================

  const { data: approvedWallets, refetch: refetchWallets } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_V2_ABI,
    functionName: 'getApprovedWallets',
    args: fid !== undefined ? [fid] : undefined,
    chainId: base.id,
  });

  const { data: isWalletApproved } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_V2_ABI,
    functionName: 'isWalletApproved',
    args: fid !== undefined && address ? [fid, address] : undefined,
    chainId: base.id,
  });

  const { data: claimableRewards, refetch: refetchClaimable } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_V2_ABI,
    functionName: 'getClaimableRewards',
    args: fid !== undefined ? [fid] : undefined,
    chainId: base.id,
  });

  const { data: entryData, refetch: refetchEntry } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_V2_ABI,
    functionName: 'entries',
    args: currentPeriod !== undefined && fid !== undefined ? [currentPeriod, fid] : undefined,
    chainId: base.id,
  });

  const { data: miniGamePlays } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_V2_ABI,
    functionName: 'fidMiniGamePlays',
    args: fid !== undefined ? [fid] : undefined,
    chainId: base.id,
  });

  const { data: luckyBurstChance } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_V2_ABI,
    functionName: 'luckyBurstChance',
    chainId: base.id,
  });

  // ============================================
  // WRITE FUNCTIONS
  // ============================================

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Enter tournament
  const enterTournament = useCallback(async (fidParam: bigint, entryAmount: string) => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const value = parseEther(entryAmount);

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V2_ABI,
        functionName: 'enterTournament',
        args: [fidParam],
        value,
        chainId: base.id,
      });
    } catch (err) {
      console.error('Error entering tournament:', err);
      setError(err instanceof Error ? err.message : 'Failed to enter tournament');
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, writeContract]);

  // Add wallet
  const addWallet = useCallback(async (fidParam: bigint, walletAddress: Address) => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V2_ABI,
        functionName: 'addWallet',
        args: [fidParam, walletAddress],
        chainId: base.id,
      });
    } catch (err) {
      console.error('Error adding wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to add wallet');
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, writeContract]);

  // Remove wallet
  const removeWallet = useCallback(async (fidParam: bigint, walletAddress: Address) => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V2_ABI,
        functionName: 'removeWallet',
        args: [fidParam, walletAddress],
        chainId: base.id,
      });
    } catch (err) {
      console.error('Error removing wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove wallet');
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, writeContract]);

  // Claim all rewards
  const claimAllRewards = useCallback(async (fidParam: bigint) => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V2_ABI,
        functionName: 'claimAllRewards',
        args: [fidParam],
        chainId: base.id,
      });
    } catch (err) {
      console.error('Error claiming rewards:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim rewards');
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, writeContract]);

  // Play Dice mini game
  const playDice = useCallback(async (fidParam: bigint) => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V2_ABI,
        functionName: 'playDice',
        args: [fidParam],
        value: parseEther('0.00001'),
        chainId: base.id,
      });
    } catch (err) {
      console.error('Error playing dice:', err);
      setError(err instanceof Error ? err.message : 'Failed to play dice');
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, writeContract]);

  // Play Spin mini game
  const playSpin = useCallback(async (fidParam: bigint) => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V2_ABI,
        functionName: 'playSpin',
        args: [fidParam],
        value: parseEther('0.00001'),
        chainId: base.id,
      });
    } catch (err) {
      console.error('Error playing spin:', err);
      setError(err instanceof Error ? err.message : 'Failed to play spin');
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, writeContract]);

  // Finalize period
  const finalizePeriod = useCallback(async (period: bigint) => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V2_ABI,
        functionName: 'finalizePeriod',
        args: [period],
        chainId: base.id,
      });
    } catch (err) {
      console.error('Error finalizing period:', err);
      setError(err instanceof Error ? err.message : 'Failed to finalize period');
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, writeContract]);

  // ============================================
  // OWNER FUNCTIONS
  // ============================================

  const withdrawBuyback = useCallback(async () => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V2_ABI,
        functionName: 'withdrawBuyback',
        chainId: base.id,
      });
    } catch (err) {
      console.error('Error withdrawing buyback:', err);
      setError(err instanceof Error ? err.message : 'Failed to withdraw buyback');
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, writeContract]);

  const withdrawTreasury = useCallback(async () => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V2_ABI,
        functionName: 'withdrawTreasury',
        chainId: base.id,
      });
    } catch (err) {
      console.error('Error withdrawing treasury:', err);
      setError(err instanceof Error ? err.message : 'Failed to withdraw treasury');
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, writeContract]);

  const injectTRIAToPrizePool = useCallback(async (amount: bigint) => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V2_ABI,
        functionName: 'injectTRIAToPrizePool',
        args: [amount],
        chainId: base.id,
      });
    } catch (err) {
      console.error('Error injecting TRIA:', err);
      setError(err instanceof Error ? err.message : 'Failed to inject TRIA');
    } finally {
      setIsLoading(false);
    }
  }, [address, contractAddress, writeContract]);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const getPeriodInfoParsed = useCallback((): PeriodInfoV2 | null => {
    if (!currentPeriod || !periodInfo) return null;

    const [startTime, endTime, triaPool, finalized, totalWeightedScore] = periodInfo as [bigint, bigint, bigint, boolean, bigint];
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeRemaining = Number(endTime - now);

    return {
      periodNumber: currentPeriod,
      startTime,
      endTime,
      triaPool,
      finalized,
      totalWeightedScore,
      timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
    };
  }, [currentPeriod, periodInfo]);

  const formatBalances = useCallback((): ContractBalances | null => {
    if (!balances) return null;

    const [buybackTRIA, treasury, miniGame, luckyBurst, miniMaintenance, miniBuyback] = balances as [bigint, bigint, bigint, bigint, bigint, bigint];

    return {
      buybackTRIA,
      treasury,
      miniGame,
      luckyBurst,
      miniMaintenance,
      miniBuyback,
    };
  }, [balances]);

  const canEnterTournament = useCallback(() => {
    if (!address || !fid) return false;
    if (!entryData) return true;
    
    const [, , , , exists] = entryData as [bigint, bigint, bigint, bigint, boolean];
    return !exists;
  }, [address, fid, entryData]);

  const hasClaimableRewards = useCallback(() => {
    if (!claimableRewards) return false;
    return claimableRewards > 0n;
  }, [claimableRewards]);

  const getEntryWeight = useCallback(() => {
    if (!entryData) return 0n;
    const [, , weight] = entryData as [bigint, bigint, bigint, bigint, boolean];
    return weight;
  }, [entryData]);

  const getUserScore = useCallback(() => {
    if (!entryData) return 0n;
    const [score] = entryData as [bigint, bigint, bigint, bigint, boolean];
    return score;
  }, [entryData]);

  // ============================================
  // REFETCH ALL DATA
  // ============================================

  const refetchAll = useCallback(() => {
    refetchPeriod();
    refetchWallets();
    refetchClaimable();
    refetchEntry();
    refetchBalances();
  }, [refetchPeriod, refetchWallets, refetchClaimable, refetchEntry, refetchBalances]);

  // Auto refetch on success
  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => refetchAll(), 2000); // Wait for blockchain state update
    }
  }, [isSuccess, refetchAll]);

  return {
    // Contract data
    currentPeriod: currentPeriod || 0n,
    periodInfo: getPeriodInfoParsed(),
    balances: formatBalances(),
    approvedWallets: (approvedWallets as Address[]) || [],
    isWalletApproved: isWalletApproved || false,
    claimableTRIA: claimableRewards || 0n,
    claimableTRIAFormatted: claimableRewards ? formatEther(claimableRewards) : '0',
    entryData: entryData as [bigint, bigint, bigint, bigint, boolean] | undefined,
    userScore: getUserScore(),
    entryWeight: getEntryWeight(),
    miniGamePlays: miniGamePlays || 0n,
    luckyBurstChance: luckyBurstChance || 500n,
    
    // Write functions - Tournament
    enterTournament,
    addWallet,
    removeWallet,
    claimAllRewards,
    finalizePeriod,
    
    // Write functions - Mini Games
    playDice,
    playSpin,
    
    // Write functions - Owner
    withdrawBuyback,
    withdrawTreasury,
    injectTRIAToPrizePool,
    
    // Helper functions
    canEnterTournament: canEnterTournament(),
    hasClaimableRewards: hasClaimableRewards(),
    
    // State
    isLoading: isLoading || isPending || isConfirming,
    isSuccess,
    error,
    
    // Refetch
    refetchAll,
    
    // Transaction hash
    transactionHash: hash,
  };
}
