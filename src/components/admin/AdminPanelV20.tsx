'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTRIAContractv20 } from '@/hooks/useTRIAContractv20';
import { formatUnits, type Address } from 'viem';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { X, TrendingUp, Users, Trophy, DollarSign, Send } from 'lucide-react';
import { BatchSubmitModalV21 } from './BatchSubmitModalV21';

interface AdminPanelV20Props {
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

export function AdminPanelV20({ isOwner, onClose }: AdminPanelV20Props) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [isAllocating, setIsAllocating] = useState<boolean>(false);
  const [showBatchSubmitModal, setShowBatchSubmitModal] = useState<boolean>(false);

  const {
    useCurrentPeriod,
    useGetCurrentPeriodInfo,
    useTotalPrizeOwedTRIA,
    allocatePrizes,
    contractAddress,
  } = useTRIAContractv20();

  const { data: currentPeriod } = useCurrentPeriod();
  const { data: periodInfo } = useGetCurrentPeriodInfo();
  const { data: totalPrizeOwedTRIA } = useTotalPrizeOwedTRIA();

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
        console.log(`📋 [ADMIN PANEL] Step 1: Fetch currentPeriod from Smart Contract`);
        console.log(`   ✅ Smart Contract returned: ${contractPeriod}`);
        
        // Step 2: Use that DYNAMIC period value to query Supabase
        const periodToQuery = contractPeriod; // This is DYNAMIC, not hardcoded!
        console.log(`📋 [ADMIN PANEL] Step 2: Query Supabase with DYNAMIC period`);
        console.log(`   🔍 Using period from contract: ${periodToQuery}`);

        // Validate period (must be >= 1)
        if (periodToQuery < 1 || isNaN(periodToQuery)) {
          console.log(`   ❌ Invalid period: ${periodToQuery} (must be >= 1)`);
          console.log('='.repeat(60));
          return;
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        console.log('🔍 [DEBUG] Supabase credentials:');
        console.log('   - URL exists:', !!supabaseUrl);
        console.log('   - Key exists:', !!supabaseAnonKey);
        console.log('   - URL value:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING');

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
        console.log('   📋 Sample data:', data.slice(0, 2));

        // Calculate weighted scores
        const SIX_BILLION_TRIA = 6_000_000_000;
        const recalculated = data.map((entry) => {
          const baseScore = safeNumber(entry.score, 0);
          const entryAmountStr = entry.entry_amount || '0';
          const entryAmountBigInt = safeBigInt(entryAmountStr, 0n);
          const entryAmountTRIA = safeNumber(safeFormatUnits(entryAmountBigInt, 18), 0);

          // Calculate weighted score: score × (entry / 6B)
          const multiplier = entryAmountTRIA / SIX_BILLION_TRIA;
          const weightedScore = Math.floor(baseScore * multiplier);

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

  // Handle allocate prizes
  const handleAllocatePrizes = async (): Promise<void> => {
    try {
      if (!currentPeriod || Number(currentPeriod) <= 1) {
        toast.error('No previous period to allocate');
        return;
      }

      const periodToAllocate = BigInt(Number(currentPeriod) - 1);

      console.log('💰 ========== ALLOCATE PRIZES ==========');
      console.log('💰 Current Period:', currentPeriod.toString());
      console.log('💰 Allocating for Period:', periodToAllocate.toString());
      console.log('💰 ======================================');

      setIsAllocating(true);
      toast.info('📝 Submitting allocation transaction...');

      // Call contract function
      await allocatePrizes(periodToAllocate);

      toast.success(`✅ Prizes allocated for period ${periodToAllocate}!`);
      setIsAllocating(false);
    } catch (error) {
      console.error('❌ Error allocating prizes:', error);
      setIsAllocating(false);
      toast.error('Failed to allocate prizes');
    }
  };

  // Extract data from contract
  // periodInfo = [period, prizePoolTRIA, totalPoints, participants, startTime, endTime, distributed]
  const prizePoolTRIA = periodInfo && Array.isArray(periodInfo) ? periodInfo[1] : 0n;
  const prizePoolFormatted = safeFormatUnits(prizePoolTRIA, 18);
  const totalOwedFormatted = safeFormatUnits(totalPrizeOwedTRIA || 0n, 18);
  const allocatePeriod = currentPeriod ? Number(currentPeriod) : null;
  const currentPeriodForDisplay = currentPeriod ? Number(currentPeriod) : null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-purple-900/95 to-blue-900/95 border-2 border-purple-500 shadow-2xl">
        {/* Header */}
        <CardHeader className="border-b border-purple-500/50 pb-4 sticky top-0 bg-gradient-to-br from-purple-900 to-blue-900 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🔐</div>
              <div>
                <CardTitle className="text-2xl font-bold text-yellow-300">
                  Admin Panel V20
                </CardTitle>
                <p className="text-sm text-gray-300 mt-1">
                  TRIA Prize Pool Management
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

          {/* Allocate Prizes Section */}
          <Card className="bg-gradient-to-br from-purple-900/80 to-pink-900/80 border-purple-500">
            <CardHeader>
              <CardTitle className="text-xl text-yellow-300 flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Allocate Prizes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">
                    Period to Allocate:{' '}
                    <span className="font-bold text-white">{currentPeriod ? (Number(currentPeriod) - 1) : '...'}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    This will distribute prizes based on weighted scores
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleAllocatePrizes}
                  disabled={isAllocating || !currentPeriod || Number(currentPeriod) <= 1}
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold"
                >
                  {isAllocating
                    ? '⏳ Allocating...'
                    : `💰 Allocate Period ${currentPeriod ? (Number(currentPeriod) - 1) : '...'}`}
                </Button>
              </div>

              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-3">
                <p className="text-xs text-yellow-200">
                  ⚠️ <strong>Warning:</strong> This action will finalize prize allocation for
                  period {currentPeriod ? (Number(currentPeriod) - 1) : '...'}. Make sure all entries are correct before proceeding.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card className="bg-gradient-to-br from-gray-900/80 to-blue-900/80 border-gray-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl text-yellow-300 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Leaderboard - Period {currentPeriodForDisplay || 'N/A'}
                </CardTitle>
                <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500 text-sm">
                  {leaderboardData.length} entries
                </Badge>
              </div>
              {currentPeriodForDisplay !== null && currentPeriodForDisplay >= 1 && (
                <p className="text-xs text-gray-400 mt-2">
                  📊 Showing CURRENT period {currentPeriodForDisplay} data from smart contract
                </p>
              )}
              {leaderboardData.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => setShowBatchSubmitModal(true)}
                  className="mt-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white font-semibold"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Batch Submit {leaderboardData.length} Scores to Contract
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {currentPeriodForDisplay !== null && currentPeriodForDisplay >= 1 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-600">
                          <th className="text-left p-2 text-gray-300">Rank</th>
                          <th className="text-left p-2 text-gray-300">Username</th>
                          <th className="text-right p-2 text-gray-300">Base Score</th>
                          <th className="text-right p-2 text-gray-300">Entry (TRIA)</th>
                          <th className="text-right p-2 text-gray-300">Weighted Score</th>
                          <th className="text-left p-2 text-gray-300">Wallet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardData.map((entry, index) => {
                          const entryAmountStr = entry.entry_amount || '0';
                          const entryAmountBigInt = safeBigInt(entryAmountStr, 0n);
                          const entryTRIA = safeFormatUnits(entryAmountBigInt, 18);
                          const entryTRIANum = parseFloat(entryTRIA);

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
                              <td className="p-2 text-gray-400 font-mono text-xs">
                                {entry.wallet_address
                                  ? `${entry.wallet_address.slice(0, 6)}...${entry.wallet_address.slice(-4)}`
                                  : 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {leaderboardData.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      No entries found for current period {currentPeriodForDisplay}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Waiting for Period Data</p>
                  <p className="text-sm mt-2">
                    Leaderboard data will appear here once the period starts.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contract Info */}
          <Card className="bg-gradient-to-br from-gray-900/60 to-purple-900/60 border-gray-700">
            <CardContent className="pt-6">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Contract V20:</span>
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

      {/* Batch Submit Modal V21 */}
      <BatchSubmitModalV21
        isOpen={showBatchSubmitModal}
        onClose={() => setShowBatchSubmitModal(false)}
        entries={leaderboardData}
        currentPeriod={currentPeriod ? Number(currentPeriod) : 0}
      />
    </div>
  );
}
