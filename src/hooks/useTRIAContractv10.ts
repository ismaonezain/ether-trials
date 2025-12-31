import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, type Address } from 'viem';
import { 
  ETHER_TRIALS_TRIA_V10_ABI, 
  ETHER_TRIALS_TRIA_V10_ADDRESS 
} from '@/lib/contracts/etherTrialsTRIAv10ABI';

export function useTRIAContractv10() {
  const { writeContractAsync } = useWriteContract();

  // ===== READ FUNCTIONS =====
  
  const useCurrentPeriod = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'currentPeriod',
    });
  };

  const usePeriodInfo = (period: bigint | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'periods',
      args: period !== undefined ? [period] : undefined,
      query: { enabled: period !== undefined },
    });
  };

  const useUserEntry = (period: bigint | undefined, userAddress: Address | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'userEntries',
      args: period !== undefined && userAddress ? [period, userAddress] : undefined,
      query: { enabled: period !== undefined && !!userAddress },
    });
  };

  const useDiceUsage = (period: bigint | undefined, userAddress: Address | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'diceUsage',
      args: period !== undefined && userAddress ? [period, userAddress] : undefined,
      query: { enabled: period !== undefined && !!userAddress },
    });
  };

  const useScoreCommit = (period: bigint | undefined, userAddress: Address | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'scoreCommits',
      args: period !== undefined && userAddress ? [period, userAddress] : undefined,
      query: { enabled: period !== undefined && !!userAddress },
    });
  };

  const useUserPoints = (period: bigint | undefined, userAddress: Address | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'userPoints',
      args: period !== undefined && userAddress ? [period, userAddress] : undefined,
      query: { enabled: period !== undefined && !!userAddress },
    });
  };

  const useHasClaimed = (period: bigint | undefined, userAddress: Address | undefined) => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'claimed',
      args: period !== undefined && userAddress ? [period, userAddress] : undefined,
      query: { enabled: period !== undefined && !!userAddress },
    });
  };

  const useMinEntry = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'minEntry',
    });
  };

  const useMaxEntry = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'maxEntry',
    });
  };

  const useBaseDicePrice = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'BASE_DICE_PRICE',
    });
  };

  const useFreeDicePerPeriod = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'FREE_DICE_PER_PERIOD',
    });
  };

  const usePlatformFeesBalance = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'platformFeesBalance',
    });
  };

  const useTotalPrizeOwedTRIA = () => {
    return useReadContract({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'totalPrizeOwedTRIA',
    });
  };

  // ===== WRITE FUNCTIONS =====

  const enterTournament = async (amountInEth: number) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'enterTournament',
      value: parseEther(amountInEth.toString()),
    });
    return hash;
  };

  const rollDice = async (price: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'rollDice',
      value: price,
    });
    return hash;
  };

  const commitScore = async (commitHash: `0x${string}`) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'commitScore',
      args: [commitHash],
    });
    return hash;
  };

  const revealScore = async (score: bigint, nonce: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'revealScore',
      args: [score, nonce],
    });
    return hash;
  };

  const claimReward = async (period: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'claimReward',
      args: [period],
    });
    return hash;
  };

  const claimRewards = async (periods: bigint[]) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'claimRewards',
      args: [periods],
    });
    return hash;
  };

  // ===== ADMIN FUNCTIONS =====

  const allocatePrizes = async (period: bigint) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'allocatePrizes',
      args: [period],
    });
    return hash;
  };

  const startNewPeriod = async () => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'startNewPeriod',
    });
    return hash;
  };

  const setEntryBounds = async (minEntryEth: number, maxEntryEth: number) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'setEntryBounds',
      args: [parseEther(minEntryEth.toString()), parseEther(maxEntryEth.toString())],
    });
    return hash;
  };

  const setV3Fee = async (fee: number) => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'setV3Fee',
      args: [fee],
    });
    return hash;
  };

  const withdrawPlatformFees = async () => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'withdrawPlatformFees',
    });
    return hash;
  };

  const pauseContract = async () => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'pause',
    });
    return hash;
  };

  const unpauseContract = async () => {
    const hash = await writeContractAsync({
      address: ETHER_TRIALS_TRIA_V10_ADDRESS,
      abi: ETHER_TRIALS_TRIA_V10_ABI,
      functionName: 'unpause',
    });
    return hash;
  };

  return {
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
    usePlatformFeesBalance,
    useTotalPrizeOwedTRIA,
    
    // Write functions
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
    setV3Fee,
    withdrawPlatformFees,
    pauseContract,
    unpauseContract,
    
    // Contract info
    contractAddress: ETHER_TRIALS_TRIA_V10_ADDRESS,
  };
}
