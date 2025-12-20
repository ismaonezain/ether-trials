'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAccount, useReadContracts } from 'wagmi';
import { useTRIAContractv21 } from '@/hooks/useTRIAContractv21';
import { ETHER_TRIALS_TRIA_V21_ABI, ETHER_TRIALS_TRIA_V21_ADDRESS } from '@/lib/contracts/etherTrialsTRIAv21ABI';
import { formatUnits } from 'viem';
import { Trophy, Coins, AlertCircle, CheckCircle2, Loader2, Gift } from 'lucide-react';
import type { Address } from 'viem';
import { ShareSuccessModal } from './ShareSuccessModal';
import { DeprecatedContractsClaimV20 } from './DeprecatedContractsClaimV20';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

interface PrizeClaimModalV21Props {
  isOpen: boolean;
  onClose: () => void;
}

interface PeriodPrizeInfo {
  period: number;
  prizeAmount: bigint;
  claimed: boolean;
  points: bigint;
  entryAmount: bigint;
}

export function PrizeClaimModalV21({ isOpen, onClose }: PrizeClaimModalV21Props) {
  const { address } = useAccount();
  const { 
    useCurrentPeriod,
    useGetUserPeriods,
    claimMultiple
  } = useTRIAContractv21();

  const { data: currentPeriod } = useCurrentPeriod();
  const { data: userPeriods } = useGetUserPeriods(address);

  const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'success' | 'error'>('idle');
  const [periodPrizes, setPeriodPrizes] = useState<PeriodPrizeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState<bigint>(BigInt(0));
  const [claimedPeriodsCount, setClaimedPeriodsCount] = useState<number>(0);
  const [showDeprecated, setShowDeprecated] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const periodsArray = userPeriods && Array.isArray(userPeriods) ? Array.from(userPeriods as bigint[]) : [];

  // Create contract calls for all user periods
  const contracts = periodsArray.map((period) => ({
    address: ETHER_TRIALS_TRIA_V21_ADDRESS as Address,
    abi: ETHER_TRIALS_TRIA_V21_ABI,
    functionName: 'getPlayerInfo',
    args: [address as Address, period],
  }));

  // Fetch all period data in parallel
  const { data: periodDataArray, isLoading: isLoadingPeriods } = useReadContracts({
    contracts,
    query: {
      enabled: !!address && periodsArray.length > 0,
    },
  });

  // Process period data
  useEffect(() => {
    // CRITICAL: Use userPeriods directly to avoid infinite loop from periodsArray
    const currentPeriodsArray = userPeriods && Array.isArray(userPeriods) ? Array.from(userPeriods as bigint[]) : [];
    
    if (!periodDataArray || currentPeriodsArray.length === 0) {
      setLoading(false);
      setPeriodPrizes([]);
      return;
    }

    try {
      const prizes: PeriodPrizeInfo[] = periodDataArray.map((result, index) => {
        const period = Number(currentPeriodsArray[index]);
        
        if (result.status === 'success' && result.result) {
          // V21 returns: [hasEntered, points, entryAmount, pendingPrizeTRIA, claimed]
          const [hasEntered, points, entryAmount, pendingPrizeTRIA, claimed] = result.result as [
            boolean,
            bigint,
            bigint,
            bigint,
            boolean
          ];

          return {
            period,
            prizeAmount: pendingPrizeTRIA,
            claimed,
            points,
            entryAmount,
          };
        }

        // Fallback if read failed
        return {
          period,
          prizeAmount: BigInt(0),
          claimed: false,
          points: BigInt(0),
          entryAmount: BigInt(0),
        };
      });

      setPeriodPrizes(prizes);
    } catch (err) {
      console.error('Error processing period data:', err);
    } finally {
      setLoading(false);
    }
  }, [periodDataArray, userPeriods]);

  // Watch for transaction confirmation
  useEffect(() => {
    if (isConfirmed && claimStatus === 'claiming') {
      setClaimStatus('success');
      
      // Calculate total claimed amount for share modal
      const totalClaimedNow = periodPrizes
        .filter(p => !p.claimed && p.prizeAmount > BigInt(0) && p.period !== Number(currentPeriod))
        .reduce((sum, p) => sum + p.prizeAmount, BigInt(0));
      
      const claimedCount = periodPrizes
        .filter(p => !p.claimed && p.prizeAmount > BigInt(0) && p.period !== Number(currentPeriod))
        .length;
      
      setClaimedAmount(totalClaimedNow);
      setClaimedPeriodsCount(claimedCount);
      
      // Show success status briefly, then show share modal
      setTimeout(() => {
        setClaimStatus('idle');
        setShowShareModal(true);
      }, 2000);
    }
  }, [isConfirmed, claimStatus, periodPrizes, currentPeriod]);

  // Handle claim all - ONLY claim finalized/past periods (exclude current period)
  const handleClaimAll = async () => {
    try {
      setClaimStatus('claiming');
      
      // CRITICAL: Filter only periods that:
      // 1. Have unclaimed prizes
      // 2. Prize amount > 0
      // 3. NOT the current period (must be past/finalized)
      const currentPeriodNum = currentPeriod ? Number(currentPeriod) : 0;
      const periodsToClaimNumbers = periodPrizes
        .filter(p => !p.claimed && p.prizeAmount > BigInt(0) && p.period < currentPeriodNum)
        .map(p => BigInt(p.period));
      
      if (periodsToClaimNumbers.length === 0) {
        console.log('⚠️ No claimable periods found (only finalized/past periods can be claimed)');
        setClaimStatus('idle');
        return;
      }
      
      console.log('✅ Claiming FINALIZED periods (V21):', periodsToClaimNumbers.map(p => p.toString()));
      console.log('⏭️ Current period (excluded):', currentPeriodNum);
      
      const hash = await writeContractAsync({
        address: ETHER_TRIALS_TRIA_V21_ADDRESS,
        abi: ETHER_TRIALS_TRIA_V21_ABI,
        functionName: 'claimMultiple',
        args: [periodsToClaimNumbers],
      });
      
      setTxHash(hash);
    } catch (err) {
      console.error('Claim all failed:', err);
      setClaimStatus('error');
      setTimeout(() => setClaimStatus('idle'), 3000);
    }
  };

  const currentPeriodNum = currentPeriod ? Number(currentPeriod) : 0;
  
  // ONLY count finalized/past periods (period < currentPeriod)
  const totalUnclaimed = periodPrizes
    .filter(p => !p.claimed && p.prizeAmount > BigInt(0) && p.period < currentPeriodNum)
    .reduce((sum, p) => sum + p.prizeAmount, BigInt(0));

  const unclaimedCount = periodPrizes.filter(p => !p.claimed && p.prizeAmount > BigInt(0) && p.period < currentPeriodNum).length;

  const totalClaimed = periodPrizes
    .filter(p => p.claimed)
    .reduce((sum, p) => sum + p.prizeAmount, BigInt(0));

  const claimedCount = periodPrizes.filter(p => p.claimed).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-gradient-to-br from-purple-900 to-indigo-900 border-2 border-purple-500">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-yellow-400">
            <Trophy className="w-5 h-5" />
            Claim TRIA Rewards
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* Status Bar */}
          {(isPending || isConfirming || claimStatus !== 'idle') && (
            <Card className="border-yellow-500/50 bg-yellow-900/20">
              <CardContent className="p-2">
                <div className="flex items-center gap-3">
                  {claimStatus === 'claiming' || isPending || isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                      <div className="flex-1">
                        <p className="text-yellow-400 font-semibold text-xs">
                          {isConfirming ? 'Confirming...' : 'Processing...'}
                        </p>
                      </div>
                    </>
                  ) : claimStatus === 'success' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <p className="text-green-400 font-semibold text-xs">Claimed successfully! 🎉</p>
                    </>
                  ) : claimStatus === 'error' ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <p className="text-red-400 font-semibold text-xs">Claim failed</p>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Card */}
          {!loading && periodsArray.length > 0 && (
            <Card className="border-yellow-500/50 bg-gradient-to-br from-yellow-900/30 to-orange-900/30">
              <CardContent className="p-3">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <Gift className="w-4 h-4 text-green-400 mx-auto mb-0.5" />
                    <p className="text-lg font-bold text-green-400">{unclaimedCount}</p>
                    <p className="text-[10px] text-gray-300">Unclaimed</p>
                  </div>
                  <div className="text-center">
                    <Coins className="w-4 h-4 text-yellow-400 mx-auto mb-0.5" />
                    <p className="text-lg font-bold text-yellow-400">
                      {Number(formatUnits(totalUnclaimed, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-[10px] text-gray-300">Claimable TRIA</p>
                  </div>
                  <div className="text-center">
                    <CheckCircle2 className="w-4 h-4 text-gray-400 mx-auto mb-0.5" />
                    <p className="text-lg font-bold text-gray-400">{claimedCount}</p>
                    <p className="text-[10px] text-gray-300">Claimed</p>
                  </div>
                </div>

                {unclaimedCount > 0 ? (
                  <Button
                    onClick={handleClaimAll}
                    disabled={isPending || isConfirming || claimStatus === 'claiming'}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 font-bold text-sm py-4"
                  >
                    {isPending || isConfirming || claimStatus === 'claiming' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Trophy className="w-4 h-4 mr-2" />
                        Claim All - {Number(formatUnits(totalUnclaimed, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })} TRIA
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-gray-400 text-sm">✅ All rewards claimed!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Period List */}
          {loading || isLoadingPeriods ? (
            <div className="text-center py-4">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin mx-auto mb-1" />
              <p className="text-purple-300 text-xs">Loading...</p>
            </div>
          ) : periodsArray.length === 0 ? (
            <Card className="border-gray-600/50 bg-gray-900/30">
              <CardContent className="p-4 text-center">
                <Trophy className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No participation history</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {periodPrizes.length === 0 ? (
                <Card className="border-gray-600/50 bg-gray-900/30">
                  <CardContent className="p-3 text-center">
                    <p className="text-gray-400 text-xs">Loading...</p>
                  </CardContent>
                </Card>
              ) : (
                periodPrizes.map((prize) => (
                  <Card 
                    key={prize.period}
                    className={
                      prize.claimed 
                        ? 'border border-gray-600/50 bg-gray-900/30'
                        : prize.prizeAmount > BigInt(0)
                        ? 'border border-green-500/50 bg-green-900/20'
                        : 'border border-gray-600/50 bg-gray-900/30'
                    }
                  >
                    <CardContent className="p-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Period {prize.period}
                            </Badge>
                            {prize.claimed && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-700 text-green-100">
                                ✅
                              </Badge>
                            )}
                            {!prize.claimed && prize.prizeAmount > BigInt(0) && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-yellow-700 text-yellow-100">
                                💰
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            <div>
                              <span className="text-gray-500">Points:</span>
                              <span className="text-gray-300 ml-1 font-bold">
                                {Number(prize.points).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Prize:</span>
                              <span className={prize.prizeAmount > BigInt(0) ? 'ml-1 font-bold text-yellow-400' : 'ml-1 font-bold text-gray-500'}>
                                {prize.prizeAmount > BigInt(0) ? Number(formatUnits(prize.prizeAmount, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'} TRIA
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Deprecated Contracts Link */}
          <Button
            variant="outline"
            size="sm"
            className="w-full border-orange-600/50 text-orange-300 hover:bg-orange-900/30 text-xs"
            onClick={() => setShowDeprecated(!showDeprecated)}
          >
            {showDeprecated ? '← Back to Current Contract' : '⚠️ View Deprecated Contract (ETH Rewards)'}
          </Button>

          {/* Deprecated Contract Section */}
          {showDeprecated && (
            <div className="pt-2 border-t border-orange-600/30">
              <DeprecatedContractsClaimV20 onClose={() => setShowDeprecated(false)} />
            </div>
          )}

          {/* Contract Info - Hidden from UI */}
        </div>
      </DialogContent>

      {/* Share Success Modal - after claim */}
      <ShareSuccessModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        totalClaimed={claimedAmount}
        periodsCount={claimedPeriodsCount}
      />
    </Dialog>
  );
}
