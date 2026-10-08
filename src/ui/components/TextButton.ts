import Phaser from 'phaser';
import { TEXTURES } from '../../assets/AssetManifest';
import { FONT_FAMILY, UI_COLORS } from '../../config/theme';
import { audio } from '../../services/Audio';

export interface TextButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  /** green: onay / satın alma gibi birincil eylemler. */
  variant?: 'orange' | 'green';
  /** Yazının sağında simge (fiyat: altın, yıldız). */
  icon?: string;
}

/** Buton dokusu 120x120; köşeler (9-dilim) sabit kalır, orta kısım gerilir. */
const SLICE = { left: 36, right: 36, top: 36, bottom: 44 } as const;
const DEFAULTS = { width: 420, height: 100, fontSize: 40, pressedSink: 6 } as const;

/**
 * Yuvarlak köşeli, basınca içe göçen sevimli buton.
 * Arka plan AssetManifest'teki dokudan 9-dilim (NineSlice) olarak çizilir —
 * Graphics'e göre her karede çok daha ucuzdur ve gerçek çizimle kolayca değiştirilir.
 */
export class TextButton extends Phaser.GameObjects.Container {
  private readonly normal: Phaser.GameObjects.NineSlice;
  private readonly pressed: Phaser.GameObjects.NineSlice;
  private readonly label: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image | null = null;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    options: TextButtonOptions = {},
  ) {
    super(scene, x, y);
    const width = options.width ?? DEFAULTS.width;
    const height = options.height ?? DEFAULTS.height;

    // Küçük butonlarda kenar dilimleri üst üste binmesin (yarı saydamken çizgi gibi görünür).
    const k = Math.min(1, width / (SLICE.left + SLICE.right), height / (SLICE.top + SLICE.bottom));
    const [left, right, top, bottom] = [SLICE.left, SLICE.right, SLICE.top, SLICE.bottom].map((s) => Math.floor(s * k));
    const slice = (key: string) => scene.add.nineslice(0, 0, key, undefined, width, height, left, right, top, bottom);
    const green = options.variant === 'green';
    this.normal = slice(green ? TEXTURES.buttonGreen : TEXTURES.button);
    this.pressed = slice(green ? TEXTURES.buttonGreenPressed : TEXTURES.buttonPressed).setVisible(false);
    this.label = scene.add
      .text(0, -6, text, {
        fontFamily: FONT_FAMILY,
        fontSize: `${options.fontSize ?? DEFAULTS.fontSize}px`,
        fontStyle: '600',
        color: green ? '#ffffff' : UI_COLORS.buttonText,
        stroke: green ? '#1f6b2d' : undefined,
        strokeThickness: green ? 6 : 0,
      })
      .setOrigin(0.5);
    this.add([this.normal, this.pressed, this.label]);
    if (options.icon) {
      const size = Math.round((options.fontSize ?? DEFAULTS.fontSize) * 1.25);
      this.icon = scene.add.image(0, -6, options.icon).setDisplaySize(size, size);
      this.add(this.icon);
      this.layoutIcon();
    }

    this.setSize(width, height);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => this.setPressed(true));
    this.on('pointerout', () => this.setPressed(false));
    this.on('pointerup', () => {
      this.setPressed(false);
      if (!this.enabled) return;
      audio.play('tap');
      onClick();
    });
    scene.add.existing(this);
  }

  /** Pasif buton soluk görünür ve tıklamaya tepki vermez. */
  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.5);
    return this;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    this.layoutIcon();
    return this;
  }

  /** Yazı + simge birlikte ortalanır. */
  private layoutIcon(): void {
    if (!this.icon) return;
    const gap = 10;
    const total = this.label.width + gap + this.icon.displayWidth;
    this.label.setX(-total / 2 + this.label.width / 2);
    this.icon.setX(total / 2 - this.icon.displayWidth / 2);
  }

  private setPressed(pressed: boolean): void {
    this.normal.setVisible(!pressed);
    this.pressed.setVisible(pressed);
    const y = -6 + (pressed ? DEFAULTS.pressedSink * (this.height / 120) : 0);
    this.label.setY(y);
    this.icon?.setY(y);
  }
}
