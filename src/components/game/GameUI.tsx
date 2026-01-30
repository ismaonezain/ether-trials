kono
  'use client';

import { useState, useEffect } from 'react';
import type { GameState } from '@/types/game';
import { formatTime, formatNumber } from '@/lib/game/utils';
import { canUseSkill } from '@/lib/game/character';
import { Button } from '@/components/ui/button';
import { Home, Zap } from 'lucide-react';

interface GameUIProps {
  gameState: GameState;
  onBackToMenu?: () => void;
  gameSpeed?: number;
  setGameSpeed?: (speed: number) => void;
}

export function GameUI({ gameState, onBackToMenu, gameSpeed = 1, setGameSpeed }: GameUIProps): JSX.Element {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const elapsedTime = Math.floor((currentTime - gameState.startTime) / 1000);
  
  if (!gameState.character) return <></>;

  return (
    <div className="w-full max-w-md mx-auto space-y-1 p-1">
      {/* Top Controls - Minimal */}
      <div className="flex justify-between items-center gap-1">
        {setGameSpeed && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const speeds = [1, 3, 5];
              const currentIndex = speeds.indexOf(gameSpeed);
              const nextIndex = (currentIndex + 1) % speeds.length;
              setGameSpeed(speeds[nextIndex]);
            }}
            className="text-[9px] gap-0.5 h-5 px-1.5 bg-gray-900/70 border border-gray-600 hover:bg-gray-800 text-gray-300"
          >
            <Zap className="w-2 h-2" />
            {gameSpeed}x
          </Button>
        )}
        
        {onBackToMenu && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToMenu}
            className="text-[9px] gap-0.5 h-5 px-1.5 border border-red-600 text-red-300 hover:bg-red-900/40 bg-black/40"
          >
            <Home className="w-2 h-2" />
            Menu
          </Button>
        )}
      </div>
      
      {/* Compact Stats */}
      <div className="bg-gray-900/70 rounded p-1 border border-gray-600/40">
        <div className="grid grid-cols-4 gap-0.5 text-center text-[9px]">
          <div>
            <div className="text-gray-400">Stage</div>
            <div className="text-white font-bold">{gameState.stage.stageNumber}</div>
          </div>
          <div>
            <div className="text-gray-400">Wave</div>
            <div className="text-white font-bold">
              {gameState.stage.currentWave + 1}/{gameState.stage.waves.length}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Score</div>
            <div className="text-white font-bold">{formatNumber(gameState.score)}</div>
          </div>
          <div>
            <div className="text-gray-400">Time</div>
            <div className="text-white font-bold">{formatTime(elapsedTime)}</div>
          </div>
        </div>
      </div>

      {/* HP Bar - Minimal */}
      <div className="bg-red-900/70 rounded p-1 border border-red-600/40">
        <div className="flex justify-between mb-0.5 text-[9px]">
          <span className="text-gray-300">{gameState.character.class}</span>
          <span className="text-white">
            {gameState.character.hp}/{gameState.character.maxHp}
          </span>
        </div>
        <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-red-600 transition-all duration-300"
            style={{ width: `${(gameState.character.hp / gameState.character.maxHp) * 100}%` }}
          />
        </div>
        
        {/* Mage Shield - Minimal */}
        {gameState.character.class === 'Mage' && gameState.character.shieldHp !== undefined && gameState.character.shieldHp > 0 && (
          <div className="mt-0.5">
            <div className="flex justify-between text-[8px]">
              <span className="text-blue-300">Shield</span>
              <span className="text-cyan-300">{gameState.character.shieldHp}</span>
            </div>
            <div className="w-full bg-black/40 rounded-full h-1 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ 
                  width: `${(gameState.character.shieldHp / (gameState.character.maxHp * 0.25)) * 100}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Skills - Minimal */}
      <div className="bg-gray-900/70 rounded p-1 border border-gray-600/40">
        <div className="text-gray-300 text-[9px] mb-0.5">Skills</div>
        <div className="space-y-0.5">
          {gameState.character.skills.map((skill) => {
            const available = canUseSkill(skill, currentTime, gameSpeed);
            const effectiveCooldown = skill.cooldown / gameSpeed;
            const cooldownProgress = available
              ? 100
              : ((currentTime - skill.lastUsed) / effectiveCooldown) * 100;

            return (
              <div key={skill.id}>
                <div className="flex justify-between text-[8px]">
                  <span className="text-gray-200">{skill.name}</span>
                  <span className={available ? 'text-green-400' : 'text-gray-500'}>
                    {available ? 'RDY' : `${Math.ceil((effectiveCooldown - (currentTime - skill.lastUsed)) / 1000)}s`}
                  </span>
                </div>
                <div className="w-full bg-black/40 rounded-full h-0.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${cooldownProgress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cook Mode - Minimal */}
      {gameState.character.class === 'Cook' && gameState.character.cookMode && (
        <div className={`rounded p-1 border text-center text-[8px] ${
          gameState.character.cookMode === 'heal'
            ? 'bg-green-900/70 border-green-600/40 text-green-300'
            : 'bg-red-900/70 border-red-600/40 text-red-300'
        }`}>
          {gameState.character.cookMode === 'heal' ? 'HEAL +80%' : 'DMG +50%'}
        </div>
      )}

      {/* Bonus Stats - Minimal */}
      {gameState.bonusStats && gameState.bonusStats.length > 0 && (
        <div className="bg-green-900/70 rounded p-1 border border-green-500/40">
          <div className="text-green-300 text-[8px] mb-0.5">Bonuses</div>
          <div className="grid grid-cols-3 gap-0.5 text-center text-[8px]">
            {gameState.bonusStats.slice(0, 6).map((stat, index) => (
              <div key={index} className="bg-black/20 rounded px-0.5">
                <span>{stat.icon}</span> +{stat.value}%
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Boss Warning - Minimal */}
      {gameState.stage.isBoss && (
        <div className="bg-red-900/70 rounded p-1 border border-red-500 text-center text-[9px] text-white animate-pulse">
          ⚠️ BOSS
        </div>
      )}
    </div>
  );
}
