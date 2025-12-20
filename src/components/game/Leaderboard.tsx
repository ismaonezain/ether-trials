'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Entry, FunEntry } from '@/hooks/useSupabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, Medal, Award, X, Crown, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '@/lib/game/utils';
import { useAccount } from 'wagmi';
import { useTournamentContractV2 } from '@/hooks/useTournamentContractV2';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { useTRIAContractv21 } from '@/hooks/useTRIAContractv21';


interface LeaderboardProps {
  entries: Entry[];
  funEntries: FunEntry[];
  currentPlayerIdentity?: string;
  currentPeriod?: number;
  onClose: () => void;
}

export function Leaderboard({ entries, funEntries, currentPlayerIdentity, currentPeriod, onClose }: LeaderboardProps): JSX.Element {
  const [tab, setTab] = useState<'paid' | 'fun'>('paid');
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [selectedFunEntry, setSelectedFunEntry] = useState<FunEntry | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(currentPeriod || 0);
  const { address } = useAccount();
  const { checkIsOwner } = useTournamentContractV2();
  const isOwner = checkIsOwner(address);
  
  // Get FID from Farcaster profile
  const { profile } = useFarcasterProfile();
  const fid = profile?.fid ? BigInt(profile.fid) : undefined;
  
  // Check if user has entry in smart contract for current period (V21)
  const { useGetPlayerInfo, useCurrentPeriod } = useTRIAContractv21();
  const { data: currentPeriodData } = useCurrentPeriod();
  const currentPeriodFromContract = currentPeriodData ? currentPeriodData : undefined;
  const { data: playerInfoData } = useGetPlayerInfo(
    address as `0x${string}` | undefined,
    currentPeriodFromContract
  );
  // playerInfoData returns: [hasEntered, score, entryAmount, points, pendingPrizeTRIA, claimed]
  const hasEnteredTournament = playerInfoData && Array.isArray(playerInfoData) && playerInfoData[0] === true;

  // Safety checks: ensure entries are arrays
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safeFunEntries = Array.isArray(funEntries) ? funEntries : [];

  // Debug logging
  console.log('🏆 Leaderboard render:', {
    totalEntries: safeEntries.length,
    totalFunEntries: safeFunEntries.length,
    currentPeriod,
    selectedPeriod
  });

  // Initialize selected period to current period when it changes
  useEffect(() => {
    if (currentPeriod !== undefined) {
      setSelectedPeriod(currentPeriod);
    }
  }, [currentPeriod]);

  // Helper function to display user-friendly username
  const getDisplayUsername = (username: string): string => {
    // If username starts with "player-" and is a long hash, show shortened version
    if (username.startsWith('player-') && username.length > 20) {
      const hash = username.substring(7); // Remove "player-" prefix
      return `Player ${hash.substring(0, 6)}...`; // Show first 6 chars of hash
    }
    return username;
  };

  // Get available periods from entries (for Prize Pool mode)
  const availablePeriodsPaid = useMemo(() => {
    const periods = new Set<number>();
    safeEntries.forEach(entry => {
      periods.add(Number(entry.period));
    });
    return Array.from(periods).sort((a, b) => b - a); // Sort descending (newest first)
  }, [safeEntries]);

  // Get available periods from fun entries (for Free mode)
  const availablePeriodsFun = useMemo(() => {
    const periods = new Set<number>();
    safeFunEntries.forEach(entry => {
      periods.add(Number(entry.period));
    });
    return Array.from(periods).sort((a, b) => b - a); // Sort descending (newest first)
  }, [safeFunEntries]);

  // Filter entries by selected period
  const filteredEntries = useMemo(() => {
    return safeEntries
      .filter(entry => entry.period === selectedPeriod)
      .sort((a, b) => {
        // Sort by score descending
        if (a.score > b.score) return -1;
        if (a.score < b.score) return 1;
        // Then by timestamp ascending (earlier entries first)
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return aTime - bTime;
      });
  }, [safeEntries, selectedPeriod]);

  // Filter fun entries by selected period, then sort by score descending and limit to top 100
  const sortedFunEntries = useMemo(() => {
    return [...safeFunEntries]
      .filter(entry => entry.period === selectedPeriod)
      .sort((a, b) => {
        // Sort by score descending
        if (a.score > b.score) return -1;
        if (a.score < b.score) return 1;
        // Then by timestamp ascending (earlier entries first)
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return aTime - bTime;
      })
      .slice(0, 100); // Limit to top 100
  }, [safeFunEntries, selectedPeriod]);

  // Period navigation - uses appropriate period list based on active tab
  const goToPreviousPeriod = () => {
    const periods = tab === 'paid' ? availablePeriodsPaid : availablePeriodsFun;
    const currentIndex = periods.indexOf(selectedPeriod);
    if (currentIndex < periods.length - 1) {
      setSelectedPeriod(periods[currentIndex + 1]);
    }
  };

  const goToNextPeriod = () => {
    const periods = tab === 'paid' ? availablePeriodsPaid : availablePeriodsFun;
    const currentIndex = periods.indexOf(selectedPeriod);
    if (currentIndex > 0) {
      setSelectedPeriod(periods[currentIndex - 1]);
    }
  };

  const hasPreviousPeriod = () => {
    const periods = tab === 'paid' ? availablePeriodsPaid : availablePeriodsFun;
    return periods.indexOf(selectedPeriod) < periods.length - 1;
  };
  
  const hasNextPeriod = () => {
    const periods = tab === 'paid' ? availablePeriodsPaid : availablePeriodsFun;
    return periods.indexOf(selectedPeriod) > 0;
  };

  // Check if current period is blind (scores hidden)
  // Fun Mode: Never blind (always show scores)
  // Paid Mode: Never blind (always show scores) - wallet addresses remain hidden for non-owners
  const isBlindPeriod = false;

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-auto">
        <Card className="max-w-4xl w-full fantasy-card max-h-[85vh] md:max-h-[90vh] flex flex-col">
          <CardHeader className="pb-3 border-b border-yellow-600/50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <CardTitle className="text-2xl fantasy-title bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">Hall of Champions</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Info Banner - Different for each mode */}
            {tab === 'paid' ? (
              isBlindPeriod ? (
                <div className="bg-gray-900/70 border-2 border-yellow-500/70 p-3 rounded-lg mt-3 animate-pulse">
                  <div className="text-yellow-300 text-xs flex items-center gap-2 font-bold mb-1">
                    🔒 Current Period - Blind Leaderboard
                  </div>
                  <div className="text-gray-200 text-[10px] leading-relaxed">
                    Scores are hidden until you pay the entry fee. Join the tournament to see all scores!
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900/50 border border-yellow-600/50 p-3 rounded mt-3">
                  <div className="text-yellow-300 text-xs flex items-center gap-2 font-bold">
                    🏆 Prize Pool Leaderboard
                  </div>
                </div>
              )
            ) : (
              <div className="bg-gray-900/50 border border-blue-600/50 p-2 rounded mt-3">
                <div className="text-blue-300 text-xs flex items-center gap-1 font-medium">
                  🎮 For Fun Mode: No entry fee required!
                </div>
              </div>
            )}

            {/* Mode Tabs */}
            <Tabs value={tab} onValueChange={(value: string) => setTab(value as 'paid' | 'fun')} className="mt-3">
              <TabsList className="grid w-full grid-cols-2 bg-black/50">
                <TabsTrigger value="paid" className="text-xs data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-600 data-[state=active]:to-red-600 data-[state=active]:text-white">💰 Prize Pool</TabsTrigger>
                <TabsTrigger value="fun" className="text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white">🎮 For Fun</TabsTrigger>
              </TabsList>
            </Tabs>



            {/* Period Navigation - For Both Modes */}
            {((tab === 'paid' && availablePeriodsPaid.length > 0) || (tab === 'fun' && availablePeriodsFun.length > 0)) && (
              <div className="bg-gray-900/50 border border-yellow-600/50 p-2 rounded-lg mt-2">
                <div className="flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={goToPreviousPeriod}
                    disabled={!hasPreviousPeriod()}
                    className="text-yellow-300 hover:bg-gray-800 disabled:opacity-30 h-7"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <div className="text-center flex-1">
                    <div className="text-xs text-yellow-400 font-medium">Period</div>
                    <div className="text-lg font-bold text-white">
                      {selectedPeriod}
                      {selectedPeriod === currentPeriod && (
                        <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded">Current</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={goToNextPeriod}
                    disabled={!hasNextPeriod()}
                    className="text-yellow-300 hover:bg-gray-800 disabled:opacity-30 h-7"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-4 overflow-auto flex-1">
            {(() => {
              // For paid mode, show entries; for fun mode, show fun entries
              const isPaidMode = tab === 'paid';
              const filteredData = isPaidMode ? filteredEntries : sortedFunEntries;

              return (
                <div className="space-y-2">
                  {/* Table Header */}
                  <div className="grid grid-cols-10 gap-2 text-xs font-semibold text-yellow-300 pb-2 border-b border-yellow-600/50 sticky top-0 bg-black z-10">
                    <div className="col-span-1 text-center">Rank</div>
                    <div className="col-span-6">Player</div>
                    <div className="col-span-2 text-center">Score</div>
                    <div className="col-span-1 text-center"></div>
                  </div>

                  {/* Entries Display */}
                  {isPaidMode ? (
                    // PAID MODE: Show Entry Table
                    filteredEntries.map((entry, index) => {
                      const rank = index + 1;
                      const isCurrentPlayer = entry.identity === currentPlayerIdentity;

                      return (
                        <div
                          key={entry.entry_id.toString()}
                          className={`grid grid-cols-10 gap-2 text-xs py-2 px-2 rounded-lg transition-colors cursor-pointer ${
                            isCurrentPlayer
                              ? 'bg-blue-900/50 border-2 border-blue-400'
                              : rank <= 3
                              ? 'bg-gradient-to-r from-yellow-900/30 to-red-900/30 border border-yellow-600/50'
                              : 'bg-black/40 border border-yellow-600/20 hover:bg-gray-800/50'
                          }`}
                          onClick={() => setSelectedEntry(entry)}
                        >
                          {/* Rank */}
                          <div className="col-span-1 text-center font-bold flex items-center justify-center">
                            {rank === 1 ? (
                              <Trophy className="w-5 h-5 text-yellow-400" title="1st Place" />
                            ) : rank === 2 ? (
                              <Medal className="w-5 h-5 text-gray-300" title="2nd Place" />
                            ) : rank === 3 ? (
                              <Award className="w-5 h-5 text-orange-600" title="3rd Place" />
                            ) : (
                              <span className="text-gray-400">{rank}</span>
                            )}
                          </div>

                          {/* Player */}
                          <div className="col-span-6 text-white truncate flex items-center gap-2 font-medium">
                            {entry.pfp_url && (
                              <img 
                                src={entry.pfp_url} 
                                alt={entry.username}
                                className="w-6 h-6 rounded-full border border-yellow-400 flex-shrink-0"
                                style={{ aspectRatio: '1/1', objectFit: 'cover' }}
                              />
                            )}
                            <span className="truncate">{getDisplayUsername(entry.username)}</span>
                            {isCurrentPlayer && (
                              <span className="ml-1 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">You</span>
                            )}
                          </div>

                          {/* Score */}
                          <div className="col-span-2 text-center text-yellow-300 font-semibold flex items-center justify-center">
                            {isBlindPeriod ? (
                              <span className="text-gray-500 tracking-wider">?????</span>
                            ) : (
                              formatNumber(Number(entry.score))
                            )}
                          </div>

                          {/* Detail Button */}
                          <div className="col-span-1 flex items-center justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEntry(entry);
                              }}
                              className="h-6 px-1 text-xs text-yellow-400 hover:text-yellow-300 hover:bg-gray-800"
                            >
                              <Info className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // FUN MODE: Show Fun Entry Table
                    sortedFunEntries.map((entry, index) => {
                      const rank = index + 1;
                      const isCurrentPlayer = entry.identity === currentPlayerIdentity;

                      return (
                        <div
                          key={entry.entry_id.toString()}
                          className={`grid grid-cols-10 gap-2 text-xs py-2 px-2 rounded-lg transition-colors cursor-pointer ${
                            isCurrentPlayer
                              ? 'bg-blue-900/50 border-2 border-blue-400'
                              : rank <= 3
                              ? 'bg-gradient-to-r from-yellow-900/30 to-red-900/30 border border-yellow-600/50'
                              : 'bg-black/40 border border-yellow-600/20 hover:bg-gray-800/50'
                          }`}
                          onClick={() => setSelectedFunEntry(entry)}
                        >
                          {/* Rank */}
                          <div className="col-span-1 text-center font-bold flex items-center justify-center text-gray-400">
                            <span>{rank}</span>
                          </div>

                          {/* Player */}
                          <div className="col-span-6 text-white truncate flex items-center gap-2 font-medium">
                            {entry.pfp_url && (
                              <img 
                                src={entry.pfp_url} 
                                alt={entry.username}
                                className="w-6 h-6 rounded-full border border-yellow-400 flex-shrink-0"
                                style={{ aspectRatio: '1/1', objectFit: 'cover' }}
                              />
                            )}
                            <span className="truncate">{getDisplayUsername(entry.username)}</span>
                            {isCurrentPlayer && (
                              <span className="ml-1 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">You</span>
                            )}
                          </div>

                          {/* Score */}
                          <div className="col-span-2 text-center text-yellow-300 font-semibold flex items-center justify-center">
                            {isBlindPeriod ? (
                              <span className="text-gray-500 tracking-wider">?????</span>
                            ) : (
                              formatNumber(Number(entry.score))
                            )}
                          </div>

                          {/* Detail Button */}
                          <div className="col-span-1 flex items-center justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFunEntry(entry);
                              }}
                              className="h-6 px-1 text-xs text-yellow-400 hover:text-yellow-300 hover:bg-gray-800"
                            >
                              <Info className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Empty State */}
                  {filteredData.length === 0 && (
                    <div className="text-center text-yellow-300 py-8 bg-gray-900/50 rounded-lg border border-yellow-600/30">
                      No champions yet. Be the first!
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>

          {/* Footer */}
          {tab === 'paid' && (
            <div className="p-4 border-t border-yellow-600/50 bg-gray-900/50 flex-shrink-0">
              <div className="text-xs text-gray-300 space-y-1">
                <p>🏆 <strong className="text-yellow-300">Prize Distribution:</strong> Your share = (Your Points / Total Points) × TRIA Pool</p>
                <p>⚖️ <strong className="text-yellow-300">Points Formula:</strong> Score × (Entry / 6B TRIA)</p>
                <p>💰 Entry range: 50,000 - 6,000,000,000 TRIA</p>
                <p>✅ Claim TRIA rewards after period ends • 100% pool distributed!</p>
              </div>
            </div>
          )}
          {tab === 'fun' && (
            <div className="p-4 border-t border-yellow-600/50 bg-gray-900/50 flex-shrink-0">
              <div className="text-xs text-gray-300 space-y-1">
                <p>🎮 For Fun Mode - No entry fee, no prize pool</p>
                <p>🏆 Top 100 players per period displayed on leaderboard</p>
                <p>📊 Tier scores (Good, Great, etc.) based on period ranking</p>
                <p>🚀 Switch to Prize Pool Mode to compete for ETH rewards</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Entry Detail Modal (Paid Mode) */}
      {selectedEntry && (
        <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
          <DialogContent className="fantasy-card text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-300">Entry Details</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {/* Username with Profile Picture */}
              <div className="bg-gray-900/50 p-3 rounded-lg border border-yellow-600/30">
                <div className="text-xs text-yellow-400 mb-1 font-medium">Player</div>
                <div className="flex items-center gap-3">
                  {selectedEntry.pfp_url && (
                    <img 
                      src={selectedEntry.pfp_url} 
                      alt={selectedEntry.username}
                      className="w-12 h-12 rounded-full border-2 border-yellow-400 flex-shrink-0"
                      style={{ aspectRatio: '1/1', objectFit: 'cover' }}
                    />
                  )}
                  <div className="text-lg font-bold text-white">{selectedEntry.username}</div>
                </div>
              </div>

              {/* Class Name */}
              {selectedEntry.className && (
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-600/50">
                  <div className="text-xs text-purple-300 mb-1 font-medium">⚔️ Class</div>
                  <div className="text-lg font-bold text-white">{selectedEntry.className}</div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900/50 p-3 rounded-lg border border-yellow-600/30">
                  <div className="text-xs text-yellow-400 mb-1 font-medium">Score</div>
                  <div className="text-lg font-bold text-yellow-300">
                    {isBlindPeriod ? (
                      <span className="text-gray-500 tracking-wider">?????</span>
                    ) : (
                      formatNumber(Number(selectedEntry.score))
                    )}
                  </div>
                </div>
                <div className="bg-purple-900/50 p-3 rounded-lg border border-blue-600/30">
                  <div className="text-xs text-blue-400 mb-1 font-medium">Stage</div>
                  <div className="text-lg font-bold text-white">{selectedEntry.stage}</div>
                </div>
              </div>

              {/* Entry Amount and Weighted Score */}
              {(() => {
                const entryAmount = selectedEntry.entry_amount || '50000000000000000000000'; // Default 50,000 TRIA in wei (18 decimals)
                const entryAmountTRIA = Number(entryAmount) / 1e18;
                const baseScore = Number(selectedEntry.score);
                // V21 Formula: Points = Score × (Entry / 6B TRIA)
                const weightedScore = Math.floor(baseScore * (entryAmountTRIA / 6_000_000_000));
                
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 p-3 rounded-lg border border-green-600/30">
                      <div className="text-xs text-green-400 mb-1 font-medium">💰 Entry Amount</div>
                      <div className="text-lg font-bold text-green-300">
                        {entryAmountTRIA.toLocaleString()} TRIA
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-yellow-900/50 to-orange-900/50 p-3 rounded-lg border border-yellow-600/30">
                      <div className="text-xs text-yellow-400 mb-1 font-medium">⚖️ Weighted Points</div>
                      <div className="text-sm font-bold text-yellow-300">
                        {formatNumber(weightedScore)}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {formatNumber(baseScore)} × ({entryAmountTRIA.toLocaleString()} / 6B)
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* HP and Completion Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-900/50 p-3 rounded-lg border border-green-600/30">
                  <div className="text-xs text-green-400 mb-1 font-medium">❤️ HP Remaining</div>
                  <div className="text-lg font-bold text-green-300">
                    {selectedEntry.remaining_hp_percent ? `${selectedEntry.remaining_hp_percent.toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
                <div className="bg-purple-900/50 p-3 rounded-lg border border-orange-600/30">
                  <div className="text-xs text-orange-400 mb-1 font-medium">⏱️ Time</div>
                  <div className="text-lg font-bold text-orange-300">
                    {selectedEntry.completion_time_seconds 
                      ? `${Math.floor(selectedEntry.completion_time_seconds / 60)}:${(selectedEntry.completion_time_seconds % 60).toString().padStart(2, '0')}`
                      : 'N/A'
                    }
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-900/50 p-3 rounded-lg border border-purple-600/30">
                  <div className="text-xs text-purple-400 mb-1 font-medium">Period</div>
                  <div className="text-sm font-semibold text-white">{Number(selectedEntry.period)}</div>
                </div>
                <div className="bg-purple-900/50 p-3 rounded-lg border border-red-600/30">
                  <div className="text-xs text-red-400 mb-1 font-medium">Entry Time</div>
                  <div className="text-xs font-semibold text-white">
                    {new Date(selectedEntry.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Wallet Address - Only visible to owner */}
              {isOwner && selectedEntry.walletAddress && (
                <div className="bg-gray-900/50 border border-yellow-600/50 p-3 rounded-lg">
                  <div className="text-xs text-yellow-300 mb-1 flex items-center gap-2 font-bold">
                    🔐 Wallet Address
                    <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">Owner View</span>
                  </div>
                  <div className="text-xs font-mono text-gray-300 break-all">
                    {selectedEntry.walletAddress}
                  </div>
                </div>
              )}

              {/* Entry Badge */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <div className="bg-yellow-900/50 border border-yellow-600 px-4 py-2 rounded-lg">
                  <span className="text-yellow-300 text-xs font-semibold">💎 Prize Pool Entry</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Fun Entry Detail Modal */}
      {selectedFunEntry && (
        <Dialog open={!!selectedFunEntry} onOpenChange={() => setSelectedFunEntry(null)}>
          <DialogContent className="fantasy-card text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-300">Entry Details</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {/* Username with Profile Picture */}
              <div className="bg-gray-900/50 p-3 rounded-lg border border-yellow-600/30">
                <div className="text-xs text-yellow-400 mb-1 font-medium">Player</div>
                <div className="flex items-center gap-3">
                  {selectedFunEntry.pfp_url && (
                    <img 
                      src={selectedFunEntry.pfp_url} 
                      alt={selectedFunEntry.username}
                      className="w-12 h-12 rounded-full border-2 border-yellow-400 flex-shrink-0"
                      style={{ aspectRatio: '1/1', objectFit: 'cover' }}
                    />
                  )}
                  <div className="text-lg font-bold text-white">{selectedFunEntry.username}</div>
                </div>
              </div>

              {/* Class Name */}
              {selectedFunEntry.className && (
                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-600/50">
                  <div className="text-xs text-purple-300 mb-1 font-medium">⚔️ Class</div>
                  <div className="text-lg font-bold text-white">{selectedFunEntry.className}</div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-900/50 p-3 rounded-lg border border-yellow-600/30">
                  <div className="text-xs text-yellow-400 mb-1 font-medium">Score</div>
                  <div className="text-lg font-bold text-yellow-300">
                    {isBlindPeriod ? (
                      <span className="text-gray-500 tracking-wider">?????</span>
                    ) : (
                      formatNumber(Number(selectedFunEntry.score))
                    )}
                  </div>
                </div>
                <div className="bg-purple-900/50 p-3 rounded-lg border border-blue-600/30">
                  <div className="text-xs text-blue-400 mb-1 font-medium">Stage</div>
                  <div className="text-lg font-bold text-white">{selectedFunEntry.stage}</div>
                </div>
              </div>

              {/* HP and Completion Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-900/50 p-3 rounded-lg border border-green-600/30">
                  <div className="text-xs text-green-400 mb-1 font-medium">❤️ HP Remaining</div>
                  <div className="text-lg font-bold text-green-300">
                    {selectedFunEntry.remaining_hp_percent ? `${selectedFunEntry.remaining_hp_percent.toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
                <div className="bg-purple-900/50 p-3 rounded-lg border border-orange-600/30">
                  <div className="text-xs text-orange-400 mb-1 font-medium">⏱️ Time</div>
                  <div className="text-lg font-bold text-orange-300">
                    {selectedFunEntry.completion_time_seconds 
                      ? `${Math.floor(selectedFunEntry.completion_time_seconds / 60)}:${(selectedFunEntry.completion_time_seconds % 60).toString().padStart(2, '0')}`
                      : 'N/A'
                    }
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-900/50 p-3 rounded-lg border border-purple-600/30">
                  <div className="text-xs text-purple-400 mb-1 font-medium">Period</div>
                  <div className="text-sm font-semibold text-white">{Number(selectedFunEntry.period)}</div>
                </div>
                <div className="bg-purple-900/50 p-3 rounded-lg border border-red-600/30">
                  <div className="text-xs text-red-400 mb-1 font-medium">Entry Time</div>
                  <div className="text-xs font-semibold text-white">
                    {new Date(selectedFunEntry.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Entry Badge */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <div className="bg-blue-900/50 border border-blue-600 px-4 py-2 rounded-lg">
                  <span className="text-blue-300 text-xs font-semibold">🎮 For Fun Entry</span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
