import Phaser from 'phaser';
import { TEXTURES } from '../../assets/AssetManifest';
import { FONT_FAMILY, UI_COLORS } from '../../config/theme';
import { audio } from '../../services/Audio';
import { tweenAsync } from '../tweens';
import { TextButton } from './TextButton';

export interface PopupButton {
  readonly label: string;
  readonly onClick: () => void;
  readonly variant?: 'orange' | 'green';
  readonly enabled?: boolean;
}

export interface PopupOptions {
  readonly title: string;
  readonly width?: number;
  readonly height?: number;
  readonly buttons?: readonly PopupButton[];
  /** Verilirse sağ üstte kapatma (X) düğmesi çıkar. */
  readonly onClose?: () => void;
}

const DEPTH = 100;
const SLICE = 52;

/**
 * Açılır pencere: ekranı karartır (arkadaki tahtaya dokunulamaz), ortada zıplayarak
 * açılan ahşap çerçeveli panel. İçerik `content` container'ına (panel merkezine göre) eklenir.
 */
export class Popup {
  readonly content: Phaser.GameObjects.Container;
  readonly width: number;
  readonly height: number;
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly panel: Phaser.GameObjects.Container;
  private closed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    options: PopupOptions,
  ) {
    this.width = options.width ?? 860;
    this.height = options.height ?? 900;
    const { width: viewW, height: viewH } = scene.scale;

    this.overlay = scene.add
      .rectangle(0, 0, viewW, viewH, 0x031a2b, 0.62)
      .setOrigin(0)
      .setDepth(DEPTH)
      .setAlpha(0)
      .setInteractive();

    this.panel = scene.add.container(viewW / 2, viewH / 2).setDepth(DEPTH + 1);
    const body = scene.add.nineslice(0, 0, TEXTURES.popupPanel, undefined, this.width, this.height, SLICE, SLICE, SLICE, SLICE);
    const title = scene.add
      .text(0, -this.height / 2 + 6, options.title, {
        fontFamily: FONT_FAMILY,
        fontSize: '76px',
        fontStyle: '700',
        color: UI_COLORS.titleText,
        stroke: '#4a2a0c',
        strokeThickness: 14,
      })
      .setOrigin(0.5);
    title.setShadow(0, 6, 'rgba(0,0,0,0.3)', 0, true, true);
    this.content = scene.add.container(0, 0);
    this.panel.add([body, this.content, title]);

    const buttons = options.buttons ?? [];
    const buttonWidth = buttons.length > 1 ? Math.min(360, (this.width - 140) / buttons.length) : 440;
    buttons.forEach((b, i) => {
      const x = (i - (buttons.length - 1) / 2) * (buttonWidth + 24);
      const button = new TextButton(scene, x, this.height / 2 - 110, b.label, b.onClick, {
        width: buttonWidth,
        height: 110,
        fontSize: buttonWidth < 280 ? 34 : buttonWidth < 330 ? 38 : 44,
        variant: b.variant,
      });
      if (b.enabled === false) button.setEnabled(false);
      this.panel.add(button);
    });
    if (options.onClose) {
      const close = scene.add
        .image(this.width / 2 - 34, -this.height / 2 + 34, TEXTURES.close)
        .setDisplaySize(84, 84)
        .setInteractive({ useHandCursor: true });
      close.on('pointerup', options.onClose);
      this.panel.add(close);
    }
    this.panel.setScale(0.6).setAlpha(0);
  }

  async open(): Promise<void> {
    audio.play('popup');
    await Promise.all([
      tweenAsync(this.scene, { targets: this.overlay, alpha: 1, duration: 200 }),
      tweenAsync(this.scene, { targets: this.panel, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' }),
    ]);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await Promise.all([
      tweenAsync(this.scene, { targets: this.overlay, alpha: 0, duration: 180 }),
      tweenAsync(this.scene, { targets: this.panel, scale: 0.7, alpha: 0, duration: 180, ease: 'Quad.easeIn' }),
    ]);
    this.overlay.destroy();
    this.panel.destroy();
  }

  /** Ekran boyutu değişirse pencereyi ortala. */
  relayout(): void {
    const { width, height } = this.scene.scale;
    this.overlay.setSize(width, height);
    this.panel.setPosition(width / 2, height / 2);
  }
}
