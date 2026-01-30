ok
  'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePointBasedContractV4 } from '@/hooks/usePointBasedContractV4';
import { Trophy, Users, Coins, Clock, TrendingUp, Wallet, Award } from 'lucide-react';

export function RealtimePrizePoolV4() {
  const { prizePoolInfo, currentPeriod, totalPrizesOwed } = usePointBasedContractV4();
  const [timeRemaining, setTimeRemaining] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Sync with contract data
  useEffect(() => {
    if (prizePoolInfo?.timeUntilDistribution) {
      setSecondsLeft(prizePoolInfo.timeUntilDistribution);
    }
  }, [prizePoolInfo?.timeUntilDistribution]);

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        const newSeconds = Math.max(0, prev - 1);
        
        if (newSeconds <= 0) {
          setTimeRemaining('Period ended - awaiting distribution');
          return 0;
        }

        const hours = Math.floor(newSeconds / 3600);
        const minutes = Math.floor((newSeconds % 3600) / 60);
        const secs = newSeconds % 60;

        setTimeRemaining(`${hours}h ${minutes}m ${secs}s`);
        return newSeconds;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="fantasy-card border-2 border-yellow-600/50 bg-gradient-to-br from-yellow-900/30 to-orange-900/30 shadow-xl shadow-yellow-600/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl fantasy-title text-yellow-300 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Live Prize Pool
          </CardTitle>
          <Badge variant="outline" className="bg-purple-600/30 text-purple-300 border-purple-500 font-bold">
            Period {currentPeriod ? Number(currentPeriod) : 0}
          </Badge>
        </div>
        <p className="text-xs text-yellow-200 font-medium">Pure ETH • Real-time • On-chain</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Prize Pool Display */}
        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 p-4 rounded-2xl border-2 border-yellow-500/50 text-center">
          <p className="text-gray-300 text-xs font-medium mb-1">Current Prize Pool</p>
          <div className="flex items-center justify-center gap-2">
            <Coins className="w-6 h-6 text-yellow-400" />
            <p className="text-4xl font-black text-yellow-400 glow-text">
              {prizePoolInfo?.currentPool || '0.0000'} ETH
            </p>
          </div>
          <p className="text-gray-400 text-xs mt-1">
            80% of entry fees • Proportional rewards
          </p>
        </div>

        {/* Stats Grid - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Participants */}
          <div className="bg-black/40 p-3 rounded-xl border border-blue-500/30">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-400" />
              <p className="text-gray-400 text-xs">Players</p>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {prizePoolInfo?.participants || 0}
            </p>
          </div>

          {/* Total Points */}
          <div className="bg-black/40 p-3 rounded-xl border border-green-500/30">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <p className="text-gray-400 text-xs">Points</p>
            </div>
            <p className="text-2xl font-bold text-green-400">
              {prizePoolInfo?.totalPoints?.toLocaleString() || '0'}
            </p>
          </div>

          {/* Platform Fees */}
          <div className="bg-black/40 p-3 rounded-xl border border-purple-500/30">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-purple-400" />
              <p className="text-gray-400 text-xs">Platform Fees</p>
            </div>
            <p className="text-lg font-bold text-purple-400">
              {prizePoolInfo?.platformBalance || '0'} ETH
            </p>
          </div>

          {/* Total Prizes Owed (Claimed) */}
          <div className="bg-black/40 p-3 rounded-xl border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-yellow-400" />
              <p className="text-gray-400 text-xs">Prizes Owed</p>
            </div>
            <p className="text-lg font-bold text-yellow-400">
              {totalPrizesOwed || '0'} ETH
            </p>
          </div>
        </div>

        {/* Countdown */}
        <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 p-3 rounded-xl border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span className="text-gray-300 text-xs font-medium">
                {prizePoolInfo?.distributed ? 'Period ended' : 'Time remaining'}
              </span>
            </div>
            <span className="text-purple-300 text-sm font-mono font-bold">
              {prizePoolInfo?.distributed ? '✅' : timeRemaining}
            </span>
          </div>
        </div>

        {/* Period Status */}
        <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-600/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">Status</span>
            <Badge 
              variant={prizePoolInfo?.distributed ? 'secondary' : 'default'}
              className={prizePoolInfo?.distributed ? 'bg-gray-700 text-gray-300' : 'bg-green-600 text-white animate-pulse'}
            >
              {prizePoolInfo?.distributed ? '🏁 Distributed' : '🟢 Active'}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-500 mb-0.5">Started</p>
              <p className="text-gray-300 font-mono text-[10px]">
                {prizePoolInfo?.startTime ? 
                  new Date(prizePoolInfo.startTime).toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }) 
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-0.5">Ends</p>
              <p className="text-gray-300 font-mono text-[10px]">
                {prizePoolInfo?.endTime ? 
                  new Date(prizePoolInfo.endTime).toLocaleString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }) 
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Prize Distribution Info */}
        <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-xl p-3">
          <p className="text-yellow-300 text-xs font-semibold mb-2">💰 Prize Distribution</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-gray-300">
              <span>• Proportional to score</span>
              <span className="text-yellow-400 font-bold">Your points × Pool</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>• Higher score = larger share</span>
              <span className="text-green-400 font-bold">Fair & transparent</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>• Claim after period ends</span>
              <span className="text-purple-400 font-bold">Multiple claims OK</span>
            </div>
          </div>
        </div>

        {/* Contract Info */}
        <div className="text-center">
          <p className="text-gray-500 text-[10px]">
            Pure ETH • Commit-Reveal • Base Network
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
