okj
  'use client';

import { useState } from 'react';
import type { CharacterClass, ElementType } from '@/types/game';
import { CLASS_CONFIGS, ELEMENT_CONFIGS } from '@/lib/game/constants';
import { getClassName, ELEMENT_BUFF_DETAILS } from '@/lib/game/classNames';
import { getSynergyBonus } from '@/lib/game/synergies';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JOB_IMAGES } from '@/lib/game/jobImages';

interface ClassSelectionProps {
  onConfirm: (characterClass: CharacterClass, element: ElementType) => void;
  onBack?: () => void;
}

export function ClassSelection({ onConfirm, onBack }: ClassSelectionProps): JSX.Element {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedClass, setSelectedClass] = useState<CharacterClass | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementType | null>(null);
  const [detailClass, setDetailClass] = useState<CharacterClass | null>(null);

  const canConfirm = selectedClass && selectedElement;
  
  const synergy = selectedClass && selectedElement ? getSynergyBonus(selectedClass, selectedElement) : null;
  
  const comingSoonClasses: CharacterClass[] = [];
  const newClasses: CharacterClass[] = ['Cook'];

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

  // Get class-specific special abilities
  const getClassSpecialAbilities = (className: CharacterClass): string[] => {
    const abilities: Record<CharacterClass, string[]> = {
      Warrior: ['5% HP Regen/2s', '8% Damage Reduction'],
      Mage: ['Shield 25% HP/8s', '8% Damage Reduction'],
      Ranger: ['Evasive Dash', '8% Damage Reduction'],
      Assassin: ['12% Execute Chance', '8% Damage Reduction'],
      Paladin: ['5% HP Regen/1.5s', '10% Damage Reduction', '200-600% Damage Reflection'],
      Cook: ['Mode Switch (1.8x DMG or 2.2x Lifesteal)', '4% HP Regen/1.5s', '8% Damage Reduction'],
    };
    return abilities[className] || [];
  };

  // Get class defense percent
  const getClassDefense = (className: CharacterClass): number => {
    return className === 'Paladin' ? 10 : 8;
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md sm:max-w-xl lg:max-w-5xl">
        <Card className="fantasy-card">
          <CardHeader className="pb-4 pt-6 sm:pb-6 sm:pt-8 border-b border-yellow-600/50">
            <CardTitle className="text-2xl sm:text-3xl lg:text-4xl text-center fantasy-title">
              {step === 1 && 'Select Your Class'}
              {step === 2 && 'Choose Element'}
            </CardTitle>
            <div className="flex justify-center gap-2 mt-4">
              <div className={`w-12 h-1.5 rounded ${step >= 1 ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50' : 'bg-gray-700'}`} />
              <div className={`w-12 h-1.5 rounded ${step >= 2 ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50' : 'bg-gray-700'}`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pb-6 pt-6">
            {/* STEP 1: Class Selection - Image Focused */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center text-gray-300 text-xs mb-3">
                  Each class has unique strengths and playstyles
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.values(CLASS_CONFIGS).map((config) => {
                    const isComingSoon = comingSoonClasses.includes(config.name);
                    const isNew = newClasses.includes(config.name);
                    
                    return (
                      <button
                        key={config.name}
                        onClick={() => !isComingSoon && handleClassSelect(config.name)}
                        disabled={isComingSoon}
                        className={`relative aspect-[3/4] rounded-xl border-2 transition-all overflow-hidden ${
                          isComingSoon
                            ? 'border-gray-700 cursor-not-allowed opacity-60'
                            : selectedClass === config.name
                            ? 'border-yellow-500 shadow-lg shadow-yellow-500/50 scale-105'
                            : 'border-gray-700 hover:border-yellow-600 hover:shadow-lg hover:scale-105'
                        }`}
                      >
                        {/* Background Image - Full visibility */}
                        <div 
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ backgroundImage: `url(${JOB_IMAGES[config.name]})` }}
                        />
                        
                        {/* Bottom gradient for name readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                        {isComingSoon && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
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

                        {/* Info button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailClass(config.name);
                          }}
                          className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-black/70 border border-yellow-500/50 flex items-center justify-center hover:bg-yellow-900/50 transition-colors"
                        >
                          <span className="text-yellow-300 text-sm font-bold">?</span>
                        </button>
                        
                        {/* Class name at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
                          <div className="text-yellow-300 font-bold text-lg text-center drop-shadow-lg">
                            {config.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  className="w-full border-yellow-600 text-yellow-300 hover:bg-gray-800 bg-black/30 h-12"
                  onClick={handleBack}
                >
                  ← Back
                </Button>
              </div>
            )}

            {/* STEP 2: Element Selection with Detailed Final Stats */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center text-gray-300 text-xs mb-3">
                  Choose an element to define your combat style
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(ELEMENT_CONFIGS).map((config) => {
                    const buffDetails = ELEMENT_BUFF_DETAILS[config.name];
                    return (
                    <button
                      key={config.name}
                      onClick={() => handleElementSelect(config.name)}
                      className={`relative p-3 rounded-xl border-2 transition-all font-bold overflow-hidden ${
                        selectedElement === config.name
                          ? 'border-blue-500 bg-gray-800 shadow-lg shadow-blue-500/70 scale-105 portal-glow'
                          : 'border-gray-700 bg-gray-900 hover:border-gray-600 hover:shadow-lg hover:scale-105'
                      }`}
                    >
                      <div className="relative">
                        <div className="text-blue-300 font-bold text-base mb-0.5">{config.name}</div>
                        <div className="text-purple-400 text-xs font-medium mb-1">×{config.damageMultiplier} DMG</div>
                        {/* Element Special Effects */}
                        <div className="bg-black/30 p-1.5 rounded border border-blue-500/30 mb-1">
                          <div className="text-yellow-300 text-[9px] font-bold mb-0.5">Special Effects:</div>
                          <div className="text-green-300 text-[8px] leading-tight">{buffDetails.primaryEffect}</div>
                          <div className="text-cyan-300 text-[8px] leading-tight">{buffDetails.secondaryEffect}</div>
                        </div>
                        <div className="text-gray-300 text-[10px] leading-relaxed">
                          {elementDescriptions[config.name]}
                        </div>
                      </div>
                    </button>
                  );})}</div>

                {/* Class Name & Synergy Display */}
                {selectedClass && selectedElement && (
                  <div className="bg-gray-800 p-3 rounded-xl border-2 border-gray-700 shadow-lg">
                    <div className="text-center">
                      <div className="text-yellow-300 font-bold text-lg mb-1">{getClassName(selectedClass, selectedElement)}</div>
                      {synergy && <div className="text-gray-200 text-xs leading-relaxed">{synergy.description}</div>}
                    </div>
                  </div>
                )}

                {/* DETAILED Character Stats Preview with Element Modifiers */}
                {selectedClass && selectedElement && (() => {
                  const classConfig = CLASS_CONFIGS[selectedClass];
                  const elementConfig = ELEMENT_CONFIGS[selectedElement];
                  
                  // Calculate final stats with element modifiers
                  const baseAttack = classConfig.skills[0].baseDamage;
                  const elementMultipliedAttack = Math.round(baseAttack * elementConfig.damageMultiplier);
                  const flatBonus = elementConfig.flatDamageBonus || 0;
                  const finalAttack = elementMultipliedAttack + flatBonus;
                  
                  // Defense calculation (base class defense + element bonus)
                  const classDefense = getClassDefense(selectedClass);
                  const elementDefenseBonus = (elementConfig.defenseBonus || 0) * 100;
                  const totalDefense = classDefense + elementDefenseBonus;
                  
                  // Crit chance (base 15%, Dark element gets +10% = 25%)
                  const baseCritChance = 15;
                  const critChance = selectedElement === 'Dark' ? 25 : baseCritChance;
                  
                  // Evade chances per class
                  const evadeChances: Record<string, number> = {
                    'Assassin': 50,
                    'Ranger': 50,
                    'Cook': 38,
                    'Mage': 32,
                    'Warrior': 30,
                    'Paladin': 28,
                  };
                  const baseEvade = evadeChances[selectedClass] || 30;
                  const windEvadeBonus = selectedElement === 'Wind' ? 30 : 0;
                  const finalEvade = baseEvade + windEvadeBonus;
                  
                  // Lifesteal calculation
                  const lifestealRanges: Record<string, { min: number; max: number }> = {
                    'Warrior': { min: 6, max: 10 },
                    'Mage': { min: 4, max: 8 },
                    'Ranger': { min: 5, max: 9 },
                    'Assassin': { min: 9, max: 17 },
                    'Paladin': { min: 11, max: 19 },
                    'Cook': { min: 7, max: 12 },
                  };
                  const baseLifesteal = lifestealRanges[selectedClass] || { min: 5, max: 10 };
                  const lifestealBonus = (elementConfig.lifestealBonus || 0) * 100;
                  const finalLifestealMin = baseLifesteal.min + lifestealBonus;
                  const finalLifestealMax = baseLifesteal.max + lifestealBonus;
                  
                  // Regen calculation
                  const elementRegenBonus = (elementConfig.regenBonus || 0) * 100;
                  
                  // Cooldown reduction
                  const cooldownReduction = selectedElement === 'Wind' ? 30 : 0;
                  
                  return (
                    <div className="bg-gray-800 p-4 rounded-xl border-2 border-yellow-600 shadow-lg">
                      <div className="text-yellow-300 text-sm mb-3 font-bold text-center">FINAL CHARACTER STATS</div>
                      
                      {/* Primary Stats */}
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="bg-black/40 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">HP</div>
                          <div className="text-red-400 font-bold text-sm">{classConfig.baseHp}</div>
                        </div>
                        
                        <div className="bg-black/40 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">Attack (Basic)</div>
                          <div className="text-orange-400 font-bold text-sm">
                            {finalAttack}
                            <span className="text-[9px] text-gray-400 ml-1">
                              ({baseAttack}×{elementConfig.damageMultiplier}+{flatBonus})
                            </span>
                          </div>
                        </div>
                        
                        <div className="bg-black/40 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">Defense</div>
                          <div className="text-blue-400 font-bold text-sm">
                            {totalDefense}%
                            {elementDefenseBonus > 0 && (
                              <span className="text-[9px] text-green-400 ml-1">
                                (+{elementDefenseBonus}%)
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-black/40 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">Crit Chance</div>
                          <div className="text-yellow-400 font-bold text-sm">
                            {critChance}%
                            {selectedElement === 'Dark' && (
                              <span className="text-[9px] text-green-400 ml-1">(+10%)</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-black/40 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">Evade Chance</div>
                          <div className="text-purple-400 font-bold text-sm">
                            {finalEvade}%
                            {windEvadeBonus > 0 && (
                              <span className="text-[9px] text-green-400 ml-1">(+{windEvadeBonus}%)</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="bg-black/40 p-2 rounded border border-gray-700">
                          <div className="text-gray-400 text-[10px] mb-0.5">Lifesteal</div>
                          <div className="text-green-400 font-bold text-sm">
                            {finalLifestealMin.toFixed(0)}-{finalLifestealMax.toFixed(0)}%
                            {lifestealBonus > 0 && (
                              <span className="text-[9px] text-green-400 ml-1">(+{lifestealBonus}%)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Secondary Stats & Bonuses */}
                      {(elementRegenBonus > 0 || cooldownReduction > 0) && (
                        <div className="bg-black/40 p-2 rounded border border-green-600/50 mb-3">
                          <div className="text-green-300 text-[10px] font-bold mb-1.5">ELEMENT BONUSES</div>
                          <div className="space-y-1 text-[9px]">
                            {elementRegenBonus > 0 && (
                              <div className="text-cyan-300">HP Regen: +{elementRegenBonus}%/sec</div>
                            )}
                            {cooldownReduction > 0 && (
                              <div className="text-cyan-300">Cooldown: -{cooldownReduction}%</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Class Special Abilities */}
                      <div className="bg-black/40 p-2 rounded border border-purple-600/50">
                        <div className="text-purple-300 text-[10px] font-bold mb-1.5">CLASS ABILITIES</div>
                        <div className="space-y-0.5 text-[9px]">
                          {getClassSpecialAbilities(selectedClass).map((ability, idx) => (
                            <div key={idx} className="text-cyan-300">
                              • {ability}
                            </div>
                          ))}
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
                    className="border-yellow-600 text-yellow-300 hover:bg-gray-800 bg-black/30 h-12"
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
                    Begin Journey
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      {detailClass && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailClass(null)}
        >
          <div 
            className="bg-gray-900 border-2 border-yellow-600 rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const config = CLASS_CONFIGS[detailClass];
              const classDefense = getClassDefense(detailClass);
              const specialAbilities = getClassSpecialAbilities(detailClass);
              
              return (
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-yellow-300 font-bold text-xl">{config.name}</h3>
                      <p className="text-gray-300 text-xs mt-1">{classDescriptions[detailClass]}</p>
                    </div>
                    <button
                      onClick={() => setDetailClass(null)}
                      className="text-gray-400 hover:text-white text-xl leading-none"
                    >
                      ×
                    </button>
                  </div>

                  {/* Base Stats */}
                  <div className="bg-black/40 p-3 rounded-lg border border-yellow-600/30">
                    <div className="text-yellow-300 text-xs font-bold mb-2">BASE STATS</div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-black/60 p-2 rounded border border-gray-700">
                        <div className="text-gray-400">HP</div>
                        <div className="text-red-400 font-bold text-base">{config.baseHp}</div>
                      </div>
                      <div className="bg-black/60 p-2 rounded border border-gray-700">
                        <div className="text-gray-400">ATK</div>
                        <div className="text-orange-400 font-bold text-base">{config.skills[0].baseDamage}</div>
                      </div>
                      <div className="bg-black/60 p-2 rounded border border-gray-700">
                        <div className="text-gray-400">DEF</div>
                        <div className="text-blue-400 font-bold text-base">{classDefense}%</div>
                      </div>
                      <div className="bg-black/60 p-2 rounded border border-gray-700">
                        <div className="text-gray-400">Evade CD</div>
                        <div className="text-purple-400 font-bold text-base">{(config.evadeCooldown / 1000).toFixed(1)}s</div>
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div className="bg-black/40 p-3 rounded-lg border border-blue-600/30">
                    <div className="text-blue-300 text-xs font-bold mb-2">SKILLS</div>
                    <div className="space-y-1.5 text-[10px]">
                      {config.skills.slice(0, 3).map((skill, idx) => (
                        <div key={idx} className="bg-black/60 p-2 rounded border border-gray-700">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-gray-300 font-bold">{skill.name}</span>
                            <span className="text-purple-400">{(skill.cooldown / 1000).toFixed(1)}s CD</span>
                          </div>
                          <div className="text-orange-400 font-bold">{skill.baseDamage} Base Damage</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Special Abilities */}
                  <div className="bg-black/40 p-3 rounded-lg border border-green-600/30">
                    <div className="text-green-300 text-xs font-bold mb-2">SPECIAL ABILITIES</div>
                    <div className="space-y-1 text-[10px]">
                      {specialAbilities.map((ability, idx) => (
                        <div key={idx} className="text-cyan-300 bg-black/60 p-2 rounded border border-gray-700">
                          • {ability}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold"
                    onClick={() => {
                      setDetailClass(null);
                      handleClassSelect(detailClass);
                    }}
                  >
                    Select {config.name}
                  </Button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
