capek ok
  'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { formatEther, type Address } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  ETHER_TRIALS_V4_ADDRESS, 
  ETHER_TRIALS_V4_ABI 
} from '@/lib/contracts/etherTrialsPointBasedV4ABI';

interface DeprecatedContractsClaimV20Props {
  onClose?: () => void;
}

export function DeprecatedContractsClaimV20({ onClose }: DeprecatedContractsClaimV20Props): JSX.Element {
  const { address } = useAccount();
  
  return (
    <Card className="fantasy-card max-w-2xl mx-auto">
      <CardHeader className="border-b border-yellow-600/50 bg-gradient-to-r from-orange-900/50 to-red-900/50">
        <CardTitle className="text-xl text-center fantasy-title text-yellow-300">
          ⚠️ Legacy Contract - Claim Your ETH Rewards
        </CardTitle>
        <p className="text-center text-gray-400 text-xs mt-2">
          This contract is deprecated. Please claim any remaining ETH rewards.
        </p>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Warning Notice */}
        <div className="bg-orange-900/30 border-2 border-orange-600/50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="text-orange-300 font-bold text-sm mb-1">
                DEPRECATED CONTRACT
              </div>
              <div className="text-gray-300 text-xs leading-relaxed">
                This contract (PointBasedV4) is no longer active for new entries. The current active version uses <strong className="text-yellow-300">TRIA rewards</strong>. Please claim any pending ETH rewards below.
              </div>
            </div>
          </div>
        </div>

        {/* PointBasedV4 Contract Card */}
        <DeprecatedContractCard
          userAddress={address}
        />

        {/* Close Button */}
        {onClose && (
          <Button
            variant="outline"
            className="w-full border-yellow-600 text-yellow-300 hover:bg-purple-900/50 bg-black/30"
            onClick={onClose}
          >
            ← Back to Current Contract
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface DeprecatedContractCardProps {
  userAddress: Address | undefined;
}

function DeprecatedContractCard({ 
  userAddress,
}: DeprecatedContractCardProps): JSX.Element {
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const { writeContractAsync } = useWriteContract();

  // Read current period
  const { data: currentPeriod } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'currentPeriod',
  });

  // Read user's periods
  const { data: userPeriods } = useReadContract({
    address: ETHER_TRIALS_V4_ADDRESS,
    abi: ETHER_TRIALS_V4_ABI,
    functionName: 'getUserPeriods',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress
    }
  });

  // Filter out current period (period that's still running)
  const periodsArray = userPeriods ? Array.from(userPeriods as bigint[]) : [];
  const claimablePeriods = periodsArray.filter(period => {
    // Exclude current period from claimable periods
    return currentPeriod ? Number(period) !== Number(currentPeriod) : true;
  });
  const hasClaimableRewards = claimablePeriods.length > 0;

  const handleClaimAll = async (): Promise<void> => {
    if (!userAddress || claimablePeriods.length === 0) {
      toast.error('No claimable periods (excluding current period)');
      return;
    }

    try {
      setIsClaiming(true);
      toast.info(`Claiming rewards from ${claimablePeriods.length} periods...`);

      const tx = await writeContractAsync({
        address: ETHER_TRIALS_V4_ADDRESS,
        abi: ETHER_TRIALS_V4_ABI,
        functionName: 'claimMultiple',
        args: [claimablePeriods],
      });

      toast.success(`✅ Successfully claimed ETH rewards from PointBasedV4!`);
      console.log('Claim transaction:', tx);
    } catch (error) {
      console.error('Failed to claim rewards:', error);
      toast.error('Failed to claim rewards. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-orange-600/50 bg-gradient-to-br from-orange-900/30 to-red-900/30 p-4">
      {/* Deprecated Badge */}
      <div className="absolute top-2 right-2">
        <div className="bg-red-600 px-2 py-0.5 rounded-full text-[9px] font-bold text-white">
          DEPRECATED
        </div>
      </div>

      <div className="space-y-2">
        {/* Contract Info */}
        <div>
          <div className="text-orange-300 font-bold text-sm mb-1">
            PointBasedV4 - ETH Rewards
          </div>
          <div className="text-gray-400 text-xs mb-2">
            ETH entry • Point-based • Claim multiple periods
          </div>
        </div>

        {/* Claimable Status */}
        {userAddress && (
          <div className="pt-2 border-t border-orange-600/30">
            {hasClaimableRewards ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-yellow-300 text-xs font-bold">
                    ✨ ETH Rewards Available!
                  </div>
                  <div className="text-green-400 text-xs font-bold">
                    {claimablePeriods.length} period(s)
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold"
                  onClick={handleClaimAll}
                  disabled={isClaiming}
                >
                  {isClaiming ? '⏳ Claiming...' : '🏆 Claim All ETH Rewards'}
                </Button>
              </div>
            ) : (
              <div className="text-gray-400 text-xs">
                {currentPeriod ? '✅ No pending rewards' : '⏳ Loading...'}
              </div>
            )}
          </div>
        )}

        {!userAddress && (
          <div className="pt-2 border-t border-orange-600/30">
            <div className="text-gray-400 text-xs">
              Connect wallet to check rewards
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
