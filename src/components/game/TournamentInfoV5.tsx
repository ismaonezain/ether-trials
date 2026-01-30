kono
  'use client';

import { useTRIAContractV5 } from '@/hooks/useTRIAContractv5';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { useAccount } from 'wagmi';
import { Trophy, Clock, Coins, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatEther } from 'viem';

export function TournamentInfoV5(): JSX.Element {
  const { address, isConnected } = useAccount();
  const { profile } = useFarcasterProfile();
  const fid = profile?.fid ? BigInt(profile.fid) : undefined;
  const {
    periodInfo,
    currentPeriod,
    claimableTRIA,
  } = useTRIAContractV5(fid);

  const [timeLeft, setTimeLeft] = useState<string>('');

  // Live countdown timer
  useEffect(() => {
    if (!periodInfo || periodInfo.timeRemaining <= 0n) {
      setTimeLeft('Period Ended');
      return;
    }

    let remaining = Number(periodInfo.timeRemaining);

    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        setTimeLeft('Period Ended');
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const secs = remaining % 60;
      setTimeLeft(`${hours}h ${minutes}m ${secs}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [periodInfo?.timeRemaining]);

  // Loading state
  if (!periodInfo) {
    return (
      <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 rounded-xl p-4 border-2 border-blue-500/30 shadow-lg">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400 animate-pulse" />
            <h3 className="text-lg font-bold text-white">Loading Tournament...</h3>
          </div>
          <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/30 space-y-3">
            <div className="h-4 bg-blue-500/20 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-blue-500/20 rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  // Status badge component
  const StatusBadge = (): JSX.Element => {
    switch (periodInfo.status) {
      case 'not-started':
        return (
          <div className="px-3 py-1 rounded-full bg-red-900/40 border border-red-500/50 text-red-300 font-bold animate-pulse text-sm">
            🔴 Not Started Yet
          </div>
        );
      case 'active':
        return (
          <div className="px-3 py-1 rounded-full bg-green-900/40 border border-green-500/50 text-green-300 font-bold text-sm">
            🟢 Active Now - Join!
          </div>
        );
      case 'ended':
        return (
          <div className="px-3 py-1 rounded-full bg-yellow-900/40 border border-yellow-500/50 text-yellow-300 font-bold text-sm">
            🟡 Ended - Awaiting Finalization
          </div>
        );
      case 'finalized':
        return (
          <div className="px-3 py-1 rounded-full bg-blue-900/40 border border-blue-500/50 text-blue-300 font-bold text-sm">
            ✅ Finalized
          </div>
        );
      default:
        return <></>;
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 rounded-xl p-5 border-2 border-purple-500/30 shadow-2xl">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <h3 className="text-xl font-bold text-white">Tournament v5</h3>
          </div>
          <StatusBadge />
        </div>

        {/* TRIA Pool - Big and Clear */}
        <div className="bg-gradient-to-r from-yellow-600/30 to-orange-600/30 rounded-xl p-4 border-2 border-yellow-500/40 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-yellow-300 mb-1">Current Prize Pool</div>
              <div className="text-3xl font-bold text-yellow-400 flex items-center gap-2">
                <Coins className="w-7 h-7" />
                {parseFloat(formatEther(periodInfo.triaPool)).toFixed(2)} TRIA
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-300 mb-1">Participants</div>
              <div className="text-2xl font-bold text-white flex items-center gap-1">
                <Users className="w-5 h-5" />
                {periodInfo.participantCount.toString()}
              </div>
            </div>
          </div>
        </div>

        {/* Period Info Card */}
        <div className="bg-blue-900/30 rounded-xl p-4 border border-blue-500/30 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-bold text-blue-300">Period #{currentPeriod.toString()}</span>
          </div>
          
          {/* Start & End Times */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-gray-400 text-xs">Started:</div>
              <div className="text-white font-mono text-xs">
                {new Date(Number(periodInfo.startTime) * 1000).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-400 text-xs">Ends:</div>
              <div className="text-white font-mono text-xs">
                {new Date(Number(periodInfo.endTime) * 1000).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          {/* Countdown - BIG and CLEAR */}
          {!periodInfo.finalized && periodInfo.status !== 'not-started' && (
            <div className="pt-3 border-t border-blue-700/50">
              <div className="text-xs text-gray-400 mb-2">Time Remaining:</div>
              <div className="text-2xl font-bold text-blue-300 font-mono tracking-wider">
                {timeLeft}
              </div>
            </div>
          )}

          {/* Not Started Message */}
          {periodInfo.status === 'not-started' && (
            <div className="pt-3 border-t border-red-700/50">
              <div className="text-sm text-red-400 font-bold">
                ⏰ Period starts in:{' '}
                {new Date(Number(periodInfo.startTime) * 1000).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          )}

          {/* Finalized Message */}
          {periodInfo.finalized && (
            <div className="pt-3 border-t border-green-700/50">
              <div className="text-sm text-green-400 font-bold">✅ Period Finalized - Rewards Ready!</div>
            </div>
          )}
        </div>

        {/* Claimable TRIA - Highlighted */}
        {claimableTRIA > 0n && (
          <div className="bg-gradient-to-r from-green-600/30 to-emerald-600/30 rounded-xl p-4 border-2 border-green-500/40 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-green-300 mb-1">Your Claimable Rewards</div>
                <div className="text-2xl font-bold text-green-300 flex items-center gap-2">
                  <Coins className="w-6 h-6" />
                  {formatEther(claimableTRIA)} TRIA
                </div>
              </div>
              <div className="text-3xl">🎉</div>
            </div>
          </div>
        )}

        {/* Wallet Status */}
        {isConnected && (
          <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg text-sm">
            <div className="text-green-400 flex items-center gap-2">
              ✓ <span className="font-bold">Wallet Connected</span>
            </div>
          </div>
        )}

        {/* Rules - Simplified */}
        <div className="space-y-1 text-xs text-gray-400 pt-3 border-t border-gray-700">
          <div className="font-bold text-white mb-2">📜 Simple Rules:</div>
          <div>• Entry: 0.00001 - 1 ETH (higher entry = higher rewards)</div>
          <div>• Auto-swapped to TRIA via Uniswap</div>
          <div>• Commit-reveal anti-cheat system</div>
          <div>• Weighted rewards based on score × entry</div>
        </div>
      </div>
    </div>
  );
}
