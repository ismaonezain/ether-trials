kono
  'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEtherTrialsV3 } from '@/hooks/useEtherTrialsV3';
import { Trophy, Users, Clock, Coins } from 'lucide-react';
import { formatUnits } from 'viem';
import { useEffect, useState } from 'react';

export function RealtimePrizePoolV3(): JSX.Element {
  const { currentPeriod, periodInfo, constants } = useEtherTrialsV3();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Calculate time remaining
  useEffect(() => {
    if (!periodInfo) return;

    const updateTime = (): void => {
      const now = Math.floor(Date.now() / 1000);
      const end = Number(periodInfo.endTime);
      const remaining = Math.max(0, end - now);
      setTimeRemaining(remaining);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [periodInfo]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <Card className="fantasy-card border-2 border-yellow-600/50">
      <CardHeader className="pb-3 border-b border-yellow-600/30">
        <CardTitle className="text-xl text-center fantasy-title text-yellow-300 flex items-center justify-center gap-2">
          <Trophy className="w-5 h-5" />
          Live TRIA Prize Pool V3
        </CardTitle>
        <div className="text-center text-xs text-gray-400">
          Period #{currentPeriod}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {/* Prize Pool Display */}
        <div className="bg-gradient-to-r from-yellow-900/50 to-orange-900/50 p-4 rounded-xl border border-yellow-600/30">
          <div className="text-xs text-yellow-300 mb-1 font-semibold">Current Prize Pool</div>
          <div className="text-3xl font-bold text-yellow-300 mb-1">
            {periodInfo ? Number(formatUnits(periodInfo.prizePoolTRIA, 18)).toFixed(2) : '0.00'} TRIA
          </div>
          <div className="text-xs text-gray-400">
            80% of all entry fees
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Participants */}
          <div className="bg-blue-900/30 p-3 rounded-lg border border-blue-500/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3 h-3 text-blue-400" />
              <span className="text-blue-300 font-semibold">Players</span>
            </div>
            <div className="text-lg font-bold text-white">
              {periodInfo ? Number(periodInfo.participantCount) : 0}
            </div>
          </div>

          {/* Entry Fee */}
          <div className="bg-purple-900/30 p-3 rounded-lg border border-purple-500/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Coins className="w-3 h-3 text-purple-400" />
              <span className="text-purple-300 font-semibold">Entry</span>
            </div>
            <div className="text-lg font-bold text-white">
              {constants.entryFee} ETH
            </div>
          </div>
        </div>

        {/* Time Remaining */}
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 p-3 rounded-xl border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-300" />
              <span className="text-xs text-purple-300 font-semibold">Time Left</span>
            </div>
            <div className="text-sm font-mono text-white">
              {formatTime(timeRemaining)}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-black/30 p-3 rounded-lg border border-purple-500/20">
          <div className="space-y-1 text-[10px] text-gray-400">
            <div>• Fixed 0.00002 ETH entry fee</div>
            <div>• Owner submits scores after period</div>
            <div>• Points = Pure score (no modifiers)</div>
            <div>• Claim TRIA rewards after allocation</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
