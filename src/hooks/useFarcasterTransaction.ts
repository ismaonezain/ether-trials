// anjing
'use client';

import { useFarcasterWallet } from './useFarcasterWallet';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useCallback } from 'react';
import type { Abi } from 'viem';

interface TransactionParams {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: unknown[];
  value?: bigint;
}

interface TransactionResult {
  hash?: `0x${string}`;
  isLoading: boolean;
  isSuccess: boolean;
  error: Error | null;
  sendTransaction: (params: TransactionParams) => Promise<void>;
}

export function useFarcasterTransaction(): TransactionResult {
  const { isInFarcaster, sendTransaction: sendFarcasterTx } = useFarcasterWallet();
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, isSuccess, error } = useWriteContract();

  const sendTransaction = useCallback(async (params: TransactionParams): Promise<void> => {
    if (isInFarcaster) {
      // Use Farcaster SDK for transactions
      try {
        // Encode the function call
        const { encodeFunctionData } = await import('viem');
        const data = encodeFunctionData({
          abi: params.abi,
          functionName: params.functionName,
          args: params.args,
        });

        await sendFarcasterTx({
          to: params.address,
          value: params.value?.toString(),
          data,
        });
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Transaction failed');
      }
    } else {
      // Use wagmi for regular wallet connections
      writeContract({
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
        value: params.value,
      });
    }
  }, [isInFarcaster, sendFarcasterTx, writeContract]);

  return {
    hash,
    isLoading: isPending,
    isSuccess,
    error,
    sendTransaction,
  };
}
