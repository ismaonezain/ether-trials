import { useReadContract, useWriteContract } from 'wagmi';
import type { Address } from 'viem';
import { 
  ETHER_TRIALS_TRIA_V20_ABI,
  ETHER_TRIALS_TRIA_V20_ADDRESS,
  TRIA_TOKEN_ADDRESS,
  ERC20_ABI,
} from '@/lib/contracts/etherTrialsTRIAv20ABI';

/**
 * Hook for EtherTrialsPointBased_v7_Final contract (V20)
 * - 100% Prize Pool (NO PLATFORM FEE!)
 * - Formula: Points = Score × (Entry / 6B TRIA)
 * - Min: 50,000 TRIA, Max: 6,000,000,000 TRIA
 * - Address: 0x8a7ea75b0f107b76a90bb690212e9cef6f02e0ab
 */
export function useTRIAContractv20() {
  const { writeContractAsync } = useWriteContract();

  // ===== TRIA TOKEN READ FUNCTIONS =====
  
  const useTriaBalance = (userAddress: Address | undefined) => {
    return useReadContract({
      address: TRIA_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: userAddress ? [userAddress] : undefined,
      query: { enabled: !!userAddress },
    });
  };

  const useTriaAllowance = (userAddress: Address | undefined) => {
    return useReadContract({
      address: TRIA_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: userAddress ? [userAddress, ETHER_TRIALS_TRIA_V20_ADDRESS] : undefined,
      query: { enabled: !!userAddress },
    });
  };

  const useTriaDecimals = () => {
    return useReadContract({
      address: TRIA_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'decimals',
    });
  };

  // ===== CONTRACT READ FUNCTIONS =====
  
  const useCurrentPeriod = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'currentPeriod',
    });
  };

  const useGetCurrentPeriodInfo = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'getCurrentPeriodInfo',
    });
  };

  const useGetPlayerInfo = (player: Address | undefined, period: bigint | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'getPlayerInfo',
      args: player && period !== undefined ? [player, period] : undefined,
      query: { enabled: !!player && period !== undefined },
    });
  };

  const useGetUserPeriods = (userAddress: Address | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'getUserPeriods',
      args: userAddress ? [userAddress] : undefined,
      query: { enabled: !!userAddress },
    });
  };

  const useGetDiceInfo = (player: Address | undefined, period: bigint | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'getDiceInfo',
      args: player && period !== undefined ? [player, period] : undefined,
      query: { enabled: !!player && period !== undefined },
    });
  };

  const useGetScoreCommit = (player: Address | undefined, period: bigint | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'getScoreCommit',
      args: player && period !== undefined ? [player, period] : undefined,
      query: { enabled: !!player && period !== undefined },
    });
  };

  const useMinEntry = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'minEntry',
    });
  };

  const useMaxEntry = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'maxEntry',
    });
  };

  const useBaseDicePrice = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'BASE_DICE_PRICE',
    });
  };

  const useFreeDicePerPeriod = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'FREE_DICE_PER_PERIOD',
    });
  };

  const useTotalPrizeOwedTRIA = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'totalPrizeOwedTRIA',
    });
  };

  const useGetPeriodPlayers = (period: bigint | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'getPeriodPlayers',
      args: period !== undefined ? [period] : undefined,
      query: { enabled: period !== undefined },
    });
  };

  const useOwner = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'owner',
    });
  };

  // ===== HELPER FUNCTIONS =====

  const { data: contractOwner } = useOwner();

  const checkIsOwner = (userAddress: Address | undefined): boolean => {
    if (!userAddress || !contractOwner) return false;
    return userAddress.toLowerCase() === (contractOwner as string).toLowerCase();
  };

  // ===== WRITE FUNCTIONS =====

  // Approve TRIA tokens for contract
  const approveTria = async (amount: bigint) => {
    const hash = await writeContractAsync({
      address: TRIA_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ETHER_TRIALS_TRIA_V20_ADDRESS, amount],
    });
    return hash;
  };

  // Enter tournament with TRIA tokens
  const enterTournament = async (triaAmount: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'enterTournament',
      args: [triaAmount],
    });
    return hash;
  };

  // Roll dice with TRIA tokens
  const rollDice = async (triaAmount: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'rollDice',
      args: [triaAmount],
    });
    return hash;
  };

  const commitScore = async ({ args }: { args: [commitHash: `0x${string}`] }) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'commitScore',
      args: args,
    });
    return hash;
  };

  const revealScore = async ({ args }: { args: [score: bigint, nonce: bigint] }) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'revealScore',
      args: args,
    });
    return hash;
  };

  const claimPrize = async (period: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'claimPrize',
      args: [period],
    });
    return hash;
  };

  const claimMultiple = async (periods: bigint[]) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'claimMultiple',
      args: [periods],
    });
    return hash;
  };

  const claimAllForUser = async () => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'claimAllForUser',
    });
    return hash;
  };

  // ===== ADMIN FUNCTIONS =====

  const allocatePrizes = async (period: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'allocatePrizes',
      args: [period],
    });
    return hash;
  };

  const submitScore = async (player: Address, score: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'submitScore',
      args: [player, score],
    });
    return hash;
  };

  const submitScoresBatch = async (players: Address[], scores: bigint[]) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'submitScoresBatch',
      args: [players, scores],
    });
    return hash;
  };

  const setEntryBounds = async (minEntry: bigint, maxEntry: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V20_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V20_ABI,
      functionName: 'setEntryBounds',
      args: [minEntry, maxEntry],
    });
    return hash;
  };

  return {
    // TRIA token hooks
    useTriaBalance,
    useTriaAllowance,
    useTriaDecimals,
    
    // Read hooks
    useCurrentPeriod,
    useGetCurrentPeriodInfo,
    useGetPlayerInfo,
    useGetUserPeriods,
    useGetDiceInfo,
    useGetScoreCommit,
    useMinEntry,
    useMaxEntry,
    useBaseDicePrice,
    useFreeDicePerPeriod,
    useTotalPrizeOwedTRIA,
    useGetPeriodPlayers,
    useOwner,
    
    // Helper functions
    checkIsOwner,
    
    // Write functions
    approveTria,
    enterTournament,
    rollDice,
    commitScore,
    revealScore,
    claimPrize,
    claimMultiple,
    claimAllForUser,
    
    // Admin functions
    allocatePrizes,
    submitScore,
    submitScoresBatch,
    setEntryBounds,
    
    // Contract info
    contractAddress: ETHER_TRIALS_TRIA_V20_ADDRESS,
    triaTokenAddress: TRIA_TOKEN_ADDRESS,
  };
}
