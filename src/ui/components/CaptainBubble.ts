import type Phaser from 'phaser';
import { TEXTURES } from '../../assets/AssetManifest';
import { FONT_FAMILY } from '../../config/theme';
import { t } from '../../i18n';

const BUBBLE = { width: 900, height: 210, slice: 52, captain: 150 } as const;

export interface CaptainBubbleOptions {
  readonly depth: number;
  /** Altta "Devam etmek için dokun" yazısı. */
  readonly tapHint?: boolean;
}

/**
 * Kaptan Pati'nin konuşma balonu (öğretici, kasaba replikleri). (x, y) balonun merkezidir.
 * Dönen container'ı yok etmek çağıranın işidir.
 */
export function createCaptainBubble(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: CaptainBubbleOptions,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y).setDepth(options.depth);
  const s = BUBBLE.slice;
  const panel = scene.add.nineslice(0, 0, TEXTURES.popupPanel, undefined, BUBBLE.width, BUBBLE.height, s, s, s, s);
  const left = -BUBBLE.width / 2 + 40 + BUBBLE.captain / 2;
  const captain = scene.add.image(left, -6, TEXTURES.captain).setDisplaySize(BUBBLE.captain, BUBBLE.captain);
  const label = scene.add
    .text(left + BUBBLE.captain / 2 + 18, options.tapHint ? -22 : 0, text, {
      fontFamily: FONT_FAMILY,
      fontSize: '36px',
      fontStyle: '600',
      color: '#5a2d06',
      wordWrap: { width: BUBBLE.width - BUBBLE.captain - 120 },
    })
    .setOrigin(0, 0.5);
  container.add([panel, captain, label]);
  if (options.tapHint) {
    const hint = scene.add
      .text(BUBBLE.width / 2 - 56, BUBBLE.height / 2 - 52, t('tut.tapToContinue'), {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: '600',
        color: '#a86a33',
      })
      .setOrigin(1, 0.5);
    container.add(hint);
    scene.tweens.add({ targets: hint, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
  }
  container.setScale(0.8).setAlpha(0);
  scene.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: captain, angle: { from: -6, to: 6 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return container;
}

export const CAPTAIN_BUBBLE_HEIGHT = BUBBLE.height;
