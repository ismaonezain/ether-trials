'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useDisconnect, useConnect, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { sdk } from '@farcaster/miniapp-sdk';
import { base } from 'wagmi/chains';

interface WalletConnectButtonProps {
  className?: string;
}

export const WalletConnectButton: React.FC<WalletConnectButtonProps> = ({ className = '' }) => {
  const { address, isConnected, connector, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  
  const [isInFarcaster, setIsInFarcaster] = useState<boolean>(false);
  const [farcasterUser, setFarcasterUser] = useState<{ fid: number; username?: string } | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState<boolean>(false);

  // Detect if running in Farcaster context
  useEffect(() => {
    setIsMounted(true);
    
    const detectFarcaster = async () => {
      try {
        const context = await sdk.context;
        if (context?.user?.fid) {
          setIsInFarcaster(true);
          setFarcasterUser({
            fid: context.user.fid,
            username: context.user.username || undefined,
          });

          // Don't auto-connect - let user manually connect wallet
        }
      } catch (error) {
        console.log('Not in Farcaster context');
        setIsInFarcaster(false);
      }
    };

    detectFarcaster();
  }, [connectors, connect, isConnected]);

  // Auto-switch to Base network after connection
  useEffect(() => {
    const switchToBase = async () => {
      if (isConnected && chain && chain.id !== base.id && switchChain && !isSwitchingNetwork) {
        try {
          setIsSwitchingNetwork(true);
          console.log(`Wrong network detected (${chain.id}). Switching to Base...`);
          await switchChain({ chainId: base.id });
          console.log('Successfully switched to Base network');
        } catch (error) {
          console.error('Failed to switch to Base network:', error);
        } finally {
          setIsSwitchingNetwork(false);
        }
      }
    };

    switchToBase();
  }, [isConnected, chain, switchChain, isSwitchingNetwork]);

  const handleConnect = () => {
    if (isInFarcaster) {
      // In Farcaster, use Farcaster connector
      const farcasterConnector = connectors.find(c => c.id === 'farcaster' || c.name === 'Farcaster');
      if (farcasterConnector) {
        connect({ connector: farcasterConnector });
      }
    } else {
      // On web, try injected connector first (MetaMask, Coinbase, Brave, etc.)
      const injectedConnector = connectors.find(c => c.id === 'injected');
      if (injectedConnector) {
        connect({ connector: injectedConnector });
      } else {
        // Fallback to WalletConnect if no injected wallet
        const wcConnector = connectors.find(c => c.id === 'walletConnect');
        if (wcConnector) {
          connect({ connector: wcConnector });
        }
      }
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const formatAddress = (addr: string): string => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Prevent hydration mismatch
  if (!isMounted) {
    return (
      <Button className={className} disabled>
        Loading...
      </Button>
    );
  }

  if (isConnected && address) {
    const isFarcasterConnector = connector?.id === 'farcaster' || connector?.name === 'Farcaster';
    const isWrongNetwork = chain && chain.id !== base.id;
    
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="text-sm text-center">
          {isInFarcaster && farcasterUser && isFarcasterConnector && (
            <div className="text-purple-400 mb-1">
              🎭 @{farcasterUser.username || `fid:${farcasterUser.fid}`}
            </div>
          )}
          <div className="text-gray-400">
            Connected: <span className="text-white">{formatAddress(address)}</span>
          </div>
          {isFarcasterConnector && (
            <div className="text-xs text-purple-300 mt-1">
              via Farcaster Wallet
            </div>
          )}
          {chain && (
            <div className={`text-xs mt-1 ${
              isWrongNetwork ? 'text-red-400' : 'text-green-400'
            }`}>
              {isWrongNetwork ? '⚠️ Wrong Network!' : '✓ Base Network'}
            </div>
          )}
        </div>
        
        {/* Warning for wrong network */}
        {isWrongNetwork && (
          <div className="bg-red-900/30 border border-red-700 rounded p-2 text-xs text-red-400 text-center">
            ⚠️ Please switch to Base Network
          </div>
        )}
        
        {/* Switch Network Button */}
        {isWrongNetwork && switchChain && (
          <Button 
            onClick={() => switchChain({ chainId: base.id })}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="sm"
            disabled={isSwitchingNetwork}
          >
            {isSwitchingNetwork ? '🔄 Switching...' : '🔄 Switch to Base'}
          </Button>
        )}
        
        <Button 
          onClick={handleDisconnect}
          variant="destructive"
          size="sm"
          className="w-full"
        >
          Disconnect Wallet
        </Button>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleConnect}
      className={`bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 ${className}`}
    >
      {isInFarcaster ? '🎭 Connect Farcaster Wallet' : '🔗 Connect Wallet'}
    </Button>
  );
};
