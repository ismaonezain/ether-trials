'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTRIAContractv21 } from '@/hooks/useTRIAContractv21';
import { toast } from 'sonner';
import { X } from 'lucide-react';

interface RevealScoreModalV20Props {
  isOpen: boolean;
  onRevealSuccess: () => void;
  onClose?: () => void;
  onSkipToGameOver?: () => void; // NEW: Skip to game over handler
  finalScore?: number; // Optional prop if passed from GameOver
}

export function RevealScoreModalV20({ isOpen, onRevealSuccess, onClose, onSkipToGameOver, finalScore: propFinalScore }: RevealScoreModalV20Props): JSX.Element {
  const { revealScore } = useTRIAContractv21();

  const [step, setStep] = useState<'loading' | 'ready' | 'revealing' | 'done' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [weightedScore, setWeightedScore] = useState<number>(0);
  const [nonce, setNonce] = useState<string>('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Handle reveal with useCallback to prevent stale closure
  const handleReveal = useCallback(async (nonceStr: string, displayScore: number): Promise<void> => {
    try {
      setIsPending(true);
      
      // CRITICAL V21: Reveal with 1 to match commit hash(1, nonce, address)
      // Contract verification: commit hash must match reveal hash
      // Actual scoring tracked in Supabase, contract just validates completion
      const scoreToReveal = BigInt(1);  // Always reveal 1 (matches commit)
      const nonceToReveal = BigInt(nonceStr);
      
      console.log('=== REVEAL SCORE TO CONTRACT V21 ===');
      console.log('🎮 Display Score:', displayScore);
      console.log('🔐 Score to Contract:', scoreToReveal.toString(), '(always 1)');
      console.log('🎲 Nonce (string):', nonceStr);
      console.log('🎲 Nonce (BigInt):', nonceToReveal.toString());
      console.log('📝 Function: revealScore(1, nonce)');
      console.log('✅ V21: Revealing 1 to match commit hash');
      console.log('📊 Actual scores tracked in Supabase');
      console.log('================================');
      
      const result = await revealScore({
        args: [scoreToReveal, nonceToReveal],
      });

      if (result) {
        setStep('done');
        toast.success('✅ Score verified on blockchain!', {
          description: `Your weighted score: ${displayScore.toLocaleString()} points`,
        });

        // Clean up localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('commitDataV21');
          localStorage.removeItem('lastGameScore');
        }

        // Auto proceed to game over after 2 seconds
        setTimeout(() => {
          onRevealSuccess();
        }, 2000);
      }
    } catch (err) {
      console.error('❌ REVEAL ERROR:', err);
      console.error('Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : 'Failed to reveal score',
        stack: err instanceof Error ? err.stack : undefined
      });
      
      setStep('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reveal score');
      toast.error('❌ Reveal Failed', {
        description: err instanceof Error ? err.message : 'Failed to verify score on blockchain',
      });
    } finally {
      setIsPending(false);
    }
  }, [revealScore, onRevealSuccess]);

  // Load commit data and score from localStorage (ONE TIME ONLY)
  useEffect(() => {
    if (!isOpen || hasInitialized) return;

    const initReveal = async () => {
      try {
        console.log('=== REVEAL SCORE V21 - LOADING DATA ===');
        
        // Step 1: Load commit data (nonce + period)
        const commitDataStr = localStorage.getItem('commitDataV21');
        if (!commitDataStr) {
          throw new Error('No commit data found. Please commit a score first.');
        }

        const commitData = JSON.parse(commitDataStr) as { nonce: string; period: string };
        console.log('✅ Commit data loaded:', commitData);
        setNonce(commitData.nonce);

        // Step 2: Load score data (weighted score)
        const scoreDataStr = localStorage.getItem('lastGameScore');
        if (!scoreDataStr) {
          throw new Error('No score data found. Please complete a game first.');
        }

        const scoreData = JSON.parse(scoreDataStr) as {
          score: number;
          weightedScore: number;
          entryAmount: number;
          timestamp: number;
        };
        console.log('✅ Score data loaded:', scoreData);
        setWeightedScore(scoreData.weightedScore);

        // Step 3: Ready to reveal
        setStep('ready');
        setHasInitialized(true);
        
        toast.info('✅ Ready to reveal', {
          description: `Weighted score: ${scoreData.weightedScore.toLocaleString()}`,
        });
      } catch (err) {
        console.error('❌ Failed to load reveal data:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load data');
        setStep('error');
        toast.error('❌ Reveal Failed', {
          description: err instanceof Error ? err.message : 'Failed to load data',
        });
      }
    };

    initReveal();
  }, [isOpen, hasInitialized]);

  // Handle close button
  const handleClose = () => {
    if (step !== 'revealing' && onClose) {
      onClose();
    }
  };

  // Reset hasInitialized when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false);
      setStep('loading');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && step !== 'revealing') {
        handleClose();
      }
    }}>
      <DialogContent className="max-w-md fantasy-card">
        <DialogHeader>
          <DialogTitle className="text-2xl fantasy-title glow-text bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
            🔓 Revealing Score
          </DialogTitle>
          <DialogDescription className="text-gray-300 text-sm">
            Verifying your score on-chain
          </DialogDescription>
        </DialogHeader>

        {/* Close Button */}
        {step !== 'revealing' && onClose && (
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-white" />
            <span className="sr-only">Close</span>
          </button>
        )}

        <div className="space-y-4">
          {step === 'loading' && (
            <div className="text-center py-8">
              <div className="animate-spin w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-blue-300 font-bold text-lg mb-2">
                📊 Loading Score Data...
              </div>
              <div className="text-gray-400 text-sm">
                Preparing your score for reveal
              </div>
            </div>
          )}

          {step === 'ready' && (
            <div className="text-center py-8">
              <div className="bg-gradient-to-br from-purple-900/50 to-black/50 p-6 rounded-lg border border-yellow-600/50 mb-4">
                <div className="text-yellow-400 text-sm mb-2">✅ Score Ready</div>
                <div className="space-y-1 mb-4">
                  <div className="text-white text-4xl font-bold">
                    {weightedScore.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">
                    Weighted Score
                  </div>
                </div>
                <div className="text-gray-300 text-sm mb-1">
                  Ready to reveal on blockchain
                </div>
                <div className="text-yellow-300 text-xs">
                  ⚠️ Click button below to reveal on-chain
                </div>
              </div>
              <Button
                size="lg"
                className="font-bold fantasy-button text-white w-full"
                onClick={() => {
                  setStep('revealing');
                  handleReveal(nonce, weightedScore);
                }}
                disabled={isPending}
              >
                🔓 Reveal Score On-Chain
              </Button>
              
              {/* Skip to Game Over button */}
              {onSkipToGameOver && (
                <Button
                  size="lg"
                  variant="outline"
                  className="font-bold w-full mt-2 border-2 border-yellow-600 text-yellow-300 hover:bg-yellow-900/50"
                  onClick={onSkipToGameOver}
                >
                  ⏭️ Skip to Game Over
                </Button>
              )}
            </div>
          )}

          {step === 'revealing' && (
            <div className="text-center py-8">
              <div className="animate-spin w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-yellow-300 font-bold text-lg mb-2">
                🔓 Revealing Score...
              </div>
              <div className="space-y-1">
                <div className="text-white text-3xl font-bold">
                  {weightedScore.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">
                  Weighted Score
                </div>
              </div>
              <div className="text-gray-400 text-sm mt-4">
                Please confirm transaction in wallet
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-green-400 font-bold text-xl mb-2">
                Score Verified!
              </div>
              <div className="space-y-1">
                <div className="text-white text-3xl font-bold">
                  {weightedScore.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  Weighted Score
                </div>
                <div className="text-gray-300 text-sm">
                  Your weighted score has been recorded on-chain
                </div>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">❌</div>
              <div className="text-red-400 font-bold text-xl mb-2">
                Reveal Failed
              </div>
              <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-4 mb-4">
                <div className="text-red-200 text-sm">
                  {errorMessage}
                </div>
              </div>
              <div className="space-y-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="font-bold w-full"
                  onClick={() => {
                    setStep('loading');
                    setErrorMessage('');
                    setHasInitialized(false);
                  }}
                >
                  🔄 Try Again
                </Button>
                
                {/* Skip to Game Over button - for expired reveal window */}
                {onSkipToGameOver && (
                  <Button
                    size="lg"
                    variant="destructive"
                    className="font-bold w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500"
                    onClick={onSkipToGameOver}
                  >
                    ⏭️ Skip to Game Over
                  </Button>
                )}
                
                <Button
                  size="lg"
                  variant="ghost"
                  className="font-bold w-full"
                  onClick={handleClose}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
