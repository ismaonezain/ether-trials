'use client';

import { useGasPrice } from 'wagmi';
import { formatGwei } from 'viem';
import { Flame } from 'lucide-react';

export function GasPriceIndicator(): JSX.Element {
  const { data: gasPrice } = useGasPrice();

  if (!gasPrice) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-800/50 rounded text-[10px] text-gray-400">
        <Flame className="w-3 h-3" />
        <span>Loading...</span>
      </div>
    );
  }

  const gasPriceGwei = formatGwei(gasPrice);
  const gasPriceNum = parseFloat(gasPriceGwei);

  // Color based on gas price (Base network typically has low gas)
  let colorClass = 'text-green-400 border-green-700/50 bg-green-900/20';
  let status = 'Low';

  if (gasPriceNum > 0.1) {
    colorClass = 'text-yellow-400 border-yellow-700/50 bg-yellow-900/20';
    status = 'Medium';
  }
  
  if (gasPriceNum > 1) {
    colorClass = 'text-red-400 border-red-700/50 bg-red-900/20';
    status = 'High';
  }

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border ${colorClass} text-[10px] sm:text-xs`}>
      <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
      <div className="flex flex-col leading-tight">
        <span className="font-semibold">{gasPriceGwei.slice(0, 6)} Gwei</span>
        <span className="text-[9px] opacity-70">{status}</span>
      </div>
    </div>
  );
}
