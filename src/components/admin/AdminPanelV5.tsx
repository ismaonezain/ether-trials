'use client';

import { useState } from 'react';
import { useTRIAContractV5 } from '@/hooks/useTRIAContractv5';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { ETHER_TRIALS_TRIA_V5_ABI, CONTRACT_ADDRESSES_V5 } from '@/lib/contracts/etherTrialsTRIAv5ABI';
import { base } from 'wagmi/chains';
import type { Address } from 'viem';

export function AdminPanelV5(): JSX.Element {
  const { profile } = useFarcasterProfile();
  const fid = profile?.fid ? BigInt(profile.fid) : undefined;
  const { periodInfo, currentPeriod, refetchAll } = useTRIAContractV5(fid);
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const contractAddress = CONTRACT_ADDRESSES_V5.base.etherTrialsTRIAv5 as Address;
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const handleFinalizePeriod = async (): Promise<void> => {
    if (!periodInfo) {
      setError('Period info not loaded');
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      console.log('Finalizing period:', currentPeriod.toString());

      writeContract({
        address: contractAddress,
        abi: ETHER_TRIALS_TRIA_V5_ABI,
        functionName: 'finalizePeriod',
        args: [currentPeriod],
        chainId: base.id,
      });

      setSuccess('Finalization transaction submitted! Waiting for confirmation...');
    } catch (err) {
      console.error('Error finalizing period:', err);
      setError(err instanceof Error ? err.message : 'Failed to finalize period');
    }
  };

  // Auto refetch on success
  if (isSuccess && success) {
    setTimeout(() => {
      setSuccess('Period finalized successfully! ✅');
      refetchAll();
    }, 2000);
  }

  if (!periodInfo) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading Admin Panel...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const canFinalize = periodInfo.status === 'ended' && !periodInfo.finalized;

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-purple-500/30">
      <CardHeader>
        <CardTitle className="text-white">🔧 Admin Panel v5</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period Info */}
        <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-500/30">
          <div className="text-sm text-gray-300 space-y-2">
            <div className="flex justify-between">
              <span>Period:</span>
              <span className="font-bold">#{currentPeriod.toString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-bold capitalize">{periodInfo.status}</span>
            </div>
            <div className="flex justify-between">
              <span>Participants:</span>
              <span className="font-bold">{periodInfo.participantCount.toString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Finalized:</span>
              <span className="font-bold">{periodInfo.finalized ? '✅ Yes' : '❌ No'}</span>
            </div>
          </div>
        </div>

        {/* Finalize Button */}
        <div className="space-y-2">
          <Button
            onClick={handleFinalizePeriod}
            disabled={!canFinalize || isPending || isConfirming}
            className="w-full"
            variant={canFinalize ? 'default' : 'secondary'}
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isPending ? 'Confirming Transaction...' : 'Waiting for Block...'}
              </>
            ) : canFinalize ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Finalize Period #{currentPeriod.toString()}
              </>
            ) : (
              'Period Not Ready to Finalize'
            )}
          </Button>

          {!canFinalize && (
            <div className="text-xs text-gray-400 text-center">
              {periodInfo.status === 'active' && '⏰ Period must end before finalization'}
              {periodInfo.status === 'not-started' && '⏰ Period has not started yet'}
              {periodInfo.finalized && '✅ Period already finalized'}
            </div>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-300 text-sm">
              <Check className="w-4 h-4" />
              {success}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-700">
          <div>• Only admin can finalize periods</div>
          <div>• Period must have ended (24h duration)</div>
          <div>• Finalization starts a new period automatically</div>
        </div>
      </CardContent>
    </Card>
  );
}
