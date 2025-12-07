'use client';

import React, { useState } from 'react';
import { Loader2, Upload, Check, AlertCircle, Users, Trophy } from 'lucide-react';
import { usePointBasedContract } from '@/hooks/usePointBasedContract';
import type { Address } from 'viem';
import type { Entry } from '@/hooks/useSupabase';

interface ScoreSubmissionPanelProps {
  onClose: () => void;
  currentPeriod: number;
  entries: Entry[];
}

export function ScoreSubmissionPanel({ onClose, currentPeriod, entries }: ScoreSubmissionPanelProps) {
  const { submitScore, submitScoresBatch } = usePointBasedContract();
  
  const [submissionMode, setSubmissionMode] = useState<'single' | 'batch'>('batch');
  const [singleAddress, setSingleAddress] = useState('');
  const [singleScore, setSingleScore] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAddresses, setSubmittedAddresses] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  // Filter entries by current period from smart contract
  const activeEntries = entries.filter(entry => 
    Number(entry.period) === currentPeriod &&
    entry.walletAddress && 
    entry.walletAddress.trim() !== ''
  );

  const handleSubmitSingle = async () => {
    if (!singleAddress || !singleScore) {
      setStatus({ type: 'error', message: 'Please enter both address and score' });
      return;
    }

    // Validate address format
    if (!singleAddress.startsWith('0x') || singleAddress.length !== 42) {
      setStatus({ type: 'error', message: 'Invalid Ethereum address format' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: 'loading', message: 'Submitting score to contract...' });

    try {
      const result = await submitScore(
        singleAddress as Address,
        BigInt(singleScore)
      );

      if (result.success) {
        setStatus({
          type: 'success',
          message: `Successfully submitted score for ${singleAddress.slice(0, 6)}...${singleAddress.slice(-4)}!`
        });
        setSubmittedAddresses(prev => new Set([...prev, singleAddress.toLowerCase()]));
        setSingleAddress('');
        setSingleScore('');
        setTimeout(() => setStatus({ type: 'idle', message: '' }), 3000);
      } else {
        setStatus({ type: 'error', message: result.error || 'Failed to submit score' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus({ type: 'error', message: `Error: ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitBatch = async () => {
    if (activeEntries.length === 0) {
      setStatus({ type: 'error', message: 'No active players to submit' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ 
      type: 'loading', 
      message: `Submitting ${activeEntries.length} scores to contract...` 
    });

    try {
      const players = activeEntries.map(entry => entry.walletAddress as Address);
      const scores = activeEntries.map(entry => BigInt(entry.score));

      const result = await submitScoresBatch(players, scores);

      if (result.success) {
        setStatus({
          type: 'success',
          message: `Successfully submitted ${activeEntries.length} scores in batch! Tx: ${result.hash?.slice(0, 10)}...`
        });
        
        // Mark all as submitted
        const newSubmitted = new Set(submittedAddresses);
        activeEntries.forEach(entry => {
          newSubmitted.add(entry.walletAddress.toLowerCase());
        });
        setSubmittedAddresses(newSubmitted);
        
        setTimeout(() => {
          setStatus({ type: 'idle', message: '' });
        }, 5000);
      } else {
        setStatus({ type: 'error', message: result.error || 'Failed to submit batch' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus({ type: 'error', message: `Error: ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-purple-900 to-indigo-900 border-2 border-purple-500 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-purple-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">Submit Scores to Contract</h2>
          </div>
          <button
            onClick={onClose}
            className="text-purple-300 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Period Info */}
        <div className="p-4 border-b border-purple-500/30 bg-blue-900/20">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-200">
              <span className="font-semibold">Current Period:</span> {currentPeriod}
            </div>
            <div className="text-sm text-blue-200">
              <span className="font-semibold">Total Entries:</span> {activeEntries.length}
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="p-4 border-b border-purple-500/30">
          <div className="flex gap-2">
            <button
              onClick={() => setSubmissionMode('batch')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${
                submissionMode === 'batch'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-900/50 text-purple-300 hover:bg-purple-800/50'
              }`}
            >
              Batch Submit (All Players)
            </button>
            <button
              onClick={() => setSubmissionMode('single')}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${
                submissionMode === 'single'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-900/50 text-purple-300 hover:bg-purple-800/50'
              }`}
            >
              Single Submit
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-250px)]">
          {submissionMode === 'batch' ? (
            <div>
              {/* Batch Info */}
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2 text-sm text-blue-200">
                  <Users className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Batch Submission</p>
                    <p className="text-xs">
                      Submit all active player scores from period {currentPeriod} in a single transaction. 
                      This is more gas-efficient than individual submissions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Entries Preview */}
              <div className="mb-4">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  Players to Submit ({activeEntries.length})
                </h3>
                <div className="bg-black/30 rounded-lg border border-purple-500/20 max-h-64 overflow-y-auto">
                  {activeEntries.length === 0 ? (
                    <div className="p-4 text-center text-purple-300 text-sm">
                      No entries found for period {currentPeriod}
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-purple-900/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-purple-300 font-semibold">#</th>
                          <th className="text-left p-2 text-purple-300 font-semibold">Username</th>
                          <th className="text-left p-2 text-purple-300 font-semibold">Address</th>
                          <th className="text-right p-2 text-purple-300 font-semibold">Score</th>
                          <th className="text-center p-2 text-purple-300 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeEntries.map((entry, index) => {
                          const isSubmitted = submittedAddresses.has(entry.walletAddress.toLowerCase());
                          
                          return (
                            <tr key={entry.entry_id.toString()} className="border-t border-purple-500/10 hover:bg-purple-900/20">
                              <td className="p-2 text-purple-300">{index + 1}</td>
                              <td className="p-2 text-white max-w-[120px] truncate" title={entry.username}>
                                {entry.username}
                              </td>
                              <td className="p-2 text-white font-mono" title={entry.walletAddress}>
                                {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}
                              </td>
                              <td className="p-2 text-right text-yellow-400 font-semibold">
                                {Number(entry.score).toLocaleString()}
                              </td>
                              <td className="p-2 text-center">
                                {isSubmitted ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-400">
                                    <Check className="w-3 h-3" />
                                    Submitted
                                  </span>
                                ) : (
                                  <span className="text-xs text-purple-300">Pending</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmitBatch}
                disabled={isSubmitting || activeEntries.length === 0}
                className={`w-full py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  activeEntries.length === 0
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : isSubmitting
                    ? 'bg-purple-600 text-white cursor-wait'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting Batch...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Submit {activeEntries.length} Scores
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              {/* Single Submission Form */}
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2 text-sm text-blue-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Individual Submission</p>
                    <p className="text-xs">
                      Submit a score for a single player. Use this when you need to update or add 
                      a specific player's score manually.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Player Address
                  </label>
                  <input
                    type="text"
                    value={singleAddress}
                    onChange={(e) => setSingleAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 bg-black/30 border border-purple-500/30 rounded-lg text-white placeholder-purple-400 focus:border-purple-500 focus:outline-none font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-purple-300 text-sm font-semibold mb-2">
                    Score
                  </label>
                  <input
                    type="number"
                    value={singleScore}
                    onChange={(e) => setSingleScore(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-black/30 border border-purple-500/30 rounded-lg text-white placeholder-purple-400 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleSubmitSingle}
                  disabled={isSubmitting || !singleAddress || !singleScore}
                  className={`w-full py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    !singleAddress || !singleScore
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : isSubmitting
                      ? 'bg-purple-600 text-white cursor-wait'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Submit Score
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {status.type !== 'idle' && (
          <div className="p-4 border-t border-purple-500/30">
            <div
              className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                status.type === 'loading'
                  ? 'bg-blue-900/30 border border-blue-500/30 text-blue-200'
                  : status.type === 'success'
                  ? 'bg-green-900/30 border border-green-500/30 text-green-200'
                  : 'bg-red-900/30 border border-red-500/30 text-red-200'
              }`}
            >
              {status.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 mt-0.5" />}
              {status.type === 'success' && <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {status.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span className="flex-1">{status.message}</span>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="p-4 border-t border-purple-500/30 bg-purple-900/20">
          <div className="text-xs text-purple-300 space-y-1">
            <p>• Submit scores from period {currentPeriod} before allocating prizes</p>
            <p>• Batch submission is more gas-efficient for multiple players</p>
            <p>• Only the contract owner can submit scores</p>
          </div>
        </div>
      </div>
    </div>
  );
}
