'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dice6, Zap, Coins, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useTRIAContractv21 } from '@/hooks/useTRIAContractv21';
import { formatUnits, parseUnits } from 'viem';
import { Address } from 'viem';

interface BonusStat {
  name: string;
  value: number;
  icon: string;
}

interface DiceRollModalV20Props {
  isOpen: boolean;
  onClose: () => void;
  onRollComplete: (bonusStats: BonusStat[]) => void;
  onSkip: () => void;
  userAddress: Address | undefined;
  gameMode?: 'free' | 'paid';
}

export function DiceRollModalV20({
  isOpen,
  onClose,
  onRollComplete,
  onSkip,
  userAddress,
  gameMode = 'paid',
}: DiceRollModalV20Props): JSX.Element {
  const [isRolling, setIsRolling] = useState(false);
  const [dice1Result, setDice1Result] = useState<number | null>(null);
  const [dice2Result, setDice2Result] = useState<number | null>(null);
  const [totalResult, setTotalResult] = useState<number | null>(null);
  const [bonusStats, setBonusStats] = useState<BonusStat[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fun mode: NO CONTRACT - pure client-side
  // Paid mode: Use contract
  const contract = gameMode === 'paid' ? useTRIAContractv21() : null;

  // Read contract state (ONLY for paid mode)
  const { data: currentPeriod } = contract?.useCurrentPeriod() || { data: undefined };
  const { data: diceInfo, refetch: refetchDiceInfo } = contract?.useGetDiceInfo(userAddress, currentPeriod) || { data: undefined, refetch: () => Promise.resolve() };
  const { data: triaBalance } = contract?.useTriaBalance(userAddress) || { data: undefined };
  const { data: triaAllowance, refetch: refetchAllowance } = contract?.useTriaAllowance(userAddress) || { data: undefined, refetch: () => Promise.resolve() };
  const { data: triaDecimals } = contract?.useTriaDecimals() || { data: undefined };
  const { data: freeDicePerPeriod } = contract?.useFreeDicePerPeriod() || { data: undefined };

  // Fun mode: Unlimited rolls (client-side only, no contract)
  // Paid mode: Parse from contract
  const decimals = triaDecimals || 18;
  const totalFreeDice = freeDicePerPeriod ? Number(freeDicePerPeriod) : 3;
  const freeRollsUsed = diceInfo?.[0] !== undefined ? Number(diceInfo[0]) : 0;
  const paidRollsUsed = diceInfo?.[1] !== undefined ? Number(diceInfo[1]) : 0;
  const freeRollsRemaining = gameMode === 'free' ? 999 : (diceInfo?.[2] !== undefined ? Number(diceInfo[2]) : totalFreeDice);
  const nextPaidRollPriceWei = diceInfo?.[3] || BigInt(0);
  const nextPaidRollPrice = Number(formatUnits(nextPaidRollPriceWei, decimals));
  const balance = triaBalance ? Number(formatUnits(triaBalance, decimals)) : 0;
  const allowance = triaAllowance ? Number(formatUnits(triaAllowance, decimals)) : 0;

  // Check if can roll
  const hasFreeRolls = freeRollsRemaining > 0;
  // Fun mode: ALWAYS can roll (no contract, unlimited)
  // Paid mode: Free rolls OR paid rolls if balance sufficient
  const canRoll = gameMode === 'free' 
    ? true 
    : (hasFreeRolls || balance >= nextPaidRollPrice);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDice1Result(null);
      setDice2Result(null);
      setTotalResult(null);
      setBonusStats([]);
      setShowResults(false);
      // Only refetch for paid mode (fun mode has no contract)
      if (gameMode === 'paid') {
        refetchDiceInfo();
        refetchAllowance();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, gameMode]);

  const performDiceRoll = async (): Promise<void> => {
    if (!canRoll) {
      toast.error('Cannot roll dice!', {
        description: hasFreeRolls ? 'No free rolls' : `Insufficient balance. Need ${nextPaidRollPrice.toLocaleString()} TRIA`,
      });
      return;
    }

    try {
      setIsProcessing(true);

      // Fun mode: NO CONTRACT - pure client-side roll
      if (gameMode === 'free') {
        console.log('🎲 [FUN MODE] Client-side roll (no contract)');
        toast.info('🎲 Rolling dice...', {
          description: 'Fun mode - unlimited rolls!',
        });
        // Skip contract interaction, go straight to animation
      } 
      // Paid mode: Use contract
      else {
        const isFreeRoll = hasFreeRolls;
        const triaAmount = isFreeRoll ? BigInt(0) : nextPaidRollPriceWei;

        console.log('🎲 [PAID MODE] Rolling dice:', {
          isFree: isFreeRoll,
          triaAmount: triaAmount.toString(),
          freeRollsRemaining,
          paidRollsUsed,
          nextPaidRollPrice,
        });

        // If paid roll, check approval and approve if needed
        if (!isFreeRoll) {
          const requiredAmount = Number(formatUnits(triaAmount, decimals));
          
          if (allowance < requiredAmount) {
            toast.info('🔓 Approving TRIA...', {
              description: 'Please confirm approval in your wallet',
            });
            
            if (contract?.approveTria) {
              await contract.approveTria(triaAmount);
              await new Promise(resolve => setTimeout(resolve, 2000));
              await refetchAllowance();
            }
            
            toast.success('✅ TRIA approved!');
          }
        }

        // Call contract rollDice
        toast.info('🎲 Rolling dice...', {
          description: isFreeRoll ? 'Using free roll' : `Paying ${nextPaidRollPrice.toLocaleString()} TRIA`,
        });

        if (contract?.rollDice) {
          await contract.rollDice(triaAmount);
          await new Promise(resolve => setTimeout(resolve, 2000));
          await refetchDiceInfo();
        }
      }

      // Start animation
      setIsRolling(true);
      setDice1Result(null);
      setDice2Result(null);
      setTotalResult(null);
      setBonusStats([]);
      setShowResults(false);

      // Animate dice roll
      const rollDuration = 2000; // 2 seconds
      const intervalTime = 100;
      const iterations = rollDuration / intervalTime;
      let currentIteration = 0;

      const rollInterval = setInterval(() => {
        setDice1Result(Math.floor(Math.random() * 6) + 1);
        setDice2Result(Math.floor(Math.random() * 6) + 1);
        currentIteration++;

        if (currentIteration >= iterations) {
          clearInterval(rollInterval);
          
          // Final results
          const finalDice1 = Math.floor(Math.random() * 6) + 1;
          const finalDice2 = Math.floor(Math.random() * 6) + 1;
          const total = finalDice1 + finalDice2;
          
          setDice1Result(finalDice1);
          setDice2Result(finalDice2);
          setTotalResult(total);
          
          // Generate bonus stats based on total result
          const stats = generateBonusStats(total);
          setBonusStats(stats);
          
          setTimeout(() => {
            setIsRolling(false);
            setShowResults(true);
            toast.success(`🎲 Rolled ${total}!`, {
              description: `${stats.length} bonus stat${stats.length > 1 ? 's' : ''} unlocked!`,
            });
          }, 500);
        }
      }, intervalTime);
    } catch (error) {
      console.error('Roll dice error:', error);
      toast.error('Failed to roll dice', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateBonusStats = (totalValue: number): BonusStat[] => {
    const allStats = [
      { name: 'HP', icon: '❤️', isSpecial: false },
      { name: 'Damage', icon: '⚔️', isSpecial: false },
      { name: 'Cooldown Reduction', icon: '⏱️', isSpecial: false },
      { name: 'Lifesteal', icon: '🩸', isSpecial: true }, // Special: 1-6%
      { name: 'Critical Chance', icon: '💥', isSpecial: false },
      { name: 'Defense', icon: '🛡️', isSpecial: true }, // Special: 1-6%
      { name: 'Critical Damage', icon: '💢', isSpecial: false },
      { name: 'Attack Speed', icon: '⚙️', isSpecial: false },
      { name: 'Dodge Chance', icon: '🌀', isSpecial: true }, // Special: 1-6%
    ];

    // Number of stats based on total dice result (2-12)
    let numStats = 1;
    if (totalValue >= 4 && totalValue <= 6) numStats = 2;
    if (totalValue >= 7 && totalValue <= 9) numStats = 3;
    if (totalValue >= 10 && totalValue <= 11) numStats = 4;
    if (totalValue === 12) numStats = 6; // Jackpot! 6 bonus stats

    // Shuffle and pick random stats
    const shuffled = [...allStats].sort(() => Math.random() - 0.5);
    const selectedStats = shuffled.slice(0, numStats);

    return selectedStats.map(stat => {
      const isSpecial = (stat as typeof allStats[0]).isSpecial;
      const value = isSpecial 
        ? Math.floor(Math.random() * 6) + 1 // 1-6% for Lifesteal & Dodge
        : (Math.floor(Math.random() * 6) + 1) * 5; // 5-30% for other stats
      
      return {
        name: stat.name,
        icon: stat.icon,
        value,
      };
    });
  };

  const handleAccept = (): void => {
    onRollComplete(bonusStats);
    onClose();
  };

  const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] bg-gradient-to-br from-purple-950 via-indigo-950 to-black border-2 border-yellow-500/50 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-yellow-400">
            🎲🎲 Roll for Bonus Stats
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
        <div className="space-y-4">
          {/* Rolls Counter & Balance */}
          {gameMode === 'free' ? (
            <Card className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-green-500/50 p-4">
              <div className="text-center">
                <Zap className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <span className="text-xl font-bold text-green-400">🎮 Fun Mode - Unlimited Rolls!</span>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Free Rolls Card */}
              <Card className={`p-4 border-2 ${
                hasFreeRolls 
                  ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/50' 
                  : 'bg-black/40 border-gray-600/30'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Zap className={`w-5 h-5 ${hasFreeRolls ? 'text-green-400' : 'text-gray-500'}`} />
                    <span className="text-sm font-semibold text-gray-300">Free Rolls</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      <span className={hasFreeRolls ? 'text-green-400' : 'text-gray-500'}>{freeRollsRemaining}</span>
                      <span className="text-gray-500"> / {totalFreeDice}</span>
                    </div>
                    {hasFreeRolls && (
                      <div className="text-xs text-green-400 font-semibold">🆓 Next roll is FREE!</div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Paid Rolls Card */}
              <Card className="bg-black/40 border-yellow-600/30 p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-400" />
                    <span className="text-sm font-semibold text-gray-300">Paid Rolls Used</span>
                  </div>
                  <span className="text-xl font-bold text-blue-400">{paidRollsUsed} / 60</span>
                </div>
                {!hasFreeRolls && (
                  <>
                    <div className="h-px bg-gray-700/50 my-2"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Next Roll Cost:</span>
                      <span className="text-lg font-bold text-yellow-400">💰 {nextPaidRollPrice.toLocaleString()} TRIA</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Your Balance:</span>
                      <span className={`text-lg font-bold ${
                        balance >= nextPaidRollPrice ? 'text-green-400' : 'text-red-400'
                      }`}>{balance.toLocaleString()} TRIA</span>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}

          {/* Two Dice Display with 3D Animation */}
          <div className="flex justify-center items-center gap-4 h-32">
            {/* Dice 1 */}
            <div
              className={`transition-all duration-300 ${
                isRolling 
                  ? 'animate-bounce' 
                  : dice1Result 
                  ? 'scale-110 animate-in zoom-in-50' 
                  : ''
              }`}
              style={{
                transform: isRolling 
                  ? `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)` 
                  : 'rotateX(0deg) rotateY(0deg)',
                transition: isRolling ? 'transform 0.1s linear' : 'transform 0.5s ease-out',
              }}
            >
              {dice1Result ? (
                <div className="text-7xl">{diceEmojis[dice1Result - 1]}</div>
              ) : (
                <Dice6 className="w-16 h-16 text-yellow-400 opacity-50" />
              )}
            </div>

            {/* Dice 2 */}
            <div
              className={`transition-all duration-300 ${
                isRolling 
                  ? 'animate-bounce delay-75' 
                  : dice2Result 
                  ? 'scale-110 animate-in zoom-in-50 delay-100' 
                  : ''
              }`}
              style={{
                transform: isRolling 
                  ? `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)` 
                  : 'rotateX(0deg) rotateY(0deg)',
                transition: isRolling ? 'transform 0.1s linear' : 'transform 0.5s ease-out',
              }}
            >
              {dice2Result ? (
                <div className="text-7xl">{diceEmojis[dice2Result - 1]}</div>
              ) : (
                <Dice6 className="w-16 h-16 text-yellow-400 opacity-50" />
              )}
            </div>
          </div>

          {/* Total Result */}
          {totalResult !== null && !isRolling && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-2">
              <div className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-3 rounded-lg border-2 border-yellow-300 shadow-lg">
                <span className="text-sm text-yellow-950 font-semibold">Total Roll:</span>
                <span className="text-4xl font-bold text-white ml-2">{totalResult}</span>
              </div>
            </div>
          )}

          {/* Bonus Stats Results */}
          {showResults && bonusStats.length > 0 && (
            <Card className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-500/50 p-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="text-center mb-3">
                <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-1" />
                <h3 className="text-lg font-bold text-green-400">
                  {totalResult === 12 ? '🎉 JACKPOT! 🎉' : 
                   totalResult! >= 10 ? '✨ LEGENDARY! ✨' :
                   totalResult! >= 7 ? '💎 RARE!' :
                   totalResult! >= 4 ? '⭐ UNCOMMON' : '📦 COMMON'}
                </h3>
                <p className="text-xs text-gray-300 mt-1">
                  {bonusStats.length} bonus stat{bonusStats.length > 1 ? 's' : ''} unlocked!
                </p>
              </div>
              <div className="space-y-2">
                {bonusStats.map((stat, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center bg-black/30 rounded p-2 border border-green-500/30"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-xl">{stat.icon}</span>
                      <span className="text-gray-200">{stat.name}</span>
                    </span>
                    <span className="text-lg font-bold text-green-400">+{stat.value}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {!showResults ? (
              <>
                <Button
                  onClick={performDiceRoll}
                  disabled={isRolling || isProcessing || !canRoll}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold text-lg py-6 disabled:opacity-50"
                >
                  {isRolling || isProcessing ? (
                    <span className="flex items-center gap-2">
                      <Dice6 className="w-5 h-5 animate-spin" />
                      {isProcessing ? 'Processing...' : 'Rolling...'}
                    </span>
                  ) : (
                    gameMode === 'free' ? (
                      <span className="flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        🎲 Roll Dice (Unlimited)
                      </span>
                    ) : !canRoll ? (
                      '❌ Insufficient TRIA'
                    ) : hasFreeRolls ? (
                      <span className="flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        🎲 Roll Dice - 🆓 FREE ({freeRollsRemaining} left)
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Coins className="w-5 h-5" />
                        🎲 Roll Dice - 💰 {nextPaidRollPrice.toLocaleString()} TRIA
                      </span>
                    )
                  )}
                </Button>
                
                {/* Skip Button - Play without bonus */}
                <Button
                  onClick={onSkip}
                  disabled={isRolling || isProcessing}
                  variant="outline"
                  className="w-full border-2 border-gray-500 text-gray-300 hover:bg-gray-800 hover:text-white font-bold py-4"
                >
                  Skip - Play Without Bonus
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                {/* Use This Button */}
                <Button
                  onClick={handleAccept}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-lg py-6"
                >
                  ✅ Use This Bonus
                </Button>
                
                {/* Roll Again Button - If can still roll */}
                {canRoll && (
                  <Button
                    onClick={() => {
                      setShowResults(false);
                      performDiceRoll();
                    }}
                    disabled={isProcessing}
                    variant="outline"
                    className="w-full border-2 border-yellow-500 text-yellow-300 hover:bg-yellow-900/30 hover:text-yellow-200 font-bold py-4"
                  >
                    {isProcessing ? (
                      'Processing...'
                    ) : gameMode === 'free' ? (
                      '🎲 Roll Again (Unlimited)'
                    ) : hasFreeRolls ? (
                      `🎲 Roll Again - 🆓 FREE (${freeRollsRemaining} left)`
                    ) : (
                      `🎲 Roll Again - 💰 ${nextPaidRollPrice.toLocaleString()} TRIA`
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Rules */}
          <Card className="bg-black/20 border-gray-700/30 p-3">
            <h4 className="text-xs font-bold text-yellow-400 mb-1">🎲 Dice System:</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• 📦 Roll 2-3 (COMMON): 1 stat</li>
              <li>• ⭐ Roll 4-6 (UNCOMMON): 2 stats</li>
              <li>• 💎 Roll 7-9 (RARE): 3 stats</li>
              <li>• ✨ Roll 10-11 (LEGENDARY): 4 stats</li>
              <li>• 🎉 Roll 12 (JACKPOT): 6 stats!</li>
              <li>• Normal stats: +5% to +30%</li>
              <li>• Lifesteal/Dodge/Defense: +1% to +6%</li>
              <li>• Free: {totalFreeDice} rolls/period</li>
              {gameMode === 'paid' && (
                <>
                  <li>• Paid: 1000 × 2^n TRIA (exponential)</li>
                  <li>• Max paid rolls: 60 per period</li>
                </>
              )}
            </ul>
          </Card>
        </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
