'use client';

import React, { useEffect, useState } from 'react';
import { usePointBasedContract } from '@/hooks/usePointBasedContract';
import { Trophy, Users, Clock, TrendingUp, Coins } from 'lucide-react';

export function RealtimePrizePool() {
  const { prizePoolInfo } = usePointBasedContract();
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Point-based system: no expected pool calculation needed
  // Prize distribution is linear based on score contributions

  useEffect(() => {
    if (!prizePoolInfo) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const nextDist = prizePoolInfo.nextDistribution.getTime();
      const diff = Math.max(0, nextDist - now);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [prizePoolInfo]);

  if (!prizePoolInfo) {
    return (
      <div className="fantasy-card rounded-xl p-6">
        <div className="text-center text-gray-400">Loading treasure vault...</div>
      </div>
    );
  }



  return (
    <div className="fantasy-card rounded-xl p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-red-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/50">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-yellow-300 fantasy-title">Treasure Vault</h3>
            <p className="text-sm text-gray-400">Period #{prizePoolInfo.period}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400 mb-1">Next Distribution</div>
          <div className="flex items-center gap-2 text-yellow-400 font-bold">
            <Clock className="w-4 h-4" />
            <span>{timeLeft}</span>
          </div>
        </div>
      </div>

      {/* Current Pool - Big Display */}
      <div className="bg-gradient-to-r from-yellow-600/20 to-red-600/20 rounded-lg p-6 mb-4 border-2 border-yellow-500/50">
        <div className="text-center">
          <div className="text-sm text-yellow-300 mb-2">Current Prize Pool</div>
          <div className="text-5xl font-bold text-yellow-400 mb-2 glow-text fantasy-title">
            {parseFloat(prizePoolInfo.currentPool).toFixed(5)} ETH
          </div>
          <div className="text-sm text-gray-300">
            ≈ ${(parseFloat(prizePoolInfo.currentPool) * 3500).toFixed(2)} USD
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Participants */}
        <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Champions</span>
          </div>
          <div className="text-2xl font-bold text-white">{prizePoolInfo.participants}</div>
        </div>

        {/* Platform Balance */}
        <div className="bg-green-900/30 rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Platform Fees</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {parseFloat(prizePoolInfo.platformBalance).toFixed(5)}
          </div>
        </div>
      </div>

      {/* Total Points Info */}
      {prizePoolInfo && prizePoolInfo.totalPoints > 0 && (
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg p-4 border border-purple-500/30">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-gray-300">Total Glory Points</span>
          </div>
          <div className="text-2xl font-bold text-purple-300">
            {prizePoolInfo.totalPoints.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Earned by {prizePoolInfo.participants} champions
          </div>
        </div>
      )}

      {/* Linear Point System Info */}
      <div className="mt-4 pt-4 border-t border-yellow-600/30">
        <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-yellow-500/30 p-3 rounded">
          <div className="text-yellow-400 text-xs mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            📊 Linear Point-Based Rewards
          </div>
          <div className="text-white text-xs mb-2">
            Your reward = (Your Score / Total Points) × Prize Pool
          </div>
          <div className="text-gray-300 text-[10px] space-y-1">
            <div>🏆 Higher score = Higher reward!</div>
            <div>⚡ Every point counts!</div>
            <div>💯 Fair & competitive distribution</div>
          </div>
        </div>
      </div>

      {/* Entry Fee Info */}
      <div className="mt-4 pt-4 border-t border-yellow-600/30">
        <div className="text-xs text-gray-400 mb-2">Entry Fee Breakdown:</div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-300">Per Entry: 0.00002 ETH</span>
          <span className="text-gray-300">Prize: 0.00001 | Platform: 0.00001</span>
        </div>
      </div>
    </div>
  );
}
