akoyk
  'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dice6, Zap, Coins, TrendingUp } from 'lucide-react';
import { useFarcasterTransaction } from '@/hooks/useFarcasterTransaction';
import { toast } from 'sonner';

interface BonusStat {
  name: string;
  value: number;
  icon: string;
}

interface DiceRollModalProps {
  isOpen: boolean;
  onClose: () => void;
  remainingAttempts: number;
  onRollComplete: (bonusStats: BonusStat[]) => void;
  onPurchaseAttempts: () => void;
  onSkip: () => void;
  onConsumeAttempt: () => void; // NEW: Callback to consume attempt
  gameMode?: 'free' | 'paid';
}

const OWNER_ADDRESS = '0x8453df2Bc1DD2e1292a08e7fa026D15d83a6B25D';
const ATTEMPT_COST = '0.00001';

export function DiceRollModal({
  isOpen,
  onClose,
  remainingAttempts,
  onRollComplete,
  onPurchaseAttempts,
  onSkip,
  onConsumeAttempt,
  gameMode = 'free',
}: DiceRollModalProps): JSX.Element {
  const [isRolling, setIsRolling] = useState(false);
  const [dice1Result, setDice1Result] = useState<number | null>(null);
  const [dice2Result, setDice2Result] = useState<number | null>(null);
  const [totalResult, setTotalResult] = useState<number | null>(null);
  const [bonusStats, setBonusStats] = useState<BonusStat[]>([]);
  const [showResults, setShowResults] = useState(false);
  const { sendTransaction } = useFarcasterTransaction();
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setDice1Result(null);
      setDice2Result(null);
      setTotalResult(null);
      setBonusStats([]);
      setShowResults(false);
    }
  }, [isOpen]);

  const rollDice = async (): Promise<void> => {
    if (remainingAttempts <= 0) {
      toast.error('No attempts remaining! Purchase more attempts to continue.');
      return;
    }

    // CONSUME ATTEMPT BEFORE ROLLING
    onConsumeAttempt();

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
        }, 500);
      }
    }, intervalTime);
  };

  const generateBonusStats = (totalValue: number): BonusStat[] => {
    const allStats = [
      { name: 'HP', icon: '❤️', isSpecial: false },
      { name: 'Damage', icon: '⚔️', isSpecial: false },
      { name: 'Cooldown Reduction', icon: '⏱️', isSpecial: false },
      { name: 'Lifesteal', icon: '🩸', isSpecial: true }, // Special: 1-6%
      { name: 'Critical Chance', icon: '💥', isSpecial: false },
      { name: 'Defense', icon: '🛡️', isSpecial: true }, // Special: 1-6% - NERFED v3.2.0
      { name: 'Critical Damage', icon: '💢', isSpecial: false },
      { name: 'Attack Speed', icon: '⚙️', isSpecial: false },
      { name: 'Dodge Chance', icon: '🌀', isSpecial: true }, // Special: 1-6%
    ];

    // Number of stats based on total dice result (2-12)
    // 2-3: 1 stat, 4-6: 2 stats, 7-9: 3 stats, 10-11: 4 stats, 12: 6 stats (jackpot!)
    let numStats = 1;
    if (totalValue >= 4 && totalValue <= 6) numStats = 2;
    if (totalValue >= 7 && totalValue <= 9) numStats = 3;
    if (totalValue >= 10 && totalValue <= 11) numStats = 4;
    if (totalValue === 12) numStats = 6; // Jackpot! 6 bonus stats

    // Shuffle and pick random stats
    const shuffled = [...allStats].sort(() => Math.random() - 0.5);
    const selectedStats = shuffled.slice(0, numStats);

    // Generate PERCENTAGE values for each stat
    // Normal stats: 5% to 30% (5%, 10%, 15%, 20%, 25%, 30%)
    // Special stats (Lifesteal, Dodge): 1% to 6%
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

  const handlePurchase = async (): Promise<void> => {
    setIsPurchasing(true);
    try {
      const result = await sendTransaction({
        to: OWNER_ADDRESS,
        value: ATTEMPT_COST,
        chainId: 'eip155:8453',
      });

      if (result.transactionHash) {
        toast.success('Purchase successful! +3 attempts added');
        onPurchaseAttempts();
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      toast.error('Purchase failed. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleAccept = (): void => {
    onRollComplete(bonusStats);
    onClose();
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
          {/* Attempts Counter */}
          <Card className="bg-black/40 border-yellow-600/30 p-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-300">Attempts Remaining:</span>
              <span className="text-xl font-bold text-yellow-400">{remainingAttempts}</span>
            </div>
          </Card>

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
                   totalResult >= 10 ? '✨ LEGENDARY! ✨' :
                   totalResult >= 7 ? '💎 RARE!' :
                   totalResult >= 4 ? '⭐ UNCOMMON' : '📦 COMMON'}
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
                  onClick={rollDice}
                  disabled={isRolling || remainingAttempts <= 0}
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold text-lg py-6 disabled:opacity-50"
                >
                  {isRolling ? (
                    <span className="flex items-center gap-2">
                      <Dice6 className="w-5 h-5 animate-spin" />
                      Rolling...
                    </span>
                  ) : remainingAttempts <= 0 ? (
                    'No Attempts Left'
                  ) : (
                    <span className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      Roll Dice!
                    </span>
                  )}
                </Button>
                
                {/* Skip Button - Play without bonus */}
                <Button
                  onClick={onSkip}
                  disabled={isRolling}
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
                
                {/* Roll Again Button - Only if attempts remaining */}
                {remainingAttempts > 0 && (
                  <Button
                    onClick={() => {
                      setShowResults(false);
                      rollDice();
                    }}
                    variant="outline"
                    className="w-full border-2 border-yellow-500 text-yellow-300 hover:bg-yellow-900/30 hover:text-yellow-200 font-bold py-4"
                  >
                    🎲 Roll Again ({remainingAttempts} left)
                  </Button>
                )}
                
                {/* Purchase More for Paid Mode - When no attempts */}
                {gameMode === 'paid' && remainingAttempts === 0 && (
                  <div className="space-y-2">
                    <div className="text-center text-xs text-gray-400">
                      Want to try again? Purchase more attempts!
                    </div>
                    <Button
                      onClick={handlePurchase}
                      disabled={isPurchasing}
                      variant="outline"
                      className="w-full border-2 border-blue-500 text-blue-300 hover:bg-blue-900/30 font-bold py-4"
                    >
                      {isPurchasing ? (
                        'Processing...'
                      ) : (
                        <span className="flex items-center gap-2 justify-center">
                          <Coins className="w-4 h-4" />
                          Buy 3 Attempts ({ATTEMPT_COST} ETH)
                        </span>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Purchase More Attempts - ONLY for paid mode */}
            {gameMode === 'paid' && remainingAttempts === 0 && !showResults && (
              <Card className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border-blue-500/50 p-4">
                <div className="text-center mb-2">
                  <Coins className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                  <p className="text-sm text-gray-300">Out of attempts?</p>
                  <p className="text-xs text-gray-400">
                    Purchase 3 more attempts for {ATTEMPT_COST} ETH
                  </p>
                </div>
                <Button
                  onClick={handlePurchase}
                  disabled={isPurchasing}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold"
                >
                  {isPurchasing ? (
                    'Processing...'
                  ) : (
                    <span className="flex items-center gap-2">
                      <Coins className="w-4 h-4" />
                      Buy 3 Attempts ({ATTEMPT_COST} ETH)
                    </span>
                  )}
                </Button>
              </Card>
            )}
            
            {/* Free mode message when out of attempts */}
            {gameMode === 'free' && remainingAttempts === 0 && !showResults && (
              <Card className="bg-gradient-to-br from-gray-900/40 to-gray-800/40 border-gray-500/50 p-4">
                <div className="text-center">
                  <p className="text-sm text-gray-300 mb-2">No attempts remaining for this game</p>
                  <p className="text-xs text-gray-400">
                    You can skip and play without bonus, or use "Skip" button above
                  </p>
                </div>
              </Card>
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
              <li>• Defense/Lifesteal/Dodge: +1% to +6%</li>
              {gameMode === 'free' && <li>• Free: 3 attempts/game (reset)</li>}
              {gameMode === 'paid' && <li>• Paid: Buy more to re-roll!</li>}
            </ul>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
