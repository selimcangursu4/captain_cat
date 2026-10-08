import Phaser from 'phaser';
import { TEXTURES } from '../../assets/AssetManifest';
import { FONT_FAMILY, UI_COLORS } from '../../config/theme';
import { audio } from '../../services/Audio';

export interface IconButtonOptions {
  readonly size?: number;
  /** Simgenin buton içindeki oranı. */
  readonly iconScale?: number;
  /** Butonun altında küçük yazı. */
  readonly label?: string;
}

/** Yuvarlak simge butonu (mağaza, ayarlar, yardımcılar). Basınca hafifçe küçülür. */
export class IconButton extends Phaser.GameObjects.Container {
  readonly diameter: number;
  private readonly face: Phaser.GameObjects.Image;
  readonly icon: Phaser.GameObjects.Image;
  readonly caption: Phaser.GameObjects.Text | null;

  constructor(scene: Phaser.Scene, x: number, y: number, iconTexture: string, onClick: () => void, options: IconButtonOptions = {}) {
    super(scene, x, y);
    this.diameter = options.size ?? 140;
    this.face = scene.add.image(0, 0, TEXTURES.roundButton).setDisplaySize(this.diameter, this.diameter);
    const iconSize = this.diameter * (options.iconScale ?? 0.66);
    this.icon = scene.add.image(0, 0, iconTexture).setDisplaySize(iconSize, iconSize);
    this.add([this.face, this.icon]);
    this.caption = options.label
      ? scene.add
          .text(0, this.diameter / 2 + 6, options.label, {
            fontFamily: FONT_FAMILY,
            fontSize: '32px',
            fontStyle: '700',
            color: UI_COLORS.titleText,
            stroke: UI_COLORS.titleStroke,
            strokeThickness: 7,
          })
          .setOrigin(0.5, 0)
      : null;
    if (this.caption) this.add(this.caption);

    this.setSize(this.diameter, this.diameter).setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => this.setScale(0.92));
    this.on('pointerout', () => this.setScale(1));
    this.on('pointerup', () => {
      this.setScale(1);
      audio.play('tap');
      onClick();
    });
    scene.add.existing(this);
  }

  /** Seçili (hedef bekleyen yardımcı): sarı zemin. */
  setHighlighted(on: boolean): this {
    this.face.setTexture(on ? TEXTURES.roundButtonActive : TEXTURES.roundButton);
    this.face.setDisplaySize(this.diameter, this.diameter);
    return this;
  }

  setDimmed(dimmed: boolean): this {
    this.face.setAlpha(dimmed ? 0.55 : 1);
    this.icon.setAlpha(dimmed ? 0.45 : 1);
    return this;
  }
}
