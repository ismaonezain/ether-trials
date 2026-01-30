kono
  'use client';

import { useState, useEffect } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTRIAContractv21 } from '@/hooks/useTRIAContractv21';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { safeSessionStorage } from '@/lib/safeStorage';
import { TRIA_TOKEN_ADDRESS } from '@/lib/contracts/etherTrialsTRIAv21ABI';
import { sdk } from '@farcaster/miniapp-sdk';

interface TournamentEntryModalV21Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TournamentEntryModalV21({ isOpen, onClose, onSuccess }: TournamentEntryModalV21Props): JSX.Element {
  const { profile } = useFarcasterProfile();
  const { address } = useAccount();
  const fid = profile?.fid ? BigInt(profile.fid) : undefined;

  const {
    approveTria,
    enterTournament,
    useCurrentPeriod,
    useGetCurrentPeriodInfo,
    useGetPlayerInfo,
    useMinEntry,
    useMaxEntry,
    useTriaBalance,
    useTriaAllowance,
    useTriaDecimals,
  } = useTRIAContractv21();

  // Read contract state
  const { data: currentPeriod } = useCurrentPeriod();
  const { data: periodInfo } = useGetCurrentPeriodInfo();
  const { data: playerInfo, refetch: refetchPlayerInfo } = useGetPlayerInfo(address, currentPeriod);
  const { data: minEntryWei } = useMinEntry();
  const { data: maxEntryWei } = useMaxEntry();
  const { data: triaBalance } = useTriaBalance(address);
  const { data: triaAllowance } = useTriaAllowance(address);
  const { data: triaDecimals } = useTriaDecimals();

  // State
  const [step, setStep] = useState<'choose' | 'approving' | 'entering' | 'waiting' | 'done'>('choose');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [entryAmount, setEntryAmount] = useState<string>('50000'); // Default 50k TRIA
  const [waitingTimeLeft, setWaitingTimeLeft] = useState<number>(10); // 10 seconds
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);

  // Constants for display
  const decimals = triaDecimals || 18;
  const minEntry = minEntryWei ? Number(formatUnits(minEntryWei, decimals)) : 50000;
  const maxEntry = maxEntryWei ? Number(formatUnits(maxEntryWei, decimals)) : 6000000000;
  const balance = triaBalance ? Number(formatUnits(triaBalance, decimals)) : 0;
  const allowance = triaAllowance ? Number(formatUnits(triaAllowance, decimals)) : 0;

  // Check if already entered
  const hasAlreadyEntered = playerInfo?.[0] || false; // hasEntered from getPlayerInfo

  // Show toast when modal opens if already entered
  useEffect(() => {
    if (isOpen && hasAlreadyEntered) {
      console.log('⚠️ User has already entered period:', currentPeriod?.toString());
      const hasShownToast = safeSessionStorage.getItem('tournament-entry-toast-shown-v21');
      if (!hasShownToast) {
        toast.warning(`You have already entered Period ${currentPeriod?.toString() || 'N/A'}!`);
        safeSessionStorage.setItem('tournament-entry-toast-shown-v21', 'true');
      }
    }
  }, [isOpen, hasAlreadyEntered, currentPeriod]);

  // 🆕 Countdown timer and polling for blockchain confirmation
  useEffect(() => {
    if (step !== 'waiting') return;

    let countdownInterval: NodeJS.Timeout | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;

    // Countdown timer
    countdownInterval = setInterval(() => {
      setWaitingTimeLeft((prev: number) => {
        if (prev <= 1) {
          // Time's up! Proceed to done
          if (countdownInterval) clearInterval(countdownInterval);
          if (pollingInterval) clearInterval(pollingInterval);
          setStep('done');
          toast.success('✅ Ready to play!', {
            description: 'You can now proceed to class selection',
          });
          if (onSuccess) {
            onSuccess();
          }
          setTimeout(() => {
            onClose();
          }, 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Polling to check if transaction is confirmed on blockchain
    pollingInterval = setInterval(async () => {
      console.log('🔍 Polling for blockchain confirmation - FORCE REFETCH...');
      try {
        // 🆕 CRITICAL FIX: Force refetch from blockchain (not cached data)
        const result = await refetchPlayerInfo();
        const freshPlayerInfo = result.data;
        
        console.log('📊 Fresh playerInfo from blockchain:', freshPlayerInfo);
        
        // Check if playerInfo has been updated (hasEntered = true)
        if (freshPlayerInfo && Array.isArray(freshPlayerInfo) && freshPlayerInfo[0] === true) {
          console.log('✅ Blockchain confirmation detected!');
          if (countdownInterval) clearInterval(countdownInterval);
          if (pollingInterval) clearInterval(pollingInterval);
          setIsConfirmed(true);
          setStep('done');
          toast.success('✅ Blockchain confirmed!', {
            description: 'Your entry is verified on-chain. Ready to play!',
          });
          if (onSuccess) {
            onSuccess();
          }
          setTimeout(() => {
            onClose();
          }, 2000);
        }
      } catch (error) {
        console.error('⚠️ Error refetching playerInfo:', error);
        // Continue polling on error
      }
    }, 5000); // Poll every 5 seconds with force refetch

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [step, playerInfo, refetchPlayerInfo, onSuccess, onClose]);

  // Handle buy TRIA - Uses Farcaster built-in swap
  const handleBuyTria = async (): Promise<void> => {
    try {
      toast.info('🔄 Opening swap...', {
        description: 'Loading Farcaster swap interface',
      });

      // Use Farcaster SDK built-in swap
      // CAIP-19 format: eip155:{chainId}/erc20:{tokenAddress}
      const result = await sdk.actions.swapToken({
        sellToken: 'eip155:8453/native', // Base ETH
        buyToken: `eip155:8453/erc20:${TRIA_TOKEN_ADDRESS}`, // TRIA on Base
        sellAmount: '10000000000000000', // 0.01 ETH default
      });

      if (result && !result.error) {
        toast.success('✅ Swap completed!', {
          description: 'Check your TRIA balance and enter tournament',
        });
      } else {
        toast.error('Swap cancelled or failed', {
          description: result?.error || 'Please try again',
        });
      }
    } catch (error) {
      console.error('Swap error:', error);
      toast.error('Failed to open swap', {
        description: 'Please try again or swap manually',
      });
    }
  };

  // Validate entry amount
  const isValidAmount = (): boolean => {
    const amount = Number(entryAmount);
    return amount >= minEntry && amount <= maxEntry && amount <= balance;
  };

  // Check if needs approval
  const needsApproval = (): boolean => {
    const amount = Number(entryAmount);
    return allowance < amount;
  };

  // Handle approve TRIA
  const handleApproveTria = async (): Promise<void> => {
    if (!fid || !address) {
      toast.error('Wallet not connected', {
        description: 'Please connect your wallet first',
      });
      return;
    }

    if (!isValidAmount()) {
      toast.error('Invalid amount', {
        description: `Please enter between ${minEntry.toLocaleString()} and ${maxEntry.toLocaleString()} TRIA`,
      });
      return;
    }

    try {
      setStep('approving');
      setIsProcessing(true);
      toast.info('🔓 Approving TRIA...', {
        description: 'Please confirm in your wallet',
      });

      // Approve unlimited (or specific amount)
      const amountToApprove = parseUnits(entryAmount, decimals);
      await approveTria(amountToApprove);

      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast.success('✅ TRIA approved!', {
        description: 'Now you can enter tournament',
      });
      
      // Auto-proceed to entry
      await handleJoinTournament();
    } catch (err) {
      console.error('Error approving TRIA:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to approve TRIA');
      setStep('choose');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle join tournament
  const handleJoinTournament = async (): Promise<void> => {
    if (!fid || !address) {
      toast.error('Wallet not connected', {
        description: 'Please connect your wallet first',
      });
      return;
    }

    if (!isValidAmount()) {
      toast.error('Invalid amount', {
        description: `Please enter between ${minEntry.toLocaleString()} and ${maxEntry.toLocaleString()} TRIA`,
      });
      return;
    }

    try {
      setStep('entering');
      setIsProcessing(true);
      toast.info('💰 Entering tournament...', {
        description: 'Depositing your TRIA tokens',
      });

      // Enter tournament with TRIA
      const amountInWei = parseUnits(entryAmount, decimals);
      await enterTournament(amountInWei);

      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Store entry amount for later use
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastEntryAmountWei', amountInWei.toString());
        localStorage.setItem('lastEntryAmountTRIA', entryAmount);
      }

      // 🆕 INSERT ENTRY TO SUPABASE IMMEDIATELY AFTER PAYMENT
      try {
        const supabaseUrl = 'https://inyeiolqczefkuwrpqyu.supabase.co';
        const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlueWVpb2xxY3plZmt1d3JwcXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjQxMDUsImV4cCI6MjA3ODEwMDEwNX0.kwNM6FVZyusEPMmCqhhOeHb4Guhh2YDocbh6qJjkvoo';
        
        if (supabaseUrl && supabaseAnonKey && currentPeriod) {
          console.log('💾 Inserting entry to Supabase after payment');
          const periodNumber = Number(currentPeriod);
          const fidNumber = Number(fid);
          const identity = `web_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          
          // Get username from Farcaster or fallback
          const username = profile?.username || profile?.displayName || `user-${fid}`;
          
          const response = await fetch(`${supabaseUrl}/rest/v1/entry`, {
            method: 'POST',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              identity: identity,
              username: username,
              period: periodNumber,
              fid: fidNumber,
              score: 0,
              stage: 0,
              remaining_hp_percent: 0,
              completion_time_seconds: 0,
              wallet_address: address,
              class_name: '',
              pfp_url: profile?.pfpUrl || '',
              entry_amount: amountInWei.toString()
            })
          });

          if (response.ok) {
            console.log('✅ Entry inserted to Supabase');
            // Store identity for later updates
            localStorage.setItem('lastEntryIdentity', identity);
          } else {
            console.error('❌ Failed to insert entry to Supabase:', await response.text());
          }
        }
      } catch (supabaseError) {
        console.error('⚠️ Supabase insert error (non-critical):', supabaseError);
        // Don't block the flow if Supabase fails
      }

      // 🆕 Skip waiting period - proceed immediately after deposit
      setStep('done');
      toast.success('🎉 Tournament entry successful!', {
        description: `Deposited ${Number(entryAmount).toLocaleString()} TRIA. Ready to play!`,
      });
      
      // Call onSuccess immediately - let parent handle phase change
      // Don't call onClose() here because it triggers handlePaymentCancel which sets phase back to 'selection'
      // The modal will unmount automatically when phase changes to 'classSelection'
      if (onSuccess) {
        onSuccess();
      }
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

  // V21: 100% goes to prize pool!
  const triaSplit = {
    prizePool: Number(entryAmount) * 1.0, // 100%!
    platform: 0, // NO PLATFORM FEE!
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-900 border-2 border-gray-700 tournament-entry-modal overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-yellow-400 font-bold">
            🏆 Join Tournament?
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Deposit TRIA tokens to compete for rewards!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Already Entered Warning */}
          {hasAlreadyEntered && (
            <div className="bg-red-900/50 p-3 rounded-xl border-2 border-red-500">
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

          {/* TRIA Balance Display */}
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-600">
            <div className="flex justify-between items-center mb-2">
              <div className="text-purple-400 text-sm">Your TRIA Balance</div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-purple-600 text-purple-300 hover:bg-purple-900/50"
                onClick={handleBuyTria}
              >
                🛒 Buy TRIA
              </Button>
            </div>
            <div className="text-white text-2xl font-bold">{balance.toLocaleString()} TRIA</div>
            {balance < minEntry && (
              <div className="text-red-400 text-xs mt-1">
                ⚠️ Insufficient balance. Minimum: {minEntry.toLocaleString()} TRIA
              </div>
            )}
          </div>

          {step === 'choose' && (
            <>
              {/* Entry Amount Input */}
              <div className="bg-gray-800 p-4 rounded-xl border-2 border-yellow-600">
                <div className="text-yellow-400 text-sm mb-2">Entry Amount (TRIA)</div>
                <Input
                  type="number"
                  value={entryAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntryAmount(e.target.value)}
                  className="text-2xl font-bold text-center bg-black/30 border-yellow-600/50 text-white"
                  min={minEntry}
                  max={Math.min(maxEntry, balance)}
                  step={1000}
                  disabled={isProcessing || hasAlreadyEntered}
                />
                <div className="text-yellow-300 text-xs mt-2 flex justify-between">
                  <span>Min: {minEntry.toLocaleString()}</span>
                  <span>Max: {maxEntry.toLocaleString()}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-yellow-600/50 text-yellow-300"
                    onClick={() => setEntryAmount(minEntry.toString())}
                  >
                    Min
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-yellow-600/50 text-yellow-300"
                    onClick={() => setEntryAmount('100000')}
                  >
                    100K
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-yellow-600/50 text-yellow-300"
                    onClick={() => setEntryAmount(Math.min(balance, maxEntry).toString())}
                  >
                    Max
                  </Button>
                </div>
              </div>

              {/* Prize Split Info - 100% Prize Pool! */}
              <div className="bg-gray-800/50 p-3 rounded border border-green-600/50 text-xs space-y-2">
                <div className="text-green-300 font-bold">💰 Prize Distribution</div>
                <div className="text-gray-300 space-y-1">
                  <div className="flex justify-between items-center">
                    <span>Prize Pool:</span>
                    <span className="text-green-400 font-bold text-base">{triaSplit.prizePool.toLocaleString()} TRIA (100%!)</span>
                  </div>
                  <div className="text-green-300 text-[10px] mt-1">
                    ✨ No platform fee! 100% goes to winners!
                  </div>
                </div>
              </div>

              {/* Info Box - Updated */}
              <div className="bg-gray-800/50 p-3 rounded border border-gray-600 text-xs text-gray-300 space-y-1">
                <div className="text-yellow-400 font-bold mb-1">⚡ What Happens Next:</div>
                <div>1️⃣ Approve TRIA tokens (if needed)</div>
                <div>2️⃣ Deposit TRIA to tournament</div>
                <div>3️⃣ <span className="text-green-400 font-bold">100% goes to prize pool!</span></div>
                <div>4️⃣ Points = Score × (Entry / 6B)</div>
                <div>5️⃣ Start game → Submit score → Claim TRIA rewards!</div>
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
                  className="font-bold bg-yellow-600 hover:bg-yellow-500 text-white"
                  onClick={needsApproval() ? handleApproveTria : handleJoinTournament}
                  disabled={isProcessing || !fid || hasAlreadyEntered || !isValidAmount()}
                >
                  {hasAlreadyEntered ? '🚫 Already Entered' : 
                   isProcessing ? '⚡ Processing...' : 
                   needsApproval() ? '🔓 Approve TRIA' : '💰 Enter Tournament'}
                </Button>
              </div>
            </>
          )}

          {step === 'approving' && (
            <div className="text-center py-8">
              <div className="animate-spin w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-blue-300 font-bold text-lg mb-2">
                🔓 Approving TRIA...
              </div>
              <div className="text-gray-400 text-sm">
                Please confirm the approval in your wallet
              </div>
            </div>
          )}

          {step === 'entering' && (
            <div className="text-center py-8">
              <div className="animate-spin w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-yellow-300 font-bold text-lg mb-2">
                💰 Depositing TRIA...
              </div>
              <div className="text-gray-400 text-sm">
                Please confirm the transaction in your wallet
              </div>
            </div>
          )}

          {step === 'waiting' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4 animate-pulse">⏳</div>
              <div className="text-yellow-300 font-bold text-xl mb-2">
                Waiting for Blockchain Confirmation
              </div>
              <div className="text-gray-300 text-sm mb-4">
                Your TRIA has been deposited! Waiting for blockchain to fully confirm your transaction...
              </div>
              
              {/* Countdown Timer */}
              <div className="bg-gray-800/50 p-4 rounded-xl border-2 border-blue-500/50 mb-4">
                <div className="text-blue-300 text-sm mb-2">Time Remaining</div>
                <div className="text-white text-4xl font-bold font-mono">
                  {Math.floor(waitingTimeLeft / 60)}:{String(waitingTimeLeft % 60).padStart(2, '0')}
                </div>
                <div className="text-blue-200 text-xs mt-2">
                  Maximum wait time: 10 seconds
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${((10 - waitingTimeLeft) / 10) * 100}%` }}
                />
              </div>

              {/* Info */}
              <div className="bg-gray-800/50 p-3 rounded border border-yellow-600/30 text-xs text-gray-300">
                <div className="text-yellow-400 font-bold mb-1">⚡ Why the wait?</div>
                <div className="text-left space-y-1">
                  <div>• Blockchain transactions need time to confirm</div>
                  <div>• We're checking on-chain to verify your entry</div>
                  <div>• This prevents issues when you start playing</div>
                  <div>• Usually takes a few seconds on Base network</div>
                </div>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <div className="text-green-400 font-bold text-xl mb-2">
                {isConfirmed ? 'Blockchain Confirmed!' : 'Ready to Play!'}
              </div>
              <div className="text-gray-300 text-sm">
                {Number(entryAmount).toLocaleString()} TRIA deposited. Now start your game to compete for rewards!
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
