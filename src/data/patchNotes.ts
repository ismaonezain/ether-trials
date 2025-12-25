export interface PatchNote {
  version: string;
  date: string;
  changes: {
    category: 'buff' | 'nerf' | 'fix' | 'new';
    target: string;
    description: string;
    color: string;
  }[];
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: 'v2.7.0',
    date: new Date().toISOString().split('T')[0],
    changes: [
      {
        category: 'nerf',
        target: '🍳 Cook ASPD Dice Bonus',
        description: 'Attack speed bonus from dice rolls capped at 10% maximum. Cook class was too OP with unlimited ASPD stacking.',
        color: '#ff6b35',
      },
      {
        category: 'buff',
        target: '🔥 Fire Element',
        description: 'Damage multiplier MASSIVELY BUFFED: 2.0x → 2.2x (+10%)! Fire is now the STRONGEST element for pure damage.',
        color: '#f97316',
      },
      {
        category: 'buff',
        target: '💨 Wind Element',
        description: 'Damage multiplier increased: 1.12x → 1.8x (+60.7%)! Wind builds are now viable for fast-paced gameplay.',
        color: '#a3e635',
      },
      {
        category: 'buff',
        target: '🌑 Dark Element',
        description: 'Damage multiplier increased: 1.15x → 1.9x (+65.2%)! Dark element now rivals Fire for burst damage.',
        color: '#7c3aed',
      },
      {
        category: 'buff',
        target: '✨ Holy Element',
        description: 'Damage multiplier buffed: 1.08x → 1.7x (+57.4%)! Holy builds now deal competitive damage.',
        color: '#fbbf24',
      },
      {
        category: 'buff',
        target: '💧 Water Element',
        description: 'Damage multiplier increased: 1.0x → 1.6x (+60%)! Water is no longer the weakest element.',
        color: '#06b6d4',
      },
      {
        category: 'buff',
        target: '🌍 Earth Element',
        description: 'Damage multiplier buffed: 0.95x → 1.5x (+57.9%)! Earth builds now deal respectable damage while maintaining tankiness.',
        color: '#84cc16',
      },
      {
        category: 'buff',
        target: '👹 Monster Damage Scaling',
        description: 'Monster damage after level 15 now increases INFINITELY (+1% per stage, no cap). Endless challenge for hardcore players!',
        color: '#dc2626',
      },
      {
        category: 'fix',
        target: '⚔️ Battle UI Optimization',
        description: 'Reduced size and complexity of battle UI elements (smaller fonts, less padding, no shadows) for better performance and less visual clutter.',
        color: '#10b981',
      },
    ],
  },
  {
    version: 'v2.6.0',
    date: '2025-01-24',
    changes: [
      {
        category: 'new',
        target: '🌍 Language System',
        description: 'Added multi-language support! Switch between English and Indonesian (Bahasa Indonesia) in game settings.',
        color: '#22c55e',
      },
      {
        category: 'buff',
        target: '🍳 Cook Defense',
        description: 'Damage reduction restored from 0% → 8%. Cook is no longer a glass cannon and has balanced defense like other classes.',
        color: '#ff6b35',
      },
      {
        category: 'new',
        target: '💾 Local-First Data System',
        description: 'All game data now saves to localStorage first, then syncs to Supabase in background. Zero data loss guarantee!',
        color: '#3b82f6',
      },
      {
        category: 'fix',
        target: '💬 Chat Auto-Scroll',
        description: 'Global chat now automatically scrolls to latest messages. No more manual scrolling required!',
        color: '#10b981',
      },
      {
        category: 'fix',
        target: '🎮 Tournament Entry Flow',
        description: 'Fixed issue where players were kicked back to class selection after depositing TRIA. Added 10-second blockchain confirmation wait period.',
        color: '#fbbf24',
      },
      {
        category: 'buff',
        target: '🏹 Ranger Evade',
        description: 'Evade chance balanced from 90% → 80%. Still very nimble, but not invincible.',
        color: '#10b981',
      },
      {
        category: 'buff',
        target: '🔮 Mage Shield',
        description: 'Shield amount MEGA BUFFED from 25% → 100% max HP! Mage now has effective 2x HP pool.',
        color: '#3b82f6',
      },
      {
        category: 'new',
        target: '🔥 Fire Element Burn',
        description: 'ALL skills with Fire element now apply burn effect automatically (5% enemy max HP per second for 5 seconds = 25% total damage).',
        color: '#f97316',
      },
      {
        category: 'buff',
        target: '🍳 Cook Heal Mode Rework',
        description: 'Heal mode no longer increases lifesteal. Instead provides 5% max HP regen every 2 seconds for consistent sustain.',
        color: '#ff6b35',
      },
    ],
  },
  {
    version: 'v1.10.0',
    date: '2025-01-23',
    changes: [
      {
        category: 'fix',
        target: '⚔️ Warrior Ground Slam',
        description: 'Changed from GATHER (circle-self) → KNOCKBACK 100 + 1s stun. Self-gather was ineffective, now has massive area push!',
        color: '#ef4444',
      },
      {
        category: 'fix',
        target: '🍜 Cook Flaming Feast',
        description: 'Changed from GATHER (circle-self) → KNOCKBACK 110 + 0.8s stun. Explosive flames now push enemies away!',
        color: '#ff6b35',
      },
      {
        category: 'buff',
        target: '🌪️ Assassin Poison Cloud',
        description: 'Range increased 85 → 220 (ranged skill) with GATHER mechanic. The only skill with gather (long range, groups monsters tightly)',
        color: '#8b5cf6',
      },
      {
        category: 'buff',
        target: '👹 Boss Base Damage',
        description: 'MASSIVELY BUFFED: Base damage 60 → 120 (+100%)! Bosses now hit VERY HARD and are truly terrifying!',
        color: '#dc2626',
      },
      {
        category: 'buff',
        target: '👹 Boss Damage Scaling',
        description: 'Boss damage scaling per stage: +18% → +25%. Late game bosses are now extremely deadly!',
        color: '#dc2626',
      },
      {
        category: 'buff',
        target: '👹 Boss Attack Speed',
        description: 'Boss attack interval reduced from 3-5s → 1.5-3s. Bosses now attack 2x more frequently! Much more pressure!',
        color: '#dc2626',
      },
      {
        category: 'buff',
        target: '🔥 Fire Boss (Stage 5-9)',
        description: 'Fire Breath: Cooldown 8s → 6s, Damage 120 → 180 (+50%). Attacks faster and hits harder!',
        color: '#f97316',
      },
      {
        category: 'buff',
        target: '❄️ Ice Boss (Stage 10-14)',
        description: 'Ice Prison: CD 10s → 8s, Dmg 80 → 140. Frost Aura: CD 12s → 10s, Dmg 50 → 90. Freeze spam intensifies!',
        color: '#06b6d4',
      },
      {
        category: 'buff',
        target: '👤 Shadow Boss (Stage 15-19)',
        description: 'Shadow Clone: CD 15s → 12s, NEW 80 dmg. Dark Void: CD 12s → 9s, Dmg 100 → 170. Teleport chaos!',
        color: '#7c3aed',
      },
      {
        category: 'buff',
        target: '✨ Arcane Boss (Stage 20-24)',
        description: 'Arcane Missiles: CD 7s → 6s, Dmg 150 → 220. Mana Drain: CD 14s → 11s, Dmg 80 → 130. Relentless magic assault!',
        color: '#a855f7',
      },
      {
        category: 'buff',
        target: '🌍 Elemental Overlord (Stage 25+)',
        description: 'Earthquake: CD 10s → 8s, Dmg 200 → 300 (MASSIVE). Regen: CD 20s → 18s. Enrage: CD 25s → 22s. Final boss is INSANE!',
        color: '#84cc16',
      },
    ],
  },
  {
    version: 'v1.9.0',
    date: '2025-01-23',
    changes: [
      {
        category: 'new',
        target: '🔮 Mage Passive Shield',
        description: 'Shield generates every 10 seconds and absorbs 15% max HP worth of damage before HP takes damage',
        color: '#3b82f6',
      },
      {
        category: 'buff',
        target: '🏹 Ranger Passive Evade',
        description: 'Evade chance increased from 40% → 45% (passive dodge chance when attacked)',
        color: '#10b981',
      },
      {
        category: 'fix',
        target: '🌀 Gather Mechanic',
        description: 'Enemies now spread around gather point instead of stacking on exact same position. Circle-self gathers to character center, others gather to target position',
        color: '#a3e635',
      },
    ],
  },
  {
    version: 'v1.8.0',
    date: '2025-01-23',
    changes: [
      {
        category: 'fix',
        target: 'Gather Skills',
        description: 'Gather skills now pull enemies to the SKILL TARGET POSITION (where you clicked), not to your character center. More tactical and predictable!',
        color: '#a3e635',
      },
      {
        category: 'new',
        target: 'Boss Mechanics',
        description: 'Bosses are now IMMUNE to knockback and gather effects. They cannot be pushed or pulled, making boss fights more challenging and strategic!',
        color: '#7c3aed',
      },
    ],
  },
  {
    version: 'v1.7.0',
    date: '2025-01-23',
    changes: [
      {
        category: 'fix',
        target: '❄️ Freeze Effect (Mage)',
        description: 'Freeze (Mage Frost Nova) now has a unique visual indicator ❄️ different from stun 😵. Both prevent movement + attack, but now more clear!',
        color: '#3b82f6',
      },
      {
        category: 'fix',
        target: '😵 Stun Mechanic',
        description: 'Stun now truly prevents BOTH movement AND attack. Previously, stunned enemies could still attack if player was in range!',
        color: '#8b5cf6',
      },
      {
        category: 'fix',
        target: '🕸️ Root vs Stun',
        description: 'Root (trap) and Stun are now clearly differentiated: Root = cannot move ONLY (can still attack), Stun = cannot move + cannot attack. Root is more tactical!',
        color: '#10b981',
      },
      {
        category: 'fix',
        target: '🔥 Burn & ☠️ Poison DOT',
        description: 'Burn and Poison damage over time work correctly now. Damage ticks every 1 second with clear emote indicators!',
        color: '#f97316',
      },
      {
        category: 'fix',
        target: '🐌 Slow Effect',
        description: 'Slow effect is now very visible with snail indicator. Movement speed drops drastically and is truly felt in gameplay!',
        color: '#22c55e',
      },
      {
        category: 'new',
        target: '✨ Miss Mechanic',
        description: 'Miss mechanic works with passive evade chance per class. Damage 0 displayed as "MISS" with clear visual feedback!',
        color: '#ffffff',
      },
    ],
  },
  {
    version: 'v1.6.0',
    date: new Date().toISOString().split('T')[0],
    changes: [
      {
        category: 'new',
        target: '⚔️ Skill Mechanics Redesign',
        description: 'Every skill now has clear behavior: KNOCKBACK (push enemies), STAY (hold in place with stun/root), or GATHER (pull enemies together)',
        color: '#22c55e',
      },
      {
        category: 'new',
        target: '🌀 Warrior Ground Slam',
        description: 'Ultimate now GATHER - pulls all enemies to center with pull strength 100, followed by 1.5s stun',
        color: '#ef4444',
      },
      {
        category: 'new',
        target: '🌪️ Assassin Poison Cloud',
        description: 'Ultimate now GATHER - sucks enemies into poison cloud with pull strength 80',
        color: '#8b5cf6',
      },
      {
        category: 'new',
        target: '🍜 Cook Flaming Feast',
        description: 'Ultimate now GATHER - delicious aroma attracts enemies with pull strength 90 + 1s stun',
        color: '#ff6b35',
      },
      {
        category: 'buff',
        target: '⚔️ Warrior Whirlwind',
        description: 'Stun duration: 250ms → 1200ms (+380%) - more effective at locking enemies in place',
        color: '#ef4444',
      },
      {
        category: 'buff',
        target: '❄️ Mage Frost Nova',
        description: 'Freeze duration: 1200ms → 1800ms (+50%) - freeze lasts longer, knockback removed (STAY behavior)',
        color: '#3b82f6',
      },
      {
        category: 'buff',
        target: '🏹 Ranger Arrow Rain',
        description: 'Trap duration: 1s → 2s (+100%), Slow: 50% → 60% (+20%), Duration: 3s → 4s - crowd control much stronger',
        color: '#10b981',
      },
      {
        category: 'buff',
        target: '🗡️ Assassin Shadow Strike',
        description: 'Stun duration: 600ms → 1500ms (+150%) - stun lock lasts longer for burst damage',
        color: '#8b5cf6',
      },
      {
        category: 'buff',
        target: '🛡️ Paladin Divine Judgement',
        description: 'Added 2000ms stun (STAY behavior) - ultimate tank to hold boss',
        color: '#f59e0b',
      },
      {
        category: 'buff',
        target: '🍳 Cook Oil Splash',
        description: 'Stun duration: 400ms → 1400ms (+250%) - slippery stun effect lasts long',
        color: '#ff6b35',
      },
      {
        category: 'new',
        target: '👹 Boss Special Abilities',
        description: 'Each boss tier now has unique skills: Stage 5-9 (Fire Breath), 10-14 (Ice Prison), 15-19 (Shadow Clone), 20-24 (Arcane Missiles), 25+ (Earthquake + Heal + Enrage)',
        color: '#dc2626',
      },
      {
        category: 'new',
        target: '🔥 Stage 5-9: Fire Boss',
        description: 'Fire Breath (8s cooldown) - Cone of fire 120 damage with burn effect',
        color: '#f97316',
      },
      {
        category: 'new',
        target: '❄️ Stage 10-14: Ice Boss',
        description: 'Ice Prison (10s) - Freeze player 3 seconds (80 dmg) + Frost Aura (12s) - Slow 50% (50 dmg)',
        color: '#06b6d4',
      },
      {
        category: 'new',
        target: '👤 Stage 15-19: Shadow Boss',
        description: 'Shadow Clone (15s) - Illusionary clone confuses + Dark Void (12s) - Teleport behind player (100 dmg)',
        color: '#7c3aed',
      },
      {
        category: 'new',
        target: '✨ Stage 20-24: Arcane Boss',
        description: 'Arcane Missiles (7s) - 5 tracking missiles (150 dmg) + Mana Drain (14s) - Slow cooldowns (80 dmg)',
        color: '#a855f7',
      },
      {
        category: 'new',
        target: '🌍 Stage 25+: Elemental Overlord',
        description: 'Earthquake (10s) - Massive AOE 200 dmg + Regeneration (20s) - Heal 15% max HP + Enrage (25s) - +50% damage & speed',
        color: '#84cc16',
      },
    ],
  },
  {
    version: 'v1.5.0',
    date: '2024-01-23',
    changes: [
      {
        category: 'fix',
        target: '🔥 Burn Effect (Mage)',
        description: 'Fixed burn DOT not applying - now deals fire damage over time every 1 second as intended',
        color: '#f97316',
      },
      {
        category: 'fix',
        target: '☠️ Poison Effect (Assassin)',
        description: 'Fixed poison DOT not applying - now deals toxic damage over time every 1 second as intended',
        color: '#22c55e',
      },
      {
        category: 'fix',
        target: '😵 Stun Effect',
        description: 'Stunned enemies now actually STOP moving - they were ignoring stun before',
        color: '#fbbf24',
      },
      {
        category: 'fix',
        target: '🕸️ Root/Trap Effect (Ranger)',
        description: 'Trapped enemies now completely immobilized (0 movement speed) with clear web indicator',
        color: '#10b981',
      },
      {
        category: 'fix',
        target: '🐌 Slow Effect (Ranger)',
        description: 'Slow now actually reduces enemy movement speed significantly - very noticeable difference with snail indicator',
        color: '#a3e635',
      },
      {
        category: 'new',
        target: 'Status Effect Visuals',
        description: 'Added clear emoji indicators for all status effects: 😵 Stun, 🕸️ Trap, 🔥 Burn, ☠️ Poison, 🐌 Slow',
        color: '#8b5cf6',
      },
    ],
  },
  {
    version: 'v1.4.0',
    date: '2024-01-22',
    changes: [
      {
        category: 'buff',
        target: 'Paladin',
        description: 'Passive HP regen increased from 4% → 5% every 1.5s. Mental damage reflection increased from 150-500% → 200-600%',
        color: '#f59e0b',
      },
      {
        category: 'new',
        target: 'Warrior',
        description: 'NEW: Passive HP regeneration 3% every 2 seconds (in addition to lifesteal)',
        color: '#ef4444',
      },
      {
        category: 'new',
        target: 'Mage',
        description: 'NEW: 15% chance to instantly reset ultimate cooldown when killing an enemy with Meteor',
        color: '#3b82f6',
      },
      {
        category: 'new',
        target: 'Knockback System',
        description: 'All knockback effects now apply 1 second stun + 30% movement slow for 2 seconds',
        color: '#10b981',
      },
      {
        category: 'nerf',
        target: 'Assassin',
        description: 'Backstab instant kill chance reduced from 8% → 6%',
        color: '#8b5cf6',
      },
    ],
  },
  {
    version: 'v1.3.0',
    date: '2024-01-21',
    changes: [
      {
        category: 'fix',
        target: 'Game Performance',
        description: 'Reduced sprite update frequency by 50% using frame skipping (enemies & effects only update every 2nd frame)',
        color: '#10b981',
      },
      {
        category: 'fix',
        target: 'Casting Animations',
        description: 'Simplified casting visual effects - removed particle systems for better performance',
        color: '#10b981',
      },
      {
        category: 'fix',
        target: 'Status Effects',
        description: 'Optimized emote rendering - show only highest priority effect (Stun > Burn > Poison)',
        color: '#10b981',
      },
      {
        category: 'fix',
        target: 'Memory Management',
        description: 'Reduced damage number lifetime from 1000ms → 800ms for faster cleanup',
        color: '#10b981',
      },
      {
        category: 'fix',
        target: 'Skill Effects',
        description: 'Reduced skill effect duration from 500ms → 300ms for better memory efficiency',
        color: '#10b981',
      },
      {
        category: 'fix',
        target: 'Frame Stability',
        description: 'Added delta time capping at 50ms to prevent performance spikes',
        color: '#10b981',
      },
    ],
  },
  {
    version: 'v1.2.0',
    date: '2024-01-20',
    changes: [
      {
        category: 'buff',
        target: 'Fire Element',
        description: 'Damage multiplier increased from 1.15 → 1.18 (+2.6%)',
        color: '#f97316',
      },
      {
        category: 'buff',
        target: 'Wind Element',
        description: 'Damage multiplier increased from 1.08 → 1.12 (+3.7%) for faster gameplay',
        color: '#a3e635',
      },
      {
        category: 'buff',
        target: 'Earth Element',
        description: 'Damage multiplier increased from 0.85 → 0.95 (+11.8%) while maintaining tankiness',
        color: '#84cc16',
      },
      {
        category: 'buff',
        target: 'Holy Element',
        description: 'Damage multiplier increased from 1.0 → 1.08 (+8%) for better support capability',
        color: '#fbbf24',
      },
      {
        category: 'buff',
        target: 'Water Element',
        description: 'Maintained at 1.0 as balanced baseline reference',
        color: '#06b6d4',
      },
      {
        category: 'nerf',
        target: 'Dark Element',
        description: 'Damage multiplier reduced from 1.25 → 1.15 (-8%) to balance overpowered performance',
        color: '#7c3aed',
      },
    ],
  },
];
