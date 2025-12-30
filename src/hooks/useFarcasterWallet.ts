// anjing
'use client';

import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

interface FarcasterWalletState {
  isInFarcaster: boolean;
  userFid: number | null;
  username: string | null;
  connectedAddress: string | null;
}

export const useFarcasterWallet = () => {
  const [state, setState] = useState<FarcasterWalletState>({
    isInFarcaster: false,
    userFid: null,
    username: null,
    connectedAddress: null,
  });

  useEffect(() => {
    const initFarcaster = async () => {
      try {
        // Add shorter timeout to prevent hanging
        const contextPromise = sdk.context;
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SDK timeout')), 2000)
        );
        
        const context = await Promise.race([contextPromise, timeoutPromise]) as typeof sdk.context;
        
        if (context?.user?.fid) {
          setState({
            isInFarcaster: true,
            userFid: context.user.fid,
            username: context.user.username || null,
            connectedAddress: context.user.verifiedAddresses?.[0] || null,
          });
        }
      } catch (error) {
        console.log('ℹ️ Not in Farcaster context - web browser mode');
        // Keep default state (not in Farcaster)
      }
    };

    initFarcaster();
  }, []);

  const sendTransaction = async (params: {
    to: string;
    value: string;
    data?: string;
  }): Promise<string> => {
    if (!state.isInFarcaster) {
      throw new Error('Not in Farcaster context');
    }

    try {
      // Miniapp SDK doesn't have sendTransaction method
      // Users should connect their wallet via wagmi/rainbowkit instead
      console.warn('Direct transaction via SDK not supported in miniapp-sdk');
      throw new Error('Please use wallet connection for transactions');
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  };

  const signMessage = async (message: string): Promise<string> => {
    if (!state.isInFarcaster) {
      throw new Error('Not in Farcaster context');
    }

    try {
      const result = await sdk.actions.signMessage({ message });
      return result.signature;
    } catch (error) {
      console.error('Farcaster sign message failed:', error);
      throw error;
    }
  };

  return {
    ...state,
    sendTransaction,
    signMessage,
  };
};
