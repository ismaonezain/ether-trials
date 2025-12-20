'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CONTRACT_ADDRESS, TOURNAMENT_CONTRACT_ADDRESS } from '@/lib/game/constants';
import { usePointBasedContract } from '@/hooks/usePointBasedContract';
import { useAccount, useReadContract, useDisconnect, useConnect, useSwitchChain } from 'wagmi';
import { formatEther } from 'viem';
import { base } from 'wagmi/chains';
import { ETHER_TRIALS_POINT_BASED_ABI } from '@/lib/contracts/etherTrialsPointBasedABI';
import type { Address } from 'viem';
import { useFarcasterWallet } from '@/hooks/useFarcasterWallet';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';

interface PaymentModalProps {
  onPaymentComplete: () => void;
  onCancel: () => void;
}



export function PaymentModal({ onPaymentComplete, onCancel }: PaymentModalProps): JSX.Element {
  const { address, isConnected } = useAccount();
  const { isInFarcaster } = useFarcasterWallet();
  const { profile } = useFarcasterProfile();
  const {
    payEntryFee,
    isPending,
    isConfirming,
    isConfirmed,
    error: contractError,
    prizePoolInfo,
    currentPeriod,
    entryFee,
  } = usePointBasedContract();

  const [showDetails, setShowDetails] = useState(false);

  // Check if user has entered - only once, no polling
  const { data: hasEnteredData, isLoading: isCheckingEntry } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: ETHER_TRIALS_POINT_BASED_ABI,
    functionName: 'hasEnteredCurrentPeriod',
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address),
    }
  });

  const hasEntered = hasEnteredData === true;
  const isPaying = isPending || isConfirming;
  const isButtonDisabled = !isConnected || isPaying || hasEntered || isCheckingEntry;

  const [error, setError] = useState<string | null>(null);

  // Handle successful payment
  useEffect(() => {
    if (isConfirmed) {
      onPaymentComplete();
    }
  }, [isConfirmed, onPaymentComplete]);

  // Handle payment errors
  useEffect(() => {
    if (contractError) {
      setError(contractError.message || 'Payment failed');
    }
  }, [contractError]);

  const handlePayment = async (): Promise<void> => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!address) {
      setError('Wallet address not available');
      return;
    }

    if (isCheckingEntry) {
      setError('Still checking entry status. Please wait...');
      return;
    }

    if (hasEntered) {
      setError('You have already entered this tournament period. Wait for next 24h cycle.');
      return;
    }

    try {
      setError(null);
      await payEntryFee();
    } catch (err) {
      console.error('Payment failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Payment failed';
      
      // Enhanced error messages for common wallet issues
      if (errorMsg.includes('user rejected') || errorMsg.includes('User rejected')) {
        setError('❌ Transaction cancelled by user');
      } else if (errorMsg.includes('insufficient funds') || errorMsg.includes('Insufficient')) {
        setError('❌ Insufficient ETH balance. You need 0.00002 ETH + gas fees.');
      } else if (errorMsg.includes('Already entered')) {
        setError('⚠️ Already entered this period. Please wait for the next 24h cycle.');
      } else if (errorMsg.includes('Incorrect entry fee')) {
        setError('❌ Entry fee mismatch. Please refresh the page and try again.');
      } else if (errorMsg.includes('network') || errorMsg.includes('Network')) {
        setError('❌ Network error. Please ensure you are on Base Network.');
      } else {
        setError(`❌ ${errorMsg}`);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
      <div className="min-h-screen flex items-center justify-center p-2 sm:p-4">
        <div className="w-full max-w-md">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2 pt-3 sm:pb-3 sm:pt-4">
              <CardTitle className="text-base sm:text-lg text-white">Prize Pool Entry</CardTitle>
              <CardDescription className="text-gray-400 text-[10px] sm:text-xs">
                Connect wallet & pay on Base Network
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 pb-3 sm:pb-4">
              {/* Farcaster Profile Display */}
              {profile && (
                <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-3 rounded-lg border border-purple-500/30">
                  <div className="flex items-center gap-3">
                    {profile.pfpUrl && (
                      <img 
                        src={profile.pfpUrl} 
                        alt="Profile" 
                        className="w-12 h-12 rounded-full border-2 border-purple-400 flex-shrink-0"
                        style={{ aspectRatio: '1/1', objectFit: 'cover' }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold text-sm truncate">{profile.displayName}</div>
                      <div className="text-purple-300 text-xs">@{profile.username}</div>
                      <div className="text-purple-400 text-xs">FID: {profile.fid}</div>
                    </div>
                  </div>
                  {isConnected ? (
                    <div className="mt-2 text-center text-green-400 text-xs">✓ Wallet Connected</div>
                  ) : (
                    <div className="mt-2 text-center text-yellow-400 text-xs">⚠️ Connect Wallet</div>
                  )}
                </div>
              )}

              {/* Entry Status */}
              {isConnected && address && (
                <div className={`p-2 border rounded-lg text-center ${
                  isCheckingEntry ? 'bg-blue-900/30 border-blue-700' :
                  hasEntered ? 'bg-yellow-900/30 border-yellow-700' : 
                  'bg-green-900/30 border-green-700'
                }`}>
                  {isCheckingEntry && <div className="text-sm text-blue-400">🔍 Checking Entry...</div>}
                  {!isCheckingEntry && hasEntered && (
                    <div className="text-sm text-yellow-400">
                      ⚠️ Already Entered - Wait 24h
                    </div>
                  )}
                  {!isCheckingEntry && !hasEntered && (
                    <div className="text-sm text-green-400">✓ Ready to Enter</div>
                  )}
                </div>
              )}

              {/* Entry Fee - Main Display */}
              <div className="p-3 sm:p-4 bg-gradient-to-r from-purple-900/40 to-blue-900/40 rounded-lg border-2 border-purple-500/30 text-center">
                <div className="text-gray-300 text-[10px] sm:text-xs mb-1">Entry Fee</div>
                <div className="text-2xl sm:text-4xl font-bold text-white mb-1">0.00002 ETH</div>
                <div className="text-gray-400 text-[10px] sm:text-xs mb-2 sm:mb-3">~$0.07 USD</div>
                
                {/* Network Info */}
                <div className="mb-2 sm:mb-3 px-2 py-1.5 bg-blue-900/40 border border-blue-600/50 rounded">
                  <div className="text-blue-300 text-[10px] sm:text-xs">
                    ⛽ Gas fees handled by your wallet
                  </div>
                  <div className="text-blue-400 text-[9px] sm:text-[10px] mt-0.5">
                    💡 Base Network = Very low fees!
                  </div>
                </div>
                
                {/* Quick Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-yellow-900/30 border border-yellow-700/50 rounded p-2">
                    <div className="text-yellow-400 font-bold">50%</div>
                    <div className="text-yellow-300/70">Prize Pool</div>
                  </div>
                  <div className="bg-green-900/30 border border-green-700/50 rounded p-2">
                    <div className="text-green-400 font-bold">50%</div>
                    <div className="text-green-300/70">Platform</div>
                  </div>
                </div>
              </div>

              {/* Toggle Details Button */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full text-xs text-purple-400 hover:text-purple-300 py-2 transition-colors"
              >
                {showDetails ? '▲ Hide Details' : '▼ Show Details'}
              </button>

              {/* Collapsible Details */}
              {showDetails && (
                <div className="space-y-2 text-xs border-t border-gray-700 pt-3">
                  {/* Payment Info */}
                  <div className="p-2 bg-blue-900/20 border border-blue-700/50 rounded">
                    <div className="text-blue-300 font-semibold mb-1.5">💰 Payment Details</div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-gray-300">
                        <span>Entry Fee:</span>
                        <span className="text-purple-400 font-bold">0.00002 ETH</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Gas Fee:</span>
                        <span className="text-blue-400">Set by wallet</span>
                      </div>
                      <div className="text-gray-400 text-[10px] mt-1 pt-1 border-t border-blue-700/30">
                        💡 Your wallet will calculate gas automatically
                      </div>
                    </div>
                  </div>
                  {prizePoolInfo && (
                    <>
                      <div className="flex justify-between text-gray-300">
                        <span>Current Prize Pool</span>
                        <span className="text-yellow-400 font-bold">
                          {prizePoolInfo.currentPool} ETH
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Total Participants</span>
                        <span className="text-blue-400 font-bold">
                          {prizePoolInfo.participants}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Period</span>
                        <span className="text-purple-400 font-bold">
                          #{prizePoolInfo.period}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-gray-300">
                    <span>Winners</span>
                    <span>Top 1000 Players</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Network</span>
                    <span className="text-blue-400">Base</span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded-lg">
                  <div className="text-red-400 text-xs">{error}</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1 sm:pt-2">
                <Button
                  size="lg"
                  className="w-full h-10 sm:h-12 text-xs sm:text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white border-2 border-purple-500 shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handlePayment}
                  disabled={isButtonDisabled}
                >
                  {isPaying ? '⏳ Processing...' : 
                   isCheckingEntry ? '🔍 Checking...' :
                   hasEntered ? '✓ Already Entered' :
                   !isConnected ? 'Connect First' :
                   '💎 Pay Entry Fee'}
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-8 sm:h-10 text-xs sm:text-sm bg-gray-800 hover:bg-gray-700 text-white border-2 border-gray-600 hover:border-gray-500"
                  onClick={onCancel}
                  disabled={isPaying}
                >
                  {hasEntered ? '← Back to Game' : '✕ Cancel'}
                </Button>
              </div>

              {/* Disclaimer */}
              <div className="text-[10px] text-gray-500 text-center leading-tight pt-2">
                Prizes distributed every 24h to Top 1000 players
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
