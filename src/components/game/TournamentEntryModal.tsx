kono
  'use client';

import { useState, useEffect, useCallback } from 'react';
import { parseEther, formatEther } from 'viem';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useTRIAContractv9 } from '@/hooks/useTRIAContractv9';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { toast } from 'sonner';
import { safeSessionStorage } from '@/lib/safeStorage';
import { checkUniswapV3Pool, formatLiquidity, getFeeTierLabel, type PoolInfo } from '@/lib/uniswap/poolChecker';

interface TournamentEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  score: number;
  onSuccess?: () => void;
  onTournamentJoined?: () => void; // Callback when user successfully joins tournament
}

export function TournamentEntryModal({ isOpen, onClose, score, onSuccess }: TournamentEntryModalProps): JSX.Element {
  const { profile } = useFarcasterProfile();
  const fid = profile?.fid ? BigInt(profile.fid) : undefined;

  const {
    enterTournament,
    currentPeriod,
    periodInfo,
    userEntry,
    scoreCommit,
    settings,
    isPending,
    isConfirming,
    isSuccess,
    error,
  } = useTRIAContractv9();

  // Calculate derived values from hook data
  const canEnterTournament = !userEntry?.hasEntered;
  const isLoading = isPending || isConfirming;

  // State definitions - MUST be before useEffect that uses them
  const [step, setStep] = useState<'choose' | 'entering' | 'done'>('choose');
  const [entryAmount, setEntryAmount] = useState<number>(0.001); // Default 0.001 ETH
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [isCheckingPool, setIsCheckingPool] = useState<boolean>(false);

  // Check Uniswap V3 pool liquidity when modal opens OR when entry amount changes
  useEffect(() => {
    const checkPool = async (): Promise<void> => {
      if (!isOpen || !settings.v3Fee) return;
      
      setIsCheckingPool(true);
      console.log('🔍 Checking Uniswap V3 pool for fee tier:', settings.v3Fee, 'with entry amount:', entryAmount);
      
      try {
        // Pass entry amount to simulate the actual swap that will happen
        const info = await checkUniswapV3Pool(settings.v3Fee, entryAmount);
        setPoolInfo(info);
        
        console.log('💧 Pool Info:', {
          exists: info.exists,
          address: info.address,
          liquidity: info.liquidity.toString(),
          hasLiquidity: info.hasLiquidity,
          warning: info.warning,
          swapSimulation: info.swapSimulation,
        });
        
        // Show warning toast if pool has issues
        if (info.warning) {
          toast.warning(info.warning, { duration: 6000 });
        }
        
        // Show error toast if swap simulation failed
        if (info.swapSimulation && !info.swapSimulation.canSwap) {
          toast.error('⚠️ SWAP WILL FAIL! Transaction will be reverted.', { duration: 8000 });
        }
      } catch (err) {
        console.error('Error checking pool:', err);
        toast.error('Failed to check pool status');
      } finally {
        setIsCheckingPool(false);
      }
    };
    
    checkPool();
  }, [isOpen, settings.v3Fee, entryAmount]);

  // Debug info - Log contract state when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 TOURNAMENT ENTRY DEBUG INFO:');
      console.log('Current Period:', currentPeriod);
      console.log('Period Info:', periodInfo);
      console.log('Contract Paused:', settings.paused);
      console.log('User Entry:', userEntry);
      console.log('Settings:', {
        minEntry: settings.minEntry,
        maxEntry: settings.maxEntry,
        v3Fee: settings.v3Fee
      });
      
      const now = Math.floor(Date.now() / 1000);
      const periodEndTime = periodInfo?.endTime ? Number(periodInfo.endTime) : 0;
      
      console.log('Now (timestamp):', now);
      console.log('Period Start Time:', periodInfo?.startTime ? Number(periodInfo.startTime) : 0);
      console.log('Period End Time:', periodEndTime);
      console.log('Period has ended?:', now >= periodEndTime);
      console.log('Period initialized?:', periodEndTime > 0);
    }
  }, [isOpen, currentPeriod, periodInfo, userEntry, settings]);

  // Constants from contract
  const MIN_ENTRY = 0.00001; // 0.00001 ETH
  const MAX_ENTRY = 1; // 1 ETH

  // Check if already entered - Show info instead of closing
  const hasAlreadyEntered = !canEnterTournament;

  // Show toast only once when modal first opens with already entered status
  useEffect(() => {
    if (isOpen && hasAlreadyEntered) {
      console.log('⚠️ User has already entered period:', currentPeriod?.toString());
      // Toast shown only once (using safe sessionStorage for Farcaster compatibility)
      const hasShownToast = safeSessionStorage.getItem('tournament-entry-toast-shown');
      if (!hasShownToast) {
        toast.warning(`You have already entered Period ${currentPeriod?.toString() || 'N/A'}!`);
        safeSessionStorage.setItem('tournament-entry-toast-shown', 'true');
      }
    }
  }, [isOpen, hasAlreadyEntered, currentPeriod]);

  // Handle join tournament - ONLY PAY ENTRY FEE
  const handleJoinTournament = async (): Promise<void> => {
    if (!fid) {
      toast.error('Farcaster profile not found');
      return;
    }

    try {
      setStep('entering');
      toast.info('💰 Entering tournament...');
      
      // Pay entry fee (V9 is wallet-based, no FID needed)
      await enterTournament(entryAmount.toString());

      // Wait for transaction confirmation
      await new Promise(resolve => setTimeout(resolve, 3000));

      setStep('done');
      toast.success('🎉 Tournament entry paid! Start your game to compete!');
      
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
    }
  };

  const handleDecline = (): void => {
    toast.info('Maybe next time! 🎮');
    onClose();
  };

  // Calculate weight based on entry amount
  const calculateWeight = (amount: number): number => {
    return Math.floor((amount / MIN_ENTRY) * 100) / 100;
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
                    You have already entered Period {currentPeriod?.toString() || 'N/A'}. Wait for period to end and admin to finalize before joining new period.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Score Display - Only show if score exists (game over scenario) */}
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
              {/* Entry Amount Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-yellow-400 text-sm">Entry Amount</span>
                  <span className="text-white font-bold">{entryAmount.toFixed(5)} ETH</span>
                </div>
                
                <Slider
                  value={[entryAmount]}
                  onValueChange={(values: number[]) => setEntryAmount(values[0] || MIN_ENTRY)}
                  min={MIN_ENTRY}
                  max={MAX_ENTRY}
                  step={0.00001}
                  className="w-full"
                />

                <div className="flex justify-between text-xs text-gray-400">
                  <span>{MIN_ENTRY} ETH</span>
                  <span>{MAX_ENTRY} ETH</span>
                </div>

                {/* Weight Info */}
                <div className="bg-blue-900/30 p-2 rounded border border-blue-600/30 text-xs text-blue-300">
                  ⚖️ <span className="font-bold">Weight: {calculateWeight(entryAmount).toFixed(2)}</span> - Higher entry = Higher reward multiplier!
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 p-3 rounded border border-yellow-600/30 text-xs text-gray-300 space-y-1">
                <div className="text-yellow-400 font-bold mb-1">⚡ What Happens Next:</div>
                <div>1️⃣ Pay entry fee to join tournament</div>
                <div>2️⃣ Entry fee split: 80% Prize Pool, 10% Buyback, 5% Treasury, 5% Mini Games</div>
                <div>3️⃣ Start game → Score committed (anti-cheat)</div>
                <div>4️⃣ End game → Score revealed & ranked!</div>
              </div>

              {/* Pool Liquidity Warning */}
              {isCheckingPool && (
                <div className="bg-blue-900/50 p-3 rounded border border-blue-600/50 text-xs text-blue-300">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                    <span>Checking Uniswap V3 pool liquidity...</span>
                  </div>
                </div>
              )}
              
              {poolInfo && !poolInfo.exists && (
                <div className="bg-red-900/80 p-3 rounded border border-red-500/50 text-xs">
                  <div className="text-red-300 font-bold mb-1">🚫 Pool Does Not Exist!</div>
                  <div className="text-red-200">
                    {poolInfo.warning}
                  </div>
                  <div className="mt-2 text-red-100 text-[10px]">
                    Current fee tier: {getFeeTierLabel(poolInfo.fee)} ({poolInfo.fee})
                  </div>
                </div>
              )}
              
              {poolInfo && poolInfo.exists && !poolInfo.hasLiquidity && (
                <div className="bg-orange-900/80 p-3 rounded border border-orange-500/50 text-xs">
                  <div className="text-orange-300 font-bold mb-1">⚠️ Zero Liquidity!</div>
                  <div className="text-orange-200">
                    {poolInfo.warning}
                  </div>
                  <div className="mt-2 space-y-1 text-orange-100 text-[10px]">
                    <div>Pool: {poolInfo.address}</div>
                    <div>Fee: {getFeeTierLabel(poolInfo.fee)}</div>
                  </div>
                </div>
              )}
              
              {poolInfo && poolInfo.exists && poolInfo.hasLiquidity && poolInfo.warning && (
                <div className="bg-yellow-900/80 p-3 rounded border border-yellow-500/50 text-xs">
                  <div className="text-yellow-300 font-bold mb-1">⚠️ Low Liquidity Warning</div>
                  <div className="text-yellow-200">
                    {poolInfo.warning}
                  </div>
                  <div className="mt-2 space-y-1 text-yellow-100 text-[10px]">
                    <div>Pool: {poolInfo.address?.slice(0, 10)}...{poolInfo.address?.slice(-8)}</div>
                    <div>Liquidity: {formatLiquidity(poolInfo.liquidity)}</div>
                    <div>Fee: {getFeeTierLabel(poolInfo.fee)}</div>
                  </div>
                </div>
              )}
              
              {/* SWAP SIMULATION FAILED - CRITICAL ERROR */}
              {poolInfo && poolInfo.swapSimulation && !poolInfo.swapSimulation.canSwap && (
                <div className="bg-red-900/90 p-4 rounded-xl border-2 border-red-400 animate-pulse text-xs">
                  <div className="text-red-200 font-bold text-sm mb-2">🚫 TRANSACTION WILL FAIL!</div>
                  <div className="text-red-100 mb-2">
                    Swap simulation failed! Your entry transaction will be reverted. DO NOT PROCEED.
                  </div>
                  <div className="text-red-200 text-[10px] space-y-1">
                    <div>Entry amount: {entryAmount.toFixed(5)} ETH</div>
                    <div>Buyback swap (10%): {formatEther(poolInfo.swapSimulation.testAmount)} ETH</div>
                    <div>Expected output: 0 TRIA (FAILED)</div>
                    <div className="mt-2 pt-2 border-t border-red-500/50">
                      <strong>Possible Causes:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>Pool liquidity too low for this swap size</li>
                        <li>Price impact too high</li>
                        <li>Smart contract slippage protection triggered</li>
                      </ul>
                    </div>
                    <div className="mt-2 pt-2 border-t border-red-500/50">
                      <strong>Solution:</strong> Ask admin to add more liquidity or try smaller entry amount.
                    </div>
                  </div>
                </div>
              )}

              {/* SWAP SIMULATION SUCCESS */}
              {poolInfo && poolInfo.exists && poolInfo.hasLiquidity && !poolInfo.warning && poolInfo.swapSimulation?.canSwap && (
                <div className="bg-green-900/50 p-3 rounded border border-green-600/50 text-xs">
                  <div className="text-green-300 font-bold mb-1">✅ Pool Ready & Swap Verified</div>
                  <div className="text-green-200 text-[10px] space-y-1 mt-1">
                    <div>Liquidity: {formatLiquidity(poolInfo.liquidity)}</div>
                    <div>Fee: {getFeeTierLabel(poolInfo.fee)}</div>
                    <div>Swap test: PASSED ✓</div>
                  </div>
                </div>
              )}

              {/* Debug Panel - Contract Status */}
              <div className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 p-3 rounded border border-gray-600/50 text-xs space-y-1">
                <div className="text-gray-300 font-bold mb-2">🔍 Contract Status (Debug)</div>
                <div className="grid grid-cols-2 gap-1 text-gray-400">
                  <div>Period:</div>
                  <div className="text-white font-mono">{currentPeriod || 0}</div>
                  
                  <div>Paused:</div>
                  <div className={settings.paused ? 'text-red-400' : 'text-green-400'}>
                    {settings.paused ? '❌ YES' : '✅ NO'}
                  </div>
                  
                  <div>Period Start:</div>
                  <div className="text-white font-mono text-[10px]">
                    {periodInfo?.startTime ? new Date(Number(periodInfo.startTime) * 1000).toLocaleString() : 'N/A'}
                  </div>
                  
                  <div>Period End:</div>
                  <div className="text-white font-mono text-[10px]">
                    {periodInfo?.endTime ? new Date(Number(periodInfo.endTime) * 1000).toLocaleString() : 'N/A'}
                  </div>
                  
                  <div>Prize Pool (ETH):</div>
                  <div className="text-yellow-400 font-mono">
                    {periodInfo?.ethPrizePool ? formatEther(periodInfo.ethPrizePool) : '0'}
                  </div>
                  
                  <div>Prize Pool (TRIA):</div>
                  <div className="text-purple-400 font-mono">
                    {periodInfo?.triaPrizePool ? formatEther(periodInfo.triaPrizePool) : '0'}
                  </div>
                </div>
                
                {/* Warning if period not initialized */}
                {periodInfo && Number(periodInfo.endTime) === 0 && (
                  <div className="mt-2 text-red-400 text-xs">
                    ⚠️ Period not initialized! Contact admin.
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="font-bold bg-black/50 border-2 border-gray-600 text-gray-300 hover:bg-gray-900/50"
                  onClick={handleDecline}
                  disabled={isLoading}
                >
                  ❌ Skip
                </Button>
                <Button
                  size="lg"
                  className="font-bold fantasy-button text-white"
                  onClick={handleJoinTournament}
                  disabled={isLoading || !fid || hasAlreadyEntered || isCheckingPool || (poolInfo && !poolInfo.exists) || (poolInfo && !poolInfo.hasLiquidity) || (poolInfo?.swapSimulation && !poolInfo.swapSimulation.canSwap)}
                >
                  {hasAlreadyEntered ? '🚫 Already Entered' : 
                   isCheckingPool ? '⏳ Checking Pool...' :
                   (poolInfo && !poolInfo.exists) ? '🚫 No Pool' :
                   (poolInfo && !poolInfo.hasLiquidity) ? '🚫 No Liquidity' :
                   (poolInfo?.swapSimulation && !poolInfo.swapSimulation.canSwap) ? '🚫 Swap Will Fail' :
                   isLoading ? '⚡ Processing...' : '💰 Pay Entry Fee'}
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
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <div className="text-green-400 font-bold text-xl mb-2">
                Entry Fee Paid!
              </div>
              <div className="text-gray-300 text-sm">
                Now start your game to compete. Your score will be committed & revealed automatically!
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
