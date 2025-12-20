'use client';

import { useState, useEffect } from 'react';
import type { GameState } from '@/types/game';
import { calculateScore, getCompletionTime, getRemainingHpPercent } from '@/lib/game/engine';
import { calculateDynamicTier, formatTime, formatNumber } from '@/lib/game/utils';
import { getTierImage } from '@/lib/game/tierImages';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { CommitScoreModalV4 } from './CommitScoreModalV4';
import { RevealScoreModalV4 } from './RevealScoreModalV4';
import { toast } from 'sonner';

interface GameOverProps {
  gameState: GameState;
  onRestart: () => void;
  onSubmitScore: (score: number, time: number, hp: number, stages: number) => Promise<void>;
  playerRank?: number;
  prizeAmount?: string;
  onBackToMenu?: () => void;
  funScores?: number[];
  paidScores?: number[];
  currentPeriod?: number;
}

export function GameOver({ gameState, onRestart, onSubmitScore, playerRank = 0, prizeAmount = '0', onBackToMenu, funScores = [], paidScores = [], currentPeriod = 0 }: GameOverProps): JSX.Element {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [sharing, setSharing] = useState<boolean>(false);
  const [showCommitModal, setShowCommitModal] = useState<boolean>(false);
  const [showRevealModal, setShowRevealModal] = useState<boolean>(false);
  
  const { profile } = useFarcasterProfile();
  const fid = profile?.fid ? BigInt(profile.fid) : undefined;

  const finalScore = calculateScore(gameState);
  const completionTime = getCompletionTime(gameState);
  const remainingHp = getRemainingHpPercent(gameState);
  const stagesCompleted = gameState.stage.stageNumber - 1;
  
  // Use dynamic tier calculation based on game mode
  const isPaidMode = gameState.gameMode === 'paid';
  const scoresForTier = isPaidMode ? paidScores : funScores;
  const tier = calculateDynamicTier(finalScore, scoresForTier);
  const tierImage = getTierImage(tier);

  useEffect(() => {
    // Auto-submit score to SpacetimeDB
    const submit = async (): Promise<void> => {
      if (submitted || submitting) return;
      setSubmitting(true);
      try {
        toast.info('💾 Submitting your score...', {
          description: 'Recording your battle performance'
        });
        await onSubmitScore(finalScore, completionTime, remainingHp, stagesCompleted);
        setSubmitted(true);
        console.log('✅ Score submitted successfully to SpacetimeDB');
        toast.success('✅ Score recorded!', {
          description: 'Your performance has been saved to the archives'
        });
      } catch (error) {
        console.error('⚠️ Failed to submit score:', error);
        // Mark as submitted anyway to prevent infinite retries
        setSubmitted(true);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log('ℹ️ Score submission failed:', errorMessage);
        toast.error('⚠️ Score submission failed', {
          description: 'Your score could not be saved. You can still view your results locally.'
        });
      } finally {
        setSubmitting(false);
      }
    };
    submit();
  }, [finalScore, completionTime, remainingHp, stagesCompleted, onSubmitScore, submitted, submitting]);

  const handleShare = async (): Promise<void> => {
    if (sharing) return;
    setSharing(true);
    
    try {
      const gameLink = 'https://bat-been-379.app.ohara.ai';
      const gameMode = gameState.gameMode === 'paid' ? 'Prize Pool Mode 🏆' : 'For Fun Mode 🎮';
      const characterClass = gameState.character?.class || 'Warrior';
      
      // Create miniapp embed share URL with stage, period, pfp, and username
      const pfpUrl = profile?.pfpUrl || '';
      const username = profile?.username || 'Anonymous';
      const shareApiUrl = `${gameLink}/api/share/${encodeURIComponent(characterClass)}?score=${finalScore}&tier=${encodeURIComponent(tier)}&mode=${gameState.gameMode}&stage=${stagesCompleted}&period=${currentPeriod}&pfp=${encodeURIComponent(pfpUrl)}&username=${encodeURIComponent(username)}`;
      
      const shareText = `Just achieved ${tier} rank in Ether Trials! ⚔️

Score: ${formatNumber(finalScore)} | Class: ${characterClass}
Mode: ${gameMode}

Think you can beat this? Play now on Base! 🎮

by @ismaone.farcaster.eth`;

      // Share to Farcaster/Base with miniapp embed
      const castText = encodeURIComponent(shareText);
      const embedUrl = encodeURIComponent(shareApiUrl);
      const shareUrl = `https://warpcast.com/~/compose?text=${castText}&embeds[]=${embedUrl}&channelKey=base&mentions[]=235940`;
      
      // Try to open in new window
      if (typeof window !== 'undefined' && window.open) {
        window.open(shareUrl, '_blank');
        console.log('✅ Shared to Farcaster/Base with miniapp embed');
        toast.success('📤 Opening share dialog...', {
          description: 'Your victory will be shared with a beautiful miniapp embed!'
        });
      } else if (navigator.share) {
        // Fallback to native share
        await navigator.share({
          title: 'Ether Trials - My Score',
          text: shareText + `\n\n▶️ Play now: ${gameLink}`,
        });
        console.log('✅ Shared via native share');
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareText + `\n\n▶️ Play now: ${gameLink}`);
        toast.success('📋 Copied to clipboard!', {
          description: 'Share link copied - paste it anywhere!'
        });
        console.log('✅ Copied to clipboard');
      }
    } catch (error) {
      console.error('Failed to share:', error);
      toast.error('Share failed', {
        description: 'Unable to share. Please try copying the score manually.'
      });
    } finally {
      setSharing(false);
    }
  };

  // Job-specific images mapping
  const jobImages: Record<string, string> = {
    'Assassin': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/c9e08baf-a03e-4a8a-ac4f-8df13c101bd0-SyooX425UEVl9yvZHumcxqkRRG8wHd',
    'Cook': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/533237ed-f0e3-4081-a711-a6dd288ecdc9-ogoWZZvx6yInE4A8zy641R0I1FCAuE',
    'Mage': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/01c48375-84c9-42e8-b769-12086cc7893a-mLtAv1rgA8zfwco0FaU82CTL3W6omW',
    'Paladin': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/21791fc9-b1f8-4f24-a3f2-3ad30e5778ac-Oa61oXdNXkFFiXaAPtfxBMtsftfSDA',
    'Ranger': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/9f5e6dc1-42ab-49bc-ab30-f41e000b3645-8mz98RwzkhShxVlFPEfpLixQKb1r1m',
    'Warrior': 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/9582d8a6-3150-4c87-a8f8-3ea4917e9254-7AqZUr9R06fsZlcMI4QBvW1UcAtoLV'
  };

  const characterClass = gameState.character?.class || 'Warrior';
  const jobImage = jobImages[characterClass] || jobImages['Warrior'];

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-black via-purple-900 to-black flex items-center justify-center p-4">
        <Card className="max-w-lg w-full fantasy-card">
        <CardHeader className="pb-3 border-b border-yellow-600/50">
          <CardTitle className="text-2xl text-center fantasy-title glow-text bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
            ⚔️ Battle Concluded ⚔️
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Farcaster Profile */}
          {profile && (
            <div className="bg-gradient-to-r from-purple-900/70 to-blue-900/70 p-3 rounded-lg border-2 border-yellow-600/50">
              <div className="flex items-center gap-3">
                {profile.pfpUrl && (
                  <img 
                    src={profile.pfpUrl} 
                    alt="Profile" 
                    className="w-12 h-12 rounded-full border-2 border-yellow-400 flex-shrink-0 shadow-lg shadow-yellow-500/50"
                    style={{ aspectRatio: '1/1', objectFit: 'cover' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-yellow-300 font-bold text-sm truncate">{profile.displayName}</div>
                  <div className="text-purple-300 text-xs">@{profile.username}</div>
                </div>
              </div>
            </div>
          )}

          {/* Job-Specific Character Image */}
          <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-yellow-600/50 bg-black">
            <img 
              src={jobImage} 
              alt={`${characterClass} Character`}
              className="w-full h-full object-cover"
              style={{ aspectRatio: '16/9', objectFit: 'cover' }}
            />
          </div>

          {/* Performance Title */}
          <div className="text-center py-2">
            <div className="text-gray-400 text-sm medieval-text">Battle Performance</div>
          </div>

          {/* Stats - Compact Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-gradient-to-br from-purple-900/50 to-black/50 p-2 rounded border border-yellow-600/30">
              <div className="text-yellow-400 text-xs">Score</div>
              <div className="text-white font-bold">{formatNumber(finalScore)}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/50 to-black/50 p-2 rounded border border-red-600/30">
              <div className="text-red-400 text-xs">Time</div>
              <div className="text-white font-bold">{formatTime(completionTime)}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/50 to-black/50 p-2 rounded border border-blue-600/30">
              <div className="text-blue-400 text-xs">Stages</div>
              <div className="text-white font-bold">{stagesCompleted}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/50 to-black/50 p-2 rounded border border-green-600/30">
              <div className="text-green-400 text-xs">HP Left</div>
              <div className="text-white font-bold">{remainingHp.toFixed(1)}%</div>
            </div>
          </div>

          {/* Class & Element */}
          {gameState.character && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gradient-to-br from-red-900/50 to-black/50 p-2 rounded border border-red-600/30">
                <div className="text-red-400 text-xs">Class</div>
                <div className="text-white font-bold">{gameState.character.class}</div>
              </div>
              <div className="bg-gradient-to-br from-blue-900/50 to-black/50 p-2 rounded border border-blue-600/30">
                <div className="text-blue-400 text-xs">Element</div>
                <div className="text-white font-bold">{gameState.character.element}</div>
              </div>
            </div>
          )}

          {/* Submit Status */}
          {submitting && (
            <div className="text-center text-yellow-300 text-sm animate-pulse">⚡ Submitting...</div>
          )}
          {submitted && (
            <div className="text-center text-green-400 text-sm">✓ Score recorded in the archives!</div>
          )}

          {/* Prize Pool Mode - Score Verified */}
          {isPaidMode && submitted && (
            <div className="space-y-2">
              <div className="p-3 bg-gradient-to-r from-green-900/50 to-emerald-900/50 border border-green-500/50 rounded text-center">
                <div className="text-green-400 font-bold text-sm mb-2">✅ Prize Pool Mode - Score Verified</div>
                <div className="text-gray-300 text-xs">
                  Your score has been submitted and verified on-chain! Check the leaderboard to see your rank and claim prizes from the main menu.
                </div>
              </div>
            </div>
          )}

          {/* Share Button */}
          <Button
            size="lg"
            className="w-full font-bold fantasy-button text-white"
            onClick={handleShare}
            disabled={sharing}
          >
            {sharing ? '🔄 Sharing...' : '📤 Share Your Victory'}
          </Button>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              size="lg" 
              className="font-bold bg-gradient-to-r from-green-700 to-blue-700 hover:from-green-600 hover:to-blue-600 text-white border-2 border-green-500" 
              onClick={onRestart}
            >
              ⚔️ Battle Again
            </Button>
            {onBackToMenu && (
              <Button 
                size="lg" 
                variant="outline" 
                className="font-bold bg-black/50 border-2 border-yellow-600 text-yellow-300 hover:bg-purple-900/50" 
                onClick={onBackToMenu}
              >
                🏰 Return to Menu
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Commit Score Modal V4 */}
      {showCommitModal && (
        <CommitScoreModalV4
          isOpen={showCommitModal}
          onClose={() => setShowCommitModal(false)}
          onCommitSuccess={() => {
            setShowCommitModal(false);
            onRestart();
          }}
        />
      )}

      {/* Reveal Score Modal V4 */}
      {showRevealModal && (
        <RevealScoreModalV4
          isOpen={showRevealModal}
          finalScore={finalScore}
          onRevealSuccess={() => {
            setShowRevealModal(false);
          }}
        />
      )}
    </>
  );
}
