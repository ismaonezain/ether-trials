capek
  'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { formatEther, parseEther, type Address } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  ETHER_TRIALS_TRIA_V9_ADDRESS, 
  ETHER_TRIALS_TRIA_V9_ABI 
} from '@/lib/contracts/etherTrialsTRIAv9ABI';
import { 
  ETHER_TRIALS_TRIA_V10_ADDRESS, 
  ETHER_TRIALS_TRIA_V10_ABI 
} from '@/lib/contracts/etherTrialsTRIAv10ABI';
import { TRIA_TOKEN_ADDRESS } from '@/lib/contracts/etherTrialsTRIAv11ABI';

interface DeprecatedContract {
  name: string;
  address: Address;
  abi: typeof ETHER_TRIALS_TRIA_V9_ABI | typeof ETHER_TRIALS_TRIA_V10_ABI;
  version: string;
  description: string;
}

const DEPRECATED_CONTRACTS: DeprecatedContract[] = [
  {
    name: 'V10 - ETH to TRIA Swap (80/20)',
    address: ETHER_TRIALS_TRIA_V10_ADDRESS,
    abi: ETHER_TRIALS_TRIA_V10_ABI,
    version: 'v10',
    description: 'ETH entry with auto-swap to TRIA • 80% prize / 20% platform'
  },
  {
    name: 'V9 - ETH to TRIA Swap',
    address: ETHER_TRIALS_TRIA_V9_ADDRESS,
    abi: ETHER_TRIALS_TRIA_V9_ABI,
    version: 'v9',
    description: 'ETH entry with auto-swap to TRIA • Early version'
  }
];

interface DeprecatedContractsClaimProps {
  onClose?: () => void;
}

export function DeprecatedContractsClaim({ onClose }: DeprecatedContractsClaimProps): JSX.Element {
  const { address } = useAccount();
  const [selectedContract, setSelectedContract] = useState<DeprecatedContract | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  
  return (
    <Card className="fantasy-card max-w-2xl mx-auto">
      <CardHeader className="border-b border-yellow-600/50 bg-gradient-to-r from-orange-900/50 to-red-900/50">
        <CardTitle className="text-xl text-center fantasy-title text-yellow-300">
          ⚠️ Legacy Contracts - Claim Your Rewards
        </CardTitle>
        <p className="text-center text-gray-400 text-xs mt-2">
          Legacy reward pools are deprecated. Please claim any remaining rewards.
        </p>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Warning Notice */}
        <div className="bg-orange-900/30 border-2 border-orange-600/50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="text-orange-300 font-bold text-sm mb-1">
                DEPRECATED REWARD POOLS
              </div>
              <div className="text-gray-300 text-xs leading-relaxed">
                These reward pools are no longer active for new entries. The current active version is <strong className="text-yellow-300">V7 Final (V11)</strong>. Please claim any pending rewards below.
              </div>
            </div>
          </div>
        </div>

        {/* Contract Selection */}
        <div className="space-y-3">
          {DEPRECATED_CONTRACTS.map((contract) => (
            <DeprecatedContractCard
              key={contract.address}
              contract={contract}
              userAddress={address}
              isSelected={selectedContract?.address === contract.address}
              onSelect={() => setSelectedContract(contract)}
            />
          ))}
        </div>

        {/* Close Button */}
        {onClose && (
          <Button
            variant="outline"
            className="w-full border-yellow-600 text-yellow-300 hover:bg-purple-900/50 bg-black/30"
            onClick={onClose}
          >
            ← Back
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface DeprecatedContractCardProps {
  contract: DeprecatedContract;
  userAddress: Address | undefined;
  isSelected: boolean;
  onSelect: () => void;
}

function DeprecatedContractCard({ 
  contract, 
  userAddress,
  isSelected,
  onSelect 
}: DeprecatedContractCardProps): JSX.Element {
  const [claimingPeriods, setClaimingPeriods] = useState<number[]>([]);
  const { writeContractAsync } = useWriteContract();

  // Read current period
  const { data: currentPeriod } = useReadContract({
    address: contract.address,
    abi: contract.abi,
    functionName: 'currentPeriod',
  });

  // Read user's claimable periods (simplified - check last 10 periods)
  const periodsToCheck = currentPeriod ? Array.from(
    { length: Math.min(Number(currentPeriod), 10) }, 
    (_, i) => Number(currentPeriod) - i
  ) : [];

  // Function to check if user has claimable rewards for a period
  const { data: userPointsData } = useReadContract({
    address: contract.address,
    abi: contract.abi,
    functionName: 'userPoints',
    args: userAddress && periodsToCheck.length > 0 
      ? [BigInt(periodsToCheck[0]), userAddress] 
      : undefined,
    query: {
      enabled: !!userAddress && periodsToCheck.length > 0
    }
  });

  // Check if already claimed
  const { data: alreadyClaimed } = useReadContract({
    address: contract.address,
    abi: contract.abi,
    functionName: 'claimed',
    args: userAddress && periodsToCheck.length > 0 
      ? [BigInt(periodsToCheck[0]), userAddress] 
      : undefined,
    query: {
      enabled: !!userAddress && periodsToCheck.length > 0
    }
  });

  const hasClaimableRewards = userPointsData && Number(userPointsData) > 0 && !alreadyClaimed;

  const handleClaimAll = async (): Promise<void> => {
    if (!userAddress || periodsToCheck.length === 0) {
      toast.error('No periods to claim');
      return;
    }

    try {
      setClaimingPeriods(periodsToCheck);
      toast.info(`Claiming rewards from ${periodsToCheck.length} periods...`);

      const tx = await writeContractAsync({
        address: contract.address,
        abi: contract.abi,
        functionName: 'claimRewards',
        args: [periodsToCheck.map(p => BigInt(p))],
      });

      toast.success(`✅ Successfully claimed rewards from ${contract.name}!`);
      console.log('Claim transaction:', tx);
    } catch (error) {
      console.error('Failed to claim rewards:', error);
      toast.error('Failed to claim rewards. Please try again.');
    } finally {
      setClaimingPeriods([]);
    }
  };

  return (
    <div 
      onClick={onSelect}
      className={`
        relative overflow-hidden rounded-xl border-2 p-4 cursor-pointer transition-all
        ${isSelected 
          ? 'border-orange-400 bg-gradient-to-br from-orange-900/50 to-red-900/50 shadow-xl shadow-orange-500/20' 
          : 'border-orange-600/50 bg-gradient-to-br from-orange-900/30 to-red-900/30 hover:border-orange-500/70'
        }
      `}
    >
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
            {contract.name}
          </div>
          <div className="text-gray-400 text-xs mb-2">
            {contract.description}
          </div>
        </div>

        {/* Claimable Status */}
        {userAddress && (
          <div className="pt-2 border-t border-orange-600/30">
            {hasClaimableRewards ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-yellow-300 text-xs font-bold">
                    ✨ Rewards Available!
                  </div>
                  <div className="text-green-400 text-xs font-bold">
                    {periodsToCheck.length} period(s)
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClaimAll();
                  }}
                  disabled={claimingPeriods.length > 0}
                >
                  {claimingPeriods.length > 0 ? '⏳ Claiming...' : '🏆 Claim All Rewards'}
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
