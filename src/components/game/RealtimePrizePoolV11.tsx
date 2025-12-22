'use client';

import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTRIAContractv11 } from '@/hooks/useTRIAContractv11';

export function RealtimePrizePoolV11(): JSX.Element {
  const {
    useCurrentPeriod,
    usePeriodInfo,
    useTriaDecimals,
  } = useTRIAContractv11();

  const { data: currentPeriod } = useCurrentPeriod();
  const { data: periodInfo } = usePeriodInfo(currentPeriod);
  const { data: triaDecimals } = useTriaDecimals();

  const [displayPool, setDisplayPool] = useState<string>('0');
  const [displayParticipants, setDisplayParticipants] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Extract period data (correct indices from Period struct)
  const triaPrizePool = periodInfo?.[0] || BigInt(0);      // index 0: prizePoolTRIA
  const totalPoints = periodInfo?.[1] || BigInt(0);        // index 1: totalPoints
  const participants = periodInfo?.[2] || BigInt(0);       // index 2: participantCount
  const startTime = periodInfo?.[3] || BigInt(0);          // index 3: startTime
  const endTime = periodInfo?.[4] || BigInt(0);            // index 4: endTime
  const distributed = periodInfo?.[5] || false;            // index 5: distributed
  const decimals = triaDecimals || 18;

  // Update display values with smooth animation
  useEffect(() => {
    if (triaPrizePool > BigInt(0)) {
      const poolInTria = Number(formatUnits(triaPrizePool, decimals));
      setDisplayPool(poolInTria.toLocaleString(undefined, { maximumFractionDigits: 0 }));
    }
  }, [triaPrizePool, decimals]);

  useEffect(() => {
    if (participants > BigInt(0)) {
      setDisplayParticipants(Number(participants));
    }
  }, [participants]);

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      if (endTime > BigInt(0)) {
        const now = BigInt(Math.floor(Date.now() / 1000));
        const remaining = endTime - now;
        
        if (remaining <= BigInt(0)) {
          setTimeRemaining('Period Ended');
          return;
        }
        
        const hours = Number(remaining / BigInt(3600));
        const minutes = Number((remaining % BigInt(3600)) / BigInt(60));
        const seconds = Number(remaining % BigInt(60));
        
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <Card className="fantasy-card prize-pool-card bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-2 border-yellow-600/50">
      <CardHeader className="pb-3 border-b border-yellow-600/30">
        <CardTitle className="text-xl fantasy-title glow-text bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent text-center">
          💰 Live TRIA Prize Pool
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Current Period & Countdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-3 rounded-xl border border-purple-600/30">
            <div className="text-center">
              <div className="text-purple-300 text-xs mb-1">Period</div>
              <div className="text-white text-2xl font-bold">
                #{currentPeriod?.toString() || '0'}
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-red-900/50 to-orange-900/50 p-3 rounded-xl border border-red-600/30">
            <div className="text-center">
              <div className="text-red-300 text-xs mb-1">⏰ Time Left</div>
              <div className="text-white text-lg font-bold">
                {timeRemaining || 'Loading...'}
              </div>
            </div>
          </div>
        </div>

        {/* Prize Pool Display */}
        <div className="bg-gradient-to-br from-yellow-900/70 to-orange-900/70 p-4 rounded-2xl border-2 border-yellow-500/50 shadow-lg shadow-yellow-600/30">
          <div className="text-center">
            <div className="text-yellow-300 text-sm mb-2 font-medium">🏆 Total Prize Pool</div>
            <div className="text-white text-4xl font-bold mb-1 glow-text">
              {displayPool}
            </div>
            <div className="text-yellow-400 text-lg font-bold">
              TRIA
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 p-3 rounded-xl border border-blue-600/30">
          <div className="flex justify-between items-center">
            <div className="text-blue-300 text-sm">👥 Participants</div>
            <div className="text-white text-xl font-bold">{displayParticipants}</div>
          </div>
        </div>

        {/* Prize Info - V7 Updated Formula */}
        <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 p-3 rounded-xl border border-green-600/30 text-xs space-y-2">
          <div className="text-green-300 font-bold mb-1">✨ How It Works (V7):</div>
          <div className="text-gray-300 space-y-1">
            <div>💎 Deposit TRIA to enter tournament</div>
            <div>🎮 Play game & submit your score</div>
            <div>🏆 Win proportional TRIA rewards</div>
            <div className="text-yellow-300 font-bold">⚖️ Points = Score × (Entry / 6B TRIA)</div>
            <div>💰 Prize = (Pool × Your Points) / Total Points</div>
            <div className="text-green-300 font-bold">✨ 100% Prize Pool (No fees!)</div>
          </div>
        </div>

        {/* Entry Bounds */}
        <div className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 p-3 rounded-xl border border-gray-600/30">
          <div className="text-xs text-gray-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Min Entry:</span>
              <span className="text-white font-bold">50,000 TRIA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Max Entry:</span>
              <span className="text-white font-bold">6,000,000,000 TRIA</span>
            </div>
          </div>
        </div>

        {/* Prize Distribution - V7: 100%! */}
        <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 p-3 rounded-xl border border-green-600/50 text-xs">
          <div className="text-green-300 font-bold mb-2">💸 Distribution (V7)</div>
          <div className="space-y-1 text-gray-300">
            <div className="flex justify-between items-center">
              <span>Prize Pool:</span>
              <span className="text-green-400 font-bold text-base">100%! 🎉</span>
            </div>
            <div className="text-green-300 text-[10px] mt-1">
              ✨ NO platform fee! All deposits go to winners!
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-green-600/20 border border-green-500/50 rounded-full px-4 py-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-300 text-xs font-bold">LIVE & ACTIVE</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
