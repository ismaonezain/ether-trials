import { SpriteSheet, AnimatedSprite, MultiSheetAnimatedSprite, type SpriteAnimation } from './SpriteSheet';
import type { CharacterClass, ElementType } from '@/types/game';

// Individual character sprite URLs (user-uploaded, transparent PNG)
const CHARACTER_SPRITES = {
  Warrior: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/0e1b59c6-473c-4b82-8e0d-a2c1f3edccbd-s0qQ9xGTU1jOueCc2XnpZr6CIPIV0f',
    cast: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/78e25e0d-3689-4446-b0a8-97fe547f4121-OyUCS7tv7gLKDpOLCnh2bHcWapnQgt'
  },
  Mage: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/f63b6ddb-92a4-4042-a2cb-361d37054993-JL4ZpLP7LMTyqoixGpAa34in30VeYa',
    cast: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/4e9f1873-6aee-4124-ad88-f160425056a1-GfmL8No3ApLR4vggvV8Z2r5NmwWaXy'
  },
  Ranger: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/6ceff22e-9191-437b-aa39-097ea89be9b4-D2ySxOc7Br9uUkuQH2TIs7apgnZcCU',
    cast: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/5edc4ea5-c300-4294-90df-75975f2dc9c0-HQn5ZYqHXBTSkYfkPGyQU3vbYiuikM'
  },
  Assassin: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/d532b45a-f48b-434b-972a-3c3b55211d65-QqSVhBjMABFBKgIW5hB0WA5Kfb8f72',
    cast: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/761bca3e-c665-4944-8a0d-21d769c0ffe9-GnN6EQxtmwwzqtMAian5kglvWIpQDZ'
  },
  Paladin: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/4661ca44-bf23-422d-a5b8-a69c8b7b2c65-hv6FGBkiqPpKB1QjLwHKxB94XxNy3y',
    cast: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/ad395159-57b9-4a8e-8e61-76ac7f4ada2d-krXHAl82ja7JLaCH8HIWYSfIwRU2jK'
  },
  Cook: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/08db144e-f603-4494-bcb0-37615b157249-FTvqHLLjwNfK2JUhOxRYa4c5HtCsKI',
    cast: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/4da4fe5c-a4dd-4aa4-a662-c91173eac5c4-y6Yir1CZ2BGaGekTjODQZcCTktJ524'
  }
};

// Individual monster sprite URLs (user-uploaded, transparent PNG, 4x4 grid 256x256 per frame)
const MONSTER_SPRITES = {
  slime: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/3ceefe11-3a4d-4c5e-ae37-3e884adcbb48-CGtXpUkEHBfLkOYUzVh89eMKnykpe0',
    move: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/dc3d9003-702e-44d8-acdf-3f91b5185fd4-JPEENWDFt1akVymYdgKKEGYhQC2U0B',
    attack: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/df819c9c-6b3a-4979-b861-4437cd34b196-64KcWzM1mL8h6rDLs9LXQMRN9pnBrw'
  },
  goblin: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/eaffb26b-5dab-43c6-ba7d-adc87b9f8ada-aG3zvQd1Vxg6Kx4ouG7eUIlgXVgmVO',
    move: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/6cdb54fd-5e8d-41a5-a55f-1e3045108289-xOt4ak7pvUk90oQYS9hIWWupM4vrM3',
    attack: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/879a47c6-ca5b-4a33-8721-a1a590847e1c-Sk91EsEcET9PzdeMdUTPbd7dTu5rmz'
  },
  orc: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/d4756e12-ba13-4008-bc55-aca60fa899fe-S5D4xE5Og7UALMHMqHibfCOdy2hSmX',
    move: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/36603e5a-b009-4ba7-b2d1-8d68784fef1c-ZALBcQ1MTzBLpCL0XnXvCuqO5E3OXk',
    attack: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/e7a5f319-48ce-4eed-a846-f433ef650326-zQZfXsFXqIP5KkCDotNcydsVvaGXye'
  },
  skeleton: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/b358cfa3-bc76-4306-bb77-342f51df5589-29GtlCCfO7xafG2PQRh11BKyz6iKCo',
    move: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/03e8d589-c727-407b-8c39-20bed6fa0b3f-S41C2Om7C9cNd97iqJ6Vfm6SC0srmL',
    attack: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/1b692116-51a8-4336-aea1-c144e9595509-Drve1eNkXHlNbXmxKBTKTkw26fZv8t'
  }
};

// Individual boss sprite URLs (user-uploaded, transparent PNG, 4x4 grid 256x256 per frame)
const BOSS_SPRITES = {
  dragon: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/9954cb92-7b9d-42f0-893c-25e3bb961d7e-l5qVMMzKcRJ4NP0rmpoqxu5ah6QTg3',
    move: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/62a327ea-1466-4f32-9b22-38b4cb857f69-pfko3gEsF85sZ4NQMEB9r6vDxp51hE',
    attack: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/2c347582-776d-4ba1-98e5-e7ac5b6e3484-AvZjuh3nankGytKt19eCKA11IMHSrm'
  },
  demon: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/de97680f-aa26-4417-ac66-1ed1be712c2a-UrGP0yHil0HFCouACd4DnQc0SG5yQc',
    move: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/a436cad7-5c44-4e5d-9e75-416f5247f3a6-iRjvfnn9opF4INwKghX4blWZKBjMHA',
    attack: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/9d3cadeb-9bc9-44ec-bb96-1b2240d1c932-ZQCs0HhhtbGSf7CRpDUeZqXQhCcAql'
  },
  golem: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/66a13d02-a17e-481b-b9da-1e508e3442da-vegnPuNdxvyW1OUEzF73WYTJkDMh1K',
    move: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/66a13d02-a17e-481b-b9da-1e508e3442da-vegnPuNdxvyW1OUEzF73WYTJkDMh1K',
    attack: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/7b1d68db-64f4-43fe-901b-0caf1c02697d-axXeinXfoV75bNGG8EUGe087PEVSE8'
  },
  ghost: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/84fec6fa-69b3-4f06-8efa-9c1d339ca900-vehkLDQAiTCmhxZcX5qzMCZEHj6WL1',
    move: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/84fec6fa-69b3-4f06-8efa-9c1d339ca900-vehkLDQAiTCmhxZcX5qzMCZEHj6WL1',
    attack: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/d9511665-0a30-4815-9fbf-e23f4402ed6a-6OVxZYKRjCgAEsJbrA3jg7DNbGyE3M'
  },
  phoenix: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/3e06e3a3-7897-4ee1-8f95-dbaad57628d6-xdqGHlmFFSrAFsUkGM6dF94Yr03McU',
    move: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/3e06e3a3-7897-4ee1-8f95-dbaad57628d6-xdqGHlmFFSrAFsUkGM6dF94Yr03McU',
    attack: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/5bf49d89-f934-4b60-b376-e72bfe5fdcef-W94pDfSPdvoJSL6WkNRnHlJgDYFBBZ'
  },
  hydra: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/503c5914-e392-43b1-824d-4cd47ef131e3-5GJWlLsrGBeQalSyLteM9OUghNyl4g',
    move: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/503c5914-e392-43b1-824d-4cd47ef131e3-5GJWlLsrGBeQalSyLteM9OUghNyl4g',
    attack: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/bbca6c0f-c610-4257-807e-2323974905af-U8bB5ckhzYgPW64QpCp6yB5WYSKAAN'
  },
  titan: {
    idle: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/12fa8238-f599-41e6-9107-cb53359a9592-nFTtLYRVsgtPXaGZE79I6x07XWlr8w',
    move: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/12fa8238-f599-41e6-9107-cb53359a9592-nFTtLYRVsgtPXaGZE79I6x07XWlr8w',
    attack: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/b2532021-e5c6-498c-9e6e-b453ab6e1eaa-CItpdGUMuw0yxKoIQsZ6xUN8FN7fQn'
  }
};

// Individual skill effect sprite URLs (user-uploaded, transparent PNG)
const SKILL_EFFECT_SPRITES = {
  Fire: {
    basic: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/3450c459-6c1d-43e0-badb-9326f5b9a544-TXC0W7uwAlxA3cRwInomvUwMVUriM2',
    heavy: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/c9cdf9f5-ef22-4c4f-8994-6beddc7a952b-yAibel4jo69zpYtp233h2kES87UFRm',
    special: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/f407b0af-d101-4f01-9e95-ae7b0326158a-D6VEIQ4FG7gTce0npvC58XxMoqumwz',
    ultimate: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/eb98e3e8-721a-4bfb-831b-3e6f670470c8-aSU4CRGRjdd7xadIHurwYdvjC7rtVZ'
  },
  Water: {
    basic: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/08d48f66-fa0a-480e-bddb-c48f2af11537-8hE3VFqbCL953kkpNhmJBslGTmt3VR',
    heavy: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/69e4e311-f610-4c90-ba4d-f816e3e212da-295p0RKNZAsH4N6n1Kk824lykrQiJI',
    special: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/6eae75ff-e5d5-46bc-af6c-d7aa0c074b68-d2z6gpMczAEEEv5HYOHqiI8IpFfvwx',
    ultimate: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/1200354a-a12f-4aca-8147-c890facbc958-f8u5sx3w0l0XKLrC7efmVnQmdkyBIi'
  },
  Earth: {
    basic: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/e05f518b-94a0-4694-ad62-464b0d40de1c-2hOymZKEMkMWHHVzV5frYLtDXCoJRC',
    heavy: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/dc6fd083-340f-4aa0-aefa-0186b92fd4fc-LagMhCY6m5PWG49fHDgYxnWzd0cEzR',
    special: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/9f92c179-905e-4ee3-9bdc-ee684f4e2aea-JWPIoffOfyUoS3k4XMMOEAblmNYcMf',
    ultimate: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/de3fb930-3379-4298-a15f-008483c7b9a5-oi0m5rm7nPx9d8OOilQiR8Or4loNli'
  },
  Wind: {
    basic: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/a0a666d3-fd29-4a1a-944c-d50ca85d055a-3GVtxfuar1ZU8jdIl4O2n4jvQtZ7Gt',
    heavy: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/81b62025-b90e-4010-b74b-feeeae2c9df5-yrfDBITtdOX63ddvbP6Mlo84qJ2aIN',
    special: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/8a933968-9780-4208-86dc-7e08ab25cf14-f37MEVO4kcAVjrupCNFRqLPxzioZpY',
    ultimate: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/e96831ad-cdc9-4143-a398-46738ab21a9b-4NrQ6O0CBA1uqroWfiUFKQmyTIb2DH'
  },
  Dark: {
    basic: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/f5831121-a3ff-4e0c-a8a7-3a850434523a-eW0aoGYZIV2pV7CUS6WH9tabSDcrO7',
    heavy: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/8215f69e-939d-426b-940d-4be070aced14-6ghPWY2RhEKaIc5kcw5ZAGS0qhuozy',
    ultimate: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/a65847af-b903-4af7-b29e-932a3aa3ce74-au210xS696DwT6QjgShJjB02lAT9t6'
  },
  Holy: {
    basic: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/838e2901-e59b-4631-b9ca-a66a66a09de8-YkbWlAMOKODWP6i8OW2c2Yk6osAeFm',
    heavy: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/4fb504ed-a0ff-4e53-b633-4a48b52753b3-2ypz0ZUxC1THObmm4HLZ23duzyC3Iy',
    ultimate: 'https://usdozf7pplhxfvrl.public.blob.vercel-storage.com/8606ef98-d33e-406c-9a2f-81caa968fc56-M9kgLmG1CKBdKL8nkxoqO3OAqcOAsv'
  }
};

export class SpriteManager {
  private static instance: SpriteManager;
  private characterSheets = new Map<string, SpriteSheet>();
  private monsterSheets = new Map<string, SpriteSheet>();
  private bossSheets = new Map<string, SpriteSheet>();
  private skillEffectSheets = new Map<string, SpriteSheet>();
  private initialized = false;

  private constructor() {
    // Pre-create individual character sprite sheets
    Object.entries(CHARACTER_SPRITES).forEach(([className, sprites]) => {
      this.characterSheets.set(`${className}-idle`, new SpriteSheet({
        url: sprites.idle,
        frameWidth: 256,
        frameHeight: 256,
        cols: 1,
        rows: 1
      }));
      this.characterSheets.set(`${className}-cast`, new SpriteSheet({
        url: sprites.cast,
        frameWidth: 256,
        frameHeight: 256,
        cols: 1,
        rows: 1
      }));
    });

    // Create individual monster sprite sheets (4x4 grid, 256x256 per frame)
    Object.entries(MONSTER_SPRITES).forEach(([monsterType, sprites]) => {
      this.monsterSheets.set(`${monsterType}-idle`, new SpriteSheet({
        url: sprites.idle,
        frameWidth: 256,
        frameHeight: 256,
        cols: 4,
        rows: 4
      }));
      this.monsterSheets.set(`${monsterType}-move`, new SpriteSheet({
        url: sprites.move,
        frameWidth: 256,
        frameHeight: 256,
        cols: 4,
        rows: 4
      }));
      this.monsterSheets.set(`${monsterType}-attack`, new SpriteSheet({
        url: sprites.attack,
        frameWidth: 256,
        frameHeight: 256,
        cols: 4,
        rows: 4
      }));
    });

    // Create individual boss sprite sheets (4x4 grid, 256x256 per frame)
    Object.entries(BOSS_SPRITES).forEach(([bossType, sprites]) => {
      this.bossSheets.set(`${bossType}-idle`, new SpriteSheet({
        url: sprites.idle,
        frameWidth: 256,
        frameHeight: 256,
        cols: 4,
        rows: 4
      }));
      this.bossSheets.set(`${bossType}-move`, new SpriteSheet({
        url: sprites.move,
        frameWidth: 256,
        frameHeight: 256,
        cols: 4,
        rows: 4
      }));
      this.bossSheets.set(`${bossType}-attack`, new SpriteSheet({
        url: sprites.attack,
        frameWidth: 256,
        frameHeight: 256,
        cols: 4,
        rows: 4
      }));
    });

    // Create individual skill effect sprite sheets
    Object.entries(SKILL_EFFECT_SPRITES).forEach(([element, skills]) => {
      Object.entries(skills).forEach(([skillType, url]) => {
        this.skillEffectSheets.set(`${element}-${skillType}`, new SpriteSheet({
          url: url,
          frameWidth: 256,
          frameHeight: 256,
          cols: 1,
          rows: 1
        }));
      });
    });
  }

  static getInstance(): SpriteManager {
    if (!SpriteManager.instance) {
      SpriteManager.instance = new SpriteManager();
    }
    return SpriteManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const charPromises = Array.from(this.characterSheets.values()).map(sheet => sheet.load());
    const monsterPromises = Array.from(this.monsterSheets.values()).map(sheet => sheet.load());
    const bossPromises = Array.from(this.bossSheets.values()).map(sheet => sheet.load());
    const skillPromises = Array.from(this.skillEffectSheets.values()).map(sheet => sheet.load());
    
    await Promise.all([...charPromises, ...monsterPromises, ...bossPromises, ...skillPromises]);
    this.initialized = true;
  }

  createCharacterSprite(characterClass: CharacterClass): MultiSheetAnimatedSprite {
    // Get pre-loaded sprite sheets for this character
    const idleSheet = this.characterSheets.get(`${characterClass}-idle`)!;
    const castSheet = this.characterSheets.get(`${characterClass}-cast`)!;

    // Map of animation name to sprite sheet
    const spriteSheets = new Map<string, SpriteSheet>([
      ['idle', idleSheet],
      ['attack', castSheet]
    ]);

    // Map of animation name to animation config
    const animations = new Map<string, SpriteAnimation>([
      ['idle', { name: 'idle', frames: [0], frameRate: 2, loop: true }],
      ['attack', { name: 'attack', frames: [0], frameRate: 8, loop: true }]
    ]);

    return new MultiSheetAnimatedSprite(spriteSheets, animations);
  }

  createMonsterSprite(stage: number): MultiSheetAnimatedSprite {
    // RANDOM WEIGHTED SELECTION - All monster types can spawn at any stage with dynamic weights
    // This creates variety and prevents monotonous gameplay at high stages
    
    const monsterTypes = ['slime', 'goblin', 'orc', 'skeleton'];
    
    // Calculate weights based on stage progression
    // Early stages favor basic monsters, late stages favor stronger ones, but all have a chance
    const weights = monsterTypes.map((_, index) => {
      const baseWeight = 100; // Everyone gets base chance
      const stageBonus = Math.max(0, (stage - index * 3) * 10); // Bonus based on stage
      return baseWeight + stageBonus;
    });
    
    // Weighted random selection
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    let monsterType = monsterTypes[0];
    for (let i = 0; i < monsterTypes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        monsterType = monsterTypes[i];
        break;
      }
    }
    
    // Get sprite sheets for this monster
    const idleSheet = this.monsterSheets.get(`${monsterType}-idle`)!;
    const moveSheet = this.monsterSheets.get(`${monsterType}-move`)!;
    const attackSheet = this.monsterSheets.get(`${monsterType}-attack`)!;

    // Map of animation name to sprite sheet
    const spriteSheets = new Map<string, SpriteSheet>([
      ['idle', idleSheet],
      ['move', moveSheet],
      ['attack', attackSheet]
    ]);

    // Each sprite sheet is a separate file containing its own animation
    // Use only first frame (frame 0) for all animations to prevent black frames flickering
    // Attack uses 1 frame, no loop, fast duration to flash briefly then return to idle
    const animations = new Map<string, SpriteAnimation>([
      ['idle', { name: 'idle', frames: [0], frameRate: 8, loop: true }],
      ['move', { name: 'move', frames: [0], frameRate: 8, loop: true }],
      ['attack', { name: 'attack', frames: [0], frameRate: 20, loop: false }]
    ]);

    return new MultiSheetAnimatedSprite(spriteSheets, animations);
  }

  createBossSprite(stage: number): MultiSheetAnimatedSprite {
    // RANDOM WEIGHTED SELECTION - All boss types can spawn with dynamic weights
    // Creates epic variety and prevents repetitive boss fights at high stages
    
    const bossTypes = ['dragon', 'demon', 'golem', 'ghost', 'phoenix', 'hydra', 'titan'];
    
    // Calculate weights based on stage progression
    // Early stages favor early bosses, late stages favor legendary ones, but all have a chance
    const weights = bossTypes.map((_, index) => {
      const baseWeight = 80; // Everyone gets base chance for variety
      const stageBonus = Math.max(0, (stage - index * 5) * 8); // Bonus based on stage
      return baseWeight + stageBonus;
    });
    
    // Weighted random selection
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    let bossType = bossTypes[0];
    for (let i = 0; i < bossTypes.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        bossType = bossTypes[i];
        break;
      }
    }
    
    // Get sprite sheets for this boss
    const idleSheet = this.bossSheets.get(`${bossType}-idle`)!;
    const moveSheet = this.bossSheets.get(`${bossType}-move`)!;
    const attackSheet = this.bossSheets.get(`${bossType}-attack`)!;

    // Map of animation name to sprite sheet
    const spriteSheets = new Map<string, SpriteSheet>([
      ['idle', idleSheet],
      ['move', moveSheet],
      ['attack', attackSheet]
    ]);

    // Each sprite sheet is a separate file containing its own animation
    // Use only first frame (frame 0) for all animations to prevent black frames flickering
    // Attack uses 1 frame, no loop, fast duration to flash briefly then return to idle
    const animations = new Map<string, SpriteAnimation>([
      ['idle', { name: 'idle', frames: [0], frameRate: 6, loop: true }],
      ['move', { name: 'move', frames: [0], frameRate: 8, loop: true }],
      ['attack', { name: 'attack', frames: [0], frameRate: 20, loop: false }]
    ]);

    return new MultiSheetAnimatedSprite(spriteSheets, animations);
  }

  createSkillEffectSprite(element: ElementType, skillType: 'basic' | 'heavy' | 'ultimate'): AnimatedSprite {
    const key = `${element}-${skillType}`;
    const sheet = this.skillEffectSheets.get(key);
    
    // Fallback to basic if skill type not found
    if (!sheet) {
      const fallbackKey = `${element}-basic`;
      const fallbackSheet = this.skillEffectSheets.get(fallbackKey);
      if (!fallbackSheet) {
        // Return a dummy sprite if element not found
        const dummySheet = this.skillEffectSheets.values().next().value;
        const animations = new Map<string, SpriteAnimation>([
          ['play', { name: 'play', frames: [0], frameRate: 10, loop: false }]
        ]);
        return new AnimatedSprite(dummySheet, animations);
      }
      const animations = new Map<string, SpriteAnimation>([
        ['play', { name: 'play', frames: [0], frameRate: 10, loop: false }]
      ]);
      return new AnimatedSprite(fallbackSheet, animations);
    }

    const animations = new Map<string, SpriteAnimation>([
      ['play', { name: 'play', frames: [0], frameRate: 10, loop: false }]
    ]);

    return new AnimatedSprite(sheet, animations);
  }

  isReady(): boolean {
    return this.initialized;
  }
}
