'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameState, DamageNumber } from '@/types/game';
import { CANVAS_WIDTH, CANVAS_HEIGHT, EVADE_DURATION, TARGET_FPS, CLASS_CONFIGS } from '@/lib/game/constants';
import { distance } from '@/lib/game/utils';
import { updateCharacterPosition, startEvade as startCharacterEvade } from '@/lib/game/character';
import { updateEnemyPosition, startTelegraph, shouldTelegraph } from '@/lib/game/enemy';
import {
  attackEnemy,
  attackEnemyWithAOE,
  enemyAttackCharacter,
  findNearestEnemy,
  selectBestSkill,
  updateEvadeState,
  shouldEvade,
  attemptEvade,
  createDamageNumber,
  createSkillEffect,
  shouldUseBossSkill,
  executeBossSkill,
  createBossSkillEffect,
  applyPaladinRegen,
  applyMageShield,
  applyCookRegen,
  applyElementRegen,
  applyCookHealModeRegen,
  updateBurnDamage,
  updateDebuffs,
  getEffectiveEnemySpeed,
  updateImmunityState,
} from '@/lib/game/combat';
import { playSkillSound, playHitSound, playMissSound, initAudioContext, playEvasiveDash, playDivineShield } from '@/lib/game/soundEffects';
import {
  updateHPBars,
  cleanupDamageNumbers,
  updateSkillEffectsInState,
  spawnCurrentWave,
  checkWaveCompletion,
  advanceWave,
} from '@/lib/game/engine';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  onGameOver: () => void;
  gameSpeed: number;
  onStageComplete?: (stage: number, score: number) => void;
}

export function GameCanvas({ gameState, setGameState, onGameOver, gameSpeed, onStageComplete }: GameCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState<number>(60);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(Date.now());
  const fpsCounterRef = useRef<number>(0);
  const fpsLastUpdateRef = useRef<number>(Date.now());
  const frameSkipCounter = useRef<number>(0);
  const MAX_DELTA_TIME = 50; // Cap delta time untuk prevent spikes
  const lastBurnTickRef = useRef<number>(0); // Track burn/poison DOT ticks
  const cachedNearestEnemyRef = useRef<{ enemy: Enemy | null, cacheTime: number }>({ enemy: null, cacheTime: 0 });
  const NEAREST_ENEMY_CACHE_DURATION = 150; // Cache nearest enemy for 150ms (3-5 frames)
  
  // Initialize audio on mount
  useEffect(() => {
    initAudioContext();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = (): void => {
      try {
      const currentTime = Date.now();
      let rawDeltaTime = currentTime - lastTimeRef.current;
      // Cap delta time to prevent huge jumps
      rawDeltaTime = Math.min(rawDeltaTime, MAX_DELTA_TIME);
      const deltaTime = rawDeltaTime * gameSpeed; // Apply speed multiplier
      lastTimeRef.current = currentTime;
      
      // Frame skipping for optimization - update every 2nd frame for non-critical stuff
      frameSkipCounter.current = (frameSkipCounter.current + 1) % 2;

      // FPS counter - using refs
      fpsCounterRef.current++;
      if (currentTime - fpsLastUpdateRef.current >= 1000) {
        setFps(fpsCounterRef.current);
        fpsCounterRef.current = 0;
        fpsLastUpdateRef.current = currentTime;
      }

      if (gameState.isPaused || gameState.isGameOver) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Spawn wave if needed
      if (gameState.enemies.length === 0) {
        spawnCurrentWave(gameState);
      }

      // NEW v5.0: Check if score exceeded 8M - trigger game over
      if (gameState.score > 8_000_000) {
        console.log('🎉 SCORE MILESTONE REACHED: 8M+ points! Game Over!');
        gameState.isGameOver = true;
        onGameOver();
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Check wave completion
      if (checkWaveCompletion(gameState) && gameState.enemies.length === 0) {
        const currentWave = gameState.stage.waves[gameState.stage.currentWave];
        if (currentWave && currentWave.spawned) {
          advanceWave(gameState, onStageComplete);
        }
      }

      // Update status effects: Burn/Poison DOT damage every 1 second
      lastBurnTickRef.current = updateBurnDamage(gameState.enemies, currentTime, lastBurnTickRef.current);
      
      // Clear expired debuffs (slow, trap, poison, stun)
      updateDebuffs(gameState.enemies, currentTime);

      // Update character
      if (gameState.character) {
        // Update animated sprite - with null check
        if (gameState.character.sprite?.animatedSprite?.sprite) {
          try {
            gameState.character.sprite.animatedSprite.sprite.update(deltaTime);
          } catch (error) {
            console.error('Character sprite update error:', error);
          }
        }
        
        updateEvadeState(gameState.character, currentTime);
        
        // Apply passive HP regeneration & shields (specializations) - v2.0.0
        applyPaladinRegen(gameState.character, currentTime);
        applyMageShield(gameState.character, currentTime);
        applyCookRegen(gameState.character, currentTime);
        applyCookHealModeRegen(gameState.character, currentTime); // NEW v2.5.0: Cook Heal Mode regen
        applyElementRegen(gameState.character, currentTime); // NEW v2.7.0: Water & Holy element regen
        
        // NEW v4.0: Check Divine Shield buff expiration
        if (gameState.character.divineShieldEndTime && currentTime >= gameState.character.divineShieldEndTime) {
          // Divine Shield buff expired - remove shield
          gameState.character.divineShieldAmount = undefined;
          gameState.character.divineShieldEndTime = undefined;
          console.log('🛡️ Divine Shield expired!');
        }

        // OPTIMIZATION: Cache nearest enemy for 150ms (reduces findNearestEnemy calls by 90%)
        let target: Enemy | null = null;
        if (currentTime - cachedNearestEnemyRef.current.cacheTime > NEAREST_ENEMY_CACHE_DURATION) {
          target = findNearestEnemy(gameState.character, gameState.enemies);
          cachedNearestEnemyRef.current = { enemy: target, cacheTime: currentTime };
        } else {
          target = cachedNearestEnemyRef.current.enemy;
          // Verify cached enemy still exists
          if (target && !gameState.enemies.find(e => e.id === target!.id)) {
            target = findNearestEnemy(gameState.character, gameState.enemies);
            cachedNearestEnemyRef.current = { enemy: target, cacheTime: currentTime };
          }
        }
        
        if (target) {
          gameState.character.targetId = target.id;

          // Evade is now pure passive - no active checking/triggering
          // Character always moves and attacks normally
          // Evade only happens passively when enemy attacks (in enemyAttackCharacter)

          // Move towards target (always, no evade interruption)
          {
            // Ranged characters (Mage, Ranger) maintain greater distance
            const isRangedCharacter = gameState.character.class === 'Mage' || gameState.character.class === 'Ranger';
            const stopDistance = isRangedCharacter ? 180 : 70;
            const dist = distance(gameState.character.position, target.position);
            if (dist > stopDistance) {
              updateCharacterPosition(
                gameState.character,
                target.position,
                150,
                deltaTime
              );
            }

            // Casting system - skills must be cast before execution
            if (gameState.character.isCasting) {
              // Character is casting - check if cast time completed
              const castElapsed = currentTime - gameState.character.castingStartTime;
              const castingSkill = gameState.character.skills.find(
                (s) => s.id === gameState.character.castingSkillId
              );
              
              if (castingSkill) {
                // Get castTime from constants (need to find in config)
                const config = CLASS_CONFIGS[gameState.character.class];
                const skillConfig = config.skills.find((sc) => sc.name === castingSkill.name);
                let castTime = skillConfig?.castTime || 300;
                
                // NEW: Apply Attack Speed reduction to casting time
                // Attack Speed from dice roll reduces casting time (min 50ms)
                if (gameState.character.attackSpeed && gameState.character.attackSpeed > 0) {
                  castTime = Math.max(50, Math.floor(castTime * (1 - gameState.character.attackSpeed)));
                }
                
                if (castElapsed >= castTime) {
                  // Cast completed - execute skill (AOE if applicable)
                  if (castingSkill.aoe) {
                    // Play sound effect
                    playSkillSound(gameState.character.class, castingSkill.type, castingSkill.element);
                    
                    // Use AOE attack for area damage
                    const aoeResult = attackEnemyWithAOE(
                      gameState.character,
                      target,
                      gameState.enemies,
                      castingSkill,
                      currentTime,
                      gameSpeed
                    );

                    // Create skill effect - position depends on AOE shape
                    const effectPosition = castingSkill.aoeShape === 'circle-self' 
                      ? gameState.character.position 
                      : target.position;
                    const skillEffect = createSkillEffect(effectPosition, castingSkill, gameState.character.class);
                    gameState.skillEffects.push(skillEffect);

                    // Create damage numbers for primary target
                    if (aoeResult.primaryTarget.damaged) {
                      playHitSound();
                      const damageNum = createDamageNumber(
                        target.position,
                        aoeResult.primaryTarget.damageAmount,
                        false,
                        currentTime
                      );
                      gameState.damageNumbers.push(damageNum);
                    }

                    // Create damage numbers for AOE targets
                    for (const aoeTarget of aoeResult.aoeTargets) {
                      const enemy = gameState.enemies.find((e) => e.id === aoeTarget.enemyId);
                      if (enemy && aoeTarget.result.damaged) {
                        const damageNum = createDamageNumber(
                          enemy.position,
                          aoeTarget.result.damageAmount,
                          false,
                          currentTime
                        );
                        gameState.damageNumbers.push(damageNum);
                      }
                    }

                    // Add score and remove killed enemies
                    gameState.score += aoeResult.totalDamage;
                    gameState.score += aoeResult.totalKills * (aoeResult.primaryTarget.executed ? 500 : 100);
                    
                    // Filter out killed enemies
                    const killedIds = [aoeResult.primaryTarget.killed ? target.id : null, ...aoeResult.aoeTargets.filter((t) => t.result.killed).map((t) => t.enemyId)].filter(Boolean) as string[];
                    gameState.enemies = gameState.enemies.filter((e) => !killedIds.includes(e.id));
                    
                    // MAGE SPECIALIZATION: Auto-retreat after knockback skills
                    if (gameState.character.class === 'Mage' && castingSkill.knockback > 0) {
                      // Move Mage away from target (opposite direction)
                      const dx = gameState.character.position.x - target.position.x;
                      const dy = gameState.character.position.y - target.position.y;
                      const distance = Math.sqrt(dx * dx + dy * dy);
                      
                      if (distance > 0) {
                        // Store start position for trail effect
                        const startPos = { x: gameState.character.position.x, y: gameState.character.position.y };
                        
                        // Retreat 100 pixels away from target
                        const retreatDistance = 100;
                        const normalizedDx = dx / distance;
                        const normalizedDy = dy / distance;
                        
                        // Apply retreat movement
                        gameState.character.position.x += normalizedDx * retreatDistance;
                        gameState.character.position.y += normalizedDy * retreatDistance;
                        
                        // Clamp to canvas boundaries
                        const BOUNDARY_PADDING = 30;
                        gameState.character.position.x = Math.max(BOUNDARY_PADDING, Math.min(CANVAS_WIDTH - BOUNDARY_PADDING, gameState.character.position.x));
                        gameState.character.position.y = Math.max(BOUNDARY_PADDING, Math.min(CANVAS_HEIGHT - BOUNDARY_PADDING, gameState.character.position.y));
                        
                        // Update sprite position
                        gameState.character.sprite.x = gameState.character.position.x;
                        gameState.character.sprite.y = gameState.character.position.y;
                        
                        // Create Mage retreat trail visual effect
                        gameState.character.dashTrail = {
                          startPos,
                          endPos: { x: gameState.character.position.x, y: gameState.character.position.y },
                          startTime: currentTime,
                          duration: 500,
                        };
                      }
                    }
                  } else {
                    // Play sound effect
                    playSkillSound(gameState.character.class, castingSkill.type, castingSkill.element);
                    
                    // Single target attack
                    const result = attackEnemy(gameState.character, target, castingSkill, currentTime, gameSpeed);
                    if (result.damaged) {
                      playHitSound();
                      // Create skill effect - position depends on AOE shape
                      const effectPosition = castingSkill.aoeShape === 'circle-self' 
                        ? gameState.character.position 
                        : target.position;
                      const skillEffect = createSkillEffect(effectPosition, castingSkill, gameState.character.class);
                      gameState.skillEffects.push(skillEffect);

                      const damageNum = createDamageNumber(
                        target.position,
                        result.damageAmount,
                        false,
                        currentTime
                      );
                      gameState.damageNumbers.push(damageNum);
                      gameState.score += result.damageAmount;

                      if (result.killed) {
                        gameState.score += result.executed ? 500 : 100;
                        gameState.enemies = gameState.enemies.filter((e) => e.id !== target.id);
                      }
                    }
                  }
                  
                  // Reset casting state
                  gameState.character.isCasting = false;
                  gameState.character.castingSkillId = null;
                  gameState.character.castingStartTime = 0;
                }
              }
            } else {
              // Not casting - select and start casting new skill
              const skill = selectBestSkill(gameState.character, target, currentTime, gameSpeed);
              if (skill) {
                // Special handling for Ranger's Evasive Dash
                if (skill.name === 'Evasive Dash') {
                  // Play dash sound effect
                  playEvasiveDash();
                  
                  // Dash away from target (opposite direction)
                  const dx = gameState.character.position.x - target.position.x;
                  const dy = gameState.character.position.y - target.position.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  
                  if (distance > 0) {
                    // Store start position for trail effect
                    const startPos = { x: gameState.character.position.x, y: gameState.character.position.y };
                    
                    // Normalize direction and dash 120 pixels away
                    const dashDistance = 120;
                    const normalizedDx = dx / distance;
                    const normalizedDy = dy / distance;
                    
                    // Apply dash movement
                    gameState.character.position.x += normalizedDx * dashDistance;
                    gameState.character.position.y += normalizedDy * dashDistance;
                    
                    // Clamp to canvas boundaries
                    const BOUNDARY_PADDING = 30;
                    gameState.character.position.x = Math.max(BOUNDARY_PADDING, Math.min(CANVAS_WIDTH - BOUNDARY_PADDING, gameState.character.position.x));
                    gameState.character.position.y = Math.max(BOUNDARY_PADDING, Math.min(CANVAS_HEIGHT - BOUNDARY_PADDING, gameState.character.position.y));
                    
                    // Update sprite position
                    gameState.character.sprite.x = gameState.character.position.x;
                    gameState.character.sprite.y = gameState.character.position.y;
                    
                    // Create dash trail visual effect
                    gameState.character.dashTrail = {
                      startPos,
                      endPos: { x: gameState.character.position.x, y: gameState.character.position.y },
                      startTime: currentTime,
                      duration: 500,
                    };
                    
                    // Mark skill as used
                    skill.lastUsed = currentTime;
                    
                    // Brief invulnerability (500ms)
                    gameState.character.isEvading = true;
                    setTimeout(() => {
                      if (gameState.character) {
                        gameState.character.isEvading = false;
                      }
                    }, 500);
                  }
                } else if (skill.name === 'Divine Shield') {
                  // Play shield sound effect
                  playDivineShield();
                  
                  // NEW v4.0: Divine Shield Rework - Instant 25% heal + 30% shield absorption for 4s
                  const healAmount = Math.floor(gameState.character.maxHp * 0.25);
                  gameState.character.hp = Math.min(gameState.character.maxHp, gameState.character.hp + healAmount);
                  
                  // Create heal number (green)
                  const healNum = createDamageNumber(
                    gameState.character.position,
                    healAmount,
                    false,
                    currentTime
                  );
                  healNum.color = '#22c55e'; // Green for healing
                  gameState.damageNumbers.push(healNum);
                  
                  // Grant damage absorption shield (30% max HP)
                  const shieldAmount = Math.floor(gameState.character.maxHp * 0.30);
                  gameState.character.divineShieldAmount = shieldAmount;
                  gameState.character.divineShieldEndTime = currentTime + 4000; // NEW: 4 seconds duration
                  
                  // Create shield number (golden)
                  const shieldNum = createDamageNumber(
                    gameState.character.position,
                    shieldAmount,
                    false,
                    currentTime
                  );
                  shieldNum.color = '#fbbf24'; // Golden for shield
                  gameState.damageNumbers.push(shieldNum);
                  
                  // Mark skill as used
                  skill.lastUsed = currentTime;
                  
                  console.log(`🛡️ Paladin activated Divine Shield! Healed ${healAmount} HP + ${shieldAmount} Shield!`);
                } else {
                  // Normal skill casting
                  gameState.character.isCasting = true;
                  gameState.character.castingSkillId = skill.id;
                  gameState.character.castingStartTime = currentTime;
                }
              }
            }
          }
        }
      }

      // Update enemies - OPTIMIZED: Skip sprite + AI updates every other frame
      for (const enemy of gameState.enemies) {
        // Update animated sprite only every 2nd frame for performance
        if (frameSkipCounter.current === 0 && enemy.sprite?.animatedSprite?.sprite) {
          try {
            enemy.sprite.animatedSprite.sprite.update(deltaTime * 2); // Compensate for skipped frames
          } catch (error) {
            console.error('Enemy sprite update error:', error);
          }
        }
        
        // OPTIMIZATION: Skip AI updates every other frame (except bosses, always update)
        if (!enemy.isBoss && frameSkipCounter.current !== 0) continue;
        
        // NEW: Check if boss should use special ability
        if (enemy.isBoss && gameState.character) {
          const bossSkill = shouldUseBossSkill(enemy, currentTime);
          if (bossSkill) {
            // Execute boss skill and deal damage to character
            const result = executeBossSkill(enemy, bossSkill, gameState.character, currentTime);
            
            // Create visual effect for boss skill
            const bossSkillEffect = createBossSkillEffect(
              enemy.position,
              bossSkill,
              gameState.character.position
            );
            gameState.bossSkillEffects.push(bossSkillEffect);
            
            // Apply damage to character
            if (result.damage > 0) {
              const damageNum = createDamageNumber(
                gameState.character.position,
                result.damage,
                false,
                currentTime
              );
              gameState.damageNumbers.push(damageNum);
              gameState.character.hp = Math.max(0, gameState.character.hp - result.damage);
              
              // Check if character died
              if (gameState.character.hp <= 0) {
                gameState.isGameOver = true;
                onGameOver();
              }
            }
            
            console.log(`🔥 Boss used: ${bossSkill.name} - ${result.effect}`);
          }
        }
        
        if (gameState.character) {
          // Check telegraph
          if (shouldTelegraph(enemy, currentTime, gameSpeed)) {
            startTelegraph(enemy, currentTime);
          }

          // Attack if telegraphing for 1 second AND within melee range AND NOT STUNNED
          const attackRange = 60; // Melee attack range for monsters
          const distToPlayer = distance(enemy.position, gameState.character.position);
          // Check if enemy is stunned (cannot attack)
          const isStunnedForAttack = enemy.stunEndTime && currentTime < enemy.stunEndTime;
          if (enemy.isTelegraphing && currentTime - enemy.telegraphStart >= 1000 && distToPlayer <= attackRange && !isStunnedForAttack) {
            const result = enemyAttackCharacter(enemy, gameState.character, currentTime);
            if (result.missed) {
              playMissSound();
              const missNum = createDamageNumber(
                gameState.character.position,
                0,
                true,
                currentTime
              );
              gameState.damageNumbers.push(missNum);
            } else if (result.damaged) {
              playHitSound();
              const damageNum = createDamageNumber(
                gameState.character.position,
                result.damageAmount,
                false,
                currentTime
              );
              gameState.damageNumbers.push(damageNum);

              if (result.killed) {
                gameState.isGameOver = true;
                onGameOver();
              }
            }
          }

          // Move towards character (with status effect checks)
          const stopDistance = 50;
          const dist = distance(enemy.position, gameState.character.position);
          
          // Check if enemy is stunned or rooted (cannot move)
          // Stun = cannot move + cannot attack
          // Root/Trap = cannot move ONLY (can still attack if in range)
          const isStunned = enemy.stunEndTime && currentTime < enemy.stunEndTime;
          const isRooted = enemy.trapped && enemy.trapEndTime && currentTime < enemy.trapEndTime;
          
          if (dist > stopDistance && !isStunned && !isRooted) {
            // Calculate effective speed (0 if trapped, reduced if slowed)
            const effectiveSpeed = getEffectiveEnemySpeed(enemy, enemy.speed);
            updateEnemyPosition(enemy, gameState.character.position, deltaTime, effectiveSpeed);
          }
        }
      }

      // Update HP bars
      updateHPBars(gameState);

      // Update skill effects - OPTIMIZED: Skip every other frame
      if (frameSkipCounter.current === 0) {
        for (const effect of gameState.skillEffects) {
          if (effect.sprite?.animatedSprite?.sprite) {
            try {
              effect.sprite.animatedSprite.sprite.update(deltaTime * 2);
            } catch (error) {
              console.error('Skill effect sprite update error:', error);
            }
          }
        }
      }
      updateSkillEffectsInState(gameState, currentTime);

      // Cleanup damage numbers
      cleanupDamageNumbers(gameState, currentTime);
      
      // Cleanup boss skill effects
      gameState.bossSkillEffects = gameState.bossSkillEffects.filter((effect) => {
        const elapsed = currentTime - effect.startTime;
        return elapsed < effect.duration;
      });

      // Render
      render(ctx, gameState, currentTime);

      animationFrameRef.current = requestAnimationFrame(gameLoop);
      } catch (error) {
        console.error('❌ Game loop error:', error);
        // Try to continue game loop despite error
        animationFrameRef.current = requestAnimationFrame(gameLoop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [onGameOver, gameSpeed, onStageComplete]); // Removed gameState to prevent loop

  const render = (
    ctx: CanvasRenderingContext2D,
    state: GameState,
    currentTime: number
  ): void => {
    // NEW: Render map background
    if (state.stage.map) {
      ctx.fillStyle = state.stage.map.backgroundColor;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Render arena walls/boundaries
      ctx.save();
      ctx.strokeStyle = state.stage.map.ambientParticleColor;
      ctx.lineWidth = 8;
      ctx.globalAlpha = 0.4;
      // Outer border with texture
      ctx.strokeRect(10, 10, CANVAS_WIDTH - 20, CANVAS_HEIGHT - 20);
      // Inner shadow effect
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.6;
      ctx.strokeRect(12, 12, CANVAS_WIDTH - 24, CANVAS_HEIGHT - 24);
      ctx.restore();
      
      // Render detailed floor pattern
      ctx.save();
      ctx.globalAlpha = 0.2;
      
      if (state.stage.map.floorPattern === 'grid') {
        // Tiled floor with depth
        const tileSize = 50;
        for (let x = 0; x < CANVAS_WIDTH; x += tileSize) {
          for (let y = 0; y < CANVAS_HEIGHT; y += tileSize) {
            // Tile body
            ctx.fillStyle = state.stage.map.ambientParticleColor;
            ctx.fillRect(x, y, tileSize - 2, tileSize - 2);
            // Tile border (grout)
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, tileSize - 2, tileSize - 2);
            // Inner highlight for 3D effect
            ctx.strokeStyle = state.stage.map.backgroundColor;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3;
            ctx.strokeRect(x + 2, y + 2, tileSize - 6, tileSize - 6);
            ctx.globalAlpha = 0.2;
          }
        }
      } else if (state.stage.map.floorPattern === 'stone') {
        // Scattered stones with shadows
        for (let i = 0; i < 150; i++) {
          const x = (i * 137.5) % CANVAS_WIDTH;
          const y = (i * 241.3) % CANVAS_HEIGHT;
          const size = 4 + (i % 5);
          // Stone shadow
          ctx.fillStyle = '#000000';
          ctx.globalAlpha = 0.3;
          ctx.fillRect(x + 1, y + 1, size, size);
          // Stone body
          ctx.fillStyle = state.stage.map.ambientParticleColor;
          ctx.globalAlpha = 0.25;
          ctx.fillRect(x, y, size, size);
        }
        ctx.globalAlpha = 0.2;
      } else if (state.stage.map.floorPattern === 'sand') {
        // Sand dunes pattern
        ctx.strokeStyle = state.stage.map.ambientParticleColor;
        ctx.lineWidth = 1;
        for (let y = 0; y < CANVAS_HEIGHT; y += 20) {
          ctx.beginPath();
          for (let x = 0; x < CANVAS_WIDTH; x += 10) {
            const wave = Math.sin(x * 0.05 + y * 0.03) * 5;
            if (x === 0) ctx.moveTo(x, y + wave);
            else ctx.lineTo(x, y + wave);
          }
          ctx.stroke();
        }
      } else if (state.stage.map.floorPattern === 'ice') {
        // Ice cracks pattern
        ctx.strokeStyle = state.stage.map.ambientParticleColor;
        ctx.lineWidth = 2;
        for (let i = 0; i < 30; i++) {
          const x = (i * 173.7) % CANVAS_WIDTH;
          const y = (i * 293.1) % CANVAS_HEIGHT;
          const angle = i * 0.7;
          const length = 40 + (i % 30);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
          ctx.stroke();
        }
      } else if (state.stage.map.floorPattern === 'void') {
        // Void swirls
        ctx.strokeStyle = state.stage.map.ambientParticleColor;
        ctx.lineWidth = 2;
        const time = currentTime * 0.0005;
        for (let i = 0; i < 20; i++) {
          const centerX = CANVAS_WIDTH / 2;
          const centerY = CANVAS_HEIGHT / 2;
          const radius = 50 + i * 30;
          const angle = i * 0.5 + time;
          ctx.globalAlpha = 0.1 + (i % 3) * 0.05;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, angle, angle + Math.PI);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.2;
      } else if (state.stage.map.floorPattern === 'lava') {
        // Lava cracks glowing
        ctx.strokeStyle = state.stage.map.ambientParticleColor;
        ctx.lineWidth = 3;
        const pulseGlow = Math.sin(currentTime * 0.003) * 0.1 + 0.2;
        ctx.globalAlpha = pulseGlow;
        for (let i = 0; i < 40; i++) {
          const x = (i * 127.3) % CANVAS_WIDTH;
          const y = (i * 251.7) % CANVAS_HEIGHT;
          const angle = i * 0.9;
          const length = 30 + (i % 25);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
          ctx.stroke();
          // Glow
          ctx.strokeStyle = '#ff6b35';
          ctx.lineWidth = 1;
          ctx.globalAlpha = pulseGlow * 0.5;
          ctx.stroke();
          ctx.strokeStyle = state.stage.map.ambientParticleColor;
          ctx.lineWidth = 3;
          ctx.globalAlpha = pulseGlow;
        }
        ctx.globalAlpha = 0.2;
      }
      
      ctx.restore();
      
      // Ambient particles/fog
      ctx.save();
      ctx.fillStyle = state.stage.map.ambientParticleColor;
      for (let i = 0; i < 25; i++) {
        const x = ((currentTime * 0.01 + i * 50) % CANVAS_WIDTH);
        const y = ((currentTime * 0.02 + i * 30) % CANVAS_HEIGHT);
        const size = 2 + (i % 3);
        const alpha = (Math.sin(currentTime * 0.002 + i) + 1) * 0.05;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      
      // Render terrain features with 3D effects
      for (const terrain of state.stage.map.terrainFeatures) {
        ctx.save();
        
        if (terrain.type === 'obstacle') {
          // Rock/pillar with 3D shading
          // Shadow (bottom-right)
          ctx.fillStyle = '#000000';
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.ellipse(
            terrain.position.x + 5,
            terrain.position.y + terrain.radius + 8,
            terrain.radius * 0.8,
            terrain.radius * 0.3,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
          
          // Rock body with gradient (3D effect)
          const gradient = ctx.createRadialGradient(
            terrain.position.x - terrain.radius * 0.3,
            terrain.position.y - terrain.radius * 0.3,
            0,
            terrain.position.x,
            terrain.position.y,
            terrain.radius
          );
          gradient.addColorStop(0, terrain.color);
          gradient.addColorStop(0.6, terrain.color);
          gradient.addColorStop(1, '#000000');
          ctx.fillStyle = gradient;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(terrain.position.x, terrain.position.y, terrain.radius, 0, Math.PI * 2);
          ctx.fill();
          
          // Highlight (top-left for 3D lighting)
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.arc(
            terrain.position.x - terrain.radius * 0.3,
            terrain.position.y - terrain.radius * 0.3,
            terrain.radius * 0.4,
            0,
            Math.PI * 2
          );
          ctx.fill();
          
          // Cracks/texture
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.3;
          for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const startRadius = terrain.radius * 0.3;
            const endRadius = terrain.radius * 0.9;
            ctx.beginPath();
            ctx.moveTo(
              terrain.position.x + Math.cos(angle) * startRadius,
              terrain.position.y + Math.sin(angle) * startRadius
            );
            ctx.lineTo(
              terrain.position.x + Math.cos(angle) * endRadius,
              terrain.position.y + Math.sin(angle) * endRadius
            );
            ctx.stroke();
          }
        } else {
          // Decoration (glowing crystals, plants, etc)
          // Glow aura
          ctx.fillStyle = terrain.color;
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.arc(
            terrain.position.x,
            terrain.position.y,
            terrain.radius * 1.5,
            0,
            Math.PI * 2
          );
          ctx.fill();
          
          // Main body
          ctx.fillStyle = terrain.color;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(terrain.position.x, terrain.position.y, terrain.radius, 0, Math.PI * 2);
          ctx.fill();
          
          // Sparkle effect
          const sparklePhase = Math.sin(currentTime * 0.005 + terrain.position.x) * 0.5 + 0.5;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = sparklePhase * 0.6;
          ctx.beginPath();
          ctx.arc(
            terrain.position.x,
            terrain.position.y - terrain.radius * 0.3,
            terrain.radius * 0.3,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        
        ctx.restore();
      }
      
      // Render gates with detailed portal effects
      for (const gate of state.stage.map.gates) {
        const elapsed = gate.isActive ? currentTime - gate.activationTime : 0;
        const pulsePhase = Math.sin(currentTime / 300) * 0.3 + 0.7;
        const rotationSpeed = gate.isActive ? 0.001 : 0.0003;
        const rotation = currentTime * rotationSpeed;
        
        ctx.save();
        ctx.translate(gate.position.x, gate.position.y);
        
        // Portal background vortex
        ctx.fillStyle = gate.color;
        ctx.globalAlpha = gate.isActive ? 0.5 * pulsePhase : 0.25;
        ctx.beginPath();
        ctx.arc(0, 0, gate.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Swirling energy spirals
        ctx.strokeStyle = gate.glowColor;
        ctx.lineWidth = 3;
        ctx.globalAlpha = gate.isActive ? 0.6 * pulsePhase : 0.3;
        for (let i = 0; i < 3; i++) {
          const spiralRadius = gate.radius * (0.3 + i * 0.3);
          const spiralRotation = rotation + (i * Math.PI * 2 / 3);
          ctx.beginPath();
          ctx.arc(0, 0, spiralRadius, spiralRotation, spiralRotation + Math.PI * 0.8);
          ctx.stroke();
        }
        
        // Outer portal frame (stone arch)
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = 8;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, gate.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner portal frame highlight
        ctx.strokeStyle = '#718096';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, gate.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        
        // Ancient runes around portal (8 runes)
        if (gate.isActive) {
          ctx.fillStyle = gate.glowColor;
          ctx.globalAlpha = pulsePhase * 0.8;
          ctx.font = '20px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const runes = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ'];
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 - rotation * 2;
            const runeX = Math.cos(angle) * (gate.radius + 20);
            const runeY = Math.sin(angle) * (gate.radius + 20);
            ctx.save();
            ctx.translate(runeX, runeY);
            ctx.rotate(angle + Math.PI / 2);
            ctx.fillText(runes[i], 0, 0);
            ctx.restore();
          }
        }
        
        // Active gate effects
        if (gate.isActive) {
          // Outer energy ring pulse
          ctx.strokeStyle = gate.glowColor;
          ctx.lineWidth = 4;
          ctx.globalAlpha = 0.5 * pulsePhase;
          ctx.beginPath();
          ctx.arc(0, 0, gate.radius + 15, 0, Math.PI * 2);
          ctx.stroke();
          
          // Inner energy particles
          ctx.fillStyle = gate.glowColor;
          for (let i = 0; i < 8; i++) {
            const particleAngle = (i / 8) * Math.PI * 2 + rotation * 3;
            const particleRadius = gate.radius * 0.7 + Math.sin(currentTime * 0.005 + i) * 10;
            const px = Math.cos(particleAngle) * particleRadius;
            const py = Math.sin(particleAngle) * particleRadius;
            ctx.globalAlpha = 0.7 * pulsePhase;
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          
          // Center portal core
          const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, gate.radius * 0.5);
          coreGradient.addColorStop(0, gate.glowColor);
          coreGradient.addColorStop(0.5, gate.color);
          coreGradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = coreGradient;
          ctx.globalAlpha = 0.6 * pulsePhase;
          ctx.beginPath();
          ctx.arc(0, 0, gate.radius * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      
      // Render map name
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px bold sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.stage.map.name, CANVAS_WIDTH / 2, 25);
    } else {
      // Fallback: original background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Render hazard effect if boss stage
      if (state.stage.isBoss && state.stage.hazardType) {
        ctx.fillStyle =
          state.stage.hazardType === 'lava'
            ? 'rgba(239, 68, 68, 0.1)'
            : state.stage.hazardType === 'sand'
            ? 'rgba(251, 191, 36, 0.1)'
            : 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    }

    // Render character
    if (state.character) {
      // Render casting visual effects - NEW v3.9.0: Improved rotating circle particles
      if (state.character.isCasting && state.character.castingSkillId) {
        const castingSkill = state.character.skills.find((s) => s.id === state.character.castingSkillId);
        if (castingSkill) {
          // Get cast time from constants
          const config = CLASS_CONFIGS[state.character.class];
          const skillConfig = config.skills.find((sc) => sc.name === castingSkill.name);
          let castTime = skillConfig?.castTime || 300;
          
          // Apply Attack Speed reduction to casting time for visual bar
          if (state.character.attackSpeed && state.character.attackSpeed > 0) {
            castTime = Math.max(50, Math.floor(castTime * (1 - state.character.attackSpeed)));
          }
          
          const castElapsed = currentTime - state.character.castingStartTime;
          const castProgress = Math.min(castElapsed / castTime, 1);
          
          // NEW v3.9.0: Rotating circle particles around character
          const numParticles = 12;
          const baseRadius = 30;
          const particleRadius = baseRadius + (10 * Math.sin(castProgress * Math.PI));
          const rotationSpeed = currentTime * 0.003; // Smooth rotation
          
          ctx.fillStyle = '#9333ea';
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          
          for (let i = 0; i < numParticles; i++) {
            const angle = (i / numParticles) * Math.PI * 2 + rotationSpeed;
            const px = state.character.position.x + Math.cos(angle) * particleRadius;
            const py = state.character.position.y + Math.sin(angle) * particleRadius;
            const size = 4 + (2 * Math.sin(castProgress * Math.PI * 4 + i));
            
            // Particle glow
            ctx.globalAlpha = 0.3 + (0.3 * castProgress);
            ctx.beginPath();
            ctx.arc(px, py, size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Particle core
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          
          // Inner pulsing glow
          const glowRadius = 20 + (10 * Math.sin(castProgress * Math.PI * 3));
          ctx.fillStyle = `rgba(147, 51, 234, ${0.2 + 0.2 * castProgress})`;
          ctx.beginPath();
          ctx.arc(state.character.position.x, state.character.position.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();
          
          // Casting bar above character
          const barWidth = 60;
          const barHeight = 6;
          const barX = state.character.position.x - barWidth / 2;
          const barY = state.character.position.y - 50;
          
          // Bar background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(barX, barY, barWidth, barHeight);
          
          // Bar progress
          ctx.fillStyle = '#a855f7';
          ctx.fillRect(barX, barY, barWidth * castProgress, barHeight);
          
          // Bar border
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(barX, barY, barWidth, barHeight);
        }
      }
      
      // NEW v4.0: Render Paladin Divine Shield absorption aura
      if (state.character.divineShieldAmount && state.character.divineShieldAmount > 0 && state.character.divineShieldEndTime && currentTime < state.character.divineShieldEndTime) {
        const shieldProgress = (state.character.divineShieldEndTime - currentTime) / 4000;
        const pulsePhase = Math.sin(currentTime * 0.015 * gameSpeed) * 0.3 + 0.7;
        
        // Golden shield aura layers
        ctx.globalAlpha = 0.4 * pulsePhase;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(state.character.position.x, state.character.position.y, 45 * pulsePhase, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 0.6 * pulsePhase;
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(state.character.position.x, state.character.position.y, 35 * pulsePhase, 0, Math.PI * 2);
        ctx.fill();
        
        // Shield barrier ring
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(state.character.position.x, state.character.position.y, 40, 0, Math.PI * 2);
        ctx.stroke();
        
        // Rotating divine runes
        ctx.fillStyle = '#fbbf24';
        ctx.font = '16px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const runes = ['✦', '✧', '✦', '✧', '✦', '✧'];
        const runeRotation = currentTime * 0.005 * gameSpeed;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + runeRotation;
          const rx = state.character.position.x + Math.cos(angle) * 45;
          const ry = state.character.position.y + Math.sin(angle) * 45;
          ctx.fillText(runes[i], rx, ry);
        }
        
        ctx.globalAlpha = 1;
      }
      
      // Render evade ring if evading
      if (state.character.isEvading) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(state.character.position.x, state.character.position.y, 30, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // NEW v3.9.0: Render dash/retreat trail effect (Ranger green, Mage blue)
      if (state.character.dashTrail) {
        const trail = state.character.dashTrail;
        const trailElapsed = currentTime - trail.startTime;
        const trailProgress = Math.min(trailElapsed / trail.duration, 1);
        const trailAlpha = 1 - trailProgress;
        
        // Trail color depends on class
        const isMage = state.character.class === 'Mage';
        const trailColor = isMage ? '#3b82f6' : '#10b981'; // Blue for Mage, Green for Ranger
        
        // Trail particles from start to end position
        const numTrailParticles = 10;
        ctx.fillStyle = trailColor;
        for (let i = 0; i < numTrailParticles; i++) {
          const t = i / numTrailParticles;
          const px = trail.startPos.x + (trail.endPos.x - trail.startPos.x) * t;
          const py = trail.startPos.y + (trail.endPos.y - trail.startPos.y) * t;
          const size = 8 - (i * 0.6);
          const particleAlpha = trailAlpha * (1 - t * 0.5);
          
          ctx.globalAlpha = particleAlpha * 0.6;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
          
          // Mage retreat has additional arcane shimmer effect
          if (isMage && i % 2 === 0) {
            ctx.fillStyle = '#93c5fd';
            ctx.globalAlpha = particleAlpha * 0.4;
            ctx.beginPath();
            ctx.arc(px, py, size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = trailColor;
          }
        }
        ctx.globalAlpha = 1;
        
        // Clean up expired trail
        if (trailProgress >= 1) {
          state.character.dashTrail = undefined;
        }
      }
      
      // Update character animation - only idle and casting
      if (state.character.sprite.animatedSprite) {
        const currentState = state.character.sprite.animatedSprite.currentState;
        
        if (state.character.isCasting) {
          // Play casting animation
          if (currentState !== 'attack') {
            state.character.sprite.animatedSprite.sprite.play('attack');
            state.character.sprite.animatedSprite.currentState = 'attack';
          }
        } else {
          // Play idle animation
          if (currentState !== 'idle') {
            state.character.sprite.animatedSprite.sprite.play('idle');
            state.character.sprite.animatedSprite.currentState = 'idle';
          }
        }
      }

      // Save context for sprite flip
      ctx.save();
      ctx.translate(state.character.position.x, state.character.position.y);
      ctx.scale(state.character.sprite.scaleX, 1);
      
      // Render animated sprite (centered at 0,0 after translate)
      if (state.character.sprite.animatedSprite) {
        state.character.sprite.animatedSprite.sprite.draw(
          ctx,
          0,
          0,
          state.character.sprite.width,
          state.character.sprite.height
        );
      }
      
      ctx.restore();
      
      // Cook mode auto-toggle mechanism - every 8 seconds (not 5 to avoid spam)
      if (state.character.class === 'Cook' && state.character.cookMode && state.character.cookModeSwitchTime !== undefined) {
        const MODE_SWITCH_INTERVAL = 8000; // 8 seconds per mode
        if (currentTime - state.character.cookModeSwitchTime >= MODE_SWITCH_INTERVAL) {
          // Auto-toggle mode
          state.character.cookMode = state.character.cookMode === 'damage' ? 'heal' : 'damage';
          state.character.cookModeSwitchTime = currentTime;
        }
        
        // Cook mode indicator emote above character
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        const modeEmote = state.character.cookMode === 'damage' ? '⚔️' : '💚';
        ctx.fillText(modeEmote, state.character.position.x, state.character.position.y - 55);
      }
    }

    // Render enemies with visual variants
    for (const enemy of state.enemies) {
      // Telegraph indicator removed for cleaner visuals
      
      // Apply visual filter for variety
      if (enemy.visualFilter && enemy.visualFilter !== 'none') {
        ctx.save();
        ctx.filter = enemy.visualFilter;
      }
      
      // Render animated sprite
      if (enemy.sprite.animatedSprite) {
        enemy.sprite.animatedSprite.sprite.draw(
          ctx,
          enemy.position.x,
          enemy.position.y,
          enemy.sprite.width,
          enemy.sprite.height
        );
      }
      
      // Restore context if filter was applied
      if (enemy.visualFilter && enemy.visualFilter !== 'none') {
        ctx.restore();
      }
      
      // Elite variant indicator (crown icon above elite mobs)
      if (enemy.variant === 'elite' && !enemy.isBoss) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '16px bold sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑', enemy.position.x, enemy.position.y - 45);
      }
      
      // OPTIMIZED: Show only the most important status effect (reduce rendering)
      let emotOffsetY = enemy.isBoss ? -65 : -55;
      ctx.font = '16px sans-serif'; // Smaller font for performance
      ctx.textAlign = 'center';
      
      // Priority: Freeze > Stun > Trap/Root > Burn > Poison > Slow (show only one)
      if (enemy.frozenEndTime && currentTime < enemy.frozenEndTime) {
        ctx.fillText('❄️', enemy.position.x, enemy.position.y + emotOffsetY); // Freeze indicator (Mage Frost Nova)
      } else if (enemy.stunEndTime && currentTime < enemy.stunEndTime) {
        ctx.fillText('😵', enemy.position.x, enemy.position.y + emotOffsetY); // Stun indicator
      } else if (enemy.trapped && enemy.trapEndTime && currentTime < enemy.trapEndTime) {
        ctx.fillText('🕸️', enemy.position.x, enemy.position.y + emotOffsetY); // Web/trap indicator
      } else if (enemy.burnEndTime && currentTime < enemy.burnEndTime && enemy.burnDamage) {
        ctx.fillText('🔥', enemy.position.x, enemy.position.y + emotOffsetY);
      } else if (enemy.poisonEndTime && currentTime < enemy.poisonEndTime) {
        ctx.fillText('☠️', enemy.position.x, enemy.position.y + emotOffsetY);
      } else if (enemy.slowAmount && enemy.slowEndTime && currentTime < enemy.slowEndTime) {
        ctx.fillText('🐌', enemy.position.x, enemy.position.y + emotOffsetY); // Slow indicator (snail)
      }
    }

    // Render skill effects with unique visuals per class
    for (const effect of state.skillEffects) {
      // Get skill info from character to determine visual style
      const character = state.character;
      if (!character) continue;
      
      const skill = character.skills.find(s => s.lastUsed && Math.abs(currentTime - s.lastUsed) < 500);
      if (!skill) {
        // Fallback to animated sprite
        if (effect.sprite.animatedSprite) {
          effect.sprite.animatedSprite.sprite.draw(
            ctx,
            effect.position.x,
            effect.position.y,
            effect.sprite.width,
            effect.sprite.height
          );
        }
        continue;
      }
      
      const elapsed = currentTime - effect.startTime;
      const progress = Math.min(elapsed / effect.duration, 1);
      const alpha = 1 - progress;
      
      ctx.globalAlpha = alpha;
      
      // Render unique visual based on class and skill type
      if (character.class === 'Warrior') {
        if (skill.type === 'basic') {
          // Power Strike - Simple diagonal slash marks (like sword swipe)
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          
          // Main diagonal slash
          const slashAngle = -Math.PI / 4; // Diagonal dari top-left ke bottom-right
          const slashLength = 70 + progress * 40;
          ctx.globalAlpha = alpha * (1.2 - progress * 0.5);
          ctx.beginPath();
          ctx.moveTo(
            effect.position.x - Math.cos(slashAngle) * slashLength / 2,
            effect.position.y - Math.sin(slashAngle) * slashLength / 2
          );
          ctx.lineTo(
            effect.position.x + Math.cos(slashAngle) * slashLength / 2,
            effect.position.y + Math.sin(slashAngle) * slashLength / 2
          );
          ctx.stroke();
          
          // Lighter trail slash for motion effect
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 4;
          ctx.globalAlpha = alpha * 0.5;
          ctx.beginPath();
          ctx.moveTo(
            effect.position.x - Math.cos(slashAngle) * slashLength / 2.5,
            effect.position.y - Math.sin(slashAngle) * slashLength / 2.5
          );
          ctx.lineTo(
            effect.position.x + Math.cos(slashAngle) * slashLength / 2.5,
            effect.position.y + Math.sin(slashAngle) * slashLength / 2.5
          );
          ctx.stroke();
          ctx.globalAlpha = alpha;
        } else if (skill.type === 'heavy') {
          // Shield Bash - IMPROVED VERSION of skill 1 (double diagonal slash with more power)
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 12;
          ctx.lineCap = 'round';
          
          // First diagonal slash (same angle as skill 1)
          const slashAngle = -Math.PI / 4;
          const slashLength = 90 + progress * 50; // Bigger than skill 1
          ctx.globalAlpha = alpha * (1.5 - progress * 0.5);
          ctx.beginPath();
          ctx.moveTo(
            effect.position.x - Math.cos(slashAngle) * slashLength / 2,
            effect.position.y - Math.sin(slashAngle) * slashLength / 2
          );
          ctx.lineTo(
            effect.position.x + Math.cos(slashAngle) * slashLength / 2,
            effect.position.y + Math.sin(slashAngle) * slashLength / 2
          );
          ctx.stroke();
          
          // Second parallel slash (offset)
          ctx.globalAlpha = alpha * (1.3 - progress * 0.4);
          ctx.beginPath();
          const offset = 20;
          ctx.moveTo(
            effect.position.x - Math.cos(slashAngle) * slashLength / 2 + offset,
            effect.position.y - Math.sin(slashAngle) * slashLength / 2 + offset
          );
          ctx.lineTo(
            effect.position.x + Math.cos(slashAngle) * slashLength / 2 + offset,
            effect.position.y + Math.sin(slashAngle) * slashLength / 2 + offset
          );
          ctx.stroke();
          
          // Cross slash (perpendicular)
          const crossAngle = Math.PI / 4; // Opposite diagonal
          ctx.globalAlpha = alpha * (1.4 - progress * 0.5);
          ctx.beginPath();
          ctx.moveTo(
            effect.position.x - Math.cos(crossAngle) * slashLength / 2,
            effect.position.y - Math.sin(crossAngle) * slashLength / 2
          );
          ctx.lineTo(
            effect.position.x + Math.cos(crossAngle) * slashLength / 2,
            effect.position.y + Math.sin(crossAngle) * slashLength / 2
          );
          ctx.stroke();
          
          // Lighter trails for motion effect (multiple)
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 6;
          for (let i = 1; i <= 3; i++) {
            ctx.globalAlpha = alpha * (0.6 - i * 0.15);
            const trailOffset = i * 8;
            ctx.beginPath();
            ctx.moveTo(
              effect.position.x - Math.cos(slashAngle) * slashLength / 3 - trailOffset,
              effect.position.y - Math.sin(slashAngle) * slashLength / 3 - trailOffset
            );
            ctx.lineTo(
              effect.position.x + Math.cos(slashAngle) * slashLength / 3 - trailOffset,
              effect.position.y + Math.sin(slashAngle) * slashLength / 3 - trailOffset
            );
            ctx.stroke();
          }
          
          // Impact flash at center
          ctx.globalAlpha = alpha * (1 - progress) * 0.7;
          ctx.fillStyle = '#fee2e2';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, (1 - progress) * 50, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
        } else {
          // Ground Slam - MASSIVE earthquake impact
          ctx.strokeStyle = '#ef4444';
          ctx.fillStyle = '#ef4444';
          ctx.lineWidth = 8;
          
          // Multiple powerful shockwave rings
          const radius1 = progress * 150;
          const radius2 = Math.max(0, progress - 0.2) * 150;
          const radius3 = Math.max(0, progress - 0.4) * 150;
          const radius4 = Math.max(0, progress - 0.6) * 150;
          
          // First wave (strongest)
          ctx.globalAlpha = alpha * (1.5 - progress * 0.8);
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, radius1, 0, Math.PI * 2);
          ctx.stroke();
          
          if (radius2 > 0) {
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#f87171';
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, radius2, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          if (radius3 > 0) {
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#fca5a5';
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, radius3, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          if (radius4 > 0) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#fee2e2';
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, radius4, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          // Ground crack lines radiating from center
          ctx.strokeStyle = '#991b1b';
          ctx.lineWidth = 4;
          const numCracks = 12;
          for (let i = 0; i < numCracks; i++) {
            const angle = (i / numCracks) * Math.PI * 2;
            const crackLength = progress * 140;
            ctx.globalAlpha = alpha * (1 - progress * 0.6);
            ctx.beginPath();
            ctx.moveTo(effect.position.x, effect.position.y);
            ctx.lineTo(
              effect.position.x + Math.cos(angle) * crackLength,
              effect.position.y + Math.sin(angle) * crackLength
            );
            ctx.stroke();
            // Branching cracks
            if (progress > 0.5) {
              const branchAngle = angle + (i % 2 === 0 ? 0.3 : -0.3);
              const branchLength = crackLength * 0.5;
              ctx.beginPath();
              ctx.moveTo(
                effect.position.x + Math.cos(angle) * crackLength * 0.6,
                effect.position.y + Math.sin(angle) * crackLength * 0.6
              );
              ctx.lineTo(
                effect.position.x + Math.cos(branchAngle) * branchLength,
                effect.position.y + Math.sin(branchAngle) * branchLength
              );
              ctx.stroke();
            }
          }
          
          // Central impact explosion flash
          ctx.globalAlpha = alpha * (1 - progress) * 0.5;
          ctx.fillStyle = '#fee2e2';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, (1 - progress) * 60, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
        }
      } else if (character.class === 'Mage') {
        if (skill.type === 'basic') {
          // Arcane Bolt - POWERFUL magic projectile with swirling energy
          // Main projectile orb with gradient
          const gradient = ctx.createRadialGradient(
            effect.position.x - 5, effect.position.y - 5, 0,
            effect.position.x, effect.position.y, 18
          );
          gradient.addColorStop(0, '#dbeafe');
          gradient.addColorStop(0.5, '#3b82f6');
          gradient.addColorStop(1, '#1e40af');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, 18, 0, Math.PI * 2);
          ctx.fill();
          
          // Outer glow
          ctx.globalAlpha = alpha * 0.4;
          ctx.fillStyle = '#60a5fa';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, 26, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
          
          // Energy trail with particles
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(effect.position.x - 40, effect.position.y);
          ctx.lineTo(effect.position.x, effect.position.y);
          ctx.stroke();
          
          // Magic sparkles in trail
          for (let i = 0; i < 5; i++) {
            const sparkleX = effect.position.x - (i * 10);
            const sparkleY = effect.position.y + (Math.sin(progress * Math.PI * 4 + i) * 8);
            ctx.fillStyle = '#93c5fd';
            ctx.globalAlpha = alpha * (1 - i * 0.15);
            ctx.beginPath();
            ctx.arc(sparkleX, sparkleY, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = alpha;
        } else if (skill.type === 'heavy') {
          // Frost Nova - MASSIVE ice explosion with giant shards
          ctx.strokeStyle = '#60a5fa';
          ctx.fillStyle = '#3b82f6';
          ctx.lineWidth = 5;
          const numShards = 16;
          for (let i = 0; i < numShards; i++) {
            const angle = (i / numShards) * Math.PI * 2 + progress * 0.5;
            const length = progress * 120;
            const x = effect.position.x + Math.cos(angle) * length;
            const y = effect.position.y + Math.sin(angle) * length;
            
            // Large ice shard (crystal shape)
            ctx.globalAlpha = alpha * (1.2 - progress * 0.4);
            ctx.beginPath();
            ctx.moveTo(x, y); // Tip
            ctx.lineTo(x + Math.cos(angle + 0.4) * 30, y + Math.sin(angle + 0.4) * 30);
            ctx.lineTo(x + Math.cos(angle) * -10, y + Math.sin(angle) * -10); // Base center
            ctx.lineTo(x + Math.cos(angle - 0.4) * 30, y + Math.sin(angle - 0.4) * 30);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Ice shard trail
            ctx.strokeStyle = '#93c5fd';
            ctx.lineWidth = 3;
            ctx.globalAlpha = alpha * 0.6;
            ctx.beginPath();
            ctx.moveTo(effect.position.x, effect.position.y);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.strokeStyle = '#60a5fa';
          }
          
          // Center ice burst explosion
          ctx.globalAlpha = alpha * (1 - progress * 0.7);
          ctx.fillStyle = '#dbeafe';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, (1 - progress) * 50, 0, Math.PI * 2);
          ctx.fill();
          
          // Freeze wave rings
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 6;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, progress * 120, 0, Math.PI * 2);
          ctx.stroke();
          if (progress > 0.3) {
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, (progress - 0.3) * 120, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = alpha;
        } else {
          // Meteor - Falling meteor with fire (ENLARGED to match 150px radius)
          const meteorY = effect.position.y - (1 - progress) * 150;
          // Meteor body
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(effect.position.x, meteorY, 25, 0, Math.PI * 2);
          ctx.fill();
          // Fire trail
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(effect.position.x, meteorY - 15, 18, 0, Math.PI * 2);
          ctx.fill();
          // Explosion at impact
          if (progress > 0.7) {
            const explosionRadius = (progress - 0.7) * 500;
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, explosionRadius, 0, Math.PI * 2);
            ctx.stroke();
            // Inner explosion ring
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, explosionRadius * 0.7, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      } else if (character.class === 'Ranger') {
        if (skill.type === 'basic') {
          // Quick Shot - POWERFUL piercing arrow with energy trail
          ctx.strokeStyle = '#10b981';
          ctx.fillStyle = '#10b981';
          ctx.lineWidth = 7;
          const arrowLength = 50;
          
          // Arrow shaft with gradient
          ctx.beginPath();
          ctx.moveTo(effect.position.x - arrowLength, effect.position.y);
          ctx.lineTo(effect.position.x + arrowLength, effect.position.y);
          ctx.stroke();
          
          // Arrow head (large sharp triangle)
          ctx.beginPath();
          ctx.moveTo(effect.position.x + arrowLength, effect.position.y);
          ctx.lineTo(effect.position.x + arrowLength - 20, effect.position.y - 12);
          ctx.lineTo(effect.position.x + arrowLength - 20, effect.position.y + 12);
          ctx.closePath();
          ctx.fill();
          
          // Energy glow around arrow
          ctx.globalAlpha = alpha * 0.4;
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(effect.position.x - arrowLength, effect.position.y);
          ctx.lineTo(effect.position.x + arrowLength, effect.position.y);
          ctx.stroke();
          ctx.globalAlpha = alpha;
          
          // Speed lines behind arrow
          for (let i = 0; i < 3; i++) {
            const lineOffset = (i + 1) * 15;
            ctx.globalAlpha = alpha * (0.5 - i * 0.15);
            ctx.strokeStyle = '#6ee7b7';
            ctx.lineWidth = 4 - i;
            ctx.beginPath();
            ctx.moveTo(effect.position.x - lineOffset, effect.position.y);
            ctx.lineTo(effect.position.x - lineOffset - 25, effect.position.y);
            ctx.stroke();
          }
          ctx.globalAlpha = alpha;
        } else if (skill.type === 'heavy') {
          // Arrow Rain - MASSIVE barrage of falling arrows
          ctx.strokeStyle = '#10b981';
          ctx.fillStyle = '#10b981';
          ctx.lineWidth = 4;
          const numArrows = 18;
          for (let i = 0; i < numArrows; i++) {
            const offsetX = (i - numArrows / 2) * 15;
            const arrowY = effect.position.y - (1 - progress) * 120 + (i * 8);
            const wobble = Math.sin(progress * Math.PI * 3 + i) * 5;
            
            // Arrow shaft
            ctx.globalAlpha = alpha * (1 - progress * 0.4);
            ctx.beginPath();
            ctx.moveTo(effect.position.x + offsetX + wobble, arrowY - 25);
            ctx.lineTo(effect.position.x + offsetX + wobble, arrowY + 25);
            ctx.stroke();
            
            // Arrow head
            ctx.beginPath();
            ctx.moveTo(effect.position.x + offsetX + wobble, arrowY + 25);
            ctx.lineTo(effect.position.x + offsetX + wobble - 8, arrowY + 15);
            ctx.lineTo(effect.position.x + offsetX + wobble + 8, arrowY + 15);
            ctx.closePath();
            ctx.fill();
            
            // Arrow trail
            ctx.globalAlpha = alpha * 0.3;
            ctx.strokeStyle = '#6ee7b7';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(effect.position.x + offsetX + wobble, arrowY - 35);
            ctx.lineTo(effect.position.x + offsetX + wobble, arrowY - 15);
            ctx.stroke();
          }
          ctx.globalAlpha = alpha;
        } else {
          // Explosive Shot - REDESIGNED for clarity (ENLARGED to match 220px radius)
          // Stage 1: Giant arrow projectile (0-0.4 progress)
          if (progress < 0.4) {
            const arrowProgress = progress / 0.4;
            ctx.strokeStyle = '#10b981';
            ctx.fillStyle = '#10b981';
            ctx.lineWidth = 8;
            const arrowLength = 60 + arrowProgress * 20;
            // Arrow shaft (thick and visible)
            ctx.beginPath();
            ctx.moveTo(effect.position.x - arrowLength, effect.position.y);
            ctx.lineTo(effect.position.x + arrowLength, effect.position.y);
            ctx.stroke();
            // Arrow head (large triangle)
            ctx.beginPath();
            ctx.moveTo(effect.position.x + arrowLength, effect.position.y);
            ctx.lineTo(effect.position.x + arrowLength - 25, effect.position.y - 15);
            ctx.lineTo(effect.position.x + arrowLength - 25, effect.position.y + 15);
            ctx.closePath();
            ctx.fill();
            // Glow around arrow
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 12;
            ctx.globalAlpha = alpha * 0.4;
            ctx.beginPath();
            ctx.moveTo(effect.position.x - arrowLength, effect.position.y);
            ctx.lineTo(effect.position.x + arrowLength, effect.position.y);
            ctx.stroke();
            ctx.globalAlpha = alpha;
          }
          // Stage 2: MASSIVE explosion (0.4-1.0 progress)
          if (progress >= 0.4) {
            const explosionProgress = (progress - 0.4) / 0.6;
            // Multiple explosion rings for dramatic effect
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 8;
            const radius1 = explosionProgress * 220;
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, radius1, 0, Math.PI * 2);
            ctx.stroke();
            
            // Second ring (delayed)
            if (explosionProgress > 0.2) {
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 6;
              const radius2 = (explosionProgress - 0.2) * 200;
              ctx.beginPath();
              ctx.arc(effect.position.x, effect.position.y, radius2, 0, Math.PI * 2);
              ctx.stroke();
            }
            
            // Third ring (final wave)
            if (explosionProgress > 0.4) {
              ctx.strokeStyle = '#fb923c';
              ctx.lineWidth = 4;
              const radius3 = (explosionProgress - 0.4) * 180;
              ctx.beginPath();
              ctx.arc(effect.position.x, effect.position.y, radius3, 0, Math.PI * 2);
              ctx.stroke();
            }
            
            // Central explosion flash
            ctx.fillStyle = '#fbbf24';
            ctx.globalAlpha = alpha * (1 - explosionProgress) * 0.6;
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, explosionProgress * 100, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = alpha;
            
            // Explosion particles
            const numParticles = 16;
            for (let i = 0; i < numParticles; i++) {
              const angle = (i / numParticles) * Math.PI * 2;
              const particleDistance = explosionProgress * 180;
              const particleX = effect.position.x + Math.cos(angle) * particleDistance;
              const particleY = effect.position.y + Math.sin(angle) * particleDistance;
              ctx.fillStyle = '#f97316';
              ctx.globalAlpha = alpha * (1 - explosionProgress);
              ctx.beginPath();
              ctx.arc(particleX, particleY, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = alpha;
            }
          }
        }
      } else if (character.class === 'Assassin') {
        if (skill.type === 'basic') {
          // Backstab - LETHAL multi-strike dagger slashes with shadow trail
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 8;
          const numSlashes = 6;
          for (let i = 0; i < numSlashes; i++) {
            const angle = -Math.PI / 3 + (i * Math.PI / 9);
            const length = 60 + progress * 30;
            const offset = (i - numSlashes / 2) * 8;
            
            // Main slash
            ctx.globalAlpha = alpha * (1.2 - i * 0.15);
            ctx.beginPath();
            ctx.moveTo(
              effect.position.x + offset - Math.cos(angle) * length / 2, 
              effect.position.y - Math.sin(angle) * length / 2
            );
            ctx.lineTo(
              effect.position.x + offset + Math.cos(angle) * length / 2, 
              effect.position.y + Math.sin(angle) * length / 2
            );
            ctx.stroke();
            
            // Shadow trail
            ctx.strokeStyle = '#a78bfa';
            ctx.lineWidth = 4;
            ctx.globalAlpha = alpha * 0.4;
            ctx.beginPath();
            ctx.moveTo(
              effect.position.x + offset - Math.cos(angle) * length / 3, 
              effect.position.y - Math.sin(angle) * length / 3
            );
            ctx.lineTo(
              effect.position.x + offset + Math.cos(angle) * length / 3, 
              effect.position.y + Math.sin(angle) * length / 3
            );
            ctx.stroke();
            ctx.strokeStyle = '#8b5cf6';
          }
          ctx.globalAlpha = alpha;
        } else if (skill.type === 'heavy') {
          // Shadow Strike - DRAMATIC shadow dash with portal effect
          ctx.fillStyle = '#8b5cf6';
          ctx.strokeStyle = '#6d28d9';
          const numImages = 10;
          for (let i = 0; i < numImages; i++) {
            const imageProgress = (progress + i * 0.08) % 1;
            const imageAlpha = 1 - imageProgress;
            const radius = 30 + imageProgress * 50;
            
            // Shadow circle
            ctx.globalAlpha = alpha * imageAlpha * 0.6;
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Shadow ring
            ctx.globalAlpha = alpha * imageAlpha * 0.8;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          // Central shadow burst
          ctx.globalAlpha = alpha * (1 - progress * 0.7);
          ctx.fillStyle = '#c4b5fd';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, (1 - progress) * 40, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
        } else {
          // Poison Cloud - TOXIC spreading gas with bubbling effect
          ctx.fillStyle = '#22c55e';
          ctx.strokeStyle = '#16a34a';
          const numParticles = 24;
          for (let i = 0; i < numParticles; i++) {
            const angle = (i / numParticles) * Math.PI * 2 + (progress * Math.PI * 0.7);
            const radius = progress * 100;
            const particleSize = 12 + Math.sin(progress * Math.PI * 3 + i) * 8;
            const wobble = Math.sin(progress * Math.PI * 4 + i * 0.5) * 10;
            const x = effect.position.x + Math.cos(angle) * (radius + wobble);
            const y = effect.position.y + Math.sin(angle) * (radius + wobble);
            
            // Poison droplet with glow
            ctx.globalAlpha = alpha * (1 - progress * 0.5);
            ctx.beginPath();
            ctx.arc(x, y, particleSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Poison gas trail
            ctx.globalAlpha = alpha * 0.3;
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(effect.position.x, effect.position.y);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.strokeStyle = '#16a34a';
          }
          
          // Central toxic cloud
          ctx.globalAlpha = alpha * 0.4;
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, progress * 100, 0, Math.PI * 2);
          ctx.fill();
          
          // Outer poison ring
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, progress * 100, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = alpha;
        }
      } else if (character.class === 'Paladin') {
        if (skill.type === 'basic') {
          // Holy Strike - RADIANT divine cross with powerful glow
          ctx.strokeStyle = '#fbbf24';
          ctx.fillStyle = '#fbbf24';
          ctx.lineWidth = 10;
          
          // Vertical beam (stronger)
          ctx.globalAlpha = alpha * (1.3 - progress * 0.4);
          ctx.beginPath();
          ctx.moveTo(effect.position.x, effect.position.y - 50);
          ctx.lineTo(effect.position.x, effect.position.y + 50);
          ctx.stroke();
          
          // Horizontal beam (cross)
          ctx.beginPath();
          ctx.moveTo(effect.position.x - 40, effect.position.y);
          ctx.lineTo(effect.position.x + 40, effect.position.y);
          ctx.stroke();
          
          // Diagonal beams for extra holiness
          ctx.lineWidth = 6;
          ctx.globalAlpha = alpha * 0.7;
          ctx.beginPath();
          ctx.moveTo(effect.position.x - 30, effect.position.y - 30);
          ctx.lineTo(effect.position.x + 30, effect.position.y + 30);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(effect.position.x + 30, effect.position.y - 30);
          ctx.lineTo(effect.position.x - 30, effect.position.y + 30);
          ctx.stroke();
          
          // Radiant glow
          ctx.globalAlpha = alpha * 0.4;
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, 50, 0, Math.PI * 2);
          ctx.fill();
          
          // Inner bright core
          ctx.globalAlpha = alpha * 0.6;
          ctx.fillStyle = '#fffbeb';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, 25, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
        } else if (skill.type === 'heavy') {
          // Holy Nova - EXPLOSIVE divine light burst
          ctx.strokeStyle = '#fbbf24';
          ctx.fillStyle = '#fde047';
          ctx.lineWidth = 6;
          const numRays = 20;
          for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2 + progress * 0.3;
            const length = progress * 120;
            const thickness = i % 2 === 0 ? 6 : 4;
            
            // Main ray
            ctx.globalAlpha = alpha * (1.3 - progress * 0.5);
            ctx.lineWidth = thickness;
            ctx.beginPath();
            ctx.moveTo(effect.position.x, effect.position.y);
            ctx.lineTo(
              effect.position.x + Math.cos(angle) * length, 
              effect.position.y + Math.sin(angle) * length
            );
            ctx.stroke();
            
            // Ray glow
            ctx.globalAlpha = alpha * 0.4;
            ctx.strokeStyle = '#fef3c7';
            ctx.lineWidth = thickness + 4;
            ctx.beginPath();
            ctx.moveTo(effect.position.x, effect.position.y);
            ctx.lineTo(
              effect.position.x + Math.cos(angle) * length * 0.7, 
              effect.position.y + Math.sin(angle) * length * 0.7
            );
            ctx.stroke();
            ctx.strokeStyle = '#fbbf24';
          }
          
          // Central radiant glow
          ctx.globalAlpha = alpha * (1 - progress * 0.6);
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, (1 - progress) * 60, 0, Math.PI * 2);
          ctx.fill();
          
          // Holy ring wave
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, progress * 120, 0, Math.PI * 2);
          ctx.stroke();
          
          if (progress > 0.3) {
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, (progress - 0.3) * 120, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = alpha;
        } else {
          // Divine Judgement - MASSIVE heavenly pillar of light
          const beamWidth = 70 + progress * 60;
          
          // Heavenly beam gradient from sky
          const gradient = ctx.createLinearGradient(
            effect.position.x, 0, 
            effect.position.x, effect.position.y
          );
          gradient.addColorStop(0, 'rgba(251, 191, 36, 0)');
          gradient.addColorStop(0.3, 'rgba(251, 191, 36, 0.4)');
          gradient.addColorStop(1, 'rgba(251, 191, 36, 0.9)');
          ctx.fillStyle = gradient;
          ctx.globalAlpha = alpha * (1.2 - progress * 0.4);
          ctx.fillRect(effect.position.x - beamWidth / 2, 0, beamWidth, effect.position.y);
          
          // Beam edges (divine light rays)
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(effect.position.x - beamWidth / 2, 0);
          ctx.lineTo(effect.position.x - beamWidth / 2, effect.position.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(effect.position.x + beamWidth / 2, 0);
          ctx.lineTo(effect.position.x + beamWidth / 2, effect.position.y);
          ctx.stroke();
          
          // Impact explosion waves
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 8;
          const radius1 = progress * 150;
          const radius2 = Math.max(0, progress - 0.2) * 150;
          const radius3 = Math.max(0, progress - 0.4) * 150;
          
          ctx.globalAlpha = alpha * (1.5 - progress);
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, radius1, 0, Math.PI * 2);
          ctx.stroke();
          
          if (radius2 > 0) {
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, radius2, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          if (radius3 > 0) {
            ctx.strokeStyle = '#fef3c7';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, radius3, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          // Central divine flash
          ctx.globalAlpha = alpha * (1 - progress) * 0.7;
          ctx.fillStyle = '#fffbeb';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, (1 - progress) * 70, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
        }
      } else if (character.class === 'Cook') {
        if (skill.type === 'basic') {
          // Wok Toss - SPINNING wok projectile with sizzle effect
          ctx.strokeStyle = '#ff6b35';
          ctx.fillStyle = '#ff6b35';
          ctx.lineWidth = 6;
          
          // Wok body with spinning animation
          const spinRotation = progress * Math.PI * 6;
          ctx.globalAlpha = alpha * (1.2 - progress * 0.4);
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, 25, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = alpha * 0.4;
          ctx.fill();
          ctx.globalAlpha = alpha;
          
          // Wok handle (spinning)
          ctx.lineWidth = 7;
          ctx.strokeStyle = '#d97706';
          const handleAngle = spinRotation;
          const handleX = Math.cos(handleAngle) * 32;
          const handleY = Math.sin(handleAngle) * 32;
          ctx.beginPath();
          ctx.moveTo(effect.position.x, effect.position.y);
          ctx.lineTo(effect.position.x + handleX, effect.position.y + handleY);
          ctx.stroke();
          
          // Sizzle particles
          for (let i = 0; i < 4; i++) {
            const particleAngle = handleAngle + (i * Math.PI / 2);
            const particleDistance = 35 + Math.sin(progress * Math.PI * 8 + i) * 8;
            const px = effect.position.x + Math.cos(particleAngle) * particleDistance;
            const py = effect.position.y + Math.sin(particleAngle) * particleDistance;
            ctx.globalAlpha = alpha * (0.7 - i * 0.15);
            ctx.fillStyle = i % 2 === 0 ? '#fbbf24' : '#ffa500';
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          
          // Motion trails
          ctx.strokeStyle = '#ffa500';
          ctx.lineWidth = 4;
          for (let i = 0; i < 5; i++) {
            const trailProgress = progress - (i * 0.1);
            if (trailProgress > 0) {
              const trailAlpha = (1 - trailProgress) * 0.6;
              const trailSize = 24 - (i * 2);
              ctx.globalAlpha = alpha * trailAlpha;
              ctx.beginPath();
              ctx.arc(effect.position.x - (i * 12), effect.position.y, trailSize, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = alpha;
        } else if (skill.type === 'heavy') {
          // Oil Splash - EXPLOSIVE oil burst with fiery droplets
          ctx.fillStyle = '#ffa500';
          ctx.strokeStyle = '#ff6b35';
          ctx.lineWidth = 4;
          const numDroplets = 18;
          for (let i = 0; i < numDroplets; i++) {
            const angle = (i / numDroplets) * Math.PI * 2 + (progress * Math.PI * 0.7);
            const distance = progress * 140;
            const wobble = Math.sin(progress * Math.PI * 4 + i) * 12;
            const dropletX = effect.position.x + Math.cos(angle) * (distance + wobble);
            const dropletY = effect.position.y + Math.sin(angle) * (distance + wobble);
            const dropletSize = 14 + Math.sin(progress * Math.PI * 3 + i) * 7;
            
            // Oil droplet body
            ctx.globalAlpha = alpha * (1 - progress * 0.4);
            ctx.beginPath();
            ctx.ellipse(dropletX, dropletY, dropletSize, dropletSize * 1.5, angle, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Droplet glow
            ctx.globalAlpha = alpha * 0.4;
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(dropletX, dropletY, dropletSize * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffa500';
            
            // Splash splatter on impact
            if (progress > 0.65) {
              const splashSize = (progress - 0.65) * 70;
              ctx.globalAlpha = alpha * 0.3;
              ctx.beginPath();
              ctx.arc(dropletX, dropletY, splashSize, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          
          // Central oil puddle with heat waves
          ctx.globalAlpha = alpha * 0.5;
          ctx.fillStyle = '#ffa500';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, progress * 110, 0, Math.PI * 2);
          ctx.fill();
          
          // Hot oil ring
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = '#ff6b35';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, progress * 140, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = alpha;
        } else {
          // Flaming Feast - REDESIGNED: Massive cooking explosion with fire rings and food burst
          ctx.strokeStyle = '#ff6b35';
          ctx.fillStyle = '#f97316';
          
          // Multiple explosive fire rings expanding outward
          const radius1 = progress * 175;
          const radius2 = Math.max(0, progress - 0.2) * 175;
          const radius3 = Math.max(0, progress - 0.4) * 175;
          
          // First fire ring (strongest)
          ctx.globalAlpha = alpha * (1.6 - progress * 0.7);
          ctx.strokeStyle = '#ff6b35';
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, radius1, 0, Math.PI * 2);
          ctx.stroke();
          
          if (radius2 > 0) {
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, radius2, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          if (radius3 > 0) {
            ctx.lineWidth = 6;
            ctx.strokeStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, radius3, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          // Flaming rays shooting outward
          const numRays = 16;
          ctx.strokeStyle = '#ff6b35';
          ctx.lineWidth = 7;
          for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2;
            const rayLength = progress * 160;
            ctx.globalAlpha = alpha * (1.4 - progress * 0.6);
            ctx.beginPath();
            ctx.moveTo(effect.position.x, effect.position.y);
            ctx.lineTo(
              effect.position.x + Math.cos(angle) * rayLength,
              effect.position.y + Math.sin(angle) * rayLength
            );
            ctx.stroke();
            // Orange trail
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 4;
            ctx.globalAlpha = alpha * 0.5;
            ctx.beginPath();
            ctx.moveTo(effect.position.x, effect.position.y);
            ctx.lineTo(
              effect.position.x + Math.cos(angle) * rayLength * 0.7,
              effect.position.y + Math.sin(angle) * rayLength * 0.7
            );
            ctx.stroke();
            ctx.strokeStyle = '#ff6b35';
          }
          
          // Food particles explosion (rice, meat, vegetables)
          ctx.fillStyle = '#fbbf24';
          const numFood = 24;
          for (let i = 0; i < numFood; i++) {
            const foodAngle = (i / numFood) * Math.PI * 2 + (progress * Math.PI * 0.5);
            const foodDistance = progress * 140 + Math.sin(progress * Math.PI * 3 + i) * 20;
            const foodX = effect.position.x + Math.cos(foodAngle) * foodDistance;
            const foodY = effect.position.y + Math.sin(foodAngle) * foodDistance;
            const foodSize = 8 + (i % 3) * 3;
            ctx.globalAlpha = alpha * (1.2 - progress * 0.7);
            
            // Different food colors
            if (i % 3 === 0) ctx.fillStyle = '#fbbf24'; // Rice/yellow
            else if (i % 3 === 1) ctx.fillStyle = '#ef4444'; // Meat/red
            else ctx.fillStyle = '#22c55e'; // Veggies/green
            
            ctx.beginPath();
            ctx.arc(foodX, foodY, foodSize, 0, Math.PI * 2);
            ctx.fill();
          }
          
          // Central cooking explosion flash
          ctx.globalAlpha = alpha * (1 - progress) * 0.8;
          ctx.fillStyle = '#fee2e2';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, (1 - progress) * 80, 0, Math.PI * 2);
          ctx.fill();
          
          // Inner fire core
          ctx.globalAlpha = alpha * 0.6;
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, progress * 100, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.globalAlpha = alpha;
        }
      }
      
      ctx.globalAlpha = 1;
    }

    // Render HP bars
    for (const bar of state.hpBars) {
      const hpPercent = bar.currentHp / bar.maxHp;

      // Background
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(bar.position.x, bar.position.y, bar.width, bar.height);

      // HP fill
      ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(bar.position.x, bar.position.y, bar.width * hpPercent, bar.height);

      // Border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bar.position.x, bar.position.y, bar.width, bar.height);
    }

    // Render damage numbers
    for (const dn of state.damageNumbers) {
      const elapsed = currentTime - dn.startTime;
      const progress = Math.min(elapsed / 1000, 1);
      const y = dn.position.y - progress * 30;
      const alpha = 1 - progress;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = dn.color;
      ctx.font = dn.isMiss ? '24px bold sans-serif' : '20px bold sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        dn.isMiss ? 'MISS' : dn.value.toString(),
        dn.position.x,
        y
      );
      ctx.globalAlpha = 1;
    }
    
    // Render boss skill effects
    for (const effect of state.bossSkillEffects) {
      const elapsed = currentTime - effect.startTime;
      const progress = Math.min(elapsed / effect.duration, 1);
      const alpha = 1 - progress * 0.7; // Fade out slower
      
      ctx.globalAlpha = alpha;
      
      switch (effect.skillType) {
        case 'fire_breath':
          // Fire breath cone
          ctx.fillStyle = '#f97316';
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 4;
          
          // Cone from boss toward target
          if (effect.targetPosition) {
            const dx = effect.targetPosition.x - effect.position.x;
            const dy = effect.targetPosition.y - effect.position.y;
            const angle = Math.atan2(dy, dx);
            const distance = progress * 200;
            
            // Draw flame cone
            ctx.beginPath();
            ctx.moveTo(effect.position.x, effect.position.y);
            ctx.lineTo(
              effect.position.x + Math.cos(angle - 0.4) * distance,
              effect.position.y + Math.sin(angle - 0.4) * distance
            );
            ctx.lineTo(
              effect.position.x + Math.cos(angle + 0.4) * distance,
              effect.position.y + Math.sin(angle + 0.4) * distance
            );
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Fire particles
            for (let i = 0; i < 8; i++) {
              const particleAngle = angle + (Math.random() - 0.5) * 0.8;
              const particleDist = progress * (180 + Math.random() * 40);
              const px = effect.position.x + Math.cos(particleAngle) * particleDist;
              const py = effect.position.y + Math.sin(particleAngle) * particleDist;
              ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#fbbf24';
              ctx.beginPath();
              ctx.arc(px, py, 6, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
          
        case 'ice_prison':
          // Ice crystal prison
          ctx.strokeStyle = '#60a5fa';
          ctx.fillStyle = '#3b82f6';
          ctx.lineWidth = 3;
          
          if (effect.targetPosition) {
            // Ice crystals forming around target
            const numCrystals = 8;
            const radius = 60 + progress * 20;
            for (let i = 0; i < numCrystals; i++) {
              const angle = (i / numCrystals) * Math.PI * 2 + progress * Math.PI;
              const cx = effect.targetPosition.x + Math.cos(angle) * radius;
              const cy = effect.targetPosition.y + Math.sin(angle) * radius;
              
              // Ice crystal shape
              ctx.beginPath();
              ctx.moveTo(cx, cy - 25);
              ctx.lineTo(cx + 10, cy);
              ctx.lineTo(cx, cy + 15);
              ctx.lineTo(cx - 10, cy);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }
            
            // Center ice burst
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(effect.targetPosition.x, effect.targetPosition.y, progress * 80, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
          
        case 'shadow_clone':
          // Shadow trail and teleport effect
          ctx.fillStyle = '#8b5cf6';
          ctx.strokeStyle = '#6d28d9';
          ctx.lineWidth = 3;
          
          // Shadow trail from old position to new
          if (effect.targetPosition && progress < 0.5) {
            const trailProgress = progress / 0.5;
            const numShadows = 10;
            for (let i = 0; i < numShadows; i++) {
              const t = (i / numShadows) * trailProgress;
              const sx = effect.position.x + (effect.targetPosition.x - effect.position.x) * t;
              const sy = effect.position.y + (effect.targetPosition.y - effect.position.y) * t;
              const shadowAlpha = 1 - (i / numShadows);
              ctx.globalAlpha = alpha * shadowAlpha * 0.6;
              ctx.beginPath();
              ctx.arc(sx, sy, 40, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = alpha;
          }
          
          // Explosion at destination
          if (progress >= 0.5 && effect.targetPosition) {
            const explosionProgress = (progress - 0.5) / 0.5;
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 4;
            const explosionRadius = explosionProgress * 100;
            ctx.beginPath();
            ctx.arc(effect.targetPosition.x, effect.targetPosition.y, explosionRadius, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
          
        case 'arcane_missiles':
          // Multiple arcane missiles
          ctx.fillStyle = '#a855f7';
          ctx.strokeStyle = '#9333ea';
          ctx.lineWidth = 3;
          
          if (effect.targetPosition) {
            const numMissiles = 5;
            for (let i = 0; i < numMissiles; i++) {
              const missileProgress = Math.max(0, progress - (i * 0.1));
              const mx = effect.position.x + (effect.targetPosition.x - effect.position.x) * missileProgress;
              const my = effect.position.y + (effect.targetPosition.y - effect.position.y) * missileProgress + Math.sin(missileProgress * Math.PI * 4) * 20;
              
              // Missile
              ctx.beginPath();
              ctx.arc(mx, my, 10, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              
              // Trail
              ctx.strokeStyle = '#c084fc';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(mx - 20, my);
              ctx.lineTo(mx, my);
              ctx.stroke();
            }
          }
          break;
          
        case 'earthquake':
          // Ground shockwaves
          ctx.strokeStyle = '#92400e';
          ctx.fillStyle = '#78350f';
          ctx.lineWidth = 5;
          
          // Multiple shockwave rings
          const numRings = 4;
          for (let i = 0; i < numRings; i++) {
            const ringProgress = Math.max(0, progress - (i * 0.15));
            const ringRadius = ringProgress * 300;
            ctx.globalAlpha = alpha * (1 - ringProgress) * 0.8;
            ctx.beginPath();
            ctx.arc(effect.position.x, effect.position.y, ringRadius, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.globalAlpha = alpha;
          
          // Ground cracks
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 3;
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const length = progress * 150;
            ctx.beginPath();
            ctx.moveTo(effect.position.x, effect.position.y);
            ctx.lineTo(
              effect.position.x + Math.cos(angle) * length,
              effect.position.y + Math.sin(angle) * length
            );
            ctx.stroke();
          }
          break;
          
        case 'heal':
          // Healing green particles
          ctx.fillStyle = '#22c55e';
          ctx.strokeStyle = '#16a34a';
          ctx.lineWidth = 2;
          
          // Upward healing particles
          const numParticles = 20;
          for (let i = 0; i < numParticles; i++) {
            const particleProgress = (progress + (i * 0.05)) % 1;
            const angle = (i / numParticles) * Math.PI * 2;
            const radius = 40 + Math.sin(particleProgress * Math.PI) * 30;
            const px = effect.position.x + Math.cos(angle) * radius;
            const py = effect.position.y - particleProgress * 100;
            const size = 8 + Math.sin(particleProgress * Math.PI) * 4;
            
            ctx.globalAlpha = alpha * (1 - particleProgress);
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.globalAlpha = alpha;
          
          // Healing aura
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, progress * 80, 0, Math.PI * 2);
          ctx.stroke();
          break;
          
        case 'enrage':
          // Red angry aura
          ctx.strokeStyle = '#dc2626';
          ctx.fillStyle = '#ef4444';
          ctx.lineWidth = 5;
          
          // Pulsing red aura
          const pulseSize = 80 + Math.sin(progress * Math.PI * 8) * 20;
          ctx.globalAlpha = alpha * 0.3;
          ctx.beginPath();
          ctx.arc(effect.position.x, effect.position.y, pulseSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
          
          // Energy spikes
          ctx.strokeStyle = '#dc2626';
          ctx.lineWidth = 4;
          const numSpikes = 12;
          for (let i = 0; i < numSpikes; i++) {
            const spikeAngle = (i / numSpikes) * Math.PI * 2 + progress * Math.PI * 4;
            const spikeLength = 60 + Math.sin(progress * Math.PI * 6 + i) * 30;
            ctx.beginPath();
            ctx.moveTo(effect.position.x, effect.position.y);
            ctx.lineTo(
              effect.position.x + Math.cos(spikeAngle) * spikeLength,
              effect.position.y + Math.sin(spikeAngle) * spikeLength
            );
            ctx.stroke();
          }
          break;
      }
      
      ctx.globalAlpha = 1;
    }
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border border-gray-700 bg-black mx-auto"
        style={{
          maxWidth: '100%',
          height: 'auto',
        }}
      />
      {/* FPS Counter */}
      <div className="absolute top-2 left-2 text-white text-sm bg-black/50 px-2 py-1 rounded">
        FPS: {fps}
      </div>
    </div>
  );
}
