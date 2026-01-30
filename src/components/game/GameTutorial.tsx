kono
  'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface GameTutorialProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function GameTutorial({ isOpen, onComplete, onSkip }: GameTutorialProps): JSX.Element {
  const [step, setStep] = useState<number>(0);

  const tutorialSteps = [
    {
      title: '⚔️ Welcome to Ether Trials!',
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Welcome, warrior! Ether Trials is a dark fantasy action RPG where you battle through waves of enemies and face powerful bosses.
          </p>
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-600">
            <div className="text-yellow-300 font-bold mb-2">🎮 Game Features:</div>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>• Fully automatic combat system - watch your build in action!</li>
              <li>• 6 unique classes × 6 elements = 36 combinations</li>
              <li>• Choose your build, then watch the battle unfold</li>
              <li>• Epic boss battles with special mechanics</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: '💰 Game Modes',
      content: (
        <div className="space-y-4">
          <div className="bg-gray-800/50 p-4 rounded-xl border-2 border-yellow-600/50">
            <div className="text-yellow-300 font-bold text-lg mb-2">💰 Prize Pool Mode</div>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>• Deposit TRIA tokens to enter</li>
              <li>• Compete for real rewards</li>
              <li>• 100% proportional prize distribution</li>
              <li>• Anti-cheat commit-reveal system</li>
            </ul>
          </div>
          <div className="bg-gray-800/50 p-4 rounded-xl border-2 border-green-500/50">
            <div className="text-green-300 font-bold text-lg mb-2">🎮 For Fun Mode</div>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>• Completely free to play</li>
              <li>• Practice and improve your skills</li>
              <li>• Full gameplay experience</li>
              <li>• Separate leaderboard for free players</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: '⚔️ Choose Your Class',
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">Each class has unique abilities and playstyles:</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-red-900/30 p-3 rounded-lg border border-red-500/30">
              <div className="font-bold text-red-300 mb-1">⚔️ Warrior</div>
              <div className="text-gray-400">Balanced fighter, boss specialist</div>
            </div>
            <div className="bg-green-900/30 p-3 rounded-lg border border-green-500/30">
              <div className="font-bold text-green-300 mb-1">🏹 Ranger</div>
              <div className="text-gray-400">High evade, nimble archer</div>
            </div>
            <div className="bg-purple-900/30 p-3 rounded-lg border border-purple-500/30">
              <div className="font-bold text-purple-300 mb-1">🗡️ Assassin</div>
              <div className="text-gray-400">High burst, execute enemies</div>
            </div>
            <div className="bg-blue-900/30 p-3 rounded-lg border border-blue-500/30">
              <div className="font-bold text-blue-300 mb-1">🔮 Mage</div>
              <div className="text-gray-400">Shield master, magic damage</div>
            </div>
            <div className="bg-yellow-900/30 p-3 rounded-lg border border-yellow-500/30">
              <div className="font-bold text-yellow-300 mb-1">🛡️ Paladin</div>
              <div className="text-gray-400">Tank, damage reflection</div>
            </div>
            <div className="bg-orange-900/30 p-3 rounded-lg border border-orange-500/30">
              <div className="font-bold text-orange-300 mb-1">🍳 Cook</div>
              <div className="text-gray-400">Mode switching, heal/damage</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '🔥 Elements & Bonuses',
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">Choose an element to enhance your abilities:</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-red-900/30 p-3 rounded-lg border border-red-500/30">
              <div className="font-bold text-red-300 mb-1">🔥 Fire</div>
              <div className="text-gray-400">1.5x damage + 2% regen/sec</div>
            </div>
            <div className="bg-cyan-900/30 p-3 rounded-lg border border-cyan-500/30">
              <div className="font-bold text-cyan-300 mb-1">💧 Water</div>
              <div className="text-gray-400">3% HP regen/sec + 5% defense</div>
            </div>
            <div className="bg-green-900/30 p-3 rounded-lg border border-green-500/30">
              <div className="font-bold text-green-300 mb-1">🌍 Earth</div>
              <div className="text-gray-400">25% defense + 3% regen/sec</div>
            </div>
            <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-500/30">
              <div className="font-bold text-gray-300 mb-1">🌪️ Wind</div>
              <div className="text-gray-400">-30% cooldown, +30% evade, +2% regen</div>
            </div>
            <div className="bg-purple-900/30 p-3 rounded-lg border border-purple-500/30">
              <div className="font-bold text-purple-300 mb-1">🌑 Dark</div>
              <div className="text-gray-400">+5% lifesteal, high damage</div>
            </div>
            <div className="bg-yellow-900/30 p-3 rounded-lg border border-yellow-500/30">
              <div className="font-bold text-yellow-300 mb-1">✨ Holy</div>
              <div className="text-gray-400">2% regen/sec + 2% lifesteal</div>
            </div>
          </div>
          <div className="bg-yellow-900/30 p-3 rounded-lg border border-yellow-600/50">
            <div className="text-yellow-300 font-bold text-sm mb-1">💡 Pro Tip:</div>
            <div className="text-gray-300 text-xs">Fire is pure damage! Earth is mega tank with regen. Wind gives insane speed!</div>
          </div>
        </div>
      ),
    },
    {
      title: '🎮 Gameplay',
      content: (
        <div className="space-y-4">
          <div className="bg-gray-800/50 p-4 rounded-lg border border-blue-500/30">
            <div className="text-purple-300 font-bold mb-2 text-lg">⚔️ Auto-Combat System:</div>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• <strong>Combat is automatic!</strong> Your character fights on its own</li>
              <li>• <strong>You choose:</strong> Class and Element at the start</li>
              <li>• <strong>Skills activate automatically</strong> when enemies are in range</li>
              <li>• <strong>Just watch and strategize!</strong> The action unfolds automatically</li>
            </ul>
          </div>
          <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-500/30">
            <div className="text-blue-300 font-bold mb-2">🎯 Your Role:</div>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>• Choose the best class + element combo</li>
              <li>• Roll dice for bonus stats (optional)</li>
              <li>• Watch the battle unfold</li>
              <li>• Learn from each run to optimize your build</li>
            </ul>
          </div>
          <div className="bg-green-900/30 p-4 rounded-lg border border-green-600/50">
            <div className="text-green-300 font-bold mb-2">💡 Strategy Tips:</div>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>• Warrior + Earth = Ultimate tank build</li>
              <li>• Assassin + Fire = Maximum burst damage</li>
              <li>• Ranger + Wind = Fast kiting machine</li>
              <li>• Experiment to find your favorite!</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: '🏆 Objectives & Scoring',
      content: (
        <div className="space-y-4">
          <div className="bg-gray-800/50 p-4 rounded-xl border-2 border-yellow-600/50">
            <div className="text-yellow-300 font-bold text-lg mb-2">🎯 Your Mission:</div>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Defeat waves of enemies to advance stages</li>
              <li>• Face powerful bosses every few stages</li>
              <li>• Survive as long as possible for higher scores</li>
              <li>• Your score = kills × stage × HP remaining</li>
            </ul>
          </div>
          <div className="bg-green-900/30 p-4 rounded-lg border border-green-500/30">
            <div className="text-green-300 font-bold mb-2">💡 Scoring Tips:</div>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>• Higher stages = exponential score multiplier</li>
              <li>• Finishing with more HP gives bonus points</li>
              <li>• Defeat bosses quickly for time bonuses</li>
              <li>• Kill counts multiply your final score</li>
            </ul>
          </div>
          <div className="bg-purple-900/30 p-4 rounded-lg border border-purple-600/50">
            <div className="text-purple-300 font-bold mb-2">🎲 Bonus Stats:</div>
            <div className="text-gray-300 text-sm">
              Before each game, roll dice for random bonus stats! Skip if you want to start immediately.
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '🚀 Ready to Play!',
      content: (
        <div className="space-y-4">
          <div className="bg-gray-800/50 p-6 rounded-xl border-2 border-green-500/50 text-center">
            <div className="text-4xl mb-4">⚔️🛡️🔥</div>
            <div className="text-green-300 font-bold text-xl mb-2">You're All Set!</div>
            <p className="text-gray-300 text-sm mb-4">
              You now know the basics of Ether Trials. Time to choose your path and begin your journey!
            </p>
          </div>
          <div className="bg-yellow-900/30 p-4 rounded-lg border border-yellow-600/50">
            <div className="text-yellow-300 font-bold text-sm mb-2">📚 Need Help Later?</div>
            <p className="text-gray-300 text-xs">
              You can replay this tutorial anytime from the settings menu. Check patch notes for the latest updates and balance changes!
            </p>
          </div>
          <div className="bg-purple-900/30 p-4 rounded-lg border border-purple-600/50">
            <div className="text-purple-300 font-bold text-sm mb-2">💬 Join the Community:</div>
            <p className="text-gray-300 text-xs">
              Use the global chat button to connect with other players, share strategies, and get tips from veterans!
            </p>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = tutorialSteps[step];
  const isLastStep = step === tutorialSteps.length - 1;

  const handleNext = (): void => {
    if (isLastStep) {
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  const handlePrevious = (): void => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-2 border-gray-700">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-2">
              {currentStepData.title}
            </h2>
            <div className="text-sm text-gray-400">
              Step {step + 1} of {tutorialSteps.length}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / tutorialSteps.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="min-h-[300px]">{currentStepData.content}</div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={onSkip}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Skip Tutorial
            </Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  className="border-yellow-600 text-yellow-300 hover:bg-yellow-900/30"
                >
                  ← Previous
                </Button>
              )}
              <Button
                onClick={handleNext}
                className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold"
              >
                {isLastStep ? "Let's Play! 🚀" : 'Next →'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
