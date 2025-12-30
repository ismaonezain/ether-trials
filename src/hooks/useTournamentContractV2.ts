
// anjing
'use client';

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useEstimateGas, useGasPrice } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { TOURNAMENT_ABI_V2 } from '@/lib/contracts/tournamentABIv2';
import { TOURNAMENT_CONTRACT_ADDRESS } from '@/lib/game/constants';
import type { Address } from 'viem';

export function useTournamentContractV2() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  
  // Gas price tracking
  const { data: gasPrice } = useGasPrice();

  // Read Functions - Use getCurrentPeriodInfo from contract
  const { data: periodInfo, refetch: refetchPeriodInfo } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: TOURNAMENT_ABI_V2,
    functionName: 'getCurrentPeriodInfo',
  });

  const { data: platformBalanceRaw } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: TOURNAMENT_ABI_V2,
    functionName: 'getPlatformBalance',
  });

  const { data: currentPeriod } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: TOURNAMENT_ABI_V2,
    functionName: 'currentPeriod',
  });

  const { data: entryFee } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: TOURNAMENT_ABI_V2,
    functionName: 'ENTRY_FEE',
  });

  // Check if address is owner
  const { data: contractOwner } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: TOURNAMENT_ABI_V2,
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

  // Check if can allocate prizes - using timeUntilAllocation
  const { data: canAllocateData } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: TOURNAMENT_ABI_V2,
    functionName: 'canAllocate',
  });

  const canAllocateFn = () => {
    if (canAllocateData === undefined) return false;
    return canAllocateData as boolean;
  };

  // Gas estimation for payEntryFee
  const { data: payEntryGasEstimate } = useEstimateGas({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: TOURNAMENT_ABI_V2,
    functionName: 'payEntryFee',
    value: entryFee as bigint,
    query: {
      enabled: Boolean(entryFee),
    },
  });

  // Write Functions
  const payEntryFee = async () => {
    if (!entryFee) throw new Error('Entry fee not loaded');
    
    return writeContract({
      address: TOURNAMENT_CONTRACT_ADDRESS as Address,
      abi: TOURNAMENT_ABI_V2,
      functionName: 'payEntryFee',
      value: entryFee as bigint,
      gas: payEntryGasEstimate ? payEntryGasEstimate + (payEntryGasEstimate / BigInt(10)) : undefined, // Add 10% buffer
    });
  };

  const claimPrize = async (period: bigint) => {
    return writeContract({
      address: TOURNAMENT_CONTRACT_ADDRESS as Address,
      abi: TOURNAMENT_ABI_V2,
      functionName: 'claimPrize',
      args: [period],
      gas: BigInt(150000), // Reasonable default for claim transactions
    });
  };

  // Admin Functions
  const allocatePrizes = async (
    topPlayers: string[]
  ): Promise<{ success: boolean; error?: string; period?: number; hash?: string }> => {
    try {
      // Initiate the transaction
      const txHash = await new Promise<string>((resolve, reject) => {
        writeContract(
          {
            address: TOURNAMENT_CONTRACT_ADDRESS as Address,
            abi: TOURNAMENT_ABI_V2,
            functionName: 'allocatePrizes',
            args: [topPlayers],
          },
          {
            onSuccess: (hash) => resolve(hash),
            onError: (error) => reject(error),
          }
        );
      });

      // Return success with current period
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
      
      // Initiate the transaction
      const txHash = await new Promise<string>((resolve, reject) => {
        writeContract(
          {
            address: TOURNAMENT_CONTRACT_ADDRESS as Address,
            abi: TOURNAMENT_ABI_V2,
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

  // Helper function to format pool info from getCurrentPeriodInfo
  const formatPrizePoolInfo = () => {
    if (!periodInfo) return null;

    // getCurrentPeriodInfo returns: (period, prizePool, participants, startTime, endTime, allocated)
    const [period, prizePool, participants, startTime, endTime, allocated] = periodInfo as [
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
      participants: Number(participants),
      platformBalance: formatEther(platformBalanceRaw || BigInt(0)),
      platformBalanceRaw: platformBalanceRaw || BigInt(0),
      lastDistribution: new Date(Number(startTime) * 1000),
      nextDistribution: new Date(Number(endTime) * 1000),
      period: Number(period),
      canDistribute: canAllocateData as boolean || false,
      timeUntilDistribution: Math.max(0, Number(endTime) - Math.floor(Date.now() / 1000)),
      startTime: new Date(Number(startTime) * 1000),
      endTime: new Date(Number(endTime) * 1000),
      allocated: allocated,
    };
  };

  // Calculate expected pool in 24h
  const calculateExpectedPool = (currentParticipants: number) => {
    if (!entryFee) return '0';
    
    // Each entry contributes 50% to prize pool (0.00001 ETH)
    const contribution = Number(entryFee) / 1e18 * 0.5;
    
    // Assume same rate continues for 24h
    const expectedTotal = currentParticipants * contribution * 2; // Double current for 24h projection
    
    return expectedTotal.toFixed(5);
  };

  // Calculate total gas cost for payEntryFee transaction
  const calculateGasCost = (): { gasCostEth: string; gasCostUsd: string; totalCostEth: string; totalCostUsd: string } => {
    if (!payEntryGasEstimate || !gasPrice || !entryFee) {
      return { gasCostEth: '0.000001', gasCostUsd: '0.0035', totalCostEth: '0.00002', totalCostUsd: '0.07' };
    }

    // Add 10% buffer to gas estimate
    const gasWithBuffer = payEntryGasEstimate + (payEntryGasEstimate / BigInt(10));
    const gasCost = gasWithBuffer * gasPrice;
    const gasCostEth = formatEther(gasCost);
    const gasCostUsd = (parseFloat(gasCostEth) * 3500).toFixed(4); // ETH price ~$3500

    const entryFeeEth = formatEther(entryFee as bigint);
    const totalCost = gasCost + (entryFee as bigint);
    const totalCostEth = formatEther(totalCost);
    const totalCostUsd = (parseFloat(totalCostEth) * 3500).toFixed(4);

    return { gasCostEth, gasCostUsd, totalCostEth, totalCostUsd };
  };

  // Helper function to get pending prize for a player in a specific period
  const getPendingPrize = (playerAddress: Address, period: bigint): bigint => {
    // This will be queried via useReadContract in the component that needs it
    // We return 0 as default here, actual value should be queried separately
    return BigInt(0);
  };

  // Helper function to check if player can claim for a specific period
  const canClaim = (playerAddress: Address, period: bigint): boolean => {
    // This will be queried via useReadContract in the component that needs it
    // We return false as default here, actual value should be queried separately
    return false;
  };

  return {
    // Read data
    prizePoolInfo: formatPrizePoolInfo(),
    currentPeriod,
    entryFee,
    contractOwner,
    gasPrice,
    
    // Read functions
    checkIsOwner,
    getPlatformBalance,
    canAllocate: canAllocateFn,
    getPendingPrize,
    canClaim,
    
    // Write functions
    payEntryFee,
    claimPrize,
    
    // Admin functions
    allocatePrizes,
    withdrawPlatformFees,
    
    // Helpers
    calculateExpectedPool,
    calculateGasCost,
    refetchPrizePoolInfo: refetchPeriodInfo,
    
    // Transaction state
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}
