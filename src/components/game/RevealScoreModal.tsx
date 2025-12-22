'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTRIAContractv9 } from '@/hooks/useTRIAContractv9';
import { toast } from 'sonner';

interface RevealScoreModalProps {
  isOpen: boolean;
  finalScore: number;
  onRevealSuccess: () => void;
  onSkipToGameOver?: () => void;
}

export function RevealScoreModal({ isOpen, finalScore, onRevealSuccess }: RevealScoreModalProps): JSX.Element {
  const {
    revealScore,
    isLoading,
  } = useTRIAContractv9();

  const [step, setStep] = useState<'revealing' | 'done'>('revealing');
  const [commitData, setCommitData] = useState<{
    score: number;
    nonce: number;
    hash: string;
    period: string;
  } | null>(null);
  const [revealExpired, setRevealExpired] = useState<boolean>(false);

  // Load commit data from localStorage
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const stored = localStorage.getItem('commitData');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setCommitData(data);
          
          // Auto-reveal with actual game score
          handleReveal(data.nonce);
        } catch (err) {
          console.error('Failed to parse commit data:', err);
          toast.error('Failed to load commit data');
        }
      } else {
        toast.error('No commit data found');
      }
    }
  }, [isOpen]);

  const handleReveal = async (nonce: number): Promise<void> => {
    try {
      toast.info('🔓 Revealing score...');

      // Reveal actual game score with nonce from commit
      await revealScore(BigInt(finalScore), BigInt(nonce));

      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));

      setStep('done');
      toast.success('✅ Score revealed and verified!');

      // Clean up commit data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('commitData');
      }

      // Auto proceed to game over after 2 seconds
      setTimeout(() => {
        onRevealSuccess();
      }, 2000);
    } catch (err) {
      console.error('Error revealing score:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to reveal score';
      
      // Check if reveal window expired
      if (errorMessage.includes('expired') || errorMessage.includes('window') || errorMessage.includes('too late')) {
        setRevealExpired(true);
        toast.error('⏰ Reveal window expired! You can skip to game over.');
      } else {
        toast.error(errorMessage);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md fantasy-card">
        <DialogHeader>
          <DialogTitle className="text-2xl fantasy-title glow-text bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
            🔓 Revealing Score
          </DialogTitle>
          <DialogDescription className="text-gray-300 text-sm">
            Verifying your score with the smart contract
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'revealing' && (
            <div className="text-center py-8">
              <div className="animate-spin w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-yellow-300 font-bold text-lg mb-2">
                🔓 Revealing Score...
              </div>
              <div className="text-white text-3xl font-bold mb-2">
                {finalScore.toLocaleString()}
              </div>
              <div className="text-gray-400 text-sm">
                Please wait while we verify your score
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-green-400 font-bold text-xl mb-2">
                Score Verified!
              </div>
              <div className="text-white text-3xl font-bold mb-2">
                {finalScore.toLocaleString()}
              </div>
              <div className="text-gray-300 text-sm">
                Your score has been recorded on-chain
              </div>
            </div>
          )}
          
          {/* Show Skip button if reveal expired */}
          {revealExpired && onSkipToGameOver && (
            <div className="text-center py-4">
              <div className="text-red-400 font-bold text-lg mb-4">
                ⏰ Reveal Window Expired
              </div>
              <div className="text-gray-300 text-sm mb-4">
                The reveal window has closed. You can proceed to game over.
              </div>
              <Button
                onClick={() => {
                  // Clean up commit data
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('commitData');
                  }
                  onSkipToGameOver();
                }}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold px-8 py-3 rounded-lg shadow-lg"
              >
                Skip to Game Over
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
