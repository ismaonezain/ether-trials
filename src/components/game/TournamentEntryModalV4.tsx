'use client';

import React, { useState, useEffect } from 'react';
import { X, Coins, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePointBasedContractV4 } from '@/hooks/usePointBasedContractV4';
import { formatEther, parseEther } from 'viem';

interface TournamentEntryModalV4Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TournamentEntryModalV4({ isOpen, onClose, onSuccess }: TournamentEntryModalV4Props) {
  const { address, isConnected } = useAccount();
  const { enterTournament, minEntry, maxEntry, isPending, isConfirming, isConfirmed, error, currentPeriod, userPeriods } = usePointBasedContractV4();
  const [status, setStatus] = useState<'idle' | 'paying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [entryAmount, setEntryAmount] = useState<number>(0.00002); // Default to min
  
  // Check if user has already entered current period
  const hasAlreadyEntered = currentPeriod && userPeriods && userPeriods.includes(currentPeriod);

  // Update entry amount when contract values load
  useEffect(() => {
    if (minEntry) {
      const minEth = Number(formatEther(minEntry));
      setEntryAmount(minEth);
    }
  }, [minEntry]);

  // Watch for transaction confirmation
  useEffect(() => {
    if (isConfirmed && status === 'paying') {
      setStatus('success');
      
      // Save entry amount to localStorage for weighted scoring
      const entryAmountWei = parseEther(entryAmount.toString());
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastEntryAmountWei', entryAmountWei.toString());
        console.log('💰 Saved entry amount to localStorage:', entryAmountWei.toString(), 'wei');
      }
    }
  }, [isConfirmed, status, entryAmount]);

  // Watch for transaction errors
  useEffect(() => {
    if (error && status === 'paying') {
      setStatus('error');
      setErrorMessage(error.message || 'Transaction failed');
    }
  }, [error, status]);

  if (!isOpen) return null;

  const MIN_ETH = minEntry ? Number(formatEther(minEntry)) : 0.00002;
  const MAX_ETH = maxEntry ? Number(formatEther(maxEntry)) : 1;

  const handlePayEntry = async () => {
    if (!isConnected || !address) {
      setStatus('error');
      setErrorMessage('Please connect your wallet first');
      return;
    }

    try {
      setStatus('paying');
      setErrorMessage('');

      const amountWei = parseEther(entryAmount.toString());
      enterTournament(amountWei);
      // Transaction will be tracked by useEffect watching isConfirmed
    } catch (error: unknown) {
      console.error('Entry payment failed:', error);
      setStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'Transaction failed';
      setErrorMessage(errorMsg);
    }
  };

  const prizeAmount = (entryAmount * 0.8).toFixed(5);
  const platformFee = (entryAmount * 0.2).toFixed(5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-purple-900 to-indigo-900 border-2 border-purple-500 rounded-lg max-w-md w-full shadow-2xl my-4">
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-purple-500/30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">Tournament Entry</h2>
          </div>
          <button
            onClick={onClose}
            className="text-purple-300 hover:text-white transition-colors"
            disabled={status === 'paying'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Already Entered State */}
          {hasAlreadyEntered ? (
            <>
              <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-6">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-600/30 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-green-300 mb-2">
                      ✅ Already Entered!
                    </h3>
                    <p className="text-green-200 text-sm">
                      You've already paid your entry for Period {currentPeriod?.toString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3">
                <div className="text-sm text-blue-200">
                  <p className="font-semibold mb-2">Ready to Play:</p>
                  <ul className="text-xs space-y-1 ml-4">
                    <li>✅ Entry confirmed on blockchain</li>
                    <li>✅ 3 free dice rolls available</li>
                    <li>✅ Can purchase up to 60 paid dice</li>
                    <li>✅ Ready to compete for prizes!</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => {
                  // Only call onSuccess - don't close modal which would trigger onClose and go back
                  if (onSuccess) onSuccess();
                }}
                className="w-full py-4 px-4 rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-lg"
              >
                <CheckCircle2 className="w-5 h-5" />
                Continue to Character Selection →
              </button>
            </>
          ) : (
            <>
              {/* Entry Amount Selector */}
              <div className="bg-purple-900/50 border border-purple-500/30 rounded-lg p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-purple-300">Entry Amount (ETH)</label>
                <div className="text-xl font-bold text-yellow-400">
                  {entryAmount.toFixed(5)} ETH
                </div>
              </div>
              
              {/* Manual Input */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={MIN_ETH}
                  max={MAX_ETH}
                  step={0.00001}
                  value={entryAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= MIN_ETH && val <= MAX_ETH) {
                      setEntryAmount(val);
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-purple-800 border border-purple-500/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Enter amount"
                />
                <span className="text-purple-300 text-sm">ETH</span>
              </div>
              
              {/* Multiplier Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[2, 3, 4, 5].map((multiplier) => (
                  <button
                    key={multiplier}
                    onClick={() => {
                      const newAmount = MIN_ETH * multiplier;
                      if (newAmount <= MAX_ETH) {
                        setEntryAmount(newAmount);
                      } else {
                        setEntryAmount(MAX_ETH);
                      }
                    }}
                    className="px-3 py-2 bg-purple-700 hover:bg-purple-600 border border-purple-500/50 rounded-lg text-yellow-400 text-xs font-bold transition-all active:scale-95"
                  >
                    ×{multiplier}
                  </button>
                ))}
              </div>
              
              <input
                type="range"
                min={MIN_ETH}
                max={MAX_ETH}
                step={0.00001}
                value={entryAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEntryAmount(parseFloat(e.target.value))}
                className="w-full h-2 bg-purple-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
              
              <div className="flex justify-between text-xs text-purple-300">
                <span>Min: {MIN_ETH.toFixed(5)} ETH</span>
                <span>Max: {MAX_ETH} ETH</span>
              </div>
            </div>
          </div>

          {/* Split Breakdown */}
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3">
            <div className="text-sm text-blue-200">
              <p className="font-semibold mb-2">Split Breakdown (Pure ETH)</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>→ Prize Pool (80%):</span>
                  <span className="font-mono font-bold">{prizeAmount} ETH</span>
                </div>
                <div className="flex justify-between">
                  <span>→ Platform Fee (20%):</span>
                  <span className="font-mono">{platformFee} ETH</span>
                </div>
              </div>
            </div>
          </div>

          {/* What Happens Next */}
          <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3">
            <div className="text-sm text-green-200">
              <p className="font-semibold mb-1">What Happens Next:</p>
              <ol className="text-xs space-y-1 ml-4">
                <li>1. Use free dice rolls (3x) or buy more</li>
                <li>2. Play game and commit your score</li>
                <li>3. Reveal score within 20 minutes</li>
                <li>4. Claim ETH rewards after period ends!</li>
              </ol>
            </div>
          </div>

          {/* Error Message */}
          {status === 'error' && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2 text-sm text-red-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Transaction Failed</p>
                  <p className="text-xs">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {status === 'success' && (
            <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-200">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">Entry Paid Successfully!</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {status === 'success' ? (
            <button
              onClick={() => {
                // Only call onSuccess - don't close modal which would trigger onClose and go back
                if (onSuccess) onSuccess();
              }}
              className="w-full py-4 px-4 rounded-lg font-semibold text-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 shadow-lg"
            >
              <CheckCircle2 className="w-5 h-5" />
              Continue to Character Selection →
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={status === 'paying'}
                className="flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all border-2 border-purple-500/50 text-purple-300 hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handlePayEntry}
                disabled={status === 'paying' || !isConnected || isPending || isConfirming}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  status === 'paying' || isPending || isConfirming
                    ? 'bg-purple-600 text-white cursor-wait'
                    : !isConnected
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg'
                }`}
              >
                {status === 'paying' || isPending || isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isConfirming ? 'Confirming...' : 'Processing...'}
                  </>
                ) : !isConnected ? (
                  'Connect Wallet'
                ) : (
                  <>
                    <Coins className="w-4 h-4" />
                    Pay {entryAmount.toFixed(5)} ETH
                  </>
                )}
              </button>
            </div>
          )}

          {/* Note */}
          <div className="text-xs text-purple-300 text-center">
            V4: Pure ETH • User-selectable entry • Dice + Commit-Reveal • Multiple claims
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
