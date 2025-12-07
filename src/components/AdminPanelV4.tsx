'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { usePointBasedContractV4 } from '@/hooks/usePointBasedContractV4';
import { useSupabase } from '@/hooks/useSupabase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2, Trophy, Users, Coins, Settings, Download } from 'lucide-react';
import { parseEther, formatEther } from 'viem';
import type { Address } from 'viem';

export function AdminPanelV4() {
  const { address } = useAccount();
  const { 
    prizePoolInfo,
    currentPeriod,
    checkIsOwner,
    submitScoresBatch,
    allocatePrizes,
    withdrawPlatformFees,
    setEntryBounds,
    minEntry,
    maxEntry,
    isPending,
    isConfirming,
    isConfirmed,
    error,
    refetchPrizePoolInfo
  } = usePointBasedContractV4();

  const { entries, freeEntries, connected, clearAllEntries } = useSupabase();

  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [batchStatus, setBatchStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [lastAction, setLastAction] = useState('');
  const [newMinEntry, setNewMinEntry] = useState('');
  const [newMaxEntry, setNewMaxEntry] = useState('');
  const [defaultAddresses, setDefaultAddresses] = useState('');
  const [defaultScore, setDefaultScore] = useState('50000');

  // Check admin access
  const isOwner = checkIsOwner(address);

  // Update min/max entry fields when contract data loads
  useEffect(() => {
    if (minEntry) setNewMinEntry(formatEther(minEntry));
    if (maxEntry) setNewMaxEntry(formatEther(maxEntry));
  }, [minEntry, maxEntry]);

  // Watch for transaction confirmation
  useEffect(() => {
    if (isConfirmed && batchStatus === 'processing') {
      setBatchStatus('success');
      setTimeout(() => {
        setBatchStatus('idle');
        refetchPrizePoolInfo();
      }, 3000);
    }
  }, [isConfirmed, batchStatus, refetchPrizePoolInfo]);

  // Watch for errors
  useEffect(() => {
    if (error && batchStatus === 'processing') {
      setBatchStatus('error');
      console.error('Transaction error:', error);
    }
  }, [error, batchStatus]);

  if (!isOwner) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-white font-bold text-lg">Access Denied</p>
        <p className="text-gray-400 text-sm mt-1">Only contract owner can access admin panel</p>
      </div>
    );
  }

  // Get current period entries from Supabase
  const currentPeriodNumber = currentPeriod ? Number(currentPeriod) : 0;
  const periodEntries = entries?.filter((e: { period: number }) => e.period === currentPeriodNumber) || [];
  const periodFunEntries = freeEntries?.filter((e: { period: number }) => e.period === currentPeriodNumber) || [];

  // Handle Batch Score Submission
  const handleBatchSubmit = async () => {
    if (!periodEntries || periodEntries.length === 0) {
      alert('No entries found for current period');
      return;
    }

    try {
      setBatchStatus('processing');
      setLastAction('Batch score submission');

      // Get unique entries by wallet address (take highest score per wallet)
      // Also apply multiplier: weighted_score = score × (entry_amount / 1 ETH)
      type EntryType = {
        wallet_address: string;
        score: number;
        entry_amount?: number; // in wei
      };

      const uniqueEntries = new Map<string, number>();
      periodEntries.forEach((entry: EntryType) => {
        const wallet = entry.wallet_address?.toLowerCase();
        if (wallet && wallet !== '' && wallet !== '0x') {
          const baseScore = Number(entry.score) || 0;
          
          // Apply multiplier: score × (entry_amount / 1 ETH)
          const entryAmountWei = entry.entry_amount || 20000000000000; // default 0.00002 ETH in wei
          const entryAmountETH = entryAmountWei / 1e18;
          const multiplier = entryAmountETH / 1.0; // entry_amount / 1 ETH
          const weightedScore = Math.floor(baseScore * multiplier);
          
          console.log('💰 Wallet:', wallet.slice(0, 10), '| Base:', baseScore, '| Entry:', entryAmountETH, 'ETH | Weighted:', weightedScore);
          
          const currentScore = uniqueEntries.get(wallet) || 0;
          if (weightedScore > currentScore) {
            uniqueEntries.set(wallet, weightedScore);
          }
        }
      });

      if (uniqueEntries.size === 0) {
        alert('No valid wallet addresses found in entries');
        setBatchStatus('idle');
        return;
      }

      const players: Address[] = Array.from(uniqueEntries.keys()) as Address[];
      const scores: bigint[] = Array.from(uniqueEntries.values()).map(s => BigInt(s));

      console.log('📊 Batch submitting weighted scores:', { 
        period: currentPeriodNumber,
        playerCount: players.length,
        note: 'Scores are weighted by entry amount (score × entry_amount / 1 ETH)',
        players: players.slice(0, 5).map((p, i) => ({ address: p, weighted_score: scores[i].toString() }))
      });

      await submitScoresBatch(players, scores);
    } catch (err) {
      console.error('Batch submit failed:', err);
      setBatchStatus('error');
      setTimeout(() => setBatchStatus('idle'), 3000);
    }
  };

  // Handle Prize Allocation
  const handleAllocatePrizes = async () => {
    if (!currentPeriod) return;
    
    try {
      setBatchStatus('processing');
      setLastAction('Prize allocation');
      await allocatePrizes(currentPeriod);
    } catch (err) {
      console.error('Allocate prizes failed:', err);
      setBatchStatus('error');
      setTimeout(() => setBatchStatus('idle'), 3000);
    }
  };

  // Handle Platform Fee Withdrawal
  const handleWithdrawFees = async () => {
    try {
      setBatchStatus('processing');
      setLastAction('Platform fee withdrawal');
      await withdrawPlatformFees();
    } catch (err) {
      console.error('Withdraw fees failed:', err);
      setBatchStatus('error');
      setTimeout(() => setBatchStatus('idle'), 3000);
    }
  };

  // Handle Entry Bounds Update
  const handleUpdateBounds = async () => {
    if (!newMinEntry || !newMaxEntry) {
      alert('Please enter valid min and max entry amounts');
      return;
    }

    try {
      const minWei = parseEther(newMinEntry);
      const maxWei = parseEther(newMaxEntry);

      if (minWei <= BigInt(0) || maxWei < minWei) {
        alert('Invalid bounds: min must be > 0 and max must be >= min');
        return;
      }

      setBatchStatus('processing');
      setLastAction('Entry bounds update');
      await setEntryBounds(minWei, maxWei);
    } catch (err) {
      console.error('Update bounds failed:', err);
      setBatchStatus('error');
      setTimeout(() => setBatchStatus('idle'), 3000);
    }
  };

  // Export leaderboard data
  const handleExportLeaderboard = () => {
    if (!periodEntries || periodEntries.length === 0) {
      alert('No entries to export');
      return;
    }

    type EntryExportType = {
      username: string;
      wallet_address: string;
      score: number;
      class_name: string;
      timestamp: string;
    };

    const csvData = periodEntries
      .map((entry: EntryExportType) => ({
        username: entry.username || 'Unknown',
        wallet: entry.wallet_address || 'N/A',
        score: Number(entry.score) || 0,
        class: entry.class_name || 'N/A',
        timestamp: entry.timestamp || new Date().toISOString()
      }))
      .sort((a, b) => b.score - a.score);

    const csv = [
      ['Rank', 'Username', 'Wallet', 'Score', 'Class', 'Timestamp'].join(','),
      ...csvData.map((row, i) => 
        [i + 1, row.username, row.wallet, row.score, row.class, row.timestamp].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaderboard-period-${currentPeriodNumber}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle Default Score Submission for addresses without scores
  const handleSubmitDefaultScores = async () => {
    if (!defaultAddresses.trim()) {
      alert('Please enter at least one wallet address');
      return;
    }

    if (!defaultScore || Number(defaultScore) <= 0) {
      alert('Please enter a valid default score (greater than 0)');
      return;
    }

    try {
      setBatchStatus('processing');
      setLastAction('Default score submission');

      // Parse addresses (support comma, space, or newline separated)
      const addressList = defaultAddresses
        .split(/[,\s\n]+/)
        .map(addr => addr.trim().toLowerCase())
        .filter(addr => addr.startsWith('0x') && addr.length === 42);

      if (addressList.length === 0) {
        alert('No valid Ethereum addresses found. Addresses must start with 0x and be 42 characters long.');
        setBatchStatus('idle');
        return;
      }

      // Check which addresses already have scores in current period
      type EntryType = {
        wallet_address: string;
      };

      const existingAddresses = new Set(
        periodEntries.map((e: EntryType) => e.wallet_address?.toLowerCase())
      );

      // Filter out addresses that already have scores
      const newAddresses = addressList.filter(addr => !existingAddresses.has(addr));

      if (newAddresses.length === 0) {
        alert(`All ${addressList.length} addresses already have scores in period ${currentPeriodNumber}.`);
        setBatchStatus('idle');
        return;
      }

      // Prepare batch submission
      const players: Address[] = newAddresses as Address[];
      const scores: bigint[] = newAddresses.map(() => BigInt(defaultScore));

      const confirmed = window.confirm(
        `📊 Default Score Submission\n\n` +
        `Total addresses: ${addressList.length}\n` +
        `Already have scores: ${addressList.length - newAddresses.length}\n` +
        `Will receive default score: ${newAddresses.length}\n` +
        `Default score: ${Number(defaultScore).toLocaleString()}\n\n` +
        `Continue?`
      );

      if (!confirmed) {
        setBatchStatus('idle');
        return;
      }

      console.log('📊 Submitting default scores:', { 
        period: currentPeriodNumber,
        playerCount: players.length,
        defaultScore: defaultScore,
        players: players.slice(0, 5)
      });

      await submitScoresBatch(players, scores);

      // Clear form on success
      setDefaultAddresses('');
    } catch (err) {
      console.error('Default score submission failed:', err);
      setBatchStatus('error');
      setTimeout(() => setBatchStatus('idle'), 3000);
    }
  };

  // Handle Clear Leaderboard
  const handleClearLeaderboard = () => {
    const totalEntries = (entries?.length || 0) + (freeEntries?.length || 0);
    
    if (totalEntries === 0) {
      alert('Leaderboard is already empty');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ WARNING: This will permanently delete ALL ${totalEntries} entries (${entries?.length || 0} paid, ${freeEntries?.length || 0} free) from the leaderboard across ALL periods!\n\nThis action CANNOT be undone. Are you sure?`
    );

    if (!confirmed) return;

    try {
      clearAllEntries();
      alert(`✅ Leaderboard cleared! ${totalEntries} entries removed.`);
    } catch (err) {
      console.error('Clear leaderboard failed:', err);
      alert('❌ Failed to clear leaderboard. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-400" />
            Admin Panel V4
          </h2>
          <p className="text-gray-400 text-sm mt-1">Pure ETH Economy • Commit-Reveal • Batch Operations</p>
        </div>
        <Badge variant="outline" className="bg-green-600/20 text-green-400 border-green-500">
          Period {currentPeriodNumber}
        </Badge>
      </div>

      {/* Status Bar */}
      {(isPending || isConfirming || batchStatus !== 'idle') && (
        <Card className="border-yellow-500/50 bg-yellow-900/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              {batchStatus === 'processing' || isPending || isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                  <div className="flex-1">
                    <p className="text-yellow-400 font-semibold text-sm">
                      {isConfirming ? 'Confirming transaction...' : 'Processing...'}
                    </p>
                    {lastAction && (
                      <p className="text-yellow-200 text-xs">{lastAction}</p>
                    )}
                  </div>
                </>
              ) : batchStatus === 'success' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <p className="text-green-400 font-semibold text-sm">Transaction confirmed!</p>
                </>
              ) : batchStatus === 'error' ? (
                <>
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <div className="flex-1">
                    <p className="text-red-400 font-semibold text-sm">Transaction failed</p>
                    {error && <p className="text-red-200 text-xs">{error.message}</p>}
                  </div>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 bg-purple-900/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Prize Pool Stats */}
          <Card className="border-purple-500/50 bg-gradient-to-br from-purple-900/50 to-blue-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-400">
                <Trophy className="w-5 h-5" />
                Prize Pool Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/30 p-3 rounded-lg border border-yellow-600/30">
                  <p className="text-gray-400 text-xs mb-1">Current Pool</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {prizePoolInfo?.currentPool || '0'} ETH
                  </p>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-purple-600/30">
                  <p className="text-gray-400 text-xs mb-1">Platform Balance</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {prizePoolInfo?.platformBalance || '0'} ETH
                  </p>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-blue-600/30">
                  <p className="text-gray-400 text-xs mb-1">Participants</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {prizePoolInfo?.participants || 0}
                  </p>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-green-600/30">
                  <p className="text-gray-400 text-xs mb-1">Total Points</p>
                  <p className="text-2xl font-bold text-green-400">
                    {prizePoolInfo?.totalPoints?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>

              {/* Period Info */}
              <div className="bg-black/30 p-3 rounded-lg border border-gray-600/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-400 text-xs">Period Status</p>
                  <Badge variant={prizePoolInfo?.distributed ? 'secondary' : 'default'}>
                    {prizePoolInfo?.distributed ? 'Distributed' : 'Active'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Start Time</p>
                    <p className="text-gray-300">{prizePoolInfo?.startTime?.toLocaleString() || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">End Time</p>
                    <p className="text-gray-300">{prizePoolInfo?.endTime?.toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Entry Bounds */}
              <div className="bg-black/30 p-3 rounded-lg border border-gray-600/30">
                <p className="text-gray-400 text-xs mb-2">Entry Bounds</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Min: <span className="text-yellow-400 font-mono">{minEntry ? formatEther(minEntry) : '0'} ETH</span></span>
                  <span className="text-gray-300">Max: <span className="text-yellow-400 font-mono">{maxEntry ? formatEther(maxEntry) : '0'} ETH</span></span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database Stats */}
          <Card className="border-blue-500/50 bg-gradient-to-br from-blue-900/50 to-purple-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Users className="w-5 h-5" />
                Database Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/30 p-3 rounded-lg border border-yellow-600/30">
                  <p className="text-gray-400 text-xs mb-1">Paid Entries (Period)</p>
                  <p className="text-2xl font-bold text-yellow-400">{periodEntries.length}</p>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-green-600/30">
                  <p className="text-gray-400 text-xs mb-1">Free Entries (Period)</p>
                  <p className="text-2xl font-bold text-green-400">{periodFunEntries.length}</p>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-purple-600/30">
                  <p className="text-gray-400 text-xs mb-1">Total Paid (All Time)</p>
                  <p className="text-2xl font-bold text-purple-400">{entries?.length || 0}</p>
                </div>
                <div className="bg-black/30 p-3 rounded-lg border border-blue-600/30">
                  <p className="text-gray-400 text-xs mb-1">Total Free (All Time)</p>
                  <p className="text-2xl font-bold text-blue-400">{freeEntries?.length || 0}</p>
                </div>
              </div>

              {/* Connection Status */}
              <div className="bg-black/30 p-2 rounded-lg border border-gray-600/30">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Database Status</span>
                  <Badge variant={connected ? 'default' : 'secondary'}>
                    {connected ? '🟢 Connected' : '🔴 Disconnected'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-yellow-500/50 bg-gradient-to-br from-yellow-900/20 to-orange-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-400">
                <Coins className="w-5 h-5" />
                Admin Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={handleWithdrawFees}
                disabled={isPending || isConfirming || !prizePoolInfo?.platformBalanceRaw || prizePoolInfo.platformBalanceRaw === BigInt(0)}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
              >
                <Coins className="w-4 h-4 mr-2" />
                Withdraw Platform Fees ({prizePoolInfo?.platformBalance || '0'} ETH)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scores Tab */}
        <TabsContent value="scores" className="space-y-4">
          <Card className="border-green-500/50 bg-gradient-to-br from-green-900/20 to-emerald-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-400">
                <Trophy className="w-5 h-5" />
                Score Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3">
                <p className="text-sm text-blue-200 mb-2">
                  <strong>Batch Score Submission</strong>
                </p>
                <p className="text-xs text-blue-300 mb-3">
                  This will submit <strong>weighted scores</strong> from Supabase to the smart contract for the current period.
                  Formula: <code>weighted_score = score × (entry_amount / 1 ETH)</code>
                </p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Period {currentPeriodNumber} Entries:</span>
                  <Badge variant="outline" className="bg-yellow-600/20 text-yellow-400">
                    {periodEntries.length} players
                  </Badge>
                </div>
                <Button
                  onClick={handleBatchSubmit}
                  disabled={isPending || isConfirming || periodEntries.length === 0}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                >
                  {isPending || isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Submit Batch Scores
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-cyan-900/30 border border-cyan-500/30 rounded-lg p-3">
                <p className="text-sm text-cyan-200 mb-2">
                  <strong>Submit Default Scores</strong>
                </p>
                <p className="text-xs text-cyan-300 mb-3">
                  Submit a default score for addresses that don't have scores yet. This helps fulfill the "No scores submitted yet" requirement for prize allocation.
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Wallet Addresses (comma or newline separated)</label>
                    <textarea
                      value={defaultAddresses}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDefaultAddresses(e.target.value)}
                      placeholder="0x123...&#10;0x456...&#10;0x789..."
                      className="w-full h-24 bg-purple-900/50 border border-purple-500/50 text-white rounded px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Default Score</label>
                    <Input
                      type="number"
                      value={defaultScore}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDefaultScore(e.target.value)}
                      placeholder="50000"
                      className="bg-purple-900/50 border-purple-500/50 text-white"
                    />
                  </div>
                  <div className="bg-purple-900/30 border border-purple-500/30 rounded p-2">
                    <p className="text-xs text-purple-300">
                      💡 <strong>Tip:</strong> Only addresses without existing scores will receive the default score. Addresses already in the leaderboard will be skipped.
                    </p>
                  </div>
                  <Button
                    onClick={handleSubmitDefaultScores}
                    disabled={isPending || isConfirming || !defaultAddresses.trim() || !defaultScore}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
                  >
                    {isPending || isConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Submit Default Scores ({defaultScore})
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-sm text-yellow-200 mb-2">
                  <strong>Allocate Prizes</strong>
                </p>
                <p className="text-xs text-yellow-300 mb-3">
                  Distribute ETH proportionally based on player scores. This ends the current period and opens the next one.
                </p>
                
                {/* Reveal Window Status */}
                {prizePoolInfo && prizePoolInfo.timeUntilCanAllocate > 0 && (
                  <div className="bg-blue-900/30 border border-blue-500/30 rounded p-2 mb-3">
                    <p className="text-xs text-blue-200 mb-1">⏳ Reveal Window Active</p>
                    <p className="text-xs text-blue-300">
                      Waiting for reveal window (20 min after period ends)
                    </p>
                    <p className="text-sm font-mono text-blue-400 mt-1">
                      {Math.floor(prizePoolInfo.timeUntilCanAllocate / 60)}m {prizePoolInfo.timeUntilCanAllocate % 60}s remaining
                    </p>
                  </div>
                )}

                {/* Requirements Status */}
                {prizePoolInfo && !prizePoolInfo.canDistribute && prizePoolInfo.timeUntilCanAllocate === 0 && (
                  <div className="bg-red-900/30 border border-red-500/30 rounded p-2 mb-3">
                    <p className="text-xs text-red-200 mb-1">⚠️ Requirements Not Met</p>
                    <ul className="text-xs text-red-300 space-y-1">
                      {prizePoolInfo.distributed && <li>• Period already distributed</li>}
                      {prizePoolInfo.totalPoints === 0 && <li>• No scores submitted yet</li>}
                      {Number(prizePoolInfo.currentPoolRaw) === 0 && <li>• No prize pool available</li>}
                    </ul>
                  </div>
                )}
                
                <Button
                  onClick={handleAllocatePrizes}
                  disabled={isPending || isConfirming || !prizePoolInfo?.canDistribute}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500"
                >
                  {isPending || isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4 mr-2" />
                      Allocate Prizes for Period {currentPeriodNumber}
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-3">
                <p className="text-sm text-purple-200 mb-2">
                  <strong>Export Leaderboard</strong>
                </p>
                <p className="text-xs text-purple-300 mb-3">
                  Download leaderboard data as CSV for period {currentPeriodNumber}.
                </p>
                <Button
                  onClick={handleExportLeaderboard}
                  disabled={periodEntries.length === 0}
                  variant="outline"
                  className="w-full border-purple-500 text-purple-300 hover:bg-purple-900/50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV ({periodEntries.length} entries)
                </Button>
              </div>

              <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-200 mb-2">
                  <strong>⚠️ Clear Leaderboard</strong>
                </p>
                <p className="text-xs text-red-300 mb-3">
                  Permanently delete ALL entries from the leaderboard (paid and free, all periods). This action cannot be undone!
                </p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Total Entries (All Time):</span>
                  <Badge variant="outline" className="bg-red-600/20 text-red-400">
                    {(entries?.length || 0) + (freeEntries?.length || 0)} entries
                  </Badge>
                </div>
                <Button
                  onClick={handleClearLeaderboard}
                  disabled={!connected || ((entries?.length || 0) + (freeEntries?.length || 0)) === 0}
                  variant="destructive"
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Clear All Leaderboard Entries
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="border-purple-500/50 bg-gradient-to-br from-purple-900/20 to-blue-900/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <Settings className="w-5 h-5" />
                Contract Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-sm text-yellow-200 mb-3">
                  <strong>Update Entry Bounds</strong>
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Minimum Entry (ETH)</label>
                    <Input
                      type="number"
                      step="0.00001"
                      value={newMinEntry}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMinEntry(e.target.value)}
                      placeholder="0.00002"
                      className="bg-purple-900/50 border-purple-500/50 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Maximum Entry (ETH)</label>
                    <Input
                      type="number"
                      step="0.00001"
                      value={newMaxEntry}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMaxEntry(e.target.value)}
                      placeholder="1"
                      className="bg-purple-900/50 border-purple-500/50 text-white"
                    />
                  </div>
                  <Button
                    onClick={handleUpdateBounds}
                    disabled={isPending || isConfirming}
                    className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500"
                  >
                    {isPending || isConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Settings className="w-4 h-4 mr-2" />
                        Update Bounds
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-gray-900/30 border border-gray-500/30 rounded-lg p-3">
                <p className="text-sm text-gray-300 mb-2">
                  <strong>Contract Information</strong>
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Contract:</span>
                    <span className="text-gray-300 font-mono">0xae90C170...270001A</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Owner:</span>
                    <span className="text-gray-300 font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Version:</span>
                    <span className="text-gray-300">V4 (Pure ETH)</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
