kono
  'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { base } from 'wagmi/chains';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface NetworkSwitcherProps {
  compact?: boolean;
}

export function NetworkSwitcher({ compact = false }: NetworkSwitcherProps): JSX.Element | null {
  const { chain, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const [isSwitching, setIsSwitching] = useState<boolean>(false);

  // Only show if connected and not on Base network
  if (!isConnected || !chain || chain.id === base.id) {
    return null;
  }

  const handleSwitchNetwork = async (): Promise<void> => {
    if (!switchChain) return;
    
    try {
      setIsSwitching(true);
      await switchChain({ chainId: base.id });
    } catch (error) {
      console.error('Failed to switch network:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  if (compact) {
    return (
      <div className="bg-red-900/40 border border-red-700 rounded-lg p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <div className="text-red-400 text-xs font-bold">⚠️ Wrong Network</div>
            <div className="text-red-300 text-[10px]">Switch to Base</div>
          </div>
          {switchChain && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3"
              onClick={handleSwitchNetwork}
              disabled={isSwitching}
            >
              {isSwitching ? '🔄' : '🔄 Switch'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 sm:p-4">
      <div className="text-center mb-3">
        <div className="text-red-400 text-sm sm:text-base font-bold mb-1">⚠️ Wrong Network Detected</div>
        <div className="text-red-300 text-xs sm:text-sm mb-1">
          You're on <span className="font-bold">{chain.name || `Chain ${chain.id}`}</span>
        </div>
        <div className="text-red-200/70 text-[10px] sm:text-xs">
          This app requires Base Network for transactions
        </div>
      </div>
      
      {switchChain && (
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          onClick={handleSwitchNetwork}
          disabled={isSwitching}
        >
          {isSwitching ? '🔄 Switching to Base...' : '🔄 Switch to Base Network'}
        </Button>
      )}

      <div className="mt-2 text-center text-gray-400 text-[10px] sm:text-xs">
        💡 Base Network offers low gas fees & fast transactions
      </div>
    </div>
  );
}
