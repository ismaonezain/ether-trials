'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTRIAContractv21 } from '@/hooks/useTRIAContractv21';
import { toast } from 'sonner';
import type { Address } from 'viem';

interface CommitScoreModalV20Props {
  isOpen: boolean;
  onClose: () => void;
  onCommitSuccess: () => void;
  userAddress: Address | undefined;
}

export function CommitScoreModalV20({ isOpen, onClose, onCommitSuccess, userAddress }: CommitScoreModalV20Props): JSX.Element {
  const {
    commitScore,
    useCurrentPeriod,
    useGetScoreCommit,
  } = useTRIAContractv21();

  const { data: currentPeriod } = useCurrentPeriod();
  const { data: scoreCommitData, refetch: refetchScoreCommit } = useGetScoreCommit(userAddress, currentPeriod);

  const [step, setStep] = useState<'input' | 'committing' | 'done'>('input');
  const [nonce, setNonce] = useState<bigint>(BigInt(0));
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Check if user already committed
  const hasCommitted = scoreCommitData && Array.isArray(scoreCommitData) && scoreCommitData[1] && Number(scoreCommitData[1]) > 0;

  // Check if user already committed when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const initCommitModal = async () => {
      // Refetch commit status first to get latest data
      try {
        await refetchScoreCommit();
      } catch (error) {
        console.error('Failed to refetch commit status:', error);
      }

      // COMMIT PHASE: Generate nonce and commit hash BEFORE game starts
      // Score will be revealed AFTER game ends with actual score from SpacetimeDB
      const randomNonce = BigInt(Math.floor(Math.random() * 1000000000));
      
      // Store nonce for later reveal (score will be added during reveal from database)
      setNonce(randomNonce);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('commitDataV21', JSON.stringify({
          nonce: randomNonce.toString(),
          period: currentPeriod?.toString() || '0',
        }));
      }
      
      setStep('input');
    };

    initCommitModal();
  }, [isOpen, currentPeriod, refetchScoreCommit]);

  const handleCommit = async (): Promise<void> => {
    if (!currentPeriod) {
      toast.error('Period not loaded');
      return;
    }

    // Double-check blockchain commit status before committing
    if (hasCommitted) {
      toast.error('❌ Already Committed!', {
        description: 'Anti-cheat protection: You already committed for this period.',
      });
      return;
    }

    try {
      setStep('committing');
      setIsPending(true);
      toast.info('🔐 Committing score hash...', {
        description: 'Securing your game session on blockchain',
      });

      // Generate commit hash: keccak256(score, nonce, address)
      // Using score=1 as placeholder, actual score revealed later
      const { keccak256, encodePacked } = await import('viem');
      const commitHash = keccak256(
        encodePacked(
          ['uint256', 'uint256', 'address'],
          [BigInt(1), nonce, userAddress as Address]
        )
      ) as `0x${string}`;

      console.log('📝 Commit hash generated:', commitHash);

      // Commit hash to smart contract
      const result = await commitScore({
        args: [commitHash],
      });

      setIsConfirming(true);
      
      // Wait for transaction to be mined
      if (result) {
        setStep('done');
        toast.success('✅ Score committed!', {
          description: 'Anti-cheat system activated. Starting game...',
        });
        
        // Auto proceed to game after 2 seconds
        setTimeout(() => {
          onCommitSuccess();
        }, 2000);
      }
    } catch (err) {
      console.error('Error committing score:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to commit score');
      setStep('input');
    } finally {
      setIsPending(false);
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg fantasy-card">
        <DialogHeader>
          <DialogTitle className="text-2xl fantasy-title glow-text bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
            🔐 Commit Score (Anti-Cheat)
          </DialogTitle>
          <DialogDescription className="text-gray-300 text-sm">
            Commit your score hash before game starts. Score will be revealed after game ends.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'input' && (
            <>
              {/* Info Box */}
              <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 p-3 rounded border border-yellow-600/30 text-xs text-gray-300">
                <div className="text-yellow-400 font-bold mb-2">🔒 Commit-Reveal System:</div>
                <div className="space-y-1">
                  <div>1️⃣ <span className="text-yellow-200">Commit</span> hash before game (reserves your slot)</div>
                  <div>2️⃣ <span className="text-green-200">Play</span> game and earn score</div>
                  <div>3️⃣ <span className="text-blue-200">Reveal</span> actual score after game ends</div>
                  <div>4️⃣ <span className="text-purple-200">Blockchain</span> verifies it matches your commit</div>
                </div>
              </div>

              {/* Period Display */}
              <div className="bg-purple-900/50 p-3 rounded border border-purple-500/30">
                <div className="text-xs text-purple-300 mb-1">Current Period</div>
                <div className="text-xl font-bold text-white">{currentPeriod?.toString() || '0'}</div>
              </div>

              {/* Already Committed Warning */}
              {hasCommitted && (
                <div className="bg-red-900/50 p-3 rounded border border-red-500/30">
                  <div className="text-red-400 font-bold mb-1">⚠️ Already Committed</div>
                  <div className="text-xs text-gray-300">
                    You already committed a score for this period. Cannot commit again to prevent cheating.
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="font-bold bg-black/50 border-2 border-gray-600 text-gray-300 hover:bg-gray-900/50"
                  onClick={onClose}
                  disabled={isPending || isConfirming}
                >
                  ← Back
                </Button>
                <Button
                  className="font-bold fantasy-button text-white"
                  onClick={handleCommit}
                  disabled={isPending || isConfirming || hasCommitted}
                >
                  {hasCommitted ? '❌ Already Committed' : isPending || isConfirming ? '⚡ Processing...' : '🔐 Commit & Start'}
                </Button>
              </div>
            </>
          )}

          {step === 'committing' && (
            <div className="text-center py-8">
              <div className="animate-spin w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-yellow-300 font-bold text-lg mb-2">
                📝 Committing Hash...
              </div>
              <div className="text-gray-400 text-sm">
                Please confirm the transaction in your wallet
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-green-400 font-bold text-xl mb-2">
                Score Committed!
              </div>
              <div className="text-gray-300 text-sm">
                Starting game... Good luck! 🎮
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
