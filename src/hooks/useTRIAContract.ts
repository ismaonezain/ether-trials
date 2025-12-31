'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther, type Address } from 'viem';
import { base } from 'wagmi/chains';
import { ETHER_TRIALS_TRIA_ABI, CONTRACT_ADDRESSES } from '@/lib/contracts/etherTrialsTRIAABI';

export interface TRIAContractData {
  // Contract info
  currentPeriod: bigint;
  triaPool: bigint;
  ethPool: bigint;
  platformFee: bigint;
  
  // User specific
  approvedWallets: Address[];
  claimableTRIA: bigint;
  claimableETH: bigint;
  hasEntered: boolean;
  userScore: bigint;
  userRank: bigint;
}

export interface PeriodInfo {
  periodNumber: bigint;
  startTime: bigint;
  endTime: bigint;
  triaPool: bigint;
  ethPool: bigint;
  finalized: boolean;
  timeRemaining: number; // seconds
}

export function useTRIAContract(fid?: bigint) {
  const { address, chainId } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get contract address based on chain
  const contractAddress = chainId === base.id 
    ? CONTRACT_ADDRESSES.base.etherTrialsTRIA as Address
    : CONTRACT_ADDRESSES.baseGoerli.etherTrialsTRIA as Address;

  // ============================================
  // READ FUNCTIONS
  // ============================================

  // Get current period
  const { data: currentPeriod, refetch: refetchPeriod } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_ABI,
    functionName: 'getCurrentPeriod',
    chainId: base.id,
  });

  // Get period info
  const { data: periodData } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_ABI,
    functionName: 'periods',
    args: currentPeriod !== undefined ? [currentPeriod] : undefined,
    chainId: base.id,
  });

  // Get approved wallets for FID
  const { data: approvedWallets, refetch: refetchWallets } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_ABI,
    functionName: 'getApprovedWallets',
    args: fid !== undefined ? [fid] : undefined,
    chainId: base.id,
  });

  // Check if wallet is approved
  const { data: isWalletApproved } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_ABI,
    functionName: 'isWalletApproved',
    args: fid !== undefined && address ? [fid, address] : undefined,
    chainId: base.id,
  });

  // Get claimable rewards
  const { data: claimableRewards, refetch: refetchClaimable } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_ABI,
    functionName: 'getClaimableRewards',
    args: fid !== undefined ? [fid] : undefined,
    chainId: base.id,
  });

  // Get entry data
  const { data: entryData, refetch: refetchEntry } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_ABI,
    functionName: 'entries',
    args: currentPeriod !== undefined && fid !== undefined ? [currentPeriod, fid] : undefined,
    chainId: base.id,
  });

  // Get user rank
  const { data: userRank } = useReadContract({
    address: contractAddress,
    abi: ETHER_TRIALS_TRIA_ABI,
    functionName: 'getFIDRank',
    args: currentPeriod !== undefined && fid !== undefined ? [currentPeriod, fid] : undefined,
    chainId: base.id,
  });

  // ============================================
  // WRITE FUNCTIONS
  // ============================================

  const { writeContract, data: hash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

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
        abi: ETHER_TRIALS_TRIA_ABI,
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
        abi: ETHER_TRIALS_TRIA_ABI,
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
        abi: ETHER_TRIALS_TRIA_ABI,
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
        abi: ETHER_TRIALS_TRIA_ABI,
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

  // Claim period rewards
  const claimPeriodRewards = useCallback(async (period: bigint, fidParam: bigint) => {
    if (!address) {
      setError('Wallet not connected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_ABI,
        functionName: 'claimPeriodRewards',
        args: [period, fidParam],
        chainId: base.id,
      });
    } catch (err) {
      console.error('Error claiming period rewards:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim period rewards');
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
        abi: ETHER_TRIALS_TRIA_ABI,
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
  // HELPER FUNCTIONS
  // ============================================

  const getPeriodInfo = useCallback((): PeriodInfo | null => {
    if (!currentPeriod || !periodData) return null;

    const [startTime, endTime, triaPool, ethPool, finalized] = periodData as [bigint, bigint, bigint, bigint, boolean];
    const now = BigInt(Math.floor(Date.now() / 1000));
    const timeRemaining = Number(endTime - now);

    return {
      periodNumber: currentPeriod,
      startTime,
      endTime,
      triaPool,
      ethPool,
      finalized,
      timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
    };
  }, [currentPeriod, periodData]);

  const formatRewards = useCallback(() => {
    if (!claimableRewards) return { tria: '0', eth: '0' };

    const [triaAmount, ethAmount] = claimableRewards as [bigint, bigint];

    return {
      tria: formatEther(triaAmount),
      eth: formatEther(ethAmount),
    };
  }, [claimableRewards]);

  const canEnterTournament = useCallback(() => {
    if (!address || !fid) return false;
    if (!entryData) return true; // No entry yet
    
    const [, , , exists] = entryData as [bigint, bigint, bigint, boolean];
    return !exists;
  }, [address, fid, entryData]);

  const hasClaimableRewards = useCallback(() => {
    if (!claimableRewards) return false;
    
    const [triaAmount, ethAmount] = claimableRewards as [bigint, bigint];
    return triaAmount > 0n || ethAmount > 0n;
  }, [claimableRewards]);

  // ============================================
  // REFETCH ALL DATA
  // ============================================

  const refetchAll = useCallback(() => {
    refetchPeriod();
    refetchWallets();
    refetchClaimable();
    refetchEntry();
  }, [refetchPeriod, refetchWallets, refetchClaimable, refetchEntry]);

  // Auto refetch on success
  useEffect(() => {
    if (isSuccess) {
      refetchAll();
    }
  }, [isSuccess, refetchAll]);

  return {
    // Contract data
    currentPeriod: currentPeriod || 0n,
    periodInfo: getPeriodInfo(),
    approvedWallets: (approvedWallets as Address[]) || [],
    isWalletApproved: isWalletApproved || false,
    claimableRewards: formatRewards(),
    userRank: userRank || 0n,
    entryData: entryData as [bigint, bigint, bigint, boolean] | undefined,
    
    // Write functions
    enterTournament,
    addWallet,
    removeWallet,
    claimAllRewards,
    claimPeriodRewards,
    finalizePeriod,
    
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
