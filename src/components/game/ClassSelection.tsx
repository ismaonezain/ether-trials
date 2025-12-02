'use client';

import { useState } from 'react';
import type { CharacterClass, ElementType } from '@/types/game';
import { CLASS_CONFIGS, ELEMENT_CONFIGS } from '@/lib/game/constants';
import { getClassName, ELEMENT_BUFF_DETAILS } from '@/lib/game/classNames';
import { getSynergyBonus } from '@/lib/game/synergies';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ClassSelectionProps {
  onConfirm: (characterClass: CharacterClass, element: ElementType) => void;
  onBack?: () => void;
}

export function ClassSelection({ onConfirm, onBack }: ClassSelectionProps): JSX.Element {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementType | null>(null);

  const canConfirm = selectedClass && selectedElement;
  
  const synergy = selectedClass && selectedElement ? getSynergyBonus(selectedClass, selectedElement) : null;
  
  const classIcons: Record<CharacterClass, string> = {
    Warrior: '⚔️',
    Mage: '🔮',
    Ranger: '🏹',
    Assassin: '🗡️',
    Paladin: '🛡️',
    Cook: '🍳',
  };
  
  const comingSoonClasses: CharacterClass[] = [];
  const newClasses: CharacterClass[] = ['Cook'];
  
  const elementIcons: Record<ElementType, string> = {
    Fire: '🔥',
    Water: '💧',
    Earth: '🌍',
    Wind: '💨',
    Dark: '🌑',
    Holy: '✨',
  };

  const classDescriptions: Record<CharacterClass, string> = {
    Warrior: 'Tank with high HP and lifesteal. Balanced melee fighter.',
    Mage: 'Glass cannon with powerful magic attacks and range.',
    Ranger: 'Swift archer with high evade and consistent damage.',
    Assassin: 'High risk, high reward. Maximum evade and lifesteal.',
    Paladin: 'Holy defender with exceptional healing and durability.',
    Cook: 'Versatile support with unique buffs and sustain.',
  };

  const elementDescriptions: Record<ElementType, string> = {
    Fire: 'Explosive damage with burning passion. High risk, high reward.',
    Water: 'Balanced approach with consistent flow and healing.',
    Earth: 'Maximum defense and stability. Immovable force.',
    Wind: 'Swift and agile. Strike fast, dodge faster.',
    Dark: 'Shadow assassin. Critical strikes from the darkness.',
    Holy: 'Divine protection and radiant healing power.',
  };

  const handleClassSelect = (cls: CharacterClass) => {
    setSelectedClass(cls);
    setStep(2);
  };

  const handleElementSelect = (element: ElementType) => {
    setSelectedElement(element);
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 1 && onBack) onBack();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-black flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md sm:max-w-xl lg:max-w-2xl">
        <Card className="fantasy-card">
          <CardHeader className="pb-4 pt-6 sm:pb-6 sm:pt-8 border-b border-yellow-600/50">
            <CardTitle className="text-2xl sm:text-3xl lg:text-4xl text-center fantasy-title glow-text bg-gradient-to-r from-yellow-400 via-red-500 to-purple-600 bg-clip-text text-transparent">
              {step === 1 && '🏰 Select Your Class'}
              {step === 2 && '✨ Choose Element'}
            </CardTitle>
            <div className="flex justify-center gap-2 mt-4">
              <div className={`w-12 h-1.5 rounded ${step >= 1 ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50' : 'bg-gray-700'}`} />
              <div className={`w-12 h-1.5 rounded ${step >= 2 ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50' : 'bg-gray-700'}`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pb-6 pt-6">
            {/* STEP 1: Class Selection */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center text-gray-300 text-xs mb-3">
                  Each class has unique strengths and playstyles
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(CLASS_CONFIGS).map((config) => {
                    const isComingSoon = comingSoonClasses.includes(config.name);
                    const isNew = newClasses.includes(config.name);
                    return (
                      <button
                        key={config.name}
                        onClick={() => !isComingSoon && handleClassSelect(config.name)}
                        disabled={isComingSoon}
                        className={`relative p-3 rounded-xl border-2 transition-all font-bold overflow-hidden ${
                          isComingSoon
                            ? 'border-gray-700 bg-black/70 cursor-not-allowed opacity-60'
                            : selectedClass === config.name
                            ? 'border-yellow-400 bg-gradient-to-br from-purple-900 to-red-900 shadow-2xl shadow-yellow-500/50 scale-105'
                            : 'border-yellow-600/40 bg-gradient-to-br from-black/80 to-purple-900/30 hover:border-yellow-500 hover:shadow-xl hover:shadow-yellow-500/30 hover:scale-105'
                        }`}
                      >
                        {isComingSoon && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-2xl z-10">
                            <span className="text-xs font-bold text-purple-400 bg-purple-900/90 px-3 py-2 rounded-lg border border-purple-500">
                              COMING SOON
                            </span>
                          </div>
                        )}
                        {isNew && (
                          <div className="absolute top-2 right-2 z-10">
                            <span className="text-[10px] font-bold text-green-300 bg-green-900/90 px-2 py-1 rounded border border-green-400 shadow-lg shadow-green-500/50 animate-pulse">
                              NEW
                            </span>
                          </div>
                        )}
                        <div className="relative">
                          <div className="text-3xl mb-1">{classIcons[config.name]}</div>
                          <div className="text-yellow-300 font-bold text-sm mb-0.5">{config.name}</div>
                          <div className="text-red-400 text-xs font-medium mb-1">{config.baseHp} HP</div>
                          <div className="text-gray-300 text-[10px] leading-relaxed">
                            {classDescriptions[config.name]}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  className="w-full border-yellow-600 text-yellow-300 hover:bg-purple-900/50 bg-black/30 h-12"
                  onClick={handleBack}
                >
                  ← Back
                </Button>
              </div>
            )}

            {/* STEP 2: Element Selection */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center text-gray-300 text-xs mb-3">
                  Choose an element to define your combat style
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(ELEMENT_CONFIGS).map((config) => (
                    <button
                      key={config.name}
                      onClick={() => handleElementSelect(config.name)}
                      className={`relative p-3 rounded-xl border-2 transition-all font-bold overflow-hidden ${
                        selectedElement === config.name
                          ? 'border-blue-400 bg-gradient-to-br from-blue-900 to-purple-900 shadow-2xl shadow-blue-500/50 scale-105'
                          : 'border-blue-600/40 bg-gradient-to-br from-black/80 to-blue-900/30 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105'
                      }`}
                    >
                      <div className="relative">
                        <div className="text-3xl mb-1">{elementIcons[config.name]}</div>
                        <div className="text-blue-300 font-bold text-sm mb-0.5">{config.name}</div>
                        <div className="text-purple-400 text-xs font-medium mb-1">×{config.damageMultiplier} DMG</div>
                        <div className="text-gray-300 text-[10px] leading-relaxed">
                          {elementDescriptions[config.name]}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Class Name & Synergy Display */}
                {selectedClass && selectedElement && (
                  <div className="bg-gradient-to-r from-purple-900/80 to-blue-900/80 p-3 rounded-xl border-2 border-yellow-500/50 shadow-lg">
                    <div className="text-center">
                      <div className="text-2xl mb-1">{synergy?.icon || '⚔️'}</div>
                      <div className="text-yellow-300 font-bold text-lg mb-1">{getClassName(selectedClass, selectedElement)}</div>
                      {synergy && <div className="text-gray-200 text-xs leading-relaxed">{synergy.description}</div>}
                    </div>
                  </div>
                )}

                {/* Character Stats Preview */}
                {selectedClass && selectedElement && (() => {
                  const classConfig = CLASS_CONFIGS[selectedClass];
                  const elementConfig = ELEMENT_CONFIGS[selectedElement];
                  
                  const baseAttack = classConfig.skills[0].baseDamage;
                  const attack = Math.round(baseAttack * elementConfig.damageMultiplier);
                  const defense = selectedElement === 'Earth' ? 15 : 5;
                  const critChance = selectedElement === 'Dark' ? 25 : 15;
                  
                  const evadeChances: Record<string, number> = {
                    'Assassin': 50,
                    'Ranger': 50,
                    'Cook': 38,
                    'Mage': 32,
                    'Warrior': 30,
                    'Paladin': 28,
                  };
                  
                  const lifestealRanges: Record<string, string> = {
                    'Warrior': '6-10%',
                    'Mage': '4-8%',
                    'Ranger': '5-9%',
                    'Assassin': '9-17%',
                    'Paladin': '11-19%',
                    'Cook': '7-12%',
                  };
                  
                  return (
                    <div className="bg-gradient-to-br from-indigo-900/80 to-black/80 p-3 rounded-xl border-2 border-indigo-500/50 shadow-lg">
                      <div className="text-yellow-300 text-xs mb-2 font-bold text-center">📊 CHARACTER STATS</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-black/30 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">HP</div>
                          <div className="text-red-400 font-bold text-sm">{classConfig.baseHp}</div>
                        </div>
                        
                        <div className="bg-black/30 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">Attack</div>
                          <div className="text-orange-400 font-bold text-sm">{attack}</div>
                        </div>
                        
                        <div className="bg-black/30 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">Defense</div>
                          <div className="text-blue-400 font-bold text-sm">{defense}</div>
                        </div>
                        
                        <div className="bg-black/30 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">Crit Chance</div>
                          <div className="text-yellow-400 font-bold text-sm">{critChance}%</div>
                        </div>
                        
                        <div className="bg-black/30 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">Evade</div>
                          <div className="text-purple-400 font-bold text-sm">{evadeChances[selectedClass] || 30}%</div>
                        </div>
                        
                        <div className="bg-black/30 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">Lifesteal</div>
                          <div className="text-green-400 font-bold text-sm">{lifestealRanges[selectedClass]}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="border-yellow-600 text-yellow-300 hover:bg-purple-900/50 bg-black/30 h-12"
                  >
                    ← Back
                  </Button>
                  <Button
                    size="lg"
                    className="fantasy-button font-bold text-white border-0 h-12 text-lg"
                    disabled={!canConfirm}
                    onClick={() => {
                      if (selectedClass && selectedElement) {
                        onConfirm(selectedClass, selectedElement);
                      }
                    }}
                  >
                    {synergy ? `⚔️ Begin Journey` : 'Start'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
