'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins, X, TrendingUp, DollarSign, Calendar, Users, History } from 'lucide-react';
import { useReadContract } from 'wagmi';
import { ETHER_TRIALS_POINT_BASED_ABI } from '@/lib/contracts/etherTrialsPointBasedABI';
import { TOURNAMENT_CONTRACT_ADDRESS } from '@/lib/game/constants';
import type { Address } from 'viem';
import { formatEther } from 'viem';
import { useSpacetimeDB } from '@/hooks/useSpacetimeDB';

interface PrizeDistributionProps {
  onClose: () => void;
}

export function PrizeDistribution({ onClose }: PrizeDistributionProps): JSX.Element {
  // Get period revenue summary from SpacetimeDB
  const { periodRevenueSummary } = useSpacetimeDB();

  // Get current period info
  const { data: periodInfo, isLoading: periodInfoLoading } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: ETHER_TRIALS_POINT_BASED_ABI,
    functionName: 'getCurrentPeriodInfo',
  });

  // Get platform balance
  const { data: platformBalanceRaw, isLoading: platformBalanceLoading } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: ETHER_TRIALS_POINT_BASED_ABI,
    functionName: 'getPlatformBalance',
  });

  // Get entry fee constant
  const { data: entryFee } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: ETHER_TRIALS_POINT_BASED_ABI,
    functionName: 'ENTRY_FEE',
  });

  const isLoading = periodInfoLoading || platformBalanceLoading;

  // Parse period info
  let currentPeriod = 0;
  let prizePool = BigInt(0);
  let totalPoints = BigInt(0);
  let participants = BigInt(0);
  let startTime = BigInt(0);
  let endTime = BigInt(0);
  let distributed = false;

  if (periodInfo && Array.isArray(periodInfo) && periodInfo.length >= 7) {
    [
      currentPeriod,
      prizePool,
      totalPoints,
      participants,
      startTime,
      endTime,
      distributed,
    ] = periodInfo as [bigint, bigint, bigint, bigint, bigint, bigint, boolean];
    currentPeriod = Number(currentPeriod);
  }

  // Calculate platform fee for current period
  const totalRevenue = participants * (entryFee || BigInt(0));
  const platformFee = totalRevenue - prizePool;

  const currentPlatformBalance = platformBalanceRaw || BigInt(0);

  // Calculate percentages
  const prizePercentage = totalRevenue > 0 ? (Number(prizePool) / Number(totalRevenue)) * 100 : 90;
  const platformPercentage = totalRevenue > 0 ? (Number(platformFee) / Number(totalRevenue)) * 100 : 10;

  // Format dates - timestamps already in seconds, need to convert to milliseconds
  const startDate = startTime > 0 ? new Date(Number(startTime) * 1000) : null;
  const endDate = endTime > 0 ? new Date(Number(endTime) * 1000) : null;

  // Calculate all-time stats from SpacetimeDB
  const allTimePrizePool = periodRevenueSummary.reduce((sum: number, period) => {
    return sum + period.totalPrizePoolDistributed;
  }, 0);

  // Platform fees = participants * 0.00001 ETH (50% of 0.00002 ETH entry fee)
  const allTimePlatformFees = periodRevenueSummary.reduce((sum: number, period) => {
    return sum + (period.participantsCount * 0.00001);
  }, 0);

  const allTimeRevenue = allTimePrizePool + allTimePlatformFees;
  const allTimeParticipants = periodRevenueSummary.reduce((sum: number, period) => {
    return sum + period.participantsCount;
  }, 0);
  const totalCompletedPeriods = periodRevenueSummary.length;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
      <Card className="max-w-4xl w-full bg-gray-900 border-gray-700 max-h-[90vh] flex flex-col">
        <CardHeader className="pb-3 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-6 h-6 text-yellow-400" />
              <CardTitle className="text-2xl text-white">Prize & Platform Revenue</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5 text-gray-400" />
            </Button>
          </div>

          <div className="text-sm text-gray-400 mt-2">
            📊 Real-time data from Base network smart contract
          </div>
        </CardHeader>

        <CardContent className="pt-4 overflow-auto flex-1">
          {isLoading ? (
            <div className="text-center text-gray-400 py-8">
              <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-yellow-400 rounded-full mx-auto mb-3"></div>
              <p>Loading data from smart contract...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* All-Time Stats Section */}
              {totalCompletedPeriods > 0 && (
                <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/30 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <History className="w-5 h-5 text-purple-400" />
                    <div className="text-purple-400 text-sm font-semibold">
                      All-Time Stats ({totalCompletedPeriods} Completed Periods)
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-black/30 rounded p-3">
                      <div className="text-yellow-400 text-xs mb-1">Total Prize Pool</div>
                      <div className="text-white font-bold text-lg">{allTimePrizePool.toFixed(6)} ETH</div>
                    </div>
                    <div className="bg-black/30 rounded p-3">
                      <div className="text-green-400 text-xs mb-1">Total Platform Fees</div>
                      <div className="text-white font-bold text-lg">{allTimePlatformFees.toFixed(6)} ETH</div>
                    </div>
                    <div className="bg-black/30 rounded p-3">
                      <div className="text-purple-400 text-xs mb-1">Total Revenue</div>
                      <div className="text-white font-bold text-lg">{allTimeRevenue.toFixed(6)} ETH</div>
                    </div>
                    <div className="bg-black/30 rounded p-3">
                      <div className="text-blue-400 text-xs mb-1">Total Participants</div>
                      <div className="text-white font-bold text-lg">{allTimeParticipants}</div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-400 mt-2">
                    📊 Aggregated from all completed distribution periods
                  </div>
                </div>
              )}

              {/* Current Platform Balance */}
              <div className="bg-gradient-to-r from-green-900/40 to-blue-900/40 border border-green-500/30 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-green-400 text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Total Platform Balance (Unclaimed)
                  </div>
                </div>
                <div className="text-white font-bold text-3xl mb-2">
                  {formatEther(currentPlatformBalance)} ETH
                </div>
                <div className="text-gray-400 text-xs">
                  💡 Available for withdrawal by contract owner
                </div>
              </div>

              {/* Current Period Info */}
              <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-white font-bold text-lg">
                    Current Period #{currentPeriod}
                  </h3>
                  {distributed ? (
                    <span className="text-green-400 text-xs bg-green-900/30 px-2 py-1 rounded ml-auto">
                      ✅ Distributed
                    </span>
                  ) : (
                    <span className="text-orange-400 text-xs bg-orange-900/30 px-2 py-1 rounded ml-auto">
                      ⏳ Active
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Prize Pool */}
                  <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/30 border border-yellow-500/30 p-4 rounded">
                    <div className="text-yellow-400 text-xs mb-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Prize Pool
                    </div>
                    <div className="text-white font-bold text-2xl mb-1">
                      {formatEther(prizePool)} ETH
                    </div>
                    <div className="text-yellow-300 text-xs">
                      {prizePercentage.toFixed(1)}% of total revenue
                    </div>
                  </div>

                  {/* Platform Fee */}
                  <div className="bg-gradient-to-br from-green-900/30 to-green-800/30 border border-green-500/30 p-4 rounded">
                    <div className="text-green-400 text-xs mb-1 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Platform Fee (This Period)
                    </div>
                    <div className="text-white font-bold text-2xl mb-1">
                      {formatEther(platformFee)} ETH
                    </div>
                    <div className="text-green-300 text-xs">
                      {platformPercentage.toFixed(1)}% of total revenue
                    </div>
                  </div>

                  {/* Total Revenue */}
                  <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/30 border border-purple-500/30 p-4 rounded">
                    <div className="text-purple-400 text-xs mb-1 flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      Total Revenue (This Period)
                    </div>
                    <div className="text-white font-bold text-2xl mb-1">
                      {formatEther(totalRevenue)} ETH
                    </div>
                    <div className="text-purple-300 text-xs">
                      Prize pool + Platform fee
                    </div>
                  </div>

                  {/* Participants */}
                  <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 border border-blue-500/30 p-4 rounded">
                    <div className="text-blue-400 text-xs mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Participants
                    </div>
                    <div className="text-white font-bold text-2xl mb-1">
                      {Number(participants)}
                    </div>
                    <div className="text-blue-300 text-xs">
                      Players who paid entry fee
                    </div>
                  </div>
                </div>

                {/* Period Dates */}
                {startDate && endDate && (
                  <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-gray-400 mb-1">Period Start</div>
                      <div className="text-white font-semibold">
                        {startDate.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1">Period End</div>
                      <div className="text-white font-semibold">
                        {endDate.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Total Points */}
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="text-gray-400 text-xs mb-1">Total Points Scored</div>
                  <div className="text-white font-bold text-lg">
                    {Number(totalPoints).toLocaleString()} points
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    Combined score from all participants
                  </div>
                </div>
              </div>

              {/* Fee Breakdown */}
              <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
                <h3 className="text-white font-bold mb-3">💡 Revenue Distribution</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-gray-300">Entry Fee per Player</div>
                    <div className="text-white font-semibold">
                      {entryFee ? formatEther(entryFee) : '0'} ETH
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-yellow-300">→ Goes to Prize Pool (50%)</div>
                    <div className="text-yellow-400 font-semibold">
                      {entryFee ? formatEther((entryFee * BigInt(50)) / BigInt(100)) : '0'} ETH
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-green-300">→ Goes to Platform (50%)</div>
                    <div className="text-green-400 font-semibold">
                      {entryFee ? formatEther((entryFee * BigInt(50)) / BigInt(100)) : '0'} ETH
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900 flex-shrink-0">
          <div className="text-xs text-gray-400 space-y-1">
            <p>💰 <strong className="text-green-400">Prize Pool:</strong> Distributed to players based on score (50% of entry fees)</p>
            <p>🏦 <strong className="text-blue-400">Platform Fee:</strong> Retained by platform (50% of entry fees)</p>
            <p>📊 All data is fetched directly from the smart contract on Base network</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
