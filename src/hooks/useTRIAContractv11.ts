import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { Address } from 'viem';
import { 
  ETHER_TRIALS_TRIA_V7_ABI,
  ETHER_TRIALS_TRIA_V7_ADDRESS,
  TRIA_TOKEN_ADDRESS,
  ERC20_ABI,
} from '@/lib/contracts/etherTrialsTRIAv11ABI';

/**
 * Hook for EtherTrialsPointBased_v7_Final contract
 * - 100% Prize Pool (NO PLATFORM FEE!)
 * - Formula: Points = Score × (Entry / 6B TRIA)
 * - Min: 50,000 TRIA, Max: 6,000,000,000 TRIA
 */
export function useTRIAContractv11() {
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
      args: userAddress ? [userAddress, ETHER_TRIALS_TRIA_V7_ADDRESS] : undefined,
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
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'currentPeriod',
    });
  };

  const usePeriodInfo = (period: bigint | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'periods',
      args: period !== undefined ? [period] : undefined,
      query: { enabled: period !== undefined },
    });
  };

  const useUserEntry = (period: bigint | undefined, userAddress: Address | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'userEntries',
      args: period !== undefined && userAddress ? [period, userAddress] : undefined,
      query: { enabled: period !== undefined && !!userAddress },
    });
  };

  const useDiceUsage = (period: bigint | undefined, userAddress: Address | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'diceUsage',
      args: period !== undefined && userAddress ? [period, userAddress] : undefined,
      query: { enabled: period !== undefined && !!userAddress },
    });
  };

  const useScoreCommit = (period: bigint | undefined, userAddress: Address | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'scoreCommits',
      args: period !== undefined && userAddress ? [period, userAddress] : undefined,
      query: { enabled: period !== undefined && !!userAddress },
    });
  };

  const useUserPoints = (period: bigint | undefined, userAddress: Address | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'userPoints',
      args: period !== undefined && userAddress ? [period, userAddress] : undefined,
      query: { enabled: period !== undefined && !!userAddress },
    });
  };

  const useHasClaimed = (period: bigint | undefined, userAddress: Address | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'claimed',
      args: period !== undefined && userAddress ? [period, userAddress] : undefined,
      query: { enabled: period !== undefined && !!userAddress },
    });
  };

  const useMinEntry = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'minEntry',
    });
  };

  const useMaxEntry = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'maxEntry',
    });
  };

  const useBaseDicePrice = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'BASE_DICE_PRICE',
    });
  };

  const useFreeDicePerPeriod = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'FREE_DICE_PER_PERIOD',
    });
  };

  // V7: NO MORE platformFeesBalance (100% prize pool)

  const useTotalPrizeOwedTRIA = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'totalPrizeOwedTRIA',
    });
  };

  // ===== WRITE FUNCTIONS =====

  // Approve TRIA tokens for contract
  const approveTria = async (amount: bigint) => {
    const hash = await writeContractAsync({
      address: TRIA_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ETHER_TRIALS_TRIA_V7_ADDRESS, amount],
    });
    return hash;
  };

  // Enter tournament with TRIA tokens
  const enterTournament = async (triaAmount: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'enterTournament',
      args: [triaAmount],
    });
    return hash;
  };

  // Roll dice with TRIA tokens
  const rollDice = async (price: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'rollDice',
      args: [price],
    });
    return hash;
  };

  const commitScore = async (commitHash: `0x${string}`) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'commitScore',
      args: [commitHash],
    });
    return hash;
  };

  const revealScore = async (score: bigint, nonce: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'revealScore',
      args: [score, nonce],
    });
    return hash;
  };

  const claimReward = async (period: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'claimReward',
      args: [period],
    });
    return hash;
  };

  const claimRewards = async (periods: bigint[]) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'claimRewards',
      args: [periods],
    });
    return hash;
  };

  // ===== ADMIN FUNCTIONS =====

  const allocatePrizes = async (period: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'allocatePrizes',
      args: [period],
    });
    return hash;
  };

  const startNewPeriod = async () => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'startNewPeriod',
    });
    return hash;
  };

  const setEntryBounds = async (minEntry: bigint, maxEntry: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'setEntryBounds',
      args: [minEntry, maxEntry],
    });
    return hash;
  };

  // V7: NO MORE withdrawPlatformFees (100% prize pool)

  const pauseContract = async () => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'pause',
    });
    return hash;
  };

  const unpauseContract = async () => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V7_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V7_ABI,
      functionName: 'unpause',
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
    usePeriodInfo,
    useUserEntry,
    useDiceUsage,
    useScoreCommit,
    useUserPoints,
    useHasClaimed,
    useMinEntry,
    useMaxEntry,
    useBaseDicePrice,
    useFreeDicePerPeriod,
    useTotalPrizeOwedTRIA,
    
    // Write functions
    approveTria,
    enterTournament,
    rollDice,
    commitScore,
    revealScore,
    claimReward,
    claimRewards,
    
    // Admin functions
    allocatePrizes,
    startNewPeriod,
    setEntryBounds,
    pauseContract,
    unpauseContract,
    
    // Contract info
    contractAddress: ETHER_TRIALS_TRIA_V7_ADDRESS,
    triaTokenAddress: TRIA_TOKEN_ADDRESS,
  };
}
