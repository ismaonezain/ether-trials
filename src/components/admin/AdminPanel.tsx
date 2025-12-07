'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, Shield, Trophy, AlertCircle, CheckCircle, Coins, Eye, Upload, X, ChevronDown, ChevronUp, RotateCcw, Megaphone, Trash2 } from 'lucide-react';
import { usePointBasedContract } from '@/hooks/usePointBasedContract';
import { PrizeDistribution } from '@/components/game/PrizeDistribution';
import { ScoreSubmissionPanel } from '@/components/admin/ScoreSubmissionPanel';
import { useSupabase } from '@/hooks/useSupabase';

interface AdminPanelProps {
  isOwner: boolean;
}

export function AdminPanel({ isOwner }: AdminPanelProps) {
  const { address } = useAccount();
  const {
    prizePoolInfo,
    allocatePrizes,
    withdrawPlatformFees,
    getPlatformBalance,
    canAllocate,
    currentPeriod,
  } = usePointBasedContract();
  const { prizePool, createAnnouncement, entries } = useSupabase();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  // isResetting state removed - reset functionality no longer needed with period-based system
  const [platformBalance, setPlatformBalance] = useState<bigint>(BigInt(0));
  const [showPrizeDistribution, setShowPrizeDistribution] = useState(false);
  const [showScoreSubmission, setShowScoreSubmission] = useState(false);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState<string>('');
  const [announcementMessage, setAnnouncementMessage] = useState<string>('');
  const [postToFarcaster, setPostToFarcaster] = useState<boolean>(false);
  const [status, setStatus] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  const platformBalanceEth = Number(platformBalance) / 1e18;

  // Fetch platform balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (isOwner && address) {
        try {
          const balance = await getPlatformBalance();
          setPlatformBalance(balance);
        } catch (error) {
          console.error('Error fetching platform balance:', error);
        }
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [isOwner, address, getPlatformBalance]);

  if (!isOwner) {
    return null;
  }

  const handleAllocatePrizes = async () => {
    setIsAllocating(true);
    setStatus({ type: 'loading', message: 'Initiating prize allocation...' });

    try {
      // Point-based system: prizes distributed proportionally based on scores submitted to contract
      setStatus({ 
        type: 'loading', 
        message: 'Allocating prizes based on player scores...' 
      });

      const result = await allocatePrizes();

      if (result.success) {
        setStatus({ 
          type: 'loading', 
          message: `Transaction submitted! Waiting for confirmation... (tx: ${result.hash?.slice(0, 10)}...)` 
        });
        
        // Wait a bit for blockchain confirmation
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        setStatus({ 
          type: 'success', 
          message: `Successfully allocated prizes! Period ${result.period}. Players can now claim their rewards.` 
        });
        
        setTimeout(() => setStatus({ type: 'idle', message: '' }), 5000);
      } else {
        setStatus({ type: 'error', message: result.error || 'Failed to allocate prizes' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus({ type: 'error', message: `Error: ${errorMessage}` });
    } finally {
      setIsAllocating(false);
    }
  };



  const handlePostAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      setStatus({ type: 'error', message: 'Title and message are required' });
      return;
    }

    setStatus({ type: 'loading', message: 'Posting announcement...' });

    try {
      // If posting to Farcaster, open Warpcast compose
      if (postToFarcaster) {
        const castText = `🎮 ${announcementTitle}\n\n${announcementMessage}\n\n#EtherTrials #Farcaster #BaseChain`;
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`;
        window.open(warpcastUrl, '_blank');
      }

      // Save to SpacetimeDB
      createAnnouncement(announcementTitle, announcementMessage, postToFarcaster);

      setStatus({
        type: 'success',
        message: postToFarcaster 
          ? 'Announcement saved! Warpcast compose window opened for posting to Farcaster.'
          : 'Announcement posted successfully!'
      });

      // Clear form
      setAnnouncementTitle('');
      setAnnouncementMessage('');
      setPostToFarcaster(false);
      setShowAnnouncementForm(false);

      setTimeout(() => setStatus({ type: 'idle', message: '' }), 5000);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus({ type: 'error', message: `Error: ${errorMessage}` });
    }
  };

  const handleWithdrawFees = async () => {
    setIsWithdrawing(true);
    setStatus({ type: 'loading', message: 'Initiating withdrawal transaction...' });

    try {
      const result = await withdrawPlatformFees();

      if (result.success) {
        setStatus({ 
          type: 'loading', 
          message: `Transaction submitted! Waiting for confirmation... (tx: ${result.hash?.slice(0, 10)}...)` 
        });
        
        // Wait a bit for blockchain confirmation
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        setStatus({ 
          type: 'success', 
          message: `Successfully withdrew ${result.amount} ETH platform fees!` 
        });
        
        const newBalance = await getPlatformBalance();
        setPlatformBalance(newBalance);
        setTimeout(() => setStatus({ type: 'idle', message: '' }), 5000);
      } else {
        setStatus({ type: 'error', message: result.error || 'Failed to withdraw fees' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus({ type: 'error', message: `Error: ${errorMessage}` });
    } finally {
      setIsWithdrawing(false);
    }
  };

  // handleResetFunEntries removed - free entries now use period-based system

  const canAllocateNow = canAllocate();

  // Toggle button when collapsed
  if (!isExpanded) {
    return (
      <>
        <button
          onClick={() => setIsExpanded(true)}
          className="fixed top-4 right-4 z-50 bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-2 border-yellow-400 rounded-full p-3 shadow-2xl shadow-purple-500/50 transition-all hover:scale-110 active:scale-95 animate-pulse"
          title="Open Admin Panel"
        >
          <Shield className="w-6 h-6 text-yellow-400" />
        </button>
        
        {/* Modals can still be triggered */}
        {showScoreSubmission && currentPeriod !== undefined && (
          <ScoreSubmissionPanel
            onClose={() => setShowScoreSubmission(false)}
            currentPeriod={Number(currentPeriod)}
            entries={entries}
          />
        )}
        {showPrizeDistribution && prizePool && (
          <PrizeDistribution
            totalPrizePool={prizePool.totalPoolAmount}
            currentPeriod={Number(prizePool.currentDistributionPeriod)}
            onClose={() => setShowPrizeDistribution(false)}
          />
        )}
      </>
    );
  }

  // Full panel when expanded
  return (
    <>
      <div className="fixed top-4 right-4 z-50 bg-gradient-to-br from-purple-900/98 to-indigo-900/98 backdrop-blur-md border-2 border-purple-500 rounded-lg shadow-2xl shadow-purple-500/30 w-full max-w-[95vw] md:max-w-md animate-in slide-in-from-top-5 duration-300">
        {/* Admin Header with Close Button */}
        <div className="flex items-center gap-2 p-3 pb-2 border-b border-purple-500/30">
          <Shield className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <h3 className="text-yellow-400 font-bold text-sm">ADMIN PANEL</h3>
          <span className="ml-auto text-xs text-purple-300">Owner</span>
          <button
            onClick={() => setIsExpanded(false)}
            className="ml-2 p-1 hover:bg-purple-700/50 rounded transition-colors"
            title="Minimize"
          >
            <X className="w-4 h-4 text-purple-300 hover:text-white" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="max-h-[calc(100vh-120px)] md:max-h-[600px] overflow-y-auto p-3 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/30 rounded p-2 border border-purple-500/20">
              <div className="text-xs text-purple-300 mb-1">Prize Pool</div>
              <div className="text-sm font-bold text-white">
                {prizePoolInfo ? `${prizePoolInfo.currentPool} ETH` : '...'}
              </div>
            </div>
            <div className="bg-black/30 rounded p-2 border border-purple-500/20">
              <div className="text-xs text-purple-300 mb-1">Participants</div>
              <div className="text-sm font-bold text-white">
                {prizePoolInfo ? prizePoolInfo.participants : '...'}
              </div>
            </div>
            <div className="bg-black/30 rounded p-2 border border-purple-500/20 col-span-2">
              <div className="text-xs text-purple-300 mb-1">Platform Balance</div>
              <div className="text-sm font-bold text-green-400">
                {platformBalanceEth.toFixed(5)} ETH
              </div>
            </div>
          </div>

          {/* Submit Scores Button */}
          <button
            onClick={() => setShowScoreSubmission(true)}
            className="w-full px-3 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/30"
          >
            <Upload className="w-4 h-4" />
            Submit Scores
          </button>

          {/* Allocate Prizes Button */}
          <button
            onClick={handleAllocatePrizes}
            disabled={isAllocating || !canAllocateNow}
            className={`w-full px-3 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              !canAllocateNow
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : isAllocating
                ? 'bg-purple-600 text-white cursor-wait'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/30'
            }`}
          >
            {isAllocating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Allocating...
              </>
            ) : !canAllocateNow ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Wait 24h
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4" />
                Allocate Prizes
              </>
            )}
          </button>

          {/* Withdraw Platform Fees Button */}
          <button
            onClick={handleWithdrawFees}
            disabled={isWithdrawing || platformBalanceEth === 0}
            className={`w-full px-3 py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              platformBalanceEth === 0
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : isWithdrawing
                ? 'bg-green-600 text-white cursor-wait'
                : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-500/30'
            }`}
          >
            {isWithdrawing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Withdrawing...
              </>
            ) : (
              <>
                <Coins className="w-4 h-4" />
                Withdraw Fees
              </>
            )}
          </button>

          {/* View Prize Distribution Button */}
          <button
            onClick={() => setShowPrizeDistribution(true)}
            className="w-full px-3 py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/30"
          >
            <Eye className="w-4 h-4" />
            View Distribution
          </button>



          {/* Reset Free Entry Button removed - free entries now use period-based system like paid entries */}

          {/* Post Announcement Button */}
          <button
            onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}
            className="w-full px-3 py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-600 to-amber-600 text-white hover:from-yellow-500 hover:to-amber-500 shadow-lg shadow-yellow-500/30"
          >
            <Megaphone className="w-4 h-4" />
            {showAnnouncementForm ? 'Cancel' : 'Post Announcement'}
          </button>

          {/* Announcement Form */}
          {showAnnouncementForm && (
            <div className="bg-black/30 rounded-lg p-3 border border-yellow-500/30 space-y-3">
              <div>
                <label className="text-xs text-yellow-300 mb-1 block">Title</label>
                <input
                  type="text"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="Announcement title..."
                  className="w-full px-2 py-1.5 bg-black/50 border border-purple-500/30 rounded text-white text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>
              <div>
                <label className="text-xs text-yellow-300 mb-1 block">Message</label>
                <textarea
                  value={announcementMessage}
                  onChange={(e) => setAnnouncementMessage(e.target.value)}
                  placeholder="Announcement message..."
                  rows={3}
                  className="w-full px-2 py-1.5 bg-black/50 border border-purple-500/30 rounded text-white text-sm focus:outline-none focus:border-yellow-400 resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="postToFarcaster"
                  checked={postToFarcaster}
                  onChange={(e) => setPostToFarcaster(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="postToFarcaster" className="text-xs text-purple-300">
                  Post to Farcaster (opens Warpcast)
                </label>
              </div>
              <button
                onClick={handlePostAnnouncement}
                className="w-full px-3 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-600 to-amber-600 text-white hover:from-yellow-500 hover:to-amber-500"
              >
                <Megaphone className="w-4 h-4" />
                Post Announcement
              </button>
            </div>
          )}

          {/* Status Messages */}
          {status.type !== 'idle' && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                status.type === 'loading'
                  ? 'bg-blue-900/30 border border-blue-500/30 text-blue-200'
                  : status.type === 'success'
                  ? 'bg-green-900/30 border border-green-500/30 text-green-200'
                  : 'bg-red-900/30 border border-red-500/30 text-red-200'
              }`}
            >
              {status.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 mt-0.5" />}
              {status.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {status.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span className="flex-1">{status.message}</span>
            </div>
          )}

          {/* Info */}
          <div className="pt-2 border-t border-purple-500/30 text-xs text-purple-300 space-y-1">
            <p>• Submit scores before allocating</p>
            <p>• Allocate prizes every 24 hours</p>
            <p>• Withdraw platform fees anytime</p>
            <p>• Free entries persist per period (no reset needed)</p>
          </div>
        </div>
      </div>

      {/* Score Submission Modal */}
      {showScoreSubmission && currentPeriod !== undefined && (
        <ScoreSubmissionPanel
          onClose={() => setShowScoreSubmission(false)}
          currentPeriod={Number(currentPeriod)}
          entries={entries}
        />
      )}

      {/* Prize Distribution Modal */}
      {showPrizeDistribution && prizePool && (
        <PrizeDistribution
          totalPrizePool={prizePool.totalPoolAmount}
          currentPeriod={Number(prizePool.currentDistributionPeriod)}
          onClose={() => setShowPrizeDistribution(false)}
        />
      )}
    </>
  );
}
