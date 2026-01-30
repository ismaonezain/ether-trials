kono
  'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, Gamepad2, Trophy, Coins } from 'lucide-react';

interface WelcomeOnboardingProps {
  onComplete: () => void;
}

export function WelcomeOnboarding({ onComplete }: WelcomeOnboardingProps): JSX.Element {
  const [currentSlide, setCurrentSlide] = useState<number>(0);

  const slides = [
    {
      icon: <Gamepad2 className="w-16 h-16 text-purple-400 mb-4" />,
      title: "Welcome to Ether Trials",
      description: "An onchain RPG tournament on Base",
      points: [
        "Battle through waves of enemies",
        "Choose from 6 unique character classes",
        "Each class has different abilities and playstyles",
        "Compete for real TRIA prizes or practice for free"
      ]
    },
    {
      icon: <Trophy className="w-16 h-16 text-yellow-400 mb-4" />,
      title: "Two Game Modes",
      description: "Choose your path",
      points: [
        "🎮 For Fun: Practice unlimited, completely free",
        "🏆 Prize Pool: Deposit TRIA to compete",
        "Top 3 players win TRIA prizes every 24 hours",
        "All scores are verified onchain (anti-cheat)"
      ]
    },
    {
      icon: <Coins className="w-16 h-16 text-green-400 mb-4" />,
      title: "How to Play",
      description: "Quick start guide",
      points: [
        "1. Connect wallet & pick a character class",
        "2. Choose game mode (Free or Prize Pool)",
        "3. Battle enemies and survive as long as possible",
        "4. Your score is automatically submitted",
        "5. Check leaderboard for rankings & prizes"
      ]
    }
  ];

  const currentSlideData = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  const handleNext = (): void => {
    if (isLastSlide) {
      onComplete();
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const handleSkip = (): void => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full fantasy-card">
        <CardContent className="p-8 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            {currentSlideData.icon}
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-yellow-300 fantasy-title glow-text">
              {currentSlideData.title}
            </h2>
            <p className="text-gray-300 text-sm medieval-text">
              {currentSlideData.description}
            </p>
          </div>

          {/* Points */}
          <div className="bg-black/50 rounded-lg p-4 space-y-3 border border-yellow-600/30">
            {currentSlideData.points.map((point, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-400 mt-2 flex-shrink-0 shadow-lg shadow-yellow-500/50" />
                <p className="text-gray-200 text-sm leading-relaxed">{point}</p>
              </div>
            ))}
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center gap-2 pt-2">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'w-8 bg-yellow-400 shadow-lg shadow-yellow-500/50'
                    : 'w-2 bg-gray-700'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            {!isLastSlide && (
              <Button
                variant="outline"
                className="flex-1 bg-black/50 border-yellow-600/50 text-gray-300 hover:bg-gray-800"
                onClick={handleSkip}
              >
                Skip
              </Button>
            )}
            <Button
              className={`${!isLastSlide ? 'flex-1' : 'w-full'} fantasy-button text-lg font-bold`}
              onClick={handleNext}
            >
              {isLastSlide ? (
                "⚔️ Enter the Trials"
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </div>

          {/* Footer Note */}
          <p className="text-center text-gray-500 text-xs pt-2">
            {isLastSlide 
              ? "⚔️ Prepare yourself, warrior!"
              : `${currentSlide + 1} of ${slides.length}`
            }
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
