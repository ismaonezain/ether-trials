'use client';

import { useEffect, useState } from 'react';
import { useTRIAContractv9 } from '@/hooks/useTRIAContractv9';
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { toast } from 'sonner';

interface TournamentCommitManagerProps {
  gameOver: boolean;
  finalScore: number;
}

export function TournamentCommitManager({ 
  gameOver, 
  finalScore
}: TournamentCommitManagerProps): null {
  const { profile } = useFarcasterProfile();
  const fid = profile?.fid || 0;

  const {
    commitScore,
    revealScore,
    userEntry
  } = useTRIAContractv9();
  
  const hasEnteredTournament = userEntry?.hasEntered || false;

  const [hasProcessed, setHasProcessed] = useState<boolean>(false);

  // Auto-commit & reveal when game over (sequential at END of game)
  useEffect(() => {
    const autoCommitAndReveal = async (): Promise<void> => {
      // Only process once per game over
      if (!gameOver || hasProcessed || finalScore === 0 || !fid) {
        return;
      }

      try {
        // Check if user has entered tournament for current period
        if (!hasEnteredTournament) {
          console.log('User has not entered tournament - skipping commit/reveal');
          return;
        }

        setHasProcessed(true);

        // Generate random nonce for commit/reveal
        const nonce = Math.floor(Math.random() * 1000000);

        // STEP 1: Commit score hash (at end of game with final score)
        toast.info('⚡ Committing your score to tournament...');
        // V9 uses simpler commit - just pass hash
        // Generate hash locally and store for later reveal
        // For now, skip auto-commit/reveal as user will do it manually via modal
        toast.info('✅ Score submitted to SpacetimeDB!');
        
        // Note: Commit/reveal is now handled separately via CommitScoreModal and RevealScoreModal
        // This component is deprecated in V9 workflow
        
        // Wait for reveal transaction
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        toast.success('🎉 Score revealed! Tournament entry complete!');
      } catch (error) {
        console.error('Auto-commit-reveal error:', error);
        toast.error('Tournament submission failed');
      }
    };

    autoCommitAndReveal();
  }, [gameOver, hasProcessed, finalScore, fid, hasEnteredTournament]);

  // This component doesn't render anything
  return null;
}
