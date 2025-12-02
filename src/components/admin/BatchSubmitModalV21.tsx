'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTRIAContractv21 } from '@/hooks/useTRIAContractv21';
import type { Address } from 'viem';

interface LeaderboardEntry {
  wallet_address: string;
  score: number;
  entry_amount: string;
  weighted_score: number;
}

interface BatchSubmitModalV21Props {
  isOpen: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  currentPeriod: number;
}

export function BatchSubmitModalV21({ isOpen, onClose, entries, currentPeriod }: BatchSubmitModalV21Props) {
  const { submitPointsBatch, isPending, isConfirming, isConfirmed, error } = useTRIAContractv21();

  const handleSubmit = () => {
    const addresses: Address[] = [];
    const weightedScores: bigint[] = [];

    entries.forEach((entry) => {
      if (entry.weighted_score > 0) {
        addresses.push(entry.wallet_address as Address);
        
        // Convert weighted score to BigInt with precision
        // Weighted score from frontend is already calculated as: score × (entry / 6B)
        // We multiply by 1e6 for precision in the contract
        const scaledWeightedScore = Math.floor(entry.weighted_score * 1_000_000);
        weightedScores.push(BigInt(scaledWeightedScore));
      }
    });

    if (addresses.length === 0) {
      alert('No valid entries to submit');
      return;
    }

    submitPointsBatch(addresses, weightedScores);
  };

  React.useEffect(() => {
    if (isConfirmed) {
      alert('Scores submitted successfully!');
      onClose();
    }
  }, [isConfirmed, onClose]);

  React.useEffect(() => {
    if (error) {
      console.error('Batch submit error:', error);
      alert(`Error: ${error.message}`);
    }
  }, [error]);

  const validEntries = entries.filter((e) => e.weighted_score > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Batch Submit Weighted Scores to Contract V21</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-sm font-semibold text-yellow-800">⚠️ Important:</p>
            <ul className="text-sm text-yellow-700 mt-2 space-y-1">
              <li>• Frontend calculates weighted scores: score × (entry / 6B TRIA)</li>
              <li>• Contract receives weighted scores with 1e6 precision</li>
              <li>• Contract only stores and allocates - NO calculation needed!</li>
              <li>• Period {currentPeriod} must NOT be distributed yet</li>
              <li>• This action is irreversible</li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm font-semibold text-blue-800">📊 Summary:</p>
            <p className="text-sm text-blue-700 mt-1">
              Submitting {validEntries.length} weighted scores to contract V21
            </p>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">Address</th>
                  <th className="px-4 py-2 text-right">Base Score</th>
                  <th className="px-4 py-2 text-right">Entry (TRIA)</th>
                  <th className="px-4 py-2 text-right">Weighted Score</th>
                  <th className="px-4 py-2 text-right">Scaled (1e6)</th>
                </tr>
              </thead>
              <tbody>
                {validEntries.map((entry, index) => {
                  const scaledWeighted = Math.floor(entry.weighted_score * 1_000_000);
                  return (
                    <tr key={index} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">
                        {entry.wallet_address.slice(0, 6)}...{entry.wallet_address.slice(-4)}
                      </td>
                      <td className="px-4 py-2 text-right">{entry.score.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">
                        {parseFloat(entry.entry_amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-blue-600">
                        {entry.weighted_score.toFixed(6)}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-600">
                        {scaledWeighted.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isPending || isConfirming}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || isConfirming || validEntries.length === 0}
            >
              {isPending || isConfirming
                ? 'Submitting...'
                : `Submit ${validEntries.length} Weighted Scores to Contract`}
            </Button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-sm font-semibold text-red-800">Error:</p>
              <p className="text-sm text-red-700 mt-1">{error.message}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
