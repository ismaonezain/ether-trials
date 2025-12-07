'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Loader2, Shield, Trophy, AlertCircle, CheckCircle, Coins, X, Megaphone } from 'lucide-react';
import { useTRIAContractV4 } from '@/hooks/useTRIAContractv4';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { useSpacetimeDB } from '@/hooks/useSpacetimeDB';
import { formatEther, type Address } from 'viem';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ETHER_TRIALS_TRIA_V4_ABI, CONTRACT_ADDRESSES_V4 } from '@/lib/contracts/etherTrialsTRIAv4ABI';

interface AdminPanelV4Props {
  isOwner: boolean;
}

// CRITICAL FIX: Split into button and content to prevent RPC crash in Farcaster
// AdminButton renders ONLY the collapsed button - NO HOOKS, NO RPC CALLS
// AdminContent renders full panel with hooks - ONLY when expanded
export function AdminPanelV4({ isOwner }: AdminPanelV4Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Early return if not owner - prevent any rendering
  if (!isOwner) {
    return null;
  }

  // Collapsed button - NO HOOKS, NO RPC CALLS
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed top-4 right-4 z-50 bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-2 border-yellow-400 rounded-full p-3 shadow-2xl shadow-purple-500/50 transition-all hover:scale-110 active:scale-95 animate-pulse"
        title="Open Admin Panel V4"
      >
        <Shield className="w-6 h-6 text-yellow-400" />
      </button>
    );
  }

  // Expanded panel - LAZY LOAD AdminContent with hooks
  return <AdminContentExpanded onClose={() => setIsExpanded(false)} />;
}

// AdminContent - ONLY rendered when expanded
// Contains all hooks and RPC calls
function AdminContentExpanded({ onClose }: { onClose: () => void }) {
  const { address } = useAccount();
  const { fid } = useFarcasterProfile();
  const {
    currentPeriod,
    periodInfo,
    balances,
    refetchAll,
  } = useTRIAContractV4(fid);
  const { createAnnouncement } = useSpacetimeDB();
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isWithdrawingTreasury, setIsWithdrawingTreasury] = useState(false);
  const [isWithdrawingBuyback, setIsWithdrawingBuyback] = useState(false);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState<string>('');
  const [announcementMessage, setAnnouncementMessage] = useState<string>('');
  const [postToFarcaster, setPostToFarcaster] = useState<boolean>(false);
  const [status, setStatus] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const contractAddress = CONTRACT_ADDRESSES_V4.base.etherTrialsTRIAv4 as Address;

  // Auto refetch on transaction success
  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => refetchAll(), 2000);
    }
  }, [isSuccess, refetchAll]);

  const handleFinalizePeriod = async () => {
    if (!currentPeriod) {
      setStatus({ type: 'error', message: 'Period not loaded' });
      return;
    }

    setIsFinalizing(true);
    setStatus({ type: 'loading', message: 'Finalizing period...' });

    try {
      // Ensure currentPeriod is BigInt
      const periodToFinalize = typeof currentPeriod === 'bigint' ? currentPeriod : BigInt(currentPeriod);
      
      console.log('🏁 Finalizing period:', periodToFinalize.toString());
      
      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V4_ABI,
        functionName: 'finalizePeriod',
        args: [periodToFinalize],
      });

      setStatus({ 
        type: 'loading', 
        message: `Transaction submitted! Waiting for confirmation...` 
      });
    } catch (error: unknown) {
      console.error('❌ Finalize error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus({ type: 'error', message: `Error: ${errorMessage}` });
      setIsFinalizing(false);
    }
  };

  const handleWithdrawTreasury = async () => {
    setIsWithdrawingTreasury(true);
    setStatus({ type: 'loading', message: 'Withdrawing treasury ETH...' });

    try {
      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V4_ABI,
        functionName: 'withdrawTreasury',
      });

      setStatus({ 
        type: 'loading', 
        message: `Transaction submitted! Waiting for confirmation...` 
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus({ type: 'error', message: `Error: ${errorMessage}` });
      setIsWithdrawingTreasury(false);
    }
  };

  const handleWithdrawBuyback = async () => {
    setIsWithdrawingBuyback(true);
    setStatus({ type: 'loading', message: 'Withdrawing buyback TRIA...' });

    try {
      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V4_ABI,
        functionName: 'withdrawBuyback',
      });

      setStatus({ 
        type: 'loading', 
        message: `Transaction submitted! Waiting for confirmation...` 
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setStatus({ type: 'error', message: `Error: ${errorMessage}` });
      setIsWithdrawingBuyback(false);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      setStatus({ type: 'error', message: 'Title and message are required' });
      return;
    }

    setStatus({ type: 'loading', message: 'Posting announcement...' });

    try {
      if (postToFarcaster) {
        const castText = `🎮 ${announcementTitle}\n\n${announcementMessage}\n\n#EtherTrials #Farcaster #BaseChain`;
        const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}`;
        window.open(warpcastUrl, '_blank');
      }

      createAnnouncement(announcementTitle, announcementMessage, postToFarcaster);

      setStatus({
        type: 'success',
        message: postToFarcaster 
          ? 'Announcement saved! Warpcast compose window opened.'
          : 'Announcement posted successfully!'
      });

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

  // Handle success states
  useEffect(() => {
    if (isSuccess && status.type === 'loading') {
      if (isFinalizing) {
        setStatus({ type: 'success', message: '✓ Period finalized successfully!' });
        setIsFinalizing(false);
      } else if (isWithdrawingTreasury) {
        setStatus({ type: 'success', message: '✓ Treasury withdrawn successfully!' });
        setIsWithdrawingTreasury(false);
      } else if (isWithdrawingBuyback) {
        setStatus({ type: 'success', message: '✓ Buyback TRIA withdrawn successfully!' });
        setIsWithdrawingBuyback(false);
      }
      setTimeout(() => setStatus({ type: 'idle', message: '' }), 5000);
    }
  }, [isSuccess, isFinalizing, isWithdrawingTreasury, isWithdrawingBuyback, status.type]);

  const canFinalize = periodInfo && !periodInfo.finalized && periodInfo.timeRemaining <= 0;
  const treasuryBalance = balances ? formatEther(balances.treasury) : '0';
  const buybackBalance = balances ? formatEther(balances.buybackTRIA) : '0';
  const triaPool = periodInfo ? formatEther(periodInfo.triaPool) : '0';

  // Full panel when expanded
  return (
    <div className="fixed top-4 right-4 z-50 bg-gradient-to-br from-purple-900/98 to-indigo-900/98 backdrop-blur-md border-2 border-purple-500 rounded-lg shadow-2xl shadow-purple-500/30 w-full max-w-[95vw] md:max-w-md animate-in slide-in-from-top-5 duration-300">
      {/* Admin Header with Close Button */}
      <div className="flex items-center gap-2 p-3 pb-2 border-b border-purple-500/30">
        <Shield className="w-5 h-5 text-yellow-400 flex-shrink-0" />
        <h3 className="text-yellow-400 font-bold text-sm">ADMIN PANEL V4</h3>
        <span className="ml-auto text-xs text-purple-300">Owner</span>
        <button
          onClick={onClose}
          className="ml-2 p-1 hover:bg-purple-700/50 rounded transition-colors"
          title="Minimize"
        >
          <X className="w-4 h-4 text-purple-300 hover:text-white" />
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="max-h-[calc(100vh-120px)] md:max-h-[600px] overflow-y-auto p-3 space-y-3">
        {/* Contract Info */}
        <div className="bg-black/40 rounded p-2 border border-yellow-500/30 mb-2">
          <div className="text-xs text-yellow-300 mb-1">Contract Address (TRIAv4)</div>
          <div className="text-[10px] font-mono text-white break-all">
            {contractAddress}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-black/30 rounded p-2 border border-purple-500/20">
            <div className="text-xs text-purple-300 mb-1">TRIA Pool</div>
            <div className="text-sm font-bold text-white flex items-center gap-1">
              <Coins className="w-3 h-3" />
              {parseFloat(triaPool).toFixed(2)}
            </div>
          </div>
          <div className="bg-black/30 rounded p-2 border border-purple-500/20">
            <div className="text-xs text-purple-300 mb-1">Period</div>
            <div className="text-sm font-bold text-white">
              #{currentPeriod?.toString()}
            </div>
          </div>
          <div className="bg-black/30 rounded p-2 border border-purple-500/20">
            <div className="text-xs text-purple-300 mb-1">Treasury ETH</div>
            <div className="text-sm font-bold text-green-400">
              {parseFloat(treasuryBalance).toFixed(5)}
            </div>
          </div>
          <div className="bg-black/30 rounded p-2 border border-purple-500/20">
            <div className="text-xs text-purple-300 mb-1">Buyback TRIA</div>
            <div className="text-sm font-bold text-blue-400">
              {parseFloat(buybackBalance).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Period Status */}
        {periodInfo && (
          <div className={`p-2 rounded border text-xs ${
            periodInfo.finalized 
              ? 'bg-green-900/30 border-green-500/50 text-green-300'
              : 'bg-blue-900/30 border-blue-500/50 text-blue-300'
          }`}>
            {periodInfo.finalized ? '✓ Period Finalized' : '⏳ Period Active'}
          </div>
        )}

        {/* Finalize Period Button */}
        <button
          onClick={handleFinalizePeriod}
          disabled={!canFinalize || isFinalizing || isPending || isConfirming}
          className={`w-full px-3 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            !canFinalize
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : isFinalizing || isPending || isConfirming
              ? 'bg-purple-600 text-white cursor-wait'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/30'
          }`}
        >
          {isFinalizing || isPending || isConfirming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Finalizing...
            </>
          ) : !canFinalize ? (
            <>
              <AlertCircle className="w-4 h-4" />
              Period Not Ended
            </>
          ) : (
            <>
              <Trophy className="w-4 h-4" />
              Finalize Period
            </>
          )}
        </button>

        {/* Withdraw Treasury Button */}
        <button
          onClick={handleWithdrawTreasury}
          disabled={isWithdrawingTreasury || isPending || isConfirming || parseFloat(treasuryBalance) === 0}
          className={`w-full px-3 py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            parseFloat(treasuryBalance) === 0
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : isWithdrawingTreasury || isPending || isConfirming
              ? 'bg-green-600 text-white cursor-wait'
              : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-500/30'
          }`}
        >
          {isWithdrawingTreasury || (isPending && isWithdrawingTreasury) || (isConfirming && isWithdrawingTreasury) ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Withdrawing...
            </>
          ) : (
            <>
              <Coins className="w-4 h-4" />
              Withdraw Treasury
            </>
          )}
        </button>

        {/* Withdraw Buyback Button */}
        <button
          onClick={handleWithdrawBuyback}
          disabled={isWithdrawingBuyback || isPending || isConfirming || parseFloat(buybackBalance) === 0}
          className={`w-full px-3 py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            parseFloat(buybackBalance) === 0
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : isWithdrawingBuyback || isPending || isConfirming
              ? 'bg-blue-600 text-white cursor-wait'
              : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/30'
          }`}
        >
          {isWithdrawingBuyback || (isPending && isWithdrawingBuyback) || (isConfirming && isWithdrawingBuyback) ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Withdrawing...
            </>
          ) : (
            <>
              <Coins className="w-4 h-4" />
              Withdraw Buyback
            </>
          )}
        </button>

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
          <p>• Period 0 auto-created at deployment</p>
          <p>• New period auto-created after finalize</p>
          <p>• Players claim rewards via their FID</p>
          <p>• Commit-reveal anti-cheat system</p>
          <p>• ETH swapped to TRIA for rewards</p>
        </div>
      </div>
    </div>
  );
}
