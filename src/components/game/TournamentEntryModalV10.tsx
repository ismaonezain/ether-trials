kono
  'use client';

import { useState, useEffect } from 'react';
import { formatEther } from 'viem';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTRIAContractv10 } from '@/hooks/useTRIAContractv10';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { safeSessionStorage } from '@/lib/safeStorage';

interface TournamentEntryModalV10Props {
  isOpen: boolean;
  onClose: () => void;
  score: number;
  onSuccess?: () => void;
  onTournamentJoined?: () => void;
}

export function TournamentEntryModalV10({ isOpen, onClose, score, onSuccess }: TournamentEntryModalV10Props): JSX.Element {
  const { profile } = useFarcasterProfile();
  const { address } = useAccount();
  const fid = profile?.fid ? BigInt(profile.fid) : undefined;

  const {
    enterTournament,
    useCurrentPeriod,
    usePeriodInfo,
    useUserEntry,
    useMinEntry,
    useMaxEntry,
  } = useTRIAContractv10();

  // Read contract state
  const { data: currentPeriod } = useCurrentPeriod();
  const { data: periodInfo } = usePeriodInfo(currentPeriod);
  const { data: userEntry } = useUserEntry(currentPeriod, address);
  const { data: minEntryWei } = useMinEntry();
  const { data: maxEntryWei } = useMaxEntry();

  // State
  const [step, setStep] = useState<'choose' | 'entering' | 'done'>('choose');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // FIXED entry amount from contract
  const FIXED_ENTRY_AMOUNT = minEntryWei ? Number(formatEther(minEntryWei)) : 0.00002;
  const entryAmount = FIXED_ENTRY_AMOUNT;

  // Check if already entered
  const hasAlreadyEntered = userEntry?.[2] || false; // hasEntered flag

  // Show toast when modal opens if already entered
  useEffect(() => {
    if (isOpen && hasAlreadyEntered) {
      console.log('⚠️ User has already entered period:', currentPeriod?.toString());
      const hasShownToast = safeSessionStorage.getItem('tournament-entry-toast-shown-v10');
      if (!hasShownToast) {
        toast.warning(`You have already entered Period ${currentPeriod?.toString() || 'N/A'}!`);
        safeSessionStorage.setItem('tournament-entry-toast-shown-v10', 'true');
      }
    }
  }, [isOpen, hasAlreadyEntered, currentPeriod]);

  // Handle join tournament
  const handleJoinTournament = async (): Promise<void> => {
    if (!fid) {
      toast.error('Farcaster profile not found', {
        description: 'Please make sure you\'re logged in',
      });
      return;
    }

    try {
      setStep('entering');
      setIsProcessing(true);
      toast.info('💰 Entering tournament...', {
        description: 'Processing your entry payment',
      });
      
      // Pay entry fee - ETH will be swapped to TRIA inside contract
      await enterTournament(entryAmount);

      // Wait for transaction confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Store entry amount in wei for later use in weighted scoring
      const entryAmountWei = Math.floor(entryAmount * 1e18);
      console.log('💾 Entry amount stored:', entryAmountWei, 'wei (', entryAmount, 'ETH)');
      
      // Store entry amount in localStorage for next game start
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastEntryAmountWei', entryAmountWei.toString());
      }

      setStep('done');
      toast.success('🎉 Tournament entry successful!', {
        description: 'Your ETH was swapped to TRIA and added to prize pool',
      });
      
      if (onSuccess) {
        onSuccess();
      }

      // Auto close after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error joining tournament:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to join tournament');
      setStep('choose');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = (): void => {
    toast.info('Maybe next time! 🎮', {
      description: 'Play free mode to practice',
    });
    onClose();
  };

  // Calculate estimated TRIA split (rough estimate, actual depends on swap rate)
  const estimatedTriaSplit = {
    prizePool: entryAmount * 0.8, // 80% to prize pool
    platform: entryAmount * 0.2,   // 20% platform fees
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md fantasy-card tournament-entry-modal">
        <DialogHeader>
          <DialogTitle className="text-2xl fantasy-title glow-text bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
            🏆 Join Tournament?
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Enter the tournament to compete for TRIA rewards!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Already Entered Warning */}
          {hasAlreadyEntered && (
            <div className="bg-gradient-to-r from-red-900/80 to-orange-900/80 p-3 rounded-xl border-2 border-red-500/50">
              <div className="flex items-start gap-2">
                <span className="text-xl">⚠️</span>
                <div className="flex-1">
                  <div className="text-red-300 font-bold text-sm mb-1">
                    Already Entered!
                  </div>
                  <div className="text-red-100 text-xs leading-relaxed">
                    You have already entered Period {currentPeriod?.toString() || 'N/A'}. Wait for period to end before joining new period.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Score Display */}
          {score > 0 && (
            <div className="bg-gradient-to-br from-purple-900/50 to-black/50 p-4 rounded-lg border border-yellow-600/50">
              <div className="text-center">
                <div className="text-yellow-400 text-sm mb-1">Your Score</div>
                <div className="text-white text-3xl font-bold">{score.toLocaleString()}</div>
              </div>
            </div>
          )}

          {step === 'choose' && (
            <>
              {/* Fixed Entry Amount Display */}
              <div className="bg-gradient-to-r from-yellow-900/50 to-orange-900/50 p-4 rounded-xl border-2 border-yellow-600/50">
                <div className="text-center">
                  <div className="text-yellow-400 text-sm mb-2">Fixed Entry Amount</div>
                  <div className="text-white text-4xl font-bold mb-1">{FIXED_ENTRY_AMOUNT.toFixed(5)} ETH</div>
                  <div className="text-yellow-300 text-xs">
                    💎 Entry fee set on-chain
                  </div>
                </div>
              </div>

              {/* Swap Info - Simplified */}
              <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 p-3 rounded border border-purple-600/30 text-xs space-y-2">
                <div className="text-purple-300 font-bold">💱 Automatic Swap & Split</div>
                <div className="text-gray-300 space-y-1">
                  <div>✅ Your {entryAmount.toFixed(5)} ETH will be swapped to TRIA</div>
                  <div>✅ 80% TRIA → Prize Pool (you can win this!)</div>
                  <div>✅ 20% TRIA → Platform Fees</div>
                  <div className="text-purple-200 text-[10px] mt-2 pt-2 border-t border-purple-600/30">
                    All swaps happen automatically via Uniswap V3 on-chain
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 p-3 rounded border border-yellow-600/30 text-xs text-gray-300 space-y-1">
                <div className="text-yellow-400 font-bold mb-1">⚡ What Happens Next:</div>
                <div>1️⃣ Pay entry fee (ETH)</div>
                <div>2️⃣ Contract swaps 100% ETH → TRIA automatically</div>
                <div>3️⃣ 80% TRIA goes to prize pool, 20% to platform</div>
                <div>4️⃣ Start game → Submit score → Claim TRIA rewards!</div>
              </div>



              {/* Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="font-bold bg-black/50 border-2 border-gray-600 text-gray-300 hover:bg-gray-900/50"
                  onClick={handleDecline}
                  disabled={isProcessing}
                >
                  ❌ Skip
                </Button>
                <Button
                  size="lg"
                  className="font-bold fantasy-button text-white"
                  onClick={handleJoinTournament}
                  disabled={isProcessing || !fid || hasAlreadyEntered}
                >
                  {hasAlreadyEntered ? '🚫 Already Entered' : 
                   isProcessing ? '⚡ Processing...' : '💰 Pay Entry Fee'}
                </Button>
              </div>
            </>
          )}

          {step === 'entering' && (
            <div className="text-center py-8">
              <div className="animate-spin w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-yellow-300 font-bold text-lg mb-2">
                💰 Processing Payment...
              </div>
              <div className="text-gray-400 text-sm">
                Please confirm the transaction in your wallet
              </div>
              <div className="text-purple-300 text-xs mt-2">
                Swapping your ETH to TRIA on-chain...
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <div className="text-green-400 font-bold text-xl mb-2">
                Entry Successful!
              </div>
              <div className="text-gray-300 text-sm">
                Your ETH was swapped to TRIA. Now start your game to compete for TRIA rewards!
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
