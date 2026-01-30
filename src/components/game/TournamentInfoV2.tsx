kono
  'use client';

import { usePointBasedContract } from '@/hooks/usePointBasedContract';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Clock, Gift } from 'lucide-react';
import { useState, useEffect } from 'react';

export function TournamentInfoV2(): JSX.Element {
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const {
    prizePoolInfo,
    currentPeriod,
  } = usePointBasedContract();

  // Point-based contract: check entry and prizes via contract directly

  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!prizePoolInfo) return;

    const interval = setInterval(() => {
      const seconds = prizePoolInfo.timeUntilDistribution;
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      setTimeLeft(`${hours}h ${minutes}m ${secs}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [prizePoolInfo]);

  return (
    <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 rounded-xl p-4 border-2 border-purple-500/30 shadow-lg">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Tournament</h3>
        </div>

        {/* Prize Pool */}
        {prizePoolInfo && (
          <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 rounded-lg p-3 border border-yellow-500/30">
            <div className="text-xs text-yellow-300 mb-1">Current Prize Pool</div>
            <div className="text-2xl font-bold text-yellow-400">
              {prizePoolInfo.currentPool} ETH
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1 text-gray-300">
                <Users className="w-3 h-3" />
                <span>{prizePoolInfo.participants} players</span>
              </div>
              <div className="flex items-center gap-1 text-gray-300">
                <span>Period #{prizePoolInfo.period}</span>
              </div>
            </div>
          </div>
        )}

        {/* Time Until Distribution */}
        {prizePoolInfo && (
          <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-500/30">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-300">Next Distribution</span>
            </div>
            <div className="text-lg font-bold text-blue-300">{timeLeft}</div>
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
          <div>• Top 1000 eligible for prizes</div>
          <div>• Manual claim after 24h</div>
          <div>• Entry: 0.00002 ETH</div>
        </div>
      </div>
    </div>
  );
}
