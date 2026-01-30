kono
  'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { usePointBasedContract } from '@/hooks/usePointBasedContract';
import { useClaimablePeriods } from '@/hooks/useClaimablePeriods';
import { Trophy, Sparkles, X, Loader2, ChevronLeft, ChevronRight, Gift, Zap } from 'lucide-react';
import { formatEther } from 'viem';
import { TOURNAMENT_CONTRACT_ADDRESS } from '@/lib/game/constants';
import { ETHER_TRIALS_POINT_BASED_ABI } from '@/lib/contracts/etherTrialsPointBasedABI';
import type { Address } from 'viem';
import { Button } from '@/components/ui/button';

interface PrizeClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  period?: bigint;
}

export function PrizeClaimModal({ isOpen, onClose, period: initialPeriod }: PrizeClaimModalProps) {
  const { address } = useAccount();
  const { claimPrize, claimAllPrizes, isPending, isConfirming, isConfirmed, currentPeriod } = usePointBasedContract();
  const { claimablePeriods, totalClaimableAmount, isLoading: isLoadingPeriods } = useClaimablePeriods();
  
  // Default to current period if no initial period provided
  const [selectedPeriod, setSelectedPeriod] = useState<bigint>(
    initialPeriod || currentPeriod || BigInt(1)
  );
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Update selected period when current period loads
  useEffect(() => {
    if (!initialPeriod && currentPeriod && selectedPeriod === BigInt(1)) {
      setSelectedPeriod(currentPeriod);
    }
  }, [currentPeriod, initialPeriod, selectedPeriod]);

  // Query pending prize for selected period
  const { data: pendingPrize, refetch: refetchPrize } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: ETHER_TRIALS_POINT_BASED_ABI,
    functionName: 'getPendingPrize',
    args: address && selectedPeriod ? [address as Address, selectedPeriod] : undefined,
  });

  // Update selected period when initial period changes
  useEffect(() => {
    if (initialPeriod) {
      setSelectedPeriod(initialPeriod);
    }
  }, [initialPeriod]);

  useEffect(() => {
    if (isConfirmed) {
      refetchPrize();
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  }, [isConfirmed, onClose, refetchPrize]);

  if (!isOpen) return null;

  const handleClaim = async () => {
    if (!selectedPeriod) return;
    
    try {
      setError('');
      setSuccessMessage('');
      await claimPrize(selectedPeriod);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim prize');
    }
  };

  const handleClaimAll = async () => {
    if (!address) return;
    
    try {
      setError('');
      setSuccessMessage('');
      
      // Filter periods that have rewards > 0 ETH
      if (isLoadingPeriods) {
        setSuccessMessage('Loading claimable periods...');
        return;
      }
      
      if (claimablePeriods.length === 0) {
        setSuccessMessage('No unclaimed prizes found in any period.');
        return;
      }
      
      // Extract period numbers from claimable periods
      const periodsWithRewards = claimablePeriods.map(p => p.period);
      
      setSuccessMessage(`Found ${periodsWithRewards.length} period(s) with rewards. Claiming...`);
      
      // Call batch claim - only for periods with actual prizes
      const result = await claimAllPrizes(periodsWithRewards);
      
      if (result.claimed > 0) {
        setSuccessMessage(`✓ Successfully claimed prizes from ${result.claimed} period(s)!`);
        setTimeout(() => {
          onClose();
        }, 3000);
      } else if (result.failed > 0) {
        setError(`Failed to claim prizes. ${result.errors.join(', ')}`);
      } else {
        setSuccessMessage('No prizes were claimed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim all prizes');
    }
  };

  const handlePreviousPeriod = () => {
    if (selectedPeriod > BigInt(1)) {
      setSelectedPeriod(selectedPeriod - BigInt(1));
    }
  };

  const handleNextPeriod = () => {
    if (currentPeriod && selectedPeriod < currentPeriod) {
      setSelectedPeriod(selectedPeriod + BigInt(1));
    }
  };

  const prizeAmount = pendingPrize ? formatEther(pendingPrize) : '0';
  const prizeUSD = (parseFloat(prizeAmount) * 3500).toFixed(2);

  // Calculate batch claim stats
  const totalRewardETH = totalClaimableAmount ? parseFloat(formatEther(totalClaimableAmount)) : 0;
  const totalRewardUSD = totalRewardETH * 3500;
  
  // Estimate gas: ~50k gas per claim + 21k base
  const estimatedGasPerClaim = 50000;
  const baseGas = 21000;
  const totalGasEstimate = (claimablePeriods.length * estimatedGasPerClaim) + baseGas;
  
  // Assume 0.5 gwei gas price (Base is cheap!)
  const gasPriceGwei = 0.5;
  const gasEstimateETH = (totalGasEstimate * gasPriceGwei) / 1e9;
  const gasEstimateUSD = gasEstimateETH * 3500;
  
  // Net profit
  const netProfitETH = totalRewardETH - gasEstimateETH;
  const netProfitUSD = netProfitETH * 3500;
  
  const isWorthClaiming = netProfitETH > 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl max-w-md w-full border-2 border-purple-500/50 shadow-2xl shadow-purple-500/30 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-gray-800/80 hover:bg-gray-700 rounded-full flex items-center justify-center z-10 transition-colors"
        >
          <X className="w-5 h-5 text-gray-300" />
        </button>

        <div className="relative p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Claim Your Prize!</h2>
            
            {/* Batch Claim Stats */}
            {currentPeriod && Number(currentPeriod) > 1 && !isLoadingPeriods && claimablePeriods.length > 0 && (
              <div className="mt-3 space-y-2">
                {/* Total Rewards & Gas Box */}
                <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/50 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {/* Total Rewards */}
                    <div className="bg-blue-900/30 rounded p-2">
                      <div className="text-blue-300 mb-1">Total Rewards</div>
                      <div className="text-white font-bold">{totalRewardETH.toFixed(6)} ETH</div>
                      <div className="text-gray-400">${totalRewardUSD.toFixed(2)}</div>
                    </div>
                    
                    {/* Gas Cost */}
                    <div className="bg-orange-900/30 rounded p-2">
                      <div className="text-orange-300 mb-1">Est. Gas Cost</div>
                      <div className="text-white font-bold">{gasEstimateETH.toFixed(6)} ETH</div>
                      <div className="text-gray-400">${gasEstimateUSD.toFixed(2)}</div>
                    </div>
                  </div>
                  
                  {/* Net Profit */}
                  <div className={`mt-2 p-2 rounded ${isWorthClaiming ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={isWorthClaiming ? 'text-green-300' : 'text-red-300'}>Net Profit:</span>
                      <div className="text-right">
                        <div className={`font-bold ${isWorthClaiming ? 'text-green-400' : 'text-red-400'}`}>
                          {netProfitETH.toFixed(6)} ETH
                        </div>
                        <div className="text-gray-400 text-[10px]">
                          ${netProfitUSD.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Claim All Hint */}
                <div className="p-2 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/50 rounded-lg">
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-300">
                      {isWorthClaiming 
                        ? `Claim ${claimablePeriods.length} period(s) at once!` 
                        : 'Gas cost exceeds rewards'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Loading periods message */}
            {currentPeriod && Number(currentPeriod) > 1 && isLoadingPeriods && (
              <div className="mt-3 p-2 bg-gradient-to-r from-gray-600/20 to-gray-700/20 border border-gray-500/50 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  <span className="text-xs text-gray-300">Checking claimable periods...</span>
                </div>
              </div>
            )}

            {/* Period Selector */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                size="sm"
                variant="ghost"
                onClick={handlePreviousPeriod}
                disabled={selectedPeriod <= BigInt(1)}
                className="text-gray-400 hover:text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="px-4 py-2 bg-gray-800 rounded-lg">
                <p className="text-gray-400 text-xs">Period</p>
                <p className="text-white font-bold text-lg">#{selectedPeriod?.toString()}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleNextPeriod}
                disabled={!currentPeriod || selectedPeriod >= currentPeriod}
                className="text-gray-400 hover:text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
            
            <p className="text-gray-500 text-xs mt-2">
              {selectedPeriod === currentPeriod ? 'Current Period' : 'Past Period'}
            </p>
          </div>

          {/* Prize Amount */}
          <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-lg p-6 mb-6 border-2 border-yellow-500/50 text-center">
            <div className="text-sm text-yellow-300 mb-2">Period #{selectedPeriod?.toString()} Prize</div>
            <div className="text-4xl font-bold text-yellow-400 mb-2">
              {pendingPrize ? formatEther(pendingPrize as bigint) : '0'} ETH
            </div>
            <div className="text-sm text-gray-300">
              ≈ ${pendingPrize ? (parseFloat(formatEther(pendingPrize as bigint)) * 3500).toFixed(2) : '0'} USD
            </div>
            {pendingPrize && BigInt(pendingPrize) > BigInt(0) && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
                <span className="text-xs text-yellow-300">Ready to claim!</span>
                <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {(isConfirmed || successMessage) && (
            <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3 mb-4">
              <p className="text-green-300 text-sm text-center">
                {successMessage || '✓ Prize claimed successfully!'}
              </p>
            </div>
          )}

          {/* Claim Buttons */}
          <div className="space-y-3">
            {/* Claim All Button - Show if multiple periods exist */}
            {currentPeriod && Number(currentPeriod) > 1 && (
              <button
                onClick={handleClaimAll}
                disabled={isPending || isConfirming || isConfirmed || isLoadingPeriods}
                className="w-full h-14 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold text-lg rounded-lg border-2 border-green-400 disabled:border-gray-600 shadow-lg shadow-green-500/30 transition-all flex items-center justify-center gap-2"
              >
                {isPending || isConfirming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : isLoadingPeriods ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Checking periods...</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-5 h-5" />
                    <span>
                      {claimablePeriods.length > 0 
                        ? `Claim ${claimablePeriods.length} Period(s) with Rewards`
                        : `Claim All Periods (1-${currentPeriod.toString()})`
                      }
                    </span>
                  </>
                )}
              </button>
            )}

            {/* Single Claim Button */}
            <button
              onClick={handleClaim}
              disabled={isPending || isConfirming || isConfirmed}
              className="w-full h-14 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold text-lg rounded-lg border-2 border-yellow-400 disabled:border-gray-600 shadow-lg shadow-yellow-500/30 transition-all flex items-center justify-center gap-2"
            >
              {isPending || isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{isPending ? 'Confirming...' : 'Processing...'}</span>
                </>
              ) : isConfirmed ? (
                <>
                  <Trophy className="w-5 h-5" />
                  <span>Claimed!</span>
                </>
              ) : (
                <>
                  <Trophy className="w-5 h-5" />
                  <span>Claim Period #{selectedPeriod?.toString()}</span>
                </>
              )}
            </button>
          </div>

          {/* Info Text */}
          <div className="mt-4 text-xs text-gray-400 text-center">
            {currentPeriod && Number(currentPeriod) > 1 
              ? `💡 Tip: Use "Claim All" to automatically claim prizes from all ${currentPeriod.toString()} periods at once!`
              : 'Prize will be transferred to your wallet once claimed'
            }
          </div>
        </div>
      </div>
    </div>
  );
}
