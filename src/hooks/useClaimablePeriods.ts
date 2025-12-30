'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { usePublicClient } from 'wagmi';
import { TOURNAMENT_CONTRACT_ADDRESS } from '@/lib/game/constants';
import { ETHER_TRIALS_POINT_BASED_ABI } from '@/lib/contracts/etherTrialsPointBasedABI';
import type { Address } from 'viem';

interface ClaimablePeriod {
  period: bigint;
  amount: bigint;
}

export function useClaimablePeriods() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [claimablePeriods, setClaimablePeriods] = useState<ClaimablePeriod[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get current period
  const { data: currentPeriod } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS as Address,
    abi: ETHER_TRIALS_POINT_BASED_ABI,
    functionName: 'currentPeriod',
  });

  useEffect(() => {
    const fetchClaimablePeriods = async () => {
      if (!address || !currentPeriod || !publicClient) return;
      
      setIsLoading(true);
      const periods: ClaimablePeriod[] = [];
      
      try {
        console.log('🔍 Checking claimable periods from 1 to', currentPeriod.toString());
        
        // Check periods from 1 to current
        const checkPromises = [];
        for (let i = 1; i <= Number(currentPeriod); i++) {
          const period = BigInt(i);
          
          // Create promise for each period check
          const promise = (async () => {
            try {
              // Read pending prize directly from smart contract
              const pendingPrize = await publicClient.readContract({
                address: TOURNAMENT_CONTRACT_ADDRESS as Address,
                abi: ETHER_TRIALS_POINT_BASED_ABI,
                functionName: 'getPendingPrize',
                args: [address as Address, period],
              }) as bigint;

              console.log(`Period ${i}: ${pendingPrize.toString()} wei`);

              if (pendingPrize > BigInt(0)) {
                return { period, amount: pendingPrize };
              }
            } catch (err) {
              console.error(`Error checking period ${period}:`, err);
            }
            return null;
          })();
          
          checkPromises.push(promise);
        }
        
        // Wait for all checks to complete
        const results = await Promise.all(checkPromises);
        
        // Filter out nulls and add to claimable periods
        results.forEach(result => {
          if (result) {
            periods.push(result);
          }
        });
        
        console.log('✅ Found', periods.length, 'claimable periods:', periods);
        setClaimablePeriods(periods);
      } catch (err) {
        console.error('Error fetching claimable periods:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchClaimablePeriods();
  }, [address, currentPeriod, publicClient]);

  const totalClaimableAmount = claimablePeriods.reduce((sum, p) => sum + p.amount, BigInt(0));

  return {
    claimablePeriods,
    totalClaimableAmount,
    isLoading,
    refetch: () => {
      // Trigger refetch by updating a state
      setClaimablePeriods([]);
    }
  };
}
