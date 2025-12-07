'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Send, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useTRIAContractv20 } from '@/hooks/useTRIAContractv20';
import type { Address } from 'viem';

interface BatchSubmitModalProps {
  entries: {
    wallet_address: string;
    username: string;
    score: number;
    entry_amount: string | null;
    weighted_score?: number;
  }[];
  currentPeriod: number;
  onClose: () => void;
}

export function BatchSubmitModal({ entries, currentPeriod, onClose }: BatchSubmitModalProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { submitScoresBatch } = useTRIAContractv20();

  const handleBatchSubmit = async (): Promise<void> => {
    try {
      setIsSubmitting(true);
      toast.info('📝 Preparing batch submission...');

      // Prepare arrays for contract
      const addresses: Address[] = [];
      const scores: bigint[] = [];

      for (const entry of entries) {
        if (!entry.wallet_address) {
          console.warn('⚠️ Skipping entry without wallet address:', entry.username);
          continue;
        }

        addresses.push(entry.wallet_address as Address);
        scores.push(BigInt(entry.score)); // BASE SCORE!
      }

      if (addresses.length === 0) {
        toast.error('No valid entries to submit');
        setIsSubmitting(false);
        return;
      }

      console.log('📤 ========== BATCH SUBMIT ==========');
      console.log('📤 Period:', currentPeriod);
      console.log('📤 Total entries:', addresses.length);
      console.log('📤 Addresses:', addresses);
      console.log('📤 Base Scores:', scores.map(s => s.toString()));
      console.log('📤 ====================================');

      // Submit to contract
      await submitScoresBatch(addresses, scores);

      toast.success(`✅ Successfully submitted ${addresses.length} scores!`);
      setIsSubmitting(false);
      onClose();
    } catch (error) {
      console.error('❌ Batch submit error:', error);
      setIsSubmitting(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to submit scores', {
        description: errorMessage,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-blue-900/95 to-purple-900/95 border-2 border-blue-500 shadow-2xl">
        <CardHeader className="border-b border-blue-500/50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Send className="h-6 w-6 text-blue-400" />
              <div>
                <CardTitle className="text-xl font-bold text-yellow-300">
                  Batch Submit Scores
                </CardTitle>
                <p className="text-sm text-gray-300 mt-1">
                  Submit {entries.length} scores to contract for Period {currentPeriod}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          {/* Warning */}
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-yellow-200">
                <p className="font-semibold">⚠️ Important Contract Information:</p>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>This sends <strong>BASE SCORES</strong> to the contract</li>
                  <li>Contract will calculate <strong>weighted scores</strong> automatically using formula: <code className="bg-black/30 px-2 py-1 rounded">points = score × (entry / 6B TRIA)</code></li>
                  <li>Contract uses the <strong>entryAmount</strong> already stored from when players entered the tournament</li>
                  <li>This action <strong>cannot be undone</strong> - make sure data is correct!</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Entries Preview */}
          <div className="bg-black/30 rounded-lg p-4 max-h-64 overflow-y-auto">
            <p className="text-sm font-semibold text-gray-300 mb-3">
              Entries to Submit ({entries.length})
            </p>
            <div className="space-y-2">
              {entries.slice(0, 10).map((entry, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between text-xs bg-white/5 rounded px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500">
                      #{index + 1}
                    </Badge>
                    <span className="text-white font-medium">{entry.username}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-gray-400">Base Score</p>
                      <p className="text-white font-bold">{entry.score.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400">Wallet</p>
                      <p className="text-gray-300 font-mono">
                        {entry.wallet_address ? `${entry.wallet_address.slice(0, 6)}...${entry.wallet_address.slice(-4)}` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {entries.length > 10 && (
                <p className="text-gray-400 text-xs text-center pt-2">
                  ... and {entries.length - 10} more entries
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-700">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              size="lg"
              onClick={handleBatchSubmit}
              disabled={isSubmitting || entries.length === 0}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 text-white font-bold"
            >
              {isSubmitting ? (
                <>⏳ Submitting {entries.length} Scores...</>
              ) : (
                <>🚀 Submit {entries.length} Scores to Contract</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
