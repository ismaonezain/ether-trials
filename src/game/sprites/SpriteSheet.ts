export interface SpriteSheetConfig {
  url: string;
  frameWidth: number;
  frameHeight: number;
  cols: number;
  rows: number;
}

export interface SpriteAnimation {
  name: string;
  frames: number[];
  frameRate: number; // frames per second
  loop: boolean;
}

export class SpriteSheet {
  private image: HTMLImageElement | null = null;
  private loaded = false;
  private loading = false;
  private loadCallbacks: Array<() => void> = [];

  constructor(private config: SpriteSheetConfig) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    if (this.loading) {
      return new Promise((resolve) => {
        this.loadCallbacks.push(resolve);
      });
    }

    this.loading = true;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.image = img;
        this.loaded = true;
        this.loading = false;
        this.loadCallbacks.forEach(cb => cb());
        this.loadCallbacks = [];
        resolve();
      };
      img.onerror = reject;
      img.src = this.config.url;
    });
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  drawFrame(
    ctx: CanvasRenderingContext2D,
    frameIndex: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (!this.image || !this.loaded) return;

    const col = frameIndex % this.config.cols;
    const row = Math.floor(frameIndex / this.config.cols);

    const sx = col * this.config.frameWidth;
    const sy = row * this.config.frameHeight;

    ctx.drawImage(
      this.image,
      sx,
      sy,
      this.config.frameWidth,
      this.config.frameHeight,
      x - width / 2,
      y - height / 2,
      width,
      height
    );
  }
}

export class AnimatedSprite {
  private currentAnimation: SpriteAnimation | null = null;
  private currentFrame = 0;
  private frameTime = 0;
  private animationTime = 0;

  constructor(
    private spriteSheet: SpriteSheet,
    private animations: Map<string, SpriteAnimation>
  ) {}

  play(animationName: string): void {
    const animation = this.animations.get(animationName);
    if (!animation) return;

    if (this.currentAnimation?.name !== animationName) {
      this.currentAnimation = animation;
      this.currentFrame = 0;
      this.frameTime = 0;
      this.animationTime = 0;
    }
  }

  update(deltaTime: number): void {
    if (!this.currentAnimation) return;

    this.frameTime += deltaTime;
    this.animationTime += deltaTime;

    const frameDuration = 1000 / this.currentAnimation.frameRate;

    if (this.frameTime >= frameDuration) {
      this.frameTime = 0;
      this.currentFrame++;

      if (this.currentFrame >= this.currentAnimation.frames.length) {
        if (this.currentAnimation.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = this.currentAnimation.frames.length - 1;
        }
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (!this.currentAnimation || !this.spriteSheet.isLoaded()) return;

    const frameIndex = this.currentAnimation.frames[this.currentFrame];
    this.spriteSheet.drawFrame(ctx, frameIndex, x, y, width, height);
  }

  isAnimationFinished(): boolean {
    if (!this.currentAnimation || this.currentAnimation.loop) return false;
    return this.currentFrame >= this.currentAnimation.frames.length - 1;
  }

  getCurrentAnimation(): string | null {
    return this.currentAnimation?.name || null;
  }
}

// Multi-sheet animated sprite for characters (supports different sprite sheets per animation)
export class MultiSheetAnimatedSprite {
  private currentAnimation: SpriteAnimation | null = null;
  private currentFrame = 0;
  private frameTime = 0;
  private animationTime = 0;
  private currentSheet: SpriteSheet | null = null;

  constructor(
    private spriteSheets: Map<string, SpriteSheet>, // map of animation name -> sprite sheet
    private animations: Map<string, SpriteAnimation>
  ) {}

  play(animationName: string): void {
    const animation = this.animations.get(animationName);
    const sheet = this.spriteSheets.get(animationName);
    if (!animation || !sheet) return;

    if (this.currentAnimation?.name !== animationName) {
      this.currentAnimation = animation;
      this.currentSheet = sheet;
      this.currentFrame = 0;
      this.frameTime = 0;
      this.animationTime = 0;
    }
  }

  update(deltaTime: number): void {
    if (!this.currentAnimation) return;

    this.frameTime += deltaTime;
    this.animationTime += deltaTime;

    const frameDuration = 1000 / this.currentAnimation.frameRate;

    if (this.frameTime >= frameDuration) {
      this.frameTime = 0;
      this.currentFrame++;

      if (this.currentFrame >= this.currentAnimation.frames.length) {
        if (this.currentAnimation.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = this.currentAnimation.frames.length - 1;
        }
      }
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (!this.currentAnimation || !this.currentSheet || !this.currentSheet.isLoaded()) return;

    const frameIndex = this.currentAnimation.frames[this.currentFrame];
    this.currentSheet.drawFrame(ctx, frameIndex, x, y, width, height);
  }

  isAnimationFinished(): boolean {
    if (!this.currentAnimation || this.currentAnimation.loop) return false;
    return this.currentFrame >= this.currentAnimation.frames.length - 1;
  }

  getCurrentAnimation(): string | null {
    return this.currentAnimation?.name || null;
  }
}
