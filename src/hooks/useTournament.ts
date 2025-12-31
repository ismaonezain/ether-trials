'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther } from 'viem';
import { useFarcasterWallet } from './useFarcasterWallet';

// Tournament contract ABI
const TOURNAMENT_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "entryFee", "type": "uint256"}],
    "name": "joinTournament",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "claimPrize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalPrizePool",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "player", "type": "address"}],
    "name": "getPlayerScore",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "player", "type": "address"}],
    "name": "hasPaid",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const TOURNAMENT_CONTRACT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as `0x${string}`;

interface TournamentHookReturn {
  joinTournament: (entryFee: bigint, estimatedGas: bigint) => Promise<void>;
  claimPrize: () => Promise<void>;
  isJoining: boolean;
  isClaiming: boolean;
  error: string | null;
  totalPrizePool: bigint;
  playerScore: bigint;
  hasPaid: boolean;
}

export const useTournament = (): TournamentHookReturn => {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Farcaster wallet integration
  const farcasterWallet = useFarcasterWallet();

  // Read total prize pool
  const { data: prizePoolData } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS,
    abi: TOURNAMENT_ABI,
    functionName: 'getTotalPrizePool',
  });

  // Read player score
  const { data: playerScoreData } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS,
    abi: TOURNAMENT_ABI,
    functionName: 'getPlayerScore',
    args: address ? [address] : undefined,
  });

  // Read if player has paid
  const { data: hasPaidData } = useReadContract({
    address: TOURNAMENT_CONTRACT_ADDRESS,
    abi: TOURNAMENT_ABI,
    functionName: 'hasPaid',
    args: address ? [address] : undefined,
  });

  const joinTournament = async (entryFee: bigint, estimatedGas: bigint): Promise<void> => {
    setIsJoining(true);
    setError(null);

    try {
      // Check if in Farcaster context
      if (farcasterWallet.isInFarcaster && farcasterWallet.connectedAddress) {
        // Use Farcaster SDK for transaction
        const txHash = await farcasterWallet.sendTransaction({
          to: TOURNAMENT_CONTRACT_ADDRESS,
          value: entryFee.toString(),
          data: '0x', // joinTournament function call data would go here
        });
        
        console.log('Farcaster transaction sent:', txHash);
      } else {
        // Use regular Wagmi for non-Farcaster contexts
        const totalValue = entryFee + estimatedGas;
        
        const hash = await writeContractAsync({
          address: TOURNAMENT_CONTRACT_ADDRESS,
          abi: TOURNAMENT_ABI,
          functionName: 'joinTournament',
          args: [entryFee],
          value: totalValue,
          gas: estimatedGas,
        });

        console.log('Transaction sent:', hash);
      }
    } catch (err: unknown) {
      console.error('Error joining tournament:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to join tournament';
      setError(errorMessage);
      throw err;
    } finally {
      setIsJoining(false);
    }
  };

  const claimPrize = async (): Promise<void> => {
    if (!address) {
      setError('No wallet connected');
      return;
    }

    setIsClaiming(true);
    setError(null);

    try {
      // Check if in Farcaster context
      if (farcasterWallet.isInFarcaster && farcasterWallet.connectedAddress) {
        // Use Farcaster SDK for transaction
        const txHash = await farcasterWallet.sendTransaction({
          to: TOURNAMENT_CONTRACT_ADDRESS,
          value: '0',
          data: '0x', // claimPrize function call data would go here
        });
        
        console.log('Farcaster prize claim sent:', txHash);
      } else {
        // Use regular Wagmi for non-Farcaster contexts
        const hash = await writeContractAsync({
          address: TOURNAMENT_CONTRACT_ADDRESS,
          abi: TOURNAMENT_ABI,
          functionName: 'claimPrize',
          gas: 150000n,
        });

        console.log('Prize claim transaction sent:', hash);
      }
    } catch (err: unknown) {
      console.error('Error claiming prize:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to claim prize';
      setError(errorMessage);
      throw err;
    } finally {
      setIsClaiming(false);
    }
  };

  return {
    joinTournament,
    claimPrize,
    isJoining,
    isClaiming,
    error,
    totalPrizePool: prizePoolData || 0n,
    playerScore: playerScoreData || 0n,
    hasPaid: hasPaidData || false,
  };
};
