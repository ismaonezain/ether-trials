okea
  'use client';

import { useEffect, useState } from 'react';

interface CountdownOverlayProps {
  onComplete: () => void;
}

export function CountdownOverlay({ onComplete }: CountdownOverlayProps): JSX.Element {
  const [count, setCount] = useState<number>(3);

  useEffect(() => {
    if (count === 0) {
      // Wait a bit before calling onComplete
      const timer = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setCount(count - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black backdrop-blur-sm">
      <div className="text-center space-y-4 p-8">
        <div className="animate-pulse">
          <div className="text-3xl font-bold bg-gradient-to-r from-yellow-400 via-red-500 to-purple-600 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(250,204,21,0.6)]">
            Loading...
          </div>
        </div>
        <div className="text-yellow-300 text-lg font-medium">
          ⚔️ Preparing Battle
        </div>
      </div>
    </div>
  );
}
