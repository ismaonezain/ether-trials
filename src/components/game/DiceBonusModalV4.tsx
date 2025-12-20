'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dice6, Zap, Coins, TrendingUp } from 'lucide-react';
import { usePointBasedContractV4 } from '@/hooks/usePointBasedContractV4';
import { toast } from 'sonner';
import { formatEther, parseEther } from 'viem';

interface BonusStat {
  name: string;
  value: number;
  icon: string;
}

interface DiceBonusModalV4Props {
  isOpen: boolean;
  onClose: () => void;
  onRollComplete: (bonusStats: BonusStat[]) => void;
  onSkip: () => void;
  gameMode: 'free' | 'paid';
}

export function DiceBonusModalV4({
  isOpen,
  onClose,
  onRollComplete,
  onSkip,
  gameMode,
}: DiceBonusModalV4Props): JSX.Element {
  const { rollDice, diceInfo, refetchDiceUsage, isPending, isConfirming, isConfirmed } = usePointBasedContractV4();
  
  const [isRolling, setIsRolling] = useState(false);
  const [dice1Result, setDice1Result] = useState<number | null>(null);
  const [dice2Result, setDice2Result] = useState<number | null>(null);
  const [totalResult, setTotalResult] = useState<number | null>(null);
  const [bonusStats, setBonusStats] = useState<BonusStat[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [lastRollWasPaid, setLastRollWasPaid] = useState(false);
  const [animationInterval, setAnimationInterval] = useState<NodeJS.Timeout | null>(null);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  
  // Fun mode: local tracking of rolls (always 3 free per game)
  const [funModeRollsUsed, setFunModeRollsUsed] = useState(0);

  // Fetch dice usage when modal opens (only for prize pool mode)
  useEffect(() => {
    if (isOpen) {
      if (gameMode === 'paid') {
        refetchDiceUsage();
      } else {
        // Fun mode: reset local counter
        setFunModeRollsUsed(0);
      }
      setDice1Result(null);
      setDice2Result(null);
      setTotalResult(null);
      setBonusStats([]);
      setShowResults(false);
      setLastRollWasPaid(false);
      setWaitingForConfirmation(false);
      
      // Clear any existing animation
      if (animationInterval) {
        clearInterval(animationInterval);
        setAnimationInterval(null);
      }
    }
  }, [isOpen, refetchDiceUsage, gameMode]);

  // Watch for transaction confirmation
  useEffect(() => {
    if (isConfirmed && waitingForConfirmation && gameMode === 'paid') {
      console.log('✅ Transaction confirmed! Generating final results...');
      
      // Stop animation
      if (animationInterval) {
        clearInterval(animationInterval);
        setAnimationInterval(null);
      }
      
      // Generate final results
      const finalDice1 = Math.floor(Math.random() * 6) + 1;
      const finalDice2 = Math.floor(Math.random() * 6) + 1;
      const total = finalDice1 + finalDice2;
      
      setDice1Result(finalDice1);
      setDice2Result(finalDice2);
      setTotalResult(total);
      
      const stats = generateBonusStats(total);
      setBonusStats(stats);
      
      // Show results
      setTimeout(() => {
        setIsRolling(false);
        setShowResults(true);
        setWaitingForConfirmation(false);
        
        toast.success('✅ Bonus stats activated!', {
          description: `You rolled ${total}! Your character has been enhanced`,
        });
        
        // Refetch dice usage to update counts
        refetchDiceUsage();
      }, 500);
    }
  }, [isConfirmed, waitingForConfirmation, gameMode, animationInterval, refetchDiceUsage]);

  // Calculate remaining rolls
  const freeRollsRemaining = gameMode === 'paid' 
    ? (diceInfo?.freeRollsRemaining ?? 0)
    : (3 - funModeRollsUsed); // Fun mode: always 3 free rolls per game
  const paidRollsRemaining = gameMode === 'paid' ? (diceInfo?.paidRollsRemaining ?? 0) : 0;
  const canRollFree = freeRollsRemaining > 0;
  const canRollPaid = gameMode === 'paid' && paidRollsRemaining > 0;

  // Calculate paid roll cost based on paidRollsUsed (doubles each time)
  // Formula from contract: BASE_DICE_PRICE * (1 << paidRollsUsed) = 0.00001 * 2^paidRollsUsed
  const BASE_DICE_PRICE = parseEther('0.00001');
  const calculatePaidRollCost = (rollsUsed: number): bigint => {
    // 2^rollsUsed
    const multiplier = BigInt(1) << BigInt(rollsUsed);
    return BASE_DICE_PRICE * multiplier;
  };
  const PAID_ROLL_COST = calculatePaidRollCost(paidRollsRemaining > 0 ? (60 - paidRollsRemaining) : 0);

  const handleRoll = async (isFree: boolean): Promise<void> => {
    if (isFree && !canRollFree) {
      toast.error('❌ No free rolls remaining!', {
        description: 'Try purchasing paid rolls to continue',
      });
      return;
    }

    if (!isFree && !canRollPaid) {
      toast.error('❌ No paid rolls remaining!', {
        description: 'Maximum rolls reached for this period',
      });
      return;
    }

    try {
      setIsRolling(true);
      setLastRollWasPaid(!isFree);
      setShowResults(false);
      setDice1Result(null);
      setDice2Result(null);
      setTotalResult(null);
      setBonusStats([]);

      // Start continuous animation (dice keep rolling)
      const interval = setInterval(() => {
        setDice1Result(Math.floor(Math.random() * 6) + 1);
        setDice2Result(Math.floor(Math.random() * 6) + 1);
      }, 100);
      setAnimationInterval(interval);

      // Fun mode: local simulation only (no blockchain)
      if (gameMode === 'free') {
        toast.info('🎲 Rolling dice...', {
          description: 'Get ready for bonus stats!',
        });
        setFunModeRollsUsed(prev => prev + 1);
        
        // Simulate delay for fun mode
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Stop animation
        clearInterval(interval);
        setAnimationInterval(null);
        
        // Generate final results for fun mode
        const finalDice1 = Math.floor(Math.random() * 6) + 1;
        const finalDice2 = Math.floor(Math.random() * 6) + 1;
        const total = finalDice1 + finalDice2;
        
        setDice1Result(finalDice1);
        setDice2Result(finalDice2);
        setTotalResult(total);
        
        const stats = generateBonusStats(total);
        setBonusStats(stats);
        
        // Show results
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsRolling(false);
        setShowResults(true);
        
        toast.success('✅ Bonus stats activated!', {
          description: `You rolled ${total}! Your character has been enhanced`,
        });
      } else {
        // Prize pool mode: call contract and let useEffect handle confirmation
        toast.info(`🎲 Rolling dice on blockchain...`, {
          description: `Using ${isFree ? 'free' : 'paid'} roll - Please confirm transaction`,
        });
        
        setWaitingForConfirmation(true);
        
        // Calculate price for paid roll based on current paidRollsUsed
        const paidRollsUsed = paidRollsRemaining > 0 ? (60 - paidRollsRemaining) : 0;
        const priceForThisRoll = calculatePaidRollCost(paidRollsUsed);
        
        console.log('🎲 Paid roll details:', {
          paidRollsUsed,
          paidRollsRemaining,
          priceForThisRoll: priceForThisRoll.toString(),
          priceInEth: formatEther(priceForThisRoll)
        });
        
        await rollDice(isFree, isFree ? BigInt(0) : priceForThisRoll);
        
        toast.info('⏳ Waiting for confirmation...', {
          description: 'Transaction submitted, waiting for blockchain confirmation',
        });
        
        // The useEffect watching isConfirmed will handle the rest
      }
    } catch (error) {
      console.error('Error rolling dice:', error);
      
      // Stop animation on error OR cancel
      if (animationInterval) {
        clearInterval(animationInterval);
        setAnimationInterval(null);
      }
      
      // Check if user cancelled transaction
      const errorMessage = error instanceof Error ? error.message : 'Please try again';
      const isCancelled = errorMessage.toLowerCase().includes('user rejected') || 
                         errorMessage.toLowerCase().includes('user denied');
      
      if (isCancelled) {
        toast.info('Transaction cancelled', {
          description: 'You can try rolling again',
        });
      } else {
        toast.error('❌ Failed to roll dice', {
          description: errorMessage,
        });
      }
      
      setIsRolling(false);
      setDice1Result(null);
      setDice2Result(null);
      setShowResults(false);
      setWaitingForConfirmation(false);
    }
  };

  const generateBonusStats = (totalValue: number): BonusStat[] => {
    const allStats = [
      { name: 'HP', icon: '❤️', isSpecial: false },
      { name: 'Damage', icon: '⚔️', isSpecial: false },
      { name: 'Speed', icon: '⚡', isSpecial: false },
      { name: 'Cooldown Reduction', icon: '⏱️', isSpecial: false },
      { name: 'Lifesteal', icon: '🩸', isSpecial: true },
      { name: 'Critical Chance', icon: '💥', isSpecial: false },
      { name: 'Defense', icon: '🛡️', isSpecial: false },
      { name: 'Critical Damage', icon: '💢', isSpecial: false },
      { name: 'Attack Speed', icon: '⚙️', isSpecial: false },
      { name: 'Dodge Chance', icon: '🌀', isSpecial: true },
    ];

    let numStats = 1;
    if (totalValue >= 4 && totalValue <= 6) numStats = 2;
    if (totalValue >= 7 && totalValue <= 9) numStats = 3;
    if (totalValue >= 10 && totalValue <= 11) numStats = 4;
    if (totalValue === 12) numStats = 6;

    const shuffled = [...allStats].sort(() => Math.random() - 0.5);
    const selectedStats = shuffled.slice(0, numStats);

    return selectedStats.map(stat => {
      const isSpecial = (stat as typeof allStats[0]).isSpecial;
      const value = isSpecial 
        ? Math.floor(Math.random() * 6) + 1
        : (Math.floor(Math.random() * 6) + 1) * 5;
      
      return {
        name: stat.name,
        icon: stat.icon,
        value,
      };
    });
  };

  const handleAccept = (): void => {
    // Validate bonusStats before accepting
    if (!bonusStats || bonusStats.length === 0) {
      toast.error('❌ No bonus stats available', {
        description: 'Please roll the dice first',
      });
      return;
    }

    console.log('✅ Accepting bonus stats:', bonusStats);
    
    try {
      onRollComplete(bonusStats);
      onClose();
    } catch (error) {
      console.error('❌ Error in handleAccept:', error);
      toast.error('❌ Failed to apply bonus', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  };

  const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-purple-950 via-indigo-950 to-black border-2 border-yellow-500/50 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-yellow-400">
            🎲🎲 Roll for Bonus Stats
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dice Usage Info */}
          <Card className="bg-black/40 border-yellow-600/30 p-3">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">🆓 Free Rolls:</span>
                <span className="text-xl font-bold text-green-400">{freeRollsRemaining}/3</span>
              </div>
              {gameMode === 'paid' && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">💎 Paid Rolls:</span>
                  <span className="text-xl font-bold text-blue-400">{paidRollsRemaining}/60</span>
                </div>
              )}
            </div>
          </Card>

          {/* Two Dice Display */}
          <div className="flex justify-center items-center gap-4 h-32">
            <div
              className={`transition-all duration-300 ${
                isRolling 
                  ? 'animate-bounce' 
                  : dice1Result 
                  ? 'scale-110 animate-in zoom-in-50' 
                  : ''
              }`}
            >
              {dice1Result ? (
                <div className="text-7xl">{diceEmojis[dice1Result - 1]}</div>
              ) : (
                <Dice6 className="w-16 h-16 text-yellow-400 opacity-50" />
              )}
            </div>

            <div
              className={`transition-all duration-300 ${
                isRolling 
                  ? 'animate-bounce delay-75' 
                  : dice2Result 
                  ? 'scale-110 animate-in zoom-in-50 delay-100' 
                  : ''
              }`}
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
                   totalResult && totalResult >= 10 ? '✨ LEGENDARY! ✨' :
                   totalResult && totalResult >= 7 ? '💎 RARE!' :
                   totalResult && totalResult >= 4 ? '⭐ UNCOMMON' : '📦 COMMON'}
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
                {/* Free Roll Button */}
                {canRollFree && (
                  <Button
                    onClick={() => handleRoll(true)}
                    disabled={isRolling || isPending || isConfirming}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-lg py-6"
                  >
                    {isRolling || isPending || isConfirming ? (
                      <span className="flex items-center gap-2">
                        <Dice6 className="w-5 h-5 animate-spin" />
                        Rolling...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        Roll FREE ({freeRollsRemaining} left)
                      </span>
                    )}
                  </Button>
                )}

                {/* Paid Roll Button - Only for paid mode */}
                {gameMode === 'paid' && canRollPaid && (
                  <>
                    {/* Exponential Pricing Info */}
                    <Card className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-blue-500/50 p-3">
                      <div className="text-center space-y-1">
                        <p className="text-xs text-blue-300 font-semibold">⚡ Dynamic Pricing</p>
                        <p className="text-xs text-gray-300">
                          Price doubles each roll: 0.00001 → 0.00002 → 0.00004 ETH...
                        </p>
                      </div>
                    </Card>
                    
                    <Button
                      onClick={() => handleRoll(false)}
                      disabled={isRolling || isPending || isConfirming}
                      variant="outline"
                      className="w-full border-2 border-blue-500 text-blue-300 hover:bg-blue-900/30 font-bold py-4"
                    >
                      {isRolling || isPending || isConfirming ? (
                        'Processing...'
                      ) : (
                        <span className="flex items-center gap-2">
                          <Coins className="w-4 h-4" />
                          Buy Roll ({formatEther(calculatePaidRollCost(60 - paidRollsRemaining))} ETH) - {paidRollsRemaining} left
                        </span>
                      )}
                    </Button>
                  </>
                )}
                
                {/* Skip Button */}
                <Button
                  onClick={onSkip}
                  disabled={isRolling || isPending || isConfirming}
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
                
                {/* Roll Again Button */}
                {(canRollFree || canRollPaid) && (
                  <Button
                    onClick={() => {
                      setShowResults(false);
                      // Auto-select roll type based on availability
                      if (canRollFree) {
                        handleRoll(true);
                      } else if (canRollPaid) {
                        handleRoll(false);
                      }
                    }}
                    variant="outline"
                    className="w-full border-2 border-yellow-500 text-yellow-300 hover:bg-yellow-900/30 hover:text-yellow-200 font-bold py-4"
                  >
                    🎲 Roll Again
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Rules */}
          <Card className="bg-black/20 border-gray-700/30 p-3">
            <h4 className="text-xs font-bold text-yellow-400 mb-1">🎲 Rarity System:</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• 📦 Roll 2-3 (COMMON): 1 stat</li>
              <li>• ⭐ Roll 4-6 (UNCOMMON): 2 stats</li>
              <li>• 💎 Roll 7-9 (RARE): 3 stats</li>
              <li>• ✨ Roll 10-11 (LEGENDARY): 4 stats</li>
              <li>• 🎉 Roll 12 (JACKPOT): 6 stats!</li>
              <li>• Normal stats: +5% to +30%</li>
              <li>• Lifesteal/Dodge: +1% to +6%</li>
              {gameMode === 'free' ? (
                <li>• Fun Mode: 3 free rolls per game</li>
              ) : (
                <>
                  <li>• Free: 3 rolls per period</li>
                  <li>• Paid: 60 rolls per period (price doubles: 0.00001 → 0.00002 → 0.00004 ETH...)</li>
                </>
              )}
            </ul>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
