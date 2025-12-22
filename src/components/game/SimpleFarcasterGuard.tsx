'use client';

import { useEffect, useState } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { Button } from '@/components/ui/button';

interface SimpleFarcasterGuardProps {
  children: React.ReactNode;
}

export function SimpleFarcasterGuard({ children }: SimpleFarcasterGuardProps): JSX.Element {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [showWarning, setShowWarning] = useState<boolean>(true);

  useEffect(() => {
    // Simple, fast check with timeout
    const checkContext = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve(false), 1000)
        );
        
        const checkPromise = (async () => {
          try {
            const context = await sdk.context;
            return !!(context && context.client);
          } catch {
            return false;
          }
        })();
        
        const result = await Promise.race([checkPromise, timeoutPromise]);
        setIsValid(result as boolean);
      } catch {
        setIsValid(false);
      }
    };

    checkContext();
  }, []);

  // Show dismissible warning if not on Farcaster/Base App
  const warningBanner = isValid === false && showWarning ? (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-2xl">ℹ️</span>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">
              For the best experience, play on <strong>Farcaster</strong> or <strong>Base App</strong>
            </p>
            <p className="text-blue-100 text-xs">
              Wallet and leaderboard features may not work properly in regular web browsers
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowWarning(false)}
          className="text-white hover:bg-white/20 shrink-0"
        >
          ✕
        </Button>
      </div>
    </div>
  ) : null;

  // Always render app, just show warning banner if needed
  return (
    <>
      {warningBanner}
      <div style={{ paddingTop: isValid === false && showWarning ? '80px' : '0' }}>
        {children}
      </div>
    </>
  );
}
