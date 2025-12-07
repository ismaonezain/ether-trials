'use client'
// Disable static rendering for this page (uses browser-only hooks)

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect } from 'react';
import type { GameState, CharacterClass, ElementType } from '@/types/game';
import { ClassSelection } from '@/components/game/ClassSelection';
import { GameCanvas } from '@/components/game/GameCanvas';
import { GameUI } from '@/components/game/GameUI';
import { GameOver } from '@/components/game/GameOver';
import { TournamentEntryModalV4 } from '@/components/game/TournamentEntryModalV4';
import { TournamentEntryModalV21 } from '@/components/game/TournamentEntryModalV21';
import { DiceRollModalV20 } from '@/components/game/DiceRollModalV20';
import { CommitScoreModalV20 } from '@/components/game/CommitScoreModalV20';
import { RevealScoreModalV20 } from '@/components/game/RevealScoreModalV20';
import { initializeGame, calculateScore } from '@/lib/game/engine';
import { initializeSpriteManager } from '@/lib/game/animatedSpriteLoader';
import { applyBonusStatsToCharacter } from '@/lib/game/diceBonus';
import { useSupabase } from '@/hooks/useSupabase';
import { useTRIAContractv21 } from '@/hooks/useTRIAContractv21';
import { useTournamentContractV2 } from '@/hooks/useTournamentContractV2';
import { usePointBasedContractV4 } from '@/hooks/usePointBasedContractV4';
import { calculatePlayerRank, calculatePrizeAmount } from '@/lib/spacetime';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';

// Dynamic imports for components that use wagmi hooks (disable SSR)
const RealtimePrizePoolV4 = dynamic(() => import('@/components/game/RealtimePrizePoolV4').then(mod => ({ default: mod.RealtimePrizePoolV4 })), { ssr: false });
const RealtimePrizePoolV21 = dynamic(() => import('@/components/game/RealtimePrizePoolV21').then(mod => ({ default: mod.RealtimePrizePoolV21 })), { ssr: false });
const AdminPanelV21 = dynamic(() => import('@/components/admin/AdminPanelV21').then(mod => ({ default: mod.AdminPanelV21 })), { ssr: false });
const PrizeClaimModalV21 = dynamic(() => import('@/components/game/PrizeClaimModalV21').then(mod => ({ default: mod.PrizeClaimModalV21 })), { ssr: false });

import { Leaderboard } from '@/components/game/Leaderboard';
import { FeedbackForm } from '@/components/game/FeedbackForm';
import { WalletStatus } from '@/components/game/WalletStatus';
import { WalletConnectButton } from '@/components/game/WalletConnectButton';
import { NetworkSwitcher } from '@/components/game/NetworkSwitcher';
import { WelcomeOnboarding } from '@/components/game/WelcomeOnboarding';
import { SimpleFarcasterGuard } from '@/components/game/SimpleFarcasterGuard';
import { CountdownOverlay } from '@/components/game/CountdownOverlay';
import { useAccount } from 'wagmi';
import { sdk } from "@farcaster/miniapp-sdk";
import { useFarcasterProfile } from '@/hooks/useFarcasterProfile';
import { TRIA_TOKEN_ADDRESS } from '@/lib/contracts/etherTrialsTRIAv21ABI';
import { toast } from 'sonner';
import { useAutoConnectWallet } from '@/hooks/useAutoConnectWallet';
import { useAddMiniApp } from "@/hooks/useAddMiniApp";
import { AnnouncementBanner } from '@/components/game/AnnouncementBanner';
import { PatchNotesBoard } from '@/components/game/PatchNotesBoard';
import { useQuickAuth } from "@/hooks/useQuickAuth";
import { useIsInFarcaster } from "@/hooks/useIsInFarcaster";
import { AudioControls } from '@/components/game/AudioControls';
import { LobbyMusic } from '@/components/game/LobbyMusic';
import { ChatPopup, FloatingChatButton } from '@/components/game/ChatPopup';
import { GameTutorial } from '@/components/game/GameTutorial';

type GamePhase = 'intro' | 'selection' | 'payment' | 'classSelection' | 'countdown' | 'playing' | 'gameOver';

export default function Page(): JSX.Element {
  // ALL STATE DECLARATIONS FIRST
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [pendingClass, setPendingClass] = useState<CharacterClass | null>(null);
  const [pendingElement, setPendingElement] = useState<ElementType | null>(null);
  const [pendingMode, setPendingMode] = useState<'paid' | 'free' | null>(null);
  const [spritesReady, setSpritesReady] = useState<boolean>(false);
  const [playerRank, setPlayerRank] = useState<number>(0);
  const [prizeAmount, setPrizeAmount] = useState<string>('0');
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState<boolean>(false);
  const [showPrizeClaimModal, setShowPrizeClaimModal] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [gameSpeed, setGameSpeed] = useState<number>(3);
  const [hasTournamentEntry, setHasTournamentEntry] = useState<boolean>(false);
  const [lastCheckedPeriod, setLastCheckedPeriod] = useState<bigint | null>(null);
  const [showDiceModal, setShowDiceModal] = useState<boolean>(false);
  const [showCommitModal, setShowCommitModal] = useState<boolean>(false);
  const [showRevealModal, setShowRevealModal] = useState<boolean>(false);
  const [showPatchNotes, setShowPatchNotes] = useState<boolean>(false);
  const [showChatPopup, setShowChatPopup] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);
    const isInFarcaster = useIsInFarcaster()
    useQuickAuth(isInFarcaster)
  
  // ALL CUSTOM HOOKS - IN CORRECT ORDER
  const { profile, loading: profileLoading } = useFarcasterProfile();
  useAutoConnectWallet();
  const { connected, identity, startGameRun, submitRunResult, prizePool, announcements, entries, freeEntries, chatMessages, sendChatMessage } = useSupabase();
  
  // Safety checks: ensure data is always arrays
  const safeAnnouncements = Array.isArray(announcements) ? announcements : [];
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safeFreeEntries = Array.isArray(freeEntries) ? freeEntries : [];
  const safeChatMessages = Array.isArray(chatMessages) ? chatMessages : [];
  
  // Get FID for V4 contract
  const fidForContract = profile?.fid ? BigInt(profile.fid) : undefined;
  
  // V21 contract hook (ACTIVE CONTRACT - TRIA - SIMPLIFIED SCORING)
  const { useCurrentPeriod, useGetScoreCommit, useGetPlayerInfo, checkIsOwner: checkIsOwnerV21 } = useTRIAContractv21();
  const { address } = useAccount();
  const { data: currentPeriod } = useCurrentPeriod();
  
  // V4 contract (DEPRECATED - for old claims only)
  const { checkIsOwner: checkIsOwnerV4 } = usePointBasedContractV4();
  
  // V2 hook only for checkIsOwner (admin check) - fallback
  const { checkIsOwner: checkIsOwnerV2 } = useTournamentContractV2();
  const { data: scoreCommitData } = useGetScoreCommit(
    address as `0x${string}` | undefined,
    currentPeriod
  );
  const { data: playerInfoData, refetch: refetchPlayerInfo } = useGetPlayerInfo(
    address as `0x${string}` | undefined,
    currentPeriod
  );
  
  // Check if user has committed
  // scoreCommitData returns: [commitHash, commitTime, score, revealed]
  // CORRECT WAY: Check if commitTime > 0 (not commitHash)
  const hasCommitted = scoreCommitData && Array.isArray(scoreCommitData) && scoreCommitData[1] && Number(scoreCommitData[1]) > 0;
  // Check if user has entered (playerInfo returns: [hasEntered, score, entryAmount, points, pendingPrizeTRIA, claimed])
  const hasEnteredContract = playerInfoData && Array.isArray(playerInfoData) && playerInfoData[2] && playerInfoData[2] > 0n;
  
  console.log('🔍 User Status Check:', {
    address,
    currentPeriod: currentPeriod?.toString(),
    scoreCommitData,
    playerInfoData,
    hasCommitted,
    hasEnteredContract,
  });
  // Check owner status only if address is available
  const isOwnerFinal = address ? (checkIsOwnerV21(address) || checkIsOwnerV4(address) || checkIsOwnerV2(address)) : false;
  
  const { addMiniApp } = useAddMiniApp();
  useEffect(() => {
    const tryAddMiniApp = async () => {
      try {
        await addMiniApp()
      } catch (error) {
        console.error('Failed to add mini app:', error)
      }
    }
    
    tryAddMiniApp()
  }, [addMiniApp])

  // ALL EFFECTS - AFTER ALL HOOKS
  // Initialize Farcaster SDK
  useEffect(() => {
    const initializeFarcaster = async () => {
      try {
        // Simple SDK ready call with timeout
        const readyPromise = sdk.actions.ready();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SDK timeout')), 2000)
        );
        
        await Promise.race([readyPromise, timeoutPromise]);
        console.log("✅ Farcaster SDK ready");
      } catch (error) {
        console.log('ℹ️ Farcaster SDK not available - running in web mode');
      }
    };
    
    initializeFarcaster();
  }, []);

  // Initialize sprites and check onboarding status on mount
  useEffect(() => {
    initializeSpriteManager().then(() => {
      setSpritesReady(true);
      console.log('Sprite manager initialized');
    });

    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      console.log('📖 First time user - showing onboarding');
      setShowOnboarding(true);
    }
    
    // Check if user has seen tutorial
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      console.log('📚 First time player - will show tutorial after onboarding');
    }
  }, []);

  // Check period status on mount and notify if period ended
  useEffect(() => {
    const checkPeriodStatus = async (): Promise<void> => {
      try {
        // Only check if we have current period from contract
        if (!currentPeriod) {
          return;
        }

        const periodNumber = Number(currentPeriod);
        
        // Fetch period data from Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseAnonKey) {
          console.warn('⚠️ Supabase credentials not configured');
          return;
        }

        // Check period end time from Supabase
        const response = await fetch(`${supabaseUrl}/rest/v1/periods?period=eq.${periodNumber}&select=end_time,allocation_notified`, {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
        });

        if (!response.ok) {
          console.error('❌ Failed to fetch period data');
          return;
        }

        const periods = await response.json();
        if (!periods || periods.length === 0) {
          console.log('ℹ️ No period data found for period', periodNumber);
          return;
        }

        const periodData = periods[0];
        const endTime = new Date(periodData.end_time).getTime();
        const now = Date.now();

        // Check if period has ended and notification not sent yet
        if (now > endTime && !periodData.allocation_notified) {
          console.log('🚨 Period', periodNumber, 'has ended! Sending notification...');
          
          // Call API to send Telegram notification
          const notifyResponse = await fetch('/api/telegram-notify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              period: periodNumber,
            }),
          });

          if (notifyResponse.ok) {
            const result = await notifyResponse.json();
            if (result.skipped) {
              console.log('ℹ️ Notification already sent for period', periodNumber);
            } else {
              console.log('✅ Telegram notification sent for period', periodNumber);
            }
          } else {
            console.error('❌ Failed to send notification');
          }
        } else if (periodData.allocation_notified) {
          console.log('ℹ️ Period', periodNumber, 'already has notification sent');
        } else {
          console.log('ℹ️ Period', periodNumber, 'is still active');
        }
      } catch (error) {
        console.error('❌ Error checking period status:', error);
      }
    };

    checkPeriodStatus();
  }, [currentPeriod]);

  // Auto-set username from Farcaster profile
  useEffect(() => {
    if (profile && !profileLoading) {
      const farcasterUsername = profile.username || profile.displayName || `user-${profile.fid}`;
      setUsername(farcasterUsername);
      console.log('✅ Auto-loaded Farcaster username:', farcasterUsername);
      console.log('📝 Profile data:', { fid: profile.fid, username: profile.username, displayName: profile.displayName });
    }
  }, [profile, profileLoading]);

  // Browser warning for paid mode - prevent accidental refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent): string => {
      if (phase === 'playing' && gameState?.gameMode === 'paid') {
        const message = 'Warning: Your game is still in progress! Your points will not be saved if you leave now.';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase, gameState]);

  // Handle onboarding complete
  const handleOnboardingComplete = useCallback((): void => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
    console.log('✅ Onboarding completed');
    
    // Show tutorial after onboarding if first time
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  // Handle tutorial complete
  const handleTutorialComplete = useCallback((): void => {
    localStorage.setItem('hasSeenTutorial', 'true');
    setShowTutorial(false);
    console.log('✅ Tutorial completed');
  }, []);

  // Handle tutorial skip
  const handleTutorialSkip = useCallback((): void => {
    localStorage.setItem('hasSeenTutorial', 'true');
    setShowTutorial(false);
    console.log('⏭️ Tutorial skipped');
  }, []);

  // Start game - defined early to avoid circular dependency
  const handleStartGame = useCallback((characterClass: CharacterClass, element: ElementType, gameMode: 'paid' | 'free'): void => {
    // This function is ONLY for FREE mode now - paid mode goes through handlePaymentComplete
    if (gameMode === 'paid') {
      console.error('❌ handleStartGame should not be called for paid mode!');
      return;
    }

    // For free mode, we still register even if not connected (will be saved locally)
    const finalUsername = username && username.trim().length > 0 ? username : 'Player';
    console.log('🎮 Starting FREE game');
    console.log('👤 Current username state:', username);
    console.log('✅ Final username to send:', finalUsername);
    
    // Register FREE game run if connected
    if (connected && identity) {
      try {
        console.log('💚 Registering FREE game run to SpacetimeDB');
        startGameRun(
          finalUsername,
          characterClass,
          0,
          address || '',
          profile?.pfpUrl
        );
      } catch (error) {
        console.error('⚠️ Failed to register game run:', error);
      }
    } else {
      console.warn('⚠️ Not connected to SpacetimeDB, starting FREE game locally');
    }

    // Start the game
    try {
      const newGameState = initializeGame(characterClass, element, gameMode);
      setGameState(newGameState);
      setPhase('playing');
    } catch (error) {
      console.error('❌ Failed to initialize game:', error);
      alert('Failed to start game. Please try again.');
    }
  }, [connected, identity, startGameRun, address, username, profile]);

  // Handle MODE selection (step 1 in ClassSelection)
  const handleModeSelected = useCallback(
    (gameMode: 'paid' | 'free'): void => {
      setPendingMode(gameMode);

      if (gameMode === 'paid') {
        // Check if already entered tournament
        if (hasTournamentEntry || hasEnteredContract) {
          // CRITICAL: If already paid, check if committed
          if (hasCommitted) {
            console.log('❌ User has already paid AND committed score for this period');
            alert('You have already committed your score for this period. Please wait for the next period or reveal your score.');
            setPhase('intro');
            return;
          }
          
          // Already paid but not committed - can proceed to class selection
          console.log('✅ Already entered tournament (paid but not committed), going to class selection');
          setPendingMode('paid'); // CRITICAL FIX: Set pending mode for consistency
          setPhase('classSelection');
        } else {
          console.log('⚠️ Not entered yet, showing payment modal');
          setPhase('payment');
        }
      } else {
        // Free mode: go straight to class selection
        setPhase('classSelection');
      }
    },
    [hasTournamentEntry, hasCommitted, hasEnteredContract]
  );

  // Handle class/element selection (step 2 & 3 in ClassSelection)
  const handleClassConfirm = useCallback(
    (characterClass: CharacterClass, element: ElementType): void => {
      try {
        // CRITICAL: Check if user has already committed
        if (pendingMode === 'paid' && hasCommitted) {
          console.error('❌ Cannot proceed: User has already committed score');
          alert('You have already committed your score for this period. Please wait for the next period or reveal your score.');
          setPhase('intro');
          return;
        }
        
        // Note: Payment verification already handled in payment modal
        // No need to check again here - if user reached this point, they already paid

        // Username should be auto-set from Farcaster profile, fallback to anonymous
        const finalUsername = username && username.trim().length > 0 ? username : 'anonymous';
        if (finalUsername === 'anonymous') {
          console.warn('⚠️ Using fallback username: anonymous');
        }

        setPendingClass(characterClass);
        setPendingElement(element);

        // BOTH paid and free mode: show dice modal
        console.log('🎲 Showing dice modal for mode:', pendingMode);
        setShowDiceModal(true);
      } catch (error) {
        console.error('❌ Error in handleClassConfirm:', error);
        alert('Failed to start game. Please try again.');
      }
    },
    [username, pendingMode, hasTournamentEntry, hasCommitted, hasEnteredContract]
  );

  // Handle tournament entry (payment) completion
  const handlePaymentComplete = useCallback(async (): Promise<void> => {
    // 🆕 CRITICAL FIX: Refetch playerInfo from blockchain BEFORE proceeding
    console.log('🔄 Refetching playerInfo from blockchain after payment...');
    try {
      const result = await refetchPlayerInfo();
      console.log('✅ Refetched playerInfo:', result.data);
    } catch (error) {
      console.error('⚠️ Failed to refetch playerInfo:', error);
      // Continue anyway - user can retry by clicking Prize Pool Mode again
    }
    
    // After payment, go to class selection
    setHasTournamentEntry(true);
    setPendingMode('paid'); // CRITICAL: Set pending mode to 'paid' for prize pool
    setPhase('classSelection');
  }, [refetchPlayerInfo]);

  // Handle paid game start after dice roll
  const handleStartPaidGame = useCallback((): void => {
    if (pendingClass && pendingElement && pendingMode) {
      // CRITICAL: Ensure connected to SpacetimeDB before starting paid game
      if (!connected || !identity) {
        console.error('❌ Cannot start PAID game: not connected to SpacetimeDB');
        alert('Please wait for connection to SpacetimeDB before playing paid mode.');
        return;
      }

      // Use Farcaster username or fallback
      const finalUsername = username && username.trim().length > 0 ? username : 'anonymous';
      if (finalUsername === 'anonymous') {
        console.warn('⚠️ Using fallback username for paid mode');
      }

      // Validate wallet address
      if (!address) {
        console.error('❌ Cannot start PAID game: wallet not connected');
        alert('Please connect your wallet first.');
        return;
      }

      try {
        console.log('💎 Registering PAID game run');
        console.log('👤 Current username state:', username);
        console.log('✅ Final username to send:', finalUsername);
        console.log('💰 Entry amount: 0.00002 ETH');
        console.log('🔐 Wallet address:', address);

        // Register paid game run FIRST with current period from smart contract
        const periodToSend = currentPeriod ? Number(currentPeriod) : 0;
        console.log('📅 ========== PAID GAME START ==========');
        console.log('📅 Smart Contract Current Period:', currentPeriod?.toString());
        console.log('📅 Period to send to SpacetimeDB:', periodToSend);
        console.log('📅 =====================================');
        
        // For Prize Pool mode: only save class name (without element)
        const buildString = pendingClass;
        console.log('🎯 Class name:', buildString);
        
        const fidToSend = profile?.fid || 0;
        console.log('🆔 FID to send:', fidToSend);
        
        // Get entry amount from localStorage (stored after payment)
        const entryAmountWei = typeof window !== 'undefined' 
          ? Number(localStorage.getItem('lastEntryAmountWei') || '50000000000000000000000')
          : 50000000000000000000000; // default 50,000 TRIA in wei (18 decimals)
        console.log('💰 Entry amount (TRIA wei):', entryAmountWei);
        
        startGameRun(
          finalUsername,
          pendingClass,
          0.00002,
          address,
          profile?.pfpUrl,
          periodToSend,
          buildString,
          fidToSend,
          entryAmountWei // Pass entry amount for weighted scoring
        );

        // THEN start the game
        const newGameState = initializeGame(pendingClass, pendingElement, pendingMode);
        newGameState.entryPaid = true;
        
        // 🆕 CRITICAL FIX: Apply dice bonus stats to character!
        if (newGameState.character && typeof window !== 'undefined') {
          const storedBonusStats = localStorage.getItem('pendingDiceBonusStats');
          if (storedBonusStats) {
            try {
              const bonusStats = JSON.parse(storedBonusStats);
              console.log('✨ Applying dice bonus stats to PAID mode character:', bonusStats);
              applyBonusStatsToCharacter(newGameState.character, bonusStats);
              localStorage.removeItem('pendingDiceBonusStats'); // Clear after use
            } catch (error) {
              console.error('❌ Failed to apply bonus stats:', error);
            }
          }
        }
        
        setGameState(newGameState);
        setPhase('playing');
        
        console.log('✅ PAID game started successfully');
      } catch (error) {
        console.error('❌ Failed to start paid game:', error);
        alert('Failed to start game. Please try again.');
      }
    }
  }, [pendingClass, pendingElement, pendingMode, connected, identity, startGameRun, address, username, profile, currentPeriod, hasTournamentEntry]);

  // Handle payment cancel
  const handlePaymentCancel = useCallback((): void => {
    setPhase('selection');
  }, []);

  // Handle stage complete - update score on every stage
  const handleStageComplete = useCallback(
    async (stage: number, score: number): Promise<void> => {
      // Update score to Supabase on every stage completion
      if (connected && identity && gameState) {
        try {
          console.log('📊 ========== STAGE COMPLETE - UPDATING SCORE ==========');
          console.log('📊 Stage Completed:', stage);
          console.log('📊 Current Score:', score);
          console.log('📊 Game Mode:', gameState.gameMode);
          console.log('📊 ====================================================');
          
          // Calculate current stats
          const time = Math.floor((Date.now() - gameState.startTime) / 1000);
          const hp = gameState.character ? gameState.character.hp : 0;
          const hpPercent = gameState.character ? (gameState.character.hp / gameState.character.maxHp) * 100 : 0;
          const stages = stage;
          
          // Submit current progress to Supabase
          await submitRunResult(score, time, hpPercent, stages);
          console.log('✅ Score updated successfully for stage', stage);
          
          // BACKUP: Save to localStorage as fallback
          if (typeof window !== 'undefined') {
            localStorage.setItem('lastGameProgress', JSON.stringify({
              score,
              time,
              hp: hpPercent,
              stage: stages,
              timestamp: Date.now(),
              mode: gameState.gameMode
            }));
          }
        } catch (error) {
          console.error('❌ Failed to update score on stage complete:', error);
          // Even if Supabase fails, save to localStorage
          if (typeof window !== 'undefined') {
            const time = Math.floor((Date.now() - gameState.startTime) / 1000);
            const hpPercent = gameState.character ? (gameState.character.hp / gameState.character.maxHp) * 100 : 0;
            localStorage.setItem('lastGameProgress', JSON.stringify({
              score,
              time,
              hp: hpPercent,
              stage,
              timestamp: Date.now(),
              mode: gameState.gameMode
            }));
          }
        }
      }
    },
    [connected, identity, submitRunResult, gameState]
  );

  // Handle game over
  const handleGameOver = useCallback(async (): Promise<void> => {
    if (!gameState) return;

    const finalScore = calculateScore(gameState);
    const completionTime = Math.floor((Date.now() - gameState.startTime) / 1000);
    const hpPercent = gameState.character ? (gameState.character.hp / gameState.character.maxHp) * 100 : 0;
    const stages = gameState.stage.stageNumber - 1;

    console.log('🎮 ========== GAME OVER ==========');
    console.log('🎮 Mode:', gameState.gameMode);
    console.log('🎮 Final Score:', finalScore);
    console.log('🎮 Completion Time:', completionTime);
    console.log('🎮 HP Percent:', hpPercent);
    console.log('🎮 Stages:', stages);
    console.log('🎮 =================================');

    // For PAID mode: save weighted score
    if (gameState.gameMode === 'paid') {
      if (typeof window !== 'undefined') {
        const entryAmountWei = Number(localStorage.getItem('lastEntryAmountWei') || '50000000000000000000000');
        const entryAmountTRIA = entryAmountWei / 1e18;
        const weightedScore = Math.floor(finalScore * (entryAmountTRIA / 6_000_000_000));
        
        localStorage.setItem('lastGameScore', JSON.stringify({
          score: finalScore,
          weightedScore: weightedScore,
          entryAmount: entryAmountTRIA,
          timestamp: Date.now()
        }));
        console.log('💾 Stored weighted score for reveal:', { score: finalScore, weightedScore, entryAmountTRIA });
      }
    }

    // 🆕 CRITICAL FIX: Save final score to Supabase for BOTH paid AND free modes
    try {
      if (connected && identity) {
        console.log('💾 Saving final score to Supabase...');
        await submitRunResult(finalScore, completionTime, hpPercent, stages);
        console.log('✅ Final score saved to Supabase successfully!');
      } else {
        console.warn('⚠️ Not connected to Supabase - score only saved locally');
      }
    } catch (error) {
      console.error('❌ Failed to save final score to Supabase:', error);
      // Don't block - we have localStorage backup
    }

    // BACKUP: Always save to localStorage regardless of Supabase success
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastGameResult', JSON.stringify({
        score: finalScore,
        time: completionTime,
        hp: hpPercent,
        stages,
        mode: gameState.gameMode,
        class: gameState.character?.class,
        element: gameState.character?.element,
        timestamp: Date.now()
      }));
      console.log('💾 Backup saved to localStorage');
    }

    // Show appropriate modal based on mode
    if (gameState.gameMode === 'paid') {
      setShowRevealModal(true);
    } else {
      // FREE mode: go to game over screen
      setPhase('gameOver');
    }
  }, [gameState, connected, identity, submitRunResult]);

  // Submit score
  const handleSubmitScore = useCallback(
    async (score: number, time: number, hp: number, stages: number): Promise<void> => {
      // Submit to SpacetimeDB for BOTH paid and for fun modes
      // Backend will track has_paid_entry based on the entry amount from startGameRun
      if (connected && identity) {
        try {
          console.log('📊 ========== SUBMITTING SCORE ==========');
          console.log('📊 Game Mode:', gameState?.gameMode);
          console.log('📊 Score:', score);
          console.log('📊 Smart Contract Current Period:', currentPeriod?.toString());
          console.log('📊 ========================================');
          await submitRunResult(score, time, hp, stages);
          
          // Store score in localStorage for reveal phase (PAID mode only)
          if (gameState?.gameMode === 'paid' && typeof window !== 'undefined') {
            // Calculate weighted score here
            const entryAmountWei = Number(localStorage.getItem('lastEntryAmountWei') || '50000000000000000000000'); // Default 50,000 TRIA
            const entryAmountTRIA = entryAmountWei / 1e18;
            // V21 Formula: Points = Score × (Entry / 6B TRIA)
            const weightedScore = Math.floor(score * (entryAmountTRIA / 6_000_000_000));
            
            localStorage.setItem('lastGameScore', JSON.stringify({
              score: score,
              weightedScore: weightedScore,
              entryAmount: entryAmountTRIA,
              timestamp: Date.now()
            }));
            console.log('💾 Stored score in localStorage for reveal:', { score, weightedScore, entryAmountTRIA });
          }
          
          // Calculate player rank from entries (only for paid mode)
          if (gameState?.gameMode === 'paid' && safeEntries && safeEntries.length > 0) {
            // Prize calculation handled separately by contract
          }
        } catch (error) {
          console.error('❌ Failed to submit score:', error);
          // Don't alert - score submission failure shouldn't block gameplay
        }
      }
    },
    [connected, identity, submitRunResult, entries, gameState, currentPeriod]
  );

  // Restart game
  const handleRestart = useCallback((): void => {
    setGameState(null);
    setPendingClass(null);
    setPendingElement(null);
    setPendingMode(null);
    setPhase('selection');
  }, []);

  // Back to menu
  const handleBackToMenu = useCallback((): void => {
    setGameState(null);
    setPendingClass(null);
    setPendingElement(null);
    setPendingMode(null);
    setPhase('intro');
  }, []);

  // Handle buy TRIA - Uses Farcaster built-in swap
  const handleBuyTria = useCallback(async (): Promise<void> => {
    try {
      toast.info('🔄 Opening swap...', {
        description: 'Loading Farcaster swap interface',
      });

      // Use Farcaster SDK built-in swap
      // CAIP-19 format: eip155:{chainId}/erc20:{tokenAddress}
      const result = await sdk.actions.swapToken({
        sellToken: 'eip155:8453/native', // Base ETH
        buyToken: `eip155:8453/erc20:${TRIA_TOKEN_ADDRESS}`, // TRIA on Base
        sellAmount: '10000000000000000', // 0.01 ETH default
      });

      if (result && !result.error) {
        toast.success('✅ Swap completed!', {
          description: 'Check your TRIA balance',
        });
      } else {
        toast.error('Swap cancelled or failed', {
          description: result?.error || 'Please try again',
        });
      }
    } catch (error) {
      console.error('Swap error:', error);
      toast.error('Failed to open swap', {
        description: 'Please try again or swap manually',
      });
    }
  }, []);

  // Handle dice roll modal - after class selection for PAID mode
  const handleDiceRollComplete = useCallback((bonusStats: Array<{ name: string; value: number; icon: string }>): void => {
    console.log('🎲 Dice roll complete, bonus stats:', bonusStats);
    
    // 🆕 CRITICAL FIX: Store bonus stats in state for later application
    // We need to apply these when character is created, not here
    if (typeof window !== 'undefined') {
      localStorage.setItem('pendingDiceBonusStats', JSON.stringify(bonusStats));
      console.log('💾 Stored dice bonus stats for application:', bonusStats);
    }
    
    setShowDiceModal(false);
    
    // For PAID mode: go to commit modal next
    if (pendingMode === 'paid') {
      setShowCommitModal(true);
    } else {
      // FREE mode: go straight to countdown
      setPhase('countdown');
    }
  }, [pendingMode]);

  const handleDiceSkip = useCallback((): void => {
    console.log('🎲 Skipped dice roll');
    setShowDiceModal(false);
    
    // For PAID mode: go to commit modal next
    if (pendingMode === 'paid') {
      setShowCommitModal(true);
    } else {
      // FREE mode: go straight to countdown
      setPhase('countdown');
    }
  }, [pendingMode]);

  // Handle commit success - go to countdown and start game
  const handleCommitSuccess = useCallback((): void => {
    console.log('🔐 Commit successful, starting game');
    setShowCommitModal(false);
    setPhase('countdown');
  }, []);

  // Handle reveal success - show game over
  const handleRevealSuccess = useCallback((): void => {
    console.log('🔓 Reveal successful, showing game over');
    setShowRevealModal(false);
    setPhase('gameOver');
  }, []);


  // Handle countdown complete - start the game
  const handleCountdownComplete = useCallback((): void => {
    if (pendingClass && pendingElement && pendingMode) {
      const finalUsername = username && username.trim().length > 0 ? username : 'Player';
      
      // Check if FREE or PAID mode
      if (pendingMode === 'free') {
        // Register FREE game run if connected
        if (connected && identity) {
          try {
            const periodToSend = currentPeriod ? Number(currentPeriod) : 0;
            const fidToSend = profile?.fid || 0;
            console.log('💚 ========== FREE GAME START ==========');
            console.log('💚 Smart Contract Current Period:', currentPeriod?.toString());
            console.log('💚 Period to send to SpacetimeDB:', periodToSend);
            console.log('💚 FID to send:', fidToSend);
            console.log('💚 =======================================');
            console.log('💚 Registering FREE game run to SpacetimeDB');
            startGameRun(
              finalUsername,
              pendingClass,
              0,
              address || '',
              profile?.pfpUrl,
              periodToSend,
              undefined, // build (not used for free mode)
              fidToSend
            );
          } catch (error) {
            console.error('⚠️ Failed to register game run:', error);
          }
        }

        // Start the game
        const newGameState = initializeGame(pendingClass, pendingElement, pendingMode);
        
        // 🆕 CRITICAL FIX: Apply dice bonus stats to character!
        if (newGameState.character && typeof window !== 'undefined') {
          const storedBonusStats = localStorage.getItem('pendingDiceBonusStats');
          if (storedBonusStats) {
            try {
              const bonusStats = JSON.parse(storedBonusStats);
              console.log('✨ Applying dice bonus stats to FREE mode character:', bonusStats);
              applyBonusStatsToCharacter(newGameState.character, bonusStats);
              localStorage.removeItem('pendingDiceBonusStats'); // Clear after use
            } catch (error) {
              console.error('❌ Failed to apply bonus stats:', error);
            }
          }
        }
        
        setGameState(newGameState);
        setPhase('playing');
      } else if (pendingMode === 'paid') {
        // PAID mode - use handleStartPaidGame which handles SpacetimeDB registration
        handleStartPaidGame();
      }
    }
  }, [pendingClass, pendingElement, pendingMode, connected, identity, startGameRun, address, username, profile, handleStartPaidGame, currentPeriod]);

  // Intro screen - WITH REALTIME PRIZE POOL
  if (phase === 'intro') {
    return (
      <SimpleFarcasterGuard>
        <LobbyMusic isBattle={false} />
        <WalletStatus />
        
        {/* Floating Chat Button */}
        {connected && profile && (
          <>
            <FloatingChatButton 
              onClick={() => setShowChatPopup(true)} 
              unreadCount={0}
            />
            <ChatPopup
              isOpen={showChatPopup}
              onClose={() => setShowChatPopup(false)}
              username={username || profile.username || 'Anonymous'}
              pfpUrl={profile.pfpUrl}
              onSendMessage={(msg) => sendChatMessage(msg, username || profile.username || 'Anonymous', profile.pfpUrl || '')}
              messages={safeChatMessages}
            />
          </>
        )}
        <div className="fixed top-14 left-0 right-0 z-40 px-3">
          <NetworkSwitcher compact />
        </div>
        {/* Announcement Banner */}
        <AnnouncementBanner announcements={safeAnnouncements} />
        <div className="min-h-screen flex items-center justify-center px-3 py-4">
          <div className="max-w-2xl w-full space-y-4">
          {/* Left: Game Info */}
          <Card className="fantasy-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-3xl text-center fantasy-title glow-text bg-gradient-to-r from-yellow-400 via-red-500 to-purple-600 bg-clip-text text-transparent">
                ⚔️ ETHER TRIALS ⚔️
              </CardTitle>
              <p className="text-center text-yellow-300 text-sm font-medium medieval-text">
                🎮 Dark Fantasy Action RPG • Powered by Farcaster & Base
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Compact Features */}
              <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                <div className="feature-box text-center text-yellow-300">⚔️ Auto-combat</div>
                <div className="feature-box text-center text-yellow-300">🛡️ Evade system</div>
                <div className="feature-box text-center text-yellow-300">🔥 6 Classes × 6 Elements</div>
                <div className="feature-box text-center text-yellow-300">👑 Boss battles</div>
              </div>



              {/* Game Modes */}
              <div className="space-y-2">
                {/* Prize Pool Mode - ACTIVE */}
                <div className="bg-gradient-to-r from-yellow-900/50 to-red-900/50 p-3 rounded-2xl border-2 border-yellow-600/50 relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-yellow-300 font-bold text-xs">💰 Prize Pool Mode</div>
                    <div className="bg-green-600 px-2 py-0.5 rounded-full text-[9px] font-bold text-white animate-pulse">
                      ✅ ACTIVE
                    </div>
                  </div>
                  <div className="text-yellow-200 text-[10px]">Deposit TRIA • Compete for rewards • 100% proportional</div>
                </div>

                {/* Free Mode - Active */}
                <div className="bg-gradient-to-r from-green-900/50 to-blue-900/50 p-3 rounded-2xl border-2 border-green-500/50 relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-green-300 font-bold text-xs">🎮 For Fun Mode</div>
                    <div className="bg-green-600 px-2 py-0.5 rounded-full text-[9px] font-bold text-white animate-pulse">
                      ✅ ACTIVE
                    </div>
                  </div>
                  <div className="text-green-200 text-[10px]">Free to play • No entry fee • Full gameplay</div>
                </div>
              </div>



              {/* Start Button */}
              <Button
                size="lg"
                className="fantasy-button w-full text-lg"
                onClick={() => setPhase('selection')}
                disabled={profileLoading}
              >
                {profileLoading ? '🌟 Loading Profile...' : 'Play Ether Trials ⚔️'}
              </Button>

              {/* Admin Button - Owner Only */}
              {isOwnerFinal && (
                <Button
                  size="lg"
                  className="w-full text-base font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl shadow-lg shadow-purple-600/40 border-2 border-purple-400"
                  onClick={() => setShowAdminPanel(true)}
                >
                  🔐 Admin Panel
                </Button>
              )}

              {/* Action Buttons Grid */}
              {address && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="lg"
                    className="w-full text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl shadow-lg shadow-purple-600/40 border-2 border-purple-400"
                    onClick={handleBuyTria}
                  >
                    🛒 Buy TRIA
                  </Button>
                  <Button
                    size="lg"
                    className="w-full text-sm font-bold bg-gradient-to-r from-yellow-600 to-red-600 hover:from-yellow-500 hover:to-red-500 text-white rounded-xl shadow-lg shadow-yellow-600/40 border-2 border-yellow-400"
                    onClick={() => setShowPrizeClaimModal(true)}
                  >
                    🏆 Claim Prizes
                  </Button>
                </div>
              )}

              {/* View Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs font-bold border-2 border-yellow-600 text-yellow-300 hover:bg-purple-900/50 rounded-xl bg-black/30"
                  onClick={() => setShowLeaderboard(true)}
                >
                  🏆 Leaderboard
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs font-bold border-2 border-blue-600 text-blue-300 hover:bg-blue-900/50 rounded-xl bg-black/30"
                  onClick={() => setShowPatchNotes(true)}
                >
                  📜 Patch Notes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs font-bold border-2 border-purple-600 text-purple-300 hover:bg-purple-900/50 rounded-xl bg-black/30"
                  onClick={() => setShowFeedbackForm(true)}
                >
                  💬 Feedback
                </Button>
              </div>

              {/* Audio Controls */}
              <div className="flex items-center gap-2">
                <AudioControls />
              </div>

              {/* Tutorial Button */}
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs font-bold border-2 border-green-600 text-green-300 hover:bg-green-900/50 rounded-xl bg-black/30"
                onClick={() => setShowTutorial(true)}
              >
                📚 How to Play
              </Button>

              {/* Farcaster/Base App Profile Display */}
              {profile && username && (
                <div className="bg-gradient-to-r from-purple-900/70 to-blue-900/70 p-3 rounded-2xl border-2 border-yellow-600/50">
                  <div className="flex items-center gap-3">
                    {profile.pfpUrl && (
                      <img 
                        src={profile.pfpUrl} 
                        alt="Profile" 
                        className="w-12 h-12 rounded-full border-3 border-yellow-400 flex-shrink-0 shadow-md shadow-yellow-500/50"
                        style={{ aspectRatio: '1/1', objectFit: 'cover' }}
                      />
                    )}
                    <div className="flex-1">
                      <div className="text-yellow-300 font-bold text-base">⚡ {username}</div>
                      <div className="text-gray-400 text-xs font-medium">FID: {profile.fid}</div>
                    </div>
                  </div>
                </div>
              )}


            </CardContent>
          </Card>
          
          {/* Right: Live TRIA Pool V21 */}
          <RealtimePrizePoolV21 />
          </div>
        </div>

        {/* Leaderboard Modal */}
        {showLeaderboard && (
          <Leaderboard
            entries={safeEntries}
            funEntries={safeFreeEntries}
            currentPlayerIdentity={identity}
            currentPeriod={currentPeriod ? Number(currentPeriod) : 0}
            onClose={() => setShowLeaderboard(false)}
          />
        )}

        {/* Feedback Form Modal */}
        {showFeedbackForm && (
          <FeedbackForm
            onClose={() => setShowFeedbackForm(false)}
          />
        )}

        {/* Patch Notes Modal */}
        {showPatchNotes && (
          <PatchNotesBoard
            onClose={() => setShowPatchNotes(false)}
          />
        )}

        {/* Prize Claim Modal V21 - TRIA Rewards */}
        {showPrizeClaimModal && (
          <PrizeClaimModalV21
            isOpen={showPrizeClaimModal}
            onClose={() => setShowPrizeClaimModal(false)}
          />
        )}

        {/* Admin Panel Modal V21 */}
        {showAdminPanel && isOwnerFinal && (
          <AdminPanelV21 
            isOwner={isOwnerFinal} 
            onClose={() => setShowAdminPanel(false)}
          />
        )}

        {/* Welcome Onboarding - First time users only */}
        {showOnboarding && (
          <WelcomeOnboarding onComplete={handleOnboardingComplete} />
        )}

        {/* Game Tutorial - First time or manual trigger */}
        {showTutorial && (
          <GameTutorial
            isOpen={showTutorial}
            onComplete={handleTutorialComplete}
            onSkip={handleTutorialSkip}
          />
        )}
      </SimpleFarcasterGuard>
    );
  }



  // Countdown phase
  if (phase === 'countdown') {
    return (
      <SimpleFarcasterGuard>
        <LobbyMusic isBattle={false} />
        <CountdownOverlay onComplete={handleCountdownComplete} />
      </SimpleFarcasterGuard>
    );
  }

  // Selection phase - Mode selection with custom UI
  if (phase === 'selection') {
    return (
      <SimpleFarcasterGuard>
        <LobbyMusic isBattle={false} />
        <WalletStatus />
        <div className="fixed top-14 left-0 right-0 z-40 px-3">
          <NetworkSwitcher compact />
        </div>
        <div className="min-h-screen bg-black flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-md sm:max-w-xl">
            <Card className="fantasy-card">
              <CardHeader className="pb-4 pt-6 sm:pb-6 sm:pt-8 border-b border-gray-700">
                <CardTitle className="text-2xl sm:text-3xl text-center fantasy-title text-white font-bold">
                  ⚔️ Choose Your Path
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pb-6 pt-6">
                {/* Prize Pool Mode - ACTIVE */}
                <div 
                  onClick={() => handleModeSelected('paid')}
                  className="cursor-pointer group"
                >
                  <div className="relative overflow-hidden rounded-xl border-2 border-yellow-600 bg-gray-900 p-4 hover:border-yellow-400 hover:bg-gray-800 transition-all">
                    <div className="text-3xl mb-2">💰</div>
                    <div className="text-lg font-bold text-yellow-300 mb-1">Prize Pool Mode</div>
                    <div className="text-xs text-gray-300 mb-2">
                      Deposit TRIA tokens and compete for real rewards!
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="bg-black/50 p-1.5 rounded border border-gray-700">
                        <div className="text-yellow-400 font-bold">✨ Real Prizes</div>
                      </div>
                      <div className="bg-black/50 p-1.5 rounded border border-gray-700">
                        <div className="text-yellow-400 font-bold">🔐 Anti-Cheat</div>
                      </div>
                      <div className="bg-black/50 p-1.5 rounded border border-gray-700">
                        <div className="text-yellow-400 font-bold">🏆 Ranked</div>
                      </div>
                      <div className="bg-black/50 p-1.5 rounded border border-gray-700">
                        <div className="text-yellow-400 font-bold">💎 TRIA</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fun Mode */}
                <div 
                  onClick={() => handleModeSelected('free')}
                  className="cursor-pointer group"
                >
                  <div className="relative overflow-hidden rounded-xl border-2 border-blue-600 bg-gray-900 p-4 hover:border-blue-400 hover:bg-gray-800 transition-all">
                    <div className="text-3xl mb-2">🎮</div>
                    <div className="text-lg font-bold text-blue-300 mb-1">Fun Mode</div>
                    <div className="text-xs text-gray-300 mb-2">
                      Practice and enjoy without stakes - completely free!
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="bg-black/50 p-1.5 rounded border border-gray-700">
                        <div className="text-blue-400 font-bold">🆓 Free Entry</div>
                      </div>
                      <div className="bg-black/50 p-1.5 rounded border border-gray-700">
                        <div className="text-blue-400 font-bold">🎯 Practice</div>
                      </div>
                      <div className="bg-black/50 p-1.5 rounded border border-gray-700">
                        <div className="text-blue-400 font-bold">📊 Leaderboard</div>
                      </div>
                      <div className="bg-black/50 p-1.5 rounded border border-gray-700">
                        <div className="text-blue-400 font-bold">😎 Casual</div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 bg-gray-900"
                  onClick={handleBackToMenu}
                >
                  ← Return to Menu
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </SimpleFarcasterGuard>
    );
  }

  // Class selection phase - After payment for paid mode, or after mode selection for free mode
  if (phase === 'classSelection') {
    return (
      <SimpleFarcasterGuard>
        <LobbyMusic isBattle={false} />
        <WalletStatus />
        <div className="fixed top-14 left-0 right-0 z-40 px-3">
          <NetworkSwitcher compact />
        </div>
        <ClassSelection onConfirm={(cls, el) => handleClassConfirm(cls, el)} onBack={() => {
          if (pendingMode === 'paid') {
            setPhase('payment');
          } else {
            setPhase('selection');
          }
        }} />
        
        {/* Dice Roll Modal V21 - Appears after Begin Journey is clicked */}
        {showDiceModal && pendingMode && (
          <DiceRollModalV20
            isOpen={showDiceModal}
            onClose={() => setShowDiceModal(false)}
            onRollComplete={handleDiceRollComplete}
            onSkip={handleDiceSkip}
            userAddress={address}
            gameMode={pendingMode}
          />
        )}

        {/* Commit Score Modal V21 - For paid mode after dice roll */}
        {showCommitModal && pendingMode === 'paid' && (
          <CommitScoreModalV20
            isOpen={showCommitModal}
            onClose={() => setShowCommitModal(false)}
            onCommitSuccess={handleCommitSuccess}
            userAddress={address}
          />
        )}
      </SimpleFarcasterGuard>
    );
  }

  // Payment phase - Tournament Entry (V21 - TRIA deposit)
  if (phase === 'payment') {
    return (
      <SimpleFarcasterGuard>
        <LobbyMusic isBattle={false} />
        <WalletStatus />
        <div className="fixed top-14 left-0 right-0 z-40 px-3">
          <NetworkSwitcher compact />
        </div>
        <TournamentEntryModalV21
          isOpen={true}
          onClose={handlePaymentCancel}
          onSuccess={() => {
            setHasTournamentEntry(true);
            handlePaymentComplete();
          }}
        />
      </SimpleFarcasterGuard>
    );
  }

  // Playing phase
  if (phase === 'playing' && gameState) {
    const isPaidMode = gameState.gameMode === 'paid';
    
    return (
      <SimpleFarcasterGuard>
        <LobbyMusic isBattle={true} />
        <WalletStatus />
        <div className="fixed top-14 left-0 right-0 z-40 px-3">
          <NetworkSwitcher compact />
        </div>
        <div className="min-h-screen bg-black pt-4 px-2 overflow-x-hidden">
        <div className="max-w-4xl mx-auto">
          {/* Warning Banner for Paid Mode */}
          {isPaidMode && (
            <div className="bg-red-900/90 border-2 border-red-500 rounded-lg p-3 mb-3 animate-pulse">
              <div className="flex items-start gap-2">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <div className="text-yellow-300 font-bold text-sm mb-1">
                    PAID MODE - DO NOT REFRESH!
                  </div>
                  <div className="text-yellow-100 text-xs leading-relaxed">
                    Warning: Do not refresh or close this page during battle! Your points will not be saved and your name will not appear on the leaderboard.
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* CRITICAL: Don't pass onBackToMenu for paid mode - prevent going back */}
          {/* CRITICAL: Don't pass dice roll during game - only before match */}
          {/* Hide GameCanvas when reveal modal is open */}
          {!showRevealModal && (
            <>
              <GameUI 
                gameState={gameState} 
                onBackToMenu={isPaidMode ? undefined : handleBackToMenu}
                gameSpeed={gameSpeed}
                setGameSpeed={setGameSpeed}
              />
              <GameCanvas
                gameState={gameState}
                setGameState={setGameState}
                onGameOver={handleGameOver}
                gameSpeed={gameSpeed}
                onStageComplete={handleStageComplete}
              />
            </>
          )}
        </div>

        {/* Reveal Score Modal V21 - Shown in playing phase when game over */}
        {showRevealModal && gameState?.gameMode === 'paid' && (
          <RevealScoreModalV20
            isOpen={showRevealModal}
            onRevealSuccess={handleRevealSuccess}
          />
        )}
      </div>
      </SimpleFarcasterGuard>
    );
  }

  // Game over phase
  if (phase === 'gameOver' && gameState) {
    // Extract scores from BOTH modes FOR CURRENT PERIOD ONLY for dynamic tier calculation
    const periodNumber = currentPeriod ? Number(currentPeriod) : 0;
    const funScores = safeFreeEntries
      .filter(entry => Number(entry.period) === periodNumber)
      .map(entry => Number(entry.score));
    const paidScores = safeEntries
      .filter(entry => Number(entry.period) === periodNumber)
      .map(entry => Number(entry.score));
    
    console.log('🎮 ========== GAME OVER - TIER DATA ==========');
    console.log('🎮 Current Period:', periodNumber);
    console.log('🎮 Total Fun Entries:', safeFreeEntries.length);
    console.log('🎮 Fun Entries in Period:', funScores.length);
    console.log('🎮 Total Paid Entries:', safeEntries.length);
    console.log('🎮 Paid Entries in Period:', paidScores.length);
    console.log('🎮 ============================================');
    
    return (
      <SimpleFarcasterGuard>
        <WalletStatus />
        <div className="fixed top-14 left-0 right-0 z-40 px-3">
          <NetworkSwitcher compact />
        </div>
        <GameOver
        gameState={gameState}
        onRestart={handleRestart}
        onSubmitScore={handleSubmitScore}
        playerRank={playerRank}
        prizeAmount={prizeAmount}
        onBackToMenu={handleBackToMenu}
        funScores={funScores}
        paidScores={paidScores}
        currentPeriod={periodNumber}
      />
      </SimpleFarcasterGuard>
    );
  }

  return (
    <SimpleFarcasterGuard>
      <WalletStatus />
      <div className="min-h-screen bg-black" />
      
      {/* Dice Roll Modal V21 - After character selection for BOTH paid and free modes */}
      {showDiceModal && pendingMode && (
        <DiceRollModalV20
          isOpen={showDiceModal}
          onClose={() => setShowDiceModal(false)}
          onRollComplete={handleDiceRollComplete}
          onSkip={handleDiceSkip}
          userAddress={address}
          gameMode={pendingMode}
        />
      )}

      {/* Commit Score Modal V21 - After dice roll, BEFORE game starts */}
      {showCommitModal && pendingMode === 'paid' && (
        <CommitScoreModalV20
          isOpen={showCommitModal}
          onClose={() => setShowCommitModal(false)}
          onCommitSuccess={handleCommitSuccess}
          userAddress={address}
        />
      )}

      {/* Reveal Score Modal V21 - Moved to playing phase to prevent duplicate rendering */}
      
      {/* Welcome Onboarding - shown on first visit */}
      {showOnboarding && (
        <WelcomeOnboarding onComplete={handleOnboardingComplete} />
      )}
    </SimpleFarcasterGuard>
  );
}
