// anjing
'use client';

import { useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { useFarcasterWallet } from './useFarcasterWallet';

/**
 * Auto-connect wallet when in Farcaster context
 */
export const useAutoConnectWallet = () => {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { isInFarcaster, connectedAddress } = useFarcasterWallet();

  useEffect(() => {
    // Only auto-connect if:
    // 1. In Farcaster context
    // 2. Not already connected
    // 3. Has a connected address from Farcaster
    if (isInFarcaster && !isConnected && connectedAddress) {
      const injectedConnector = connectors.find((c) => c.id === 'injected');
      
      if (injectedConnector) {
        console.log('🔄 Auto-connecting wallet from Farcaster...');
        connect({ connector: injectedConnector });
      }
    }
  }, [isInFarcaster, isConnected, connectedAddress, connect, connectors]);

  return { isInFarcaster, connectedAddress };
};
