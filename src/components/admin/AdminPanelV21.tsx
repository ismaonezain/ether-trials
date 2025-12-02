'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTRIAContractv21 } from '@/hooks/useTRIAContractv21';
import { formatUnits, type Address } from 'viem';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { X, TrendingUp, Users, Trophy, DollarSign } from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ETHER_TRIALS_TRIA_V21_ABI, ETHER_TRIALS_TRIA_V21_ADDRESS } from '@/lib/contracts/etherTrialsTRIAv21ABI';

interface AdminPanelV21Props {
  isOwner: boolean;
  onClose?: () => void;
}

interface LeaderboardEntry {
  identity: string;
  username: string;
  score: number;
  wallet_address: string;
  entry_amount: string | null;
  weighted_score?: number;
}

// ===== SAFE HELPER FUNCTIONS =====

function safeBigInt(value: string | null | undefined, fallback: bigint = 0n): bigint {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '0') return fallback;
  try {
    return BigInt(trimmed);
  } catch {
    return fallback;
  }
}

function safeFormatUnits(value: bigint, decimals: number = 18): string {
  try {
    return formatUnits(value, decimals);
  } catch {
    return '0';
  }
}

function safeNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

export function AdminPanelV21({ isOwner, onClose }: AdminPanelV21Props) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    useCurrentPeriod,
    useGetCurrentPeriodInfo,
    useGetPeriodInfo,
    useTotalPrizeOwedTRIA,
    allocatePrizes,
    contractAddress,
  } = useTRIAContractv21();

  const { data: currentPeriod } = useCurrentPeriod();
  const { data: periodInfo } = useGetCurrentPeriodInfo();
  const { data: totalPrizeOwedTRIA } = useTotalPrizeOwedTRIA();

  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Don't render if not owner
  if (!isOwner) return null;

  // Fetch leaderboard from Supabase
  useEffect(() => {
    const fetchLeaderboard = async (): Promise<void> => {
      try {
        // CRITICAL: Clear leaderboard first to prevent showing stale data
        setLeaderboardData([]);

        // Step 1: Get currentPeriod from smart contract
        if (!currentPeriod) {
          console.log('⏳ [ADMIN PANEL] Waiting for currentPeriod from smart contract...');
          return;
        }

        // Step 1: Get currentPeriod from smart contract (DYNAMIC VALUE)
        const contractPeriod = Number(currentPeriod);
        console.log('='.repeat(60));
        console.log(`📋 [ADMIN PANEL V21] Step 1: Fetch currentPeriod from Smart Contract`);
        console.log(`   ✅ Smart Contract returned: ${contractPeriod}`);
        
        // Step 2: Use that DYNAMIC period value to query Supabase
        const periodToQuery = contractPeriod; // This is DYNAMIC, not hardcoded!
        console.log(`📋 [ADMIN PANEL V21] Step 2: Query Supabase with DYNAMIC period`);
        console.log(`   🔍 Using period from contract: ${periodToQuery}`);

        // Validate period (must be >= 1)
        if (periodToQuery < 1 || isNaN(periodToQuery)) {
          console.log(`   ❌ Invalid period: ${periodToQuery} (must be >= 1)`);
          console.log('='.repeat(60));
          return;
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
          console.error('❌ Supabase credentials not configured');
          toast.error('Supabase not configured', {
            description: 'Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
          });
          return;
        }

        // Build query URL - CORRECT TABLE NAME: "entry" NOT "entries"
        const queryUrl = `${supabaseUrl}/rest/v1/entry?period=eq.${periodToQuery}&select=identity,username,score,wallet_address,entry_amount&order=score.desc`;
        console.log(`   🔗 Query URL: ${queryUrl}`);

        console.log('   🚀 Sending request to Supabase...');
        const response = await fetch(queryUrl, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        });

        console.log('   📡 Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('   ❌ Response error:', errorText);
          throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`);
        }

        const data: LeaderboardEntry[] = await response.json();
        console.log(`   📥 Received ${data.length} entries from Supabase`);

        // Calculate weighted scores - EXACT same logic as Leaderboard detail modal
        const recalculated = data.map((entry, index) => {
          // EXACT same as Leaderboard.tsx Line 496-500
          const entryAmount = entry.entry_amount || '50000000000000000000000'; // Default 50,000 TRIA in wei (18 decimals)
          const entryAmountTRIA = Number(entryAmount) / 1e18;
          const baseScore = Number(entry.score);
          // V20 Formula: Points = Score × (Entry / 6B TRIA)
          const weightedScore = Math.floor(baseScore * (entryAmountTRIA / 6_000_000_000));

          // Debug logging for first 3 entries
          if (index < 3) {
            console.log(`   📊 Entry ${index + 1} [${entry.username}]:`, {
              score: baseScore,
              entry_amount_raw: entry.entry_amount,
              entry_amount_used: entryAmount,
              entry_amount_TRIA: entryAmountTRIA,
              weighted_score: weightedScore
            });
          }

          return {
            ...entry,
            weighted_score: weightedScore,
          };
        });

        // Sort by weighted score descending
        recalculated.sort((a, b) => (b.weighted_score || 0) - (a.weighted_score || 0));

        setLeaderboardData(recalculated);
        console.log(`   ✅ Successfully loaded ${recalculated.length} entries for period ${periodToQuery}`);
        console.log('='.repeat(50));
      } catch (error) {
        console.error('❌ Error fetching leaderboard:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        toast.error('Failed to load leaderboard', {
          description: errorMessage,
        });
        setLeaderboardData([]);
      }
    };

    fetchLeaderboard();
  }, [currentPeriod]);

  // Handle batch submit scores
  const handleBatchSubmit = async (): Promise<void> => {
    if (leaderboardData.length === 0) {
      toast.error('No entries to submit');
      return;
    }

    try {
      setIsSubmitting(true);
      toast.info('📝 Submitting batch scores to contract...');

      // Prepare arrays
      const players: Address[] = leaderboardData
        .filter(entry => entry.wallet_address)
        .map(entry => entry.wallet_address as Address);
      
      const points: bigint[] = leaderboardData
        .filter(entry => entry.wallet_address)
        .map(entry => BigInt(entry.weighted_score || 0));

      console.log('📝 Batch Submit:', {
        count: players.length,
        players: players.map(p => `${p.slice(0, 6)}...${p.slice(-4)}`),
        points: points.map(p => p.toString()),
      });

      // Submit batch to contract
      const hash = await writeContractAsync({
        address: ETHER_TRIALS_TRIA_V21_ADDRESS,
        abi: ETHER_TRIALS_TRIA_V21_ABI,
        functionName: 'submitPointsBatch',
        args: [players, points],
      });

      setTxHash(hash);
      toast.success('✅ Batch submitted! Waiting for confirmation...');
    } catch (error) {
      console.error('❌ Batch submit error:', error);
      toast.error('Failed to submit batch');
      setIsSubmitting(false);
    }
  };

  // NEW: Handle batch refund (submit score 1 for all addresses)
  const handleBatchRefund = async (): Promise<void> => {
    if (leaderboardData.length === 0) {
      toast.error('No entries to refund');
      return;
    }

    // Confirm action (dangerous operation!)
    const confirmed = window.confirm(
      `⚠️ REFUND MODE\n\n` +
      `This will submit score 1 for ALL ${leaderboardData.length} addresses.\n\n` +
      `This allows players to reclaim their entry tokens in case of bugs or unfair gameplay.\n\n` +
      `Are you sure you want to proceed?`
    );

    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      toast.info('💸 Submitting batch refund (score 1 for all)...');

      // Prepare arrays - ALL addresses get score 1
      const players: Address[] = leaderboardData
        .filter(entry => entry.wallet_address)
        .map(entry => entry.wallet_address as Address);
      
      // All players get score 1 (refund mechanism)
      const points: bigint[] = players.map(() => 1n);

      console.log('💸 Batch Refund:', {
        count: players.length,
        players: players.map(p => `${p.slice(0, 6)}...${p.slice(-4)}`),
        points: 'All set to 1 (refund mode)',
      });

      // Submit batch to contract
      const hash = await writeContractAsync({
        address: ETHER_TRIALS_TRIA_V21_ADDRESS,
        abi: ETHER_TRIALS_TRIA_V21_ABI,
        functionName: 'submitPointsBatch',
        args: [players, points],
      });

      setTxHash(hash);
      toast.success('✅ Batch refund submitted! Players can now reclaim tokens...');
    } catch (error) {
      console.error('❌ Batch refund error:', error);
      toast.error('Failed to submit batch refund');
      setIsSubmitting(false);
    }
  };

  // Watch for confirmation
  useEffect(() => {
    if (isConfirmed && isSubmitting) {
      toast.success('🎉 Batch scores confirmed on-chain!');
      setIsSubmitting(false);
      setTxHash(undefined);
    }
  }, [isConfirmed, isSubmitting]);

  // Handle allocate prizes
  const handleAllocatePrizes = async (): Promise<void> => {
    try {
      if (!currentPeriod) {
        toast.error('No period to allocate');
        return;
      }

      const periodToAllocate = currentPeriod;

      console.log('💰 ========== ALLOCATE PRIZES (V21) ==========');
      console.log('💰 Allocating for Current Period:', periodToAllocate.toString());
      console.log('💰 ======================================');

      toast.info('📝 Submitting allocation transaction...');

      // Call contract function
      await allocatePrizes(periodToAllocate);

      toast.success(`✅ Prizes allocated for period ${periodToAllocate}!`);
    } catch (error) {
      console.error('❌ Error allocating prizes:', error);
      toast.error('Failed to allocate prizes');
    }
  };

  // Extract data from contract
  // periodInfo = [period, prizePoolTRIA, totalPoints, participants, startTime, endTime, distributed]
  const prizePoolTRIA = periodInfo && Array.isArray(periodInfo) ? periodInfo[1] : 0n;
  const prizePoolFormatted = safeFormatUnits(prizePoolTRIA, 18);
  const totalOwedFormatted = safeFormatUnits(totalPrizeOwedTRIA || 0n, 18);

  // currentPeriodInfo = [period, prizePoolTRIA, totalPoints, participants, startTime, endTime, distributed]
  const currentTotalPoints = periodInfo && Array.isArray(periodInfo) ? periodInfo[2] : 0n;
  const currentDistributed = periodInfo && Array.isArray(periodInfo) ? periodInfo[6] : false;

  // Enable Allocate button if current period not yet distributed
  const canAllocatePrizes = !currentDistributed;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-purple-900/95 to-blue-900/95 border-2 border-purple-500 shadow-2xl">
        {/* Header */}
        <CardHeader className="border-b border-purple-500/50 pb-4 sticky top-0 bg-gradient-to-br from-purple-900 to-blue-900 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🔐</div>
              <div>
                <CardTitle className="text-2xl font-bold text-yellow-300">
                  Admin Panel V21
                </CardTitle>
                <p className="text-sm text-gray-300 mt-1">
                  Simplified Contract - Frontend Scoring
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Period Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-900/80 to-purple-900/80 border-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Trophy className="h-8 w-8 text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-300">Current Period</p>
                    <p className="text-2xl font-bold text-white">
                      {currentPeriod ? currentPeriod.toString() : '...'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-900/80 to-blue-900/80 border-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-green-400" />
                  <div>
                    <p className="text-sm text-gray-300">TRIA Prize Pool</p>
                    <p className="text-2xl font-bold text-white">
                      {parseFloat(prizePoolFormatted).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-900/80 to-orange-900/80 border-yellow-500">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-300">Unclaimed TRIA</p>
                    <p className="text-2xl font-bold text-white">
                      {parseFloat(totalOwedFormatted).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions - Simplified! No stacked modals */}
          <Card className="bg-gradient-to-br from-purple-900/80 to-pink-900/80 border-purple-500">
            <CardHeader>
              <CardTitle className="text-xl text-yellow-300 flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Admin Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Batch Submit Scores */}
                <Button
                  size="lg"
                  onClick={handleBatchSubmit}
                  disabled={isSubmitting || isConfirming || leaderboardData.length === 0}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white font-bold h-20"
                >
                  {isSubmitting || isConfirming ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full"></div>
                      <span className="text-xs">Submitting...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">📊</span>
                      <span>Batch Submit Scores</span>
                      {leaderboardData.length > 0 && (
                        <span className="text-xs opacity-80">({leaderboardData.length} entries)</span>
                      )}
                    </div>
                  )}
                </Button>

                {/* Allocate Prizes */}
                <Button
                  size="lg"
                  onClick={handleAllocatePrizes}
                  disabled={!canAllocatePrizes}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold h-20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg">💰</span>
                    <span>Allocate Prizes</span>
                    {currentPeriod && (
                      <span className="text-xs opacity-80">
                        Period {Number(currentPeriod)}
                        {currentTotalPoints > 0n ? ` (${currentTotalPoints.toString()} pts)` : ' (no scores)'}
                      </span>
                    )}
                  </div>
                </Button>
              </div>

              {/* NEW: Batch Refund Button (Emergency Use Only) */}
              <div className="border-t border-red-500/30 pt-4">
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 mb-3">
                  <p className="text-xs text-red-200">
                    🚨 <strong>Emergency Refund Mode:</strong> Use only when there's a bug or unfair gameplay. This will submit score 1 for all addresses, allowing them to reclaim their entry tokens.
                  </p>
                </div>
                
                <Button
                  size="lg"
                  onClick={handleBatchRefund}
                  disabled={isSubmitting || isConfirming || leaderboardData.length === 0}
                  className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold h-16"
                >
                  {isSubmitting || isConfirming ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full"></div>
                      <span className="text-xs">Processing...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">💸</span>
                      <span>Batch Refund (Score 1 for All)</span>
                      {leaderboardData.length > 0 && (
                        <span className="text-xs opacity-80">Emergency token refund for {leaderboardData.length} addresses</span>
                      )}
                    </div>
                  )}
                </Button>
              </div>

              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-3">
                <p className="text-xs text-yellow-200">
                  ⚠️ <strong>Normal Workflow:</strong> 1️⃣ Submit all scores → 2️⃣ Allocate prizes
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard - Compact View */}
          <Card className="bg-gradient-to-br from-gray-900/80 to-blue-900/80 border-gray-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl text-yellow-300 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Current Period Leaderboard
                </CardTitle>
                <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500 text-sm">
                  {leaderboardData.length} entries
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-900/95">
                    <tr className="border-b border-gray-600">
                      <th className="text-left p-2 text-gray-300">Rank</th>
                      <th className="text-left p-2 text-gray-300">Username</th>
                      <th className="text-right p-2 text-gray-300">Score</th>
                      <th className="text-right p-2 text-gray-300">Entry</th>
                      <th className="text-right p-2 text-gray-300">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.map((entry, index) => {
                      // EXACT same as Leaderboard.tsx Line 496-497
                      const entryAmount = entry.entry_amount || '50000000000000000000000'; // Default 50,000 TRIA in wei (18 decimals)
                      const entryTRIANum = Number(entryAmount) / 1e18;

                      return (
                        <tr
                          key={entry.identity}
                          className={`border-b border-gray-700/50 hover:bg-white/5 ${
                            index < 3 ? 'bg-yellow-900/20' : ''
                          }`}
                        >
                          <td className="p-2">
                            <Badge
                              variant="outline"
                              className={
                                index === 0
                                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
                                  : index === 1
                                  ? 'bg-gray-400/20 text-gray-300 border-gray-400'
                                  : index === 2
                                  ? 'bg-orange-700/20 text-orange-300 border-orange-700'
                                  : 'bg-gray-700/20 text-gray-400 border-gray-600'
                              }
                            >
                              #{index + 1}
                            </Badge>
                          </td>
                          <td className="p-2 text-white font-medium">{entry.username}</td>
                          <td className="p-2 text-right text-gray-300">
                            {safeNumber(entry.score, 0).toLocaleString()}
                          </td>
                          <td className="p-2 text-right text-blue-300">
                            {entryTRIANum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="p-2 text-right text-yellow-300 font-bold">
                            {(entry.weighted_score || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {leaderboardData.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    No entries found for current period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contract Info */}
          <Card className="bg-gradient-to-br from-gray-900/60 to-purple-900/60 border-gray-700">
            <CardContent className="pt-6">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Contract V21:</span>
                  <span className="text-purple-300 font-mono">{contractAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Chain:</span>
                  <span className="text-blue-300">Base Mainnet</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
