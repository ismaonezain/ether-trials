'use client';

import { useTRIAContractv9 } from '@/hooks/useTRIAContractv9';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { useAccount } from 'wagmi';
import { Trophy, Clock, Coins } from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatEther } from 'viem';

export function TournamentInfoV4(): JSX.Element {
  const { address, isConnected } = useAccount();
  const {
    periodInfo,
    currentPeriod,
  } = useTRIAContractv9();

  const [timeLeft, setTimeLeft] = useState<string>('');
  const [periodStatus, setPeriodStatus] = useState<'not-started' | 'active' | 'ended' | 'finalized'>('active');
  const [localTimeRemaining, setLocalTimeRemaining] = useState<number>(0);

  // Calculate period status based on current time
  useEffect(() => {
    if (!periodInfo) return;
    
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const start = Number(periodInfo.startTime);
    const end = Number(periodInfo.endTime);

    if (periodInfo.finalized) {
      setPeriodStatus('finalized');
    } else if (now < start) {
      setPeriodStatus('not-started');
    } else if (now >= start && now < end) {
      setPeriodStatus('active');
    } else {
      setPeriodStatus('ended');
    }
  }, [periodInfo]);

  // Initialize local countdown from periodInfo
  useEffect(() => {
    if (!periodInfo) return;
    setLocalTimeRemaining(periodInfo.timeRemaining);
  }, [periodInfo?.periodNumber, periodInfo?.timeRemaining]);

  // Update countdown every second
  useEffect(() => {
    if (localTimeRemaining <= 0) {
      setTimeLeft('Period Ended');
      return;
    }

    const interval = setInterval(() => {
      setLocalTimeRemaining((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          setTimeLeft('Period Ended');
          return 0;
        }
        
        const hours = Math.floor(newTime / 3600);
        const minutes = Math.floor((newTime % 3600) / 60);
        const secs = newTime % 60;
        setTimeLeft(`${hours}h ${minutes}m ${secs}s`);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [localTimeRemaining]);

  // Show loading state only if periodInfo is not available
  if (!periodInfo) {
    return (
      <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 rounded-xl p-4 border-2 border-blue-500/30 shadow-lg">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-400 animate-pulse" />
            <h3 className="text-lg font-bold text-white">Loading Tournament Data...</h3>
          </div>

          {/* Loading Skeleton */}
          <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/30 space-y-3">
            <div className="h-4 bg-blue-500/20 rounded animate-pulse w-3/4"></div>
            <div className="h-4 bg-blue-500/20 rounded animate-pulse w-1/2"></div>
            <div className="h-6 bg-blue-500/20 rounded animate-pulse w-full mt-2"></div>
          </div>

          <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-500/30 space-y-3">
            <div className="h-4 bg-purple-500/20 rounded animate-pulse w-2/3"></div>
            <div className="h-4 bg-purple-500/20 rounded animate-pulse w-1/2"></div>
          </div>

          <div className="text-sm text-gray-400 text-center mt-4 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 animate-spin" />
            Fetching period information from blockchain...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 rounded-xl p-4 border-2 border-purple-500/30 shadow-lg">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Tournament v4</h3>
        </div>

        {/* TRIA Pool */}
        {periodInfo && (
          <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-lg p-3 border border-yellow-500/30">
            <div className="text-xs text-yellow-300 mb-1">Current TRIA Pool</div>
            <div className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
              <Coins className="w-6 h-6" />
              {parseFloat(formatEther(periodInfo.triaPool)).toFixed(2)}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <div className="text-gray-300">
                Period #{periodInfo.periodNumber ? periodInfo.periodNumber.toString() : '0'}
              </div>
              {/* Period Status Badge */}
              {periodStatus === 'not-started' && (
                <div className="px-2 py-1 rounded bg-red-900/30 text-red-400 font-bold animate-pulse">
                  🔴 Not Started Yet
                </div>
              )}
              {periodStatus === 'active' && (
                <div className="px-2 py-1 rounded bg-green-900/30 text-green-400 font-bold">
                  🟢 Active Now
                </div>
              )}
              {periodStatus === 'ended' && (
                <div className="px-2 py-1 rounded bg-yellow-900/30 text-yellow-400 font-bold">
                  🟡 Ended - Awaiting Finalization
                </div>
              )}
              {periodStatus === 'finalized' && (
                <div className="px-2 py-1 rounded bg-blue-900/30 text-blue-400 font-bold">
                  ✓ Finalized
                </div>
              )}
            </div>
          </div>
        )}

        {/* Period Times */}
        {periodInfo && (
          <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-500/30 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-blue-300">Period Timeline</span>
            </div>
            
            {/* Start Time */}
            <div className="text-xs space-y-1">
              <div className="text-gray-400">Started:</div>
              <div className="text-gray-200 font-mono">
                {new Date(Number(periodInfo.startTime) * 1000).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </div>
            </div>

            {/* End Time */}
            <div className="text-xs space-y-1">
              <div className="text-gray-400">Ends:</div>
              <div className="text-gray-200 font-mono">
                {new Date(Number(periodInfo.endTime) * 1000).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </div>
            </div>

            {/* Countdown - only if not finalized */}
            {!periodInfo.finalized && (
              <div className="pt-2 border-t border-blue-700/50">
                <div className="text-xs text-gray-400 mb-1">Time Remaining:</div>
                <div className="text-lg font-bold text-blue-300">{timeLeft}</div>
              </div>
            )}

            {/* Finalized Message */}
            {periodInfo.finalized && (
              <div className="pt-2 border-t border-green-700/50">
                <div className="text-sm text-green-400 font-bold">✓ Period Finalized</div>
              </div>
            )}
          </div>
        )}



        {/* Wallet Status - Auto-connected via Farcaster */}
        {isConnected && (
          <div className="p-2 bg-green-900/30 border border-green-700 rounded text-xs">
            <div className="text-green-400">✓ Wallet Connected</div>
          </div>
        )}

        {/* Rules */}
        <div className="space-y-1 text-xs text-gray-400 pt-2 border-t border-gray-700">
          <div>• Variable entry: 0.00001-1 ETH</div>
          <div>• ETH swapped to TRIA via Uniswap</div>
          <div>• Commit-reveal anti-cheat</div>
          <div>• Weighted rewards based on entry</div>
        </div>
      </div>
    </div>
  );
}
