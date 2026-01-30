kono
  'use client';

import React, { useState } from 'react';
import { X, Coins, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { usePointBasedContract } from '@/hooks/usePointBasedContract';
import { formatEther } from 'viem';

interface TournamentEntryModalV3Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TournamentEntryModalV3({ isOpen, onClose, onSuccess }: TournamentEntryModalV3Props) {
  const { address, isConnected } = useAccount();
  const { payEntryFee, entryFee, isPending } = usePointBasedContract();
  const [status, setStatus] = useState<'idle' | 'paying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const FIXED_ENTRY_FEE = entryFee || BigInt('20000000000000'); // 0.00002 ETH

  const handlePayEntry = async () => {
    if (!isConnected || !address) {
      setStatus('error');
      setErrorMessage('Please connect your wallet first');
      return;
    }

    try {
      setStatus('paying');
      setErrorMessage('');

      // V3 contract: frontend provides amountOutMinimum for slippage protection
      // For now, using 0 (no slippage protection) - should use Quoter in production
      // TODO: Integrate with Uniswap V3 Quoter to get expected output and apply 1-5% slippage tolerance
      const amountOutMinimum = BigInt(0);

      await payEntryFee(amountOutMinimum);
      
      setStatus('success');
      if (onSuccess) onSuccess();

      // Auto close after success
      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 2000);
    } catch (error: unknown) {
      console.error('Entry payment failed:', error);
      setStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'Transaction failed';
      setErrorMessage(errorMsg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-purple-900 to-indigo-900 border-2 border-purple-500 rounded-lg max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-purple-500/30 flex items-center justify-between">
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
          {/* Fixed Entry Amount */}
          <div className="bg-purple-900/50 border border-purple-500/30 rounded-lg p-4">
            <div className="text-center">
              <div className="text-sm text-purple-300 mb-2">Fixed Entry Fee</div>
              <div className="text-3xl font-bold text-yellow-400">
                {formatEther(FIXED_ENTRY_FEE)} ETH
              </div>
              <div className="text-xs text-purple-300 mt-1">
                (~$0.06 USD at current rates)
              </div>
            </div>
          </div>

          {/* What Happens */}
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2 text-sm text-blue-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Automatic Swap & Split</p>
                <ul className="text-xs space-y-1">
                  <li>• ETH swapped to $TRIA via Uniswap V3</li>
                  <li>• 80% goes to prize pool (in TRIA)</li>
                  <li>• 20% platform fees</li>
                </ul>
              </div>
            </div>
          </div>

          {/* What Happens Next */}
          <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3">
            <div className="text-sm text-green-200">
              <p className="font-semibold mb-1">What Happens Next:</p>
              <ol className="text-xs space-y-1 ml-4">
                <li>1. Play the game and achieve your best score</li>
                <li>2. Owner submits all scores to contract</li>
                <li>3. Owner allocates prizes based on scores</li>
                <li>4. Claim your TRIA rewards!</li>
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
              disabled={status === 'paying' || status === 'success' || !isConnected || isPending}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                status === 'success'
                  ? 'bg-green-600 text-white cursor-not-allowed'
                  : status === 'paying' || isPending
                  ? 'bg-purple-600 text-white cursor-wait'
                  : !isConnected
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg'
              }`}
            >
              {status === 'paying' || isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : status === 'success' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Paid!
                </>
              ) : !isConnected ? (
                'Connect Wallet'
              ) : (
                <>
                  <Coins className="w-4 h-4" />
                  Pay Entry Fee
                </>
              )}
            </button>
          </div>

          {/* Note */}
          <div className="text-xs text-purple-300 text-center">
            V3: Owner-managed scores • No commit-reveal • No dice rolling
          </div>
        </div>
      </div>
    </div>
  );
}
