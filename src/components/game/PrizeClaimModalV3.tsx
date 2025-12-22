'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEtherTrialsV3 } from '@/hooks/useEtherTrialsV3';
import { Trophy, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatUnits } from 'viem';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { ETHER_TRIALS_V3_ADDRESS, ETHER_TRIALS_V3_ABI } from '@/lib/contracts/etherTrialsPointBasedV3ABI';
import { BASE_RPC_URL } from '@/lib/rpcConfig';

interface Period {
  period: number;
  prizeAmount: bigint;
  claimed: boolean;
  hasEntered: boolean;
}

interface PrizeClaimModalV3Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PrizeClaimModalV3({ isOpen, onClose }: PrizeClaimModalV3Props): JSX.Element | null {
  const { address } = useAccount();
  const { claimPrize, isPending, isConfirming, isSuccess, error } = useEtherTrialsV3();
  const [claimablePeriods, setClaimablePeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch claimable periods
  useEffect(() => {
    const fetchClaimablePeriods = async (): Promise<void> => {
      if (!address || !isOpen) return;

      setLoading(true);
      try {
        const client = createPublicClient({
          chain: base,
          transport: http(BASE_RPC_URL),
        });

        // Get current period
        const currentPeriod = await client.readContract({
          address: ETHER_TRIALS_V3_ADDRESS,
          abi: ETHER_TRIALS_V3_ABI,
          functionName: 'currentPeriod',
        });

        const periods: Period[] = [];

        // Check last 10 periods
        const startPeriod = Math.max(1, Number(currentPeriod) - 10);
        for (let i = startPeriod; i <= Number(currentPeriod); i++) {
          try {
            // Get player info for this period
            const playerInfo = await client.readContract({
              address: ETHER_TRIALS_V3_ADDRESS,
              abi: ETHER_TRIALS_V3_ABI,
              functionName: 'getPlayerInfo',
              args: [address, BigInt(i)],
            });

            const hasEntered = playerInfo[0];
            const pendingPrize = playerInfo[2];
            const claimed = playerInfo[3];

            if (hasEntered && pendingPrize > 0n) {
              periods.push({
                period: i,
                prizeAmount: pendingPrize,
                claimed,
                hasEntered,
              });
            }
          } catch (err) {
            console.error(`Failed to fetch period ${i}:`, err);
          }
        }

        setClaimablePeriods(periods.reverse()); // Most recent first
      } catch (err) {
        console.error('Failed to fetch claimable periods:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchClaimablePeriods();
  }, [address, isOpen]);

  const handleClaim = (period: number): void => {
    claimPrize(period);
  };

  if (!isOpen) return null;

  const unclaimedPeriods = claimablePeriods.filter((p) => !p.claimed);
  const totalUnclaimed = unclaimedPeriods.reduce((sum, p) => sum + p.prizeAmount, 0n);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <Card className="max-w-2xl w-full bg-gradient-to-br from-purple-900 to-indigo-900 border-2 border-yellow-500 shadow-2xl max-h-[90vh] overflow-hidden">
        <CardHeader className="border-b border-yellow-500/30 sticky top-0 bg-purple-900/90 backdrop-blur-sm z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-yellow-300 flex items-center gap-2">
              <Trophy className="w-6 h-6" />
              Claim Your TRIA Rewards (V3)
            </CardTitle>
            <button
              onClick={onClose}
              className="text-purple-300 hover:text-white transition-colors text-2xl"
            >
              ✕
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Status Messages */}
          {error && (
            <Alert className="bg-red-900/50 border-red-500">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-200">
                {error.message || 'Transaction failed. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          {isSuccess && (
            <Alert className="bg-green-900/50 border-green-500">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-200">
                Prize claimed successfully!
              </AlertDescription>
            </Alert>
          )}

          {/* Total Unclaimed */}
          {!loading && unclaimedPeriods.length > 0 && (
            <div className="bg-gradient-to-r from-yellow-900/50 to-orange-900/50 p-4 rounded-xl border-2 border-yellow-500/50">
              <div className="text-sm text-yellow-300 mb-1">Total Unclaimed Rewards</div>
              <div className="text-3xl font-bold text-yellow-300">
                {Number(formatUnits(totalUnclaimed, 18)).toFixed(4)} TRIA
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <span className="ml-3 text-purple-300">Loading claimable periods...</span>
            </div>
          )}

          {/* No Rewards */}
          {!loading && claimablePeriods.length === 0 && (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <div className="text-xl text-gray-400 mb-2">No rewards available</div>
              <div className="text-sm text-gray-500">
                Play tournaments to earn TRIA rewards!
              </div>
            </div>
          )}

          {/* Claimable Periods List */}
          {!loading && unclaimedPeriods.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-purple-300 font-semibold">
                Unclaimed Rewards ({unclaimedPeriods.length})
              </div>
              {unclaimedPeriods.map((period) => (
                <div
                  key={period.period}
                  className="bg-black/30 rounded-xl p-4 border border-purple-500/30"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm text-gray-400">Period #{period.period}</div>
                      <div className="text-xl font-bold text-yellow-300">
                        {Number(formatUnits(period.prizeAmount, 18)).toFixed(4)} TRIA
                      </div>
                    </div>
                    <Button
                      onClick={() => handleClaim(period.period)}
                      disabled={isPending || isConfirming}
                      className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500"
                    >
                      {isPending || isConfirming ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Claiming...
                        </>
                      ) : (
                        <>
                          <Trophy className="w-4 h-4 mr-2" />
                          Claim
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Already Claimed */}
          {!loading && claimablePeriods.filter((p) => p.claimed).length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-green-300 font-semibold">
                Already Claimed ({claimablePeriods.filter((p) => p.claimed).length})
              </div>
              {claimablePeriods
                .filter((p) => p.claimed)
                .map((period) => (
                  <div
                    key={period.period}
                    className="bg-green-900/20 rounded-xl p-4 border border-green-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-400">Period #{period.period}</div>
                        <div className="text-lg font-semibold text-green-300">
                          {Number(formatUnits(period.prizeAmount, 18)).toFixed(4)} TRIA
                        </div>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Close Button */}
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-purple-500 text-purple-300 hover:bg-purple-900/50"
          >
            Close
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
