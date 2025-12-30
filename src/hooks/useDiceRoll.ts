// anjing
'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSpacetimeDB } from './useSpacetimeDB';
import type { BonusStat } from '@/types/game';

const OWNER_ADDRESS = '0x8453df2Bc1DD2e1292a08e7fa026D15d83a6B25D';

interface UseDiceRollReturn {
  remainingAttempts: number;
  purchaseAttempts: () => Promise<void>;
  consumeAttempt: () => void;
  resetFreeAttempts: () => void;
  applyBonusStats: (character: any, bonusStats: BonusStat[]) => void;
}

export function useDiceRoll(gameMode: 'free' | 'paid' = 'free', currentPeriod?: number): UseDiceRollReturn {
  const { connected, identity, userDiceUsage, consumeDiceAttempt, addPurchasedRolls } = useSpacetimeDB();
  const lastLoggedRef = useRef<string>('');
  
  // Memoize the current usage to prevent unnecessary recalculations
  const currentUsage = useMemo(() => {
    if (gameMode === 'paid' && connected && identity && currentPeriod !== undefined) {
      return userDiceUsage.find(u => 
        u.identity === identity && 
        Number(u.period) === currentPeriod
      );
    }
    return null;
  }, [gameMode, connected, identity, currentPeriod, userDiceUsage]);
  
  // Calculate attempts from memoized usage
  const calculatedAttempts = useMemo((): number => {
    if (typeof window === 'undefined') return 3;
    
    // FREE MODE: Always start with 3 attempts (reset every game)
    if (gameMode === 'free') {
      return 3;
    }
    
    // PAID MODE: Query from SpacetimeDB based on current period
    if (gameMode === 'paid' && connected && identity && currentPeriod !== undefined) {
      const usage = currentUsage;
      
      const rollsUsed = usage ? usage.rollsUsed : 0;
      const purchasedRolls = usage ? usage.purchasedRolls : 0;
      const freeRemaining = Math.max(0, 3 - rollsUsed);
      const totalRemaining = freeRemaining + purchasedRolls;
      
      // Only log if values changed (prevent spam)
      const logKey = `${currentPeriod}-${rollsUsed}-${purchasedRolls}-${totalRemaining}`;
      if (lastLoggedRef.current !== logKey) {
        console.log('🎲 Dice attempts for period', currentPeriod, ':', {
          rollsUsed,
          freeRemaining,
          purchasedRolls,
          totalRemaining,
          hasUsageRecord: !!usage
        });
        lastLoggedRef.current = logKey;
      }
      
      return totalRemaining;
    }
    
    // Default: 3 free attempts
    return 3;
  }, [gameMode, connected, identity, currentPeriod, currentUsage]);

  const [remainingAttempts, setRemainingAttempts] = useState<number>(calculatedAttempts);

  // Update remaining attempts when calculated value changes
  useEffect(() => {
    setRemainingAttempts(calculatedAttempts);
  }, [calculatedAttempts]);

  // Purchase more attempts (adds 3 attempts for 0.00001 ETH)
  const purchaseAttempts = useCallback(async (): Promise<void> => {
    // For PAID mode with SpacetimeDB connection, call the reducer
    if (gameMode === 'paid' && connected && identity && currentPeriod !== undefined) {
      try {
        console.log('💰 Purchasing 3 dice rolls for period:', currentPeriod);
        addPurchasedRolls(currentPeriod, 3);
        // The state will be updated automatically via onUpdate callback from SpacetimeDB
        // But we also update locally for immediate UI feedback
        setRemainingAttempts(prev => prev + 3);
      } catch (error) {
        console.error('❌ Failed to purchase dice rolls:', error);
        alert('Failed to purchase dice rolls. Please try again.');
      }
    } else {
      // For FREE mode or when not connected, just update local state
      setRemainingAttempts(prev => prev + 3);
    }
  }, [gameMode, connected, identity, currentPeriod, addPurchasedRolls]);

  // Consume one attempt
  const consumeAttempt = useCallback((): void => {
    if (remainingAttempts <= 0) {
      console.warn('⚠️ No dice attempts remaining!');
      return;
    }

    // For PAID mode with SpacetimeDB connection, call the reducer
    if (gameMode === 'paid' && connected && identity && currentPeriod !== undefined) {
      try {
        console.log('🎲 Consuming dice attempt via SpacetimeDB for period:', currentPeriod);
        consumeDiceAttempt(currentPeriod);
        // The state will be updated automatically via onUpdate callback from SpacetimeDB
        // But we also update locally for immediate UI feedback
        setRemainingAttempts(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('❌ Failed to consume dice attempt:', error);
        alert('Failed to consume dice attempt. Please try again.');
      }
    } else {
      // For FREE mode or when not connected, just update local state
      setRemainingAttempts(prev => Math.max(0, prev - 1));
    }
  }, [remainingAttempts, gameMode, connected, identity, currentPeriod, consumeDiceAttempt]);

  // Reset attempts for FREE mode (called when starting new free game)
  const resetFreeAttempts = useCallback((): void => {
    if (gameMode === 'free') {
      setRemainingAttempts(3);
    }
  }, [gameMode]);

  // Apply bonus stats to character (PERCENTAGE-BASED)
  const applyBonusStats = useCallback((character: any, bonusStats: BonusStat[]): void => {
    if (!character) return;

    bonusStats.forEach((stat) => {
      const percentBonus = stat.value / 100; // Convert percentage to decimal (e.g., 10% = 0.10)
      
      switch (stat.name) {
        case 'HP':
          const hpIncrease = Math.floor(character.maxHp * percentBonus);
          character.maxHp += hpIncrease;
          character.hp += hpIncrease; // Also increase current HP
          break;
        case 'Damage':
          character.skills.forEach((skill: any) => {
            const damageIncrease = Math.floor(skill.damage * percentBonus);
            skill.damage += damageIncrease;
          });
          break;
        case 'Cooldown Reduction':
          character.skills.forEach((skill: any) => {
            const cooldownReduction = Math.floor(skill.cooldown * percentBonus);
            skill.cooldown = Math.max(100, skill.cooldown - cooldownReduction); // Min 100ms
          });
          break;
        case 'Lifesteal':
          character.skills.forEach((skill: any) => {
            skill.lifesteal = Math.min(0.5, (skill.lifesteal || 0) + percentBonus); // Max 50%
          });
          break;
        case 'Critical Chance':
          // Critical chance can be tracked separately
          break;
      }
    });

    console.log('✨ Applied PERCENTAGE bonus stats to character:', bonusStats);
  }, []);

  return {
    remainingAttempts,
    purchaseAttempts,
    consumeAttempt,
    resetFreeAttempts,
    applyBonusStats,
  };
}
