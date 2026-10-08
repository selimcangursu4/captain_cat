import Phaser from 'phaser';
import { TEXTURES } from '../../assets/AssetManifest';
import { FONT_FAMILY, UI_COLORS } from '../../config/theme';
import { audio } from '../../services/Audio';

const SIZE = { width: 250, height: 92, icon: 84, slice: 40, plus: 46 } as const;

export interface CounterPillOptions {
  /** Verilirse sayaç dokunulabilir olur ve sağında "+" rozeti çıkar. */
  readonly onTap?: () => void;
  readonly plus?: boolean;
}

/** Üst çubuktaki sayaç (yıldız, altın, can): solda simge, ortada sayı ya da kısa metin. */
export class CounterPill extends Phaser.GameObjects.Container {
  protected readonly label: Phaser.GameObjects.Text;
  protected readonly icon: Phaser.GameObjects.Image;
  private value = 0;

  constructor(scene: Phaser.Scene, iconTexture: string, depth: number, options: CounterPillOptions = {}) {
    super(scene, 0, 0);
    const panel = scene.add.nineslice(
      SIZE.icon / 4,
      0,
      TEXTURES.hudPanel,
      undefined,
      SIZE.width,
      SIZE.height,
      SIZE.slice,
      SIZE.slice,
      SIZE.slice,
      SIZE.slice,
    );
    this.icon = scene.add.image(-SIZE.width / 2 + SIZE.icon / 4, 0, iconTexture).setDisplaySize(SIZE.icon, SIZE.icon);
    this.label = scene.add
      .text(SIZE.icon / 2 + 6, -2, '0', {
        fontFamily: FONT_FAMILY,
        fontSize: '50px',
        fontStyle: '700',
        color: UI_COLORS.titleText,
        stroke: UI_COLORS.titleStroke,
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.add([panel, this.icon, this.label]);
    if (options.plus) {
      this.add(scene.add.image(SIZE.width / 2 + SIZE.icon / 4 - 6, SIZE.height / 2 - 14, TEXTURES.plus).setDisplaySize(SIZE.plus, SIZE.plus));
    }
    if (options.onTap) {
      const onTap = options.onTap;
      this.setSize(SIZE.width + SIZE.icon / 2, SIZE.height).setInteractive({ useHandCursor: true });
      this.on('pointerup', () => {
        audio.play('tap');
        onTap();
      });
    }
    this.setDepth(depth);
    scene.add.existing(this);
  }

  /** Simgenin dünya koordinatı (uçan yıldız/altın animasyonları için). */
  get iconPoint(): { x: number; y: number } {
    return { x: this.x + this.icon.x, y: this.y + this.icon.y };
  }

  setValue(value: number, animate = false): this {
    const changed = value !== this.value;
    this.value = value;
    this.setText(String(value), 50);
    if (animate && changed) this.bump();
    return this;
  }

  /** Sayı yerine kısa metin (ör. can zamanlayıcısı "12:34", "Dolu"). */
  setText(text: string, fontSize = 50): this {
    if (this.label.text !== text) this.label.setText(text);
    this.label.setFontSize(fontSize);
    return this;
  }

  bump(): void {
    this.scene.tweens.killTweensOf(this.label);
    this.label.setScale(1);
    this.scene.tweens.add({ targets: this.label, scale: 1.3, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
  }
}

/** Can sayacı: kalbin üstünde can sayısı, yanında sıradaki cana kalan süre ya da "Dolu". */
export class LivesPill extends CounterPill {
  private readonly heartCount: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, depth: number, onTap: () => void) {
    super(scene, TEXTURES.heart, depth, { onTap });
    this.heartCount = scene.add
      .text(this.icon.x, this.icon.y - 2, '5', {
        fontFamily: FONT_FAMILY,
        fontSize: '44px',
        fontStyle: '700',
        color: '#ffffff',
        stroke: '#7b1d1d',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.add(this.heartCount);
  }

  setLives(count: number, label: string): void {
    const text = String(count);
    if (this.heartCount.text !== text) {
      this.heartCount.setText(text);
      this.scene.tweens.add({ targets: this.heartCount, scale: { from: 1.4, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    }
    this.setText(label, label.length > 4 ? 40 : 44);
  }
}

/** "12:34" biçiminde kalan süre. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
