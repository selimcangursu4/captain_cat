import type Phaser from 'phaser';
import { FONT_FAMILY, UI_COLORS } from '../../config/theme';
import { tweenAsync, waitMs } from '../tweens';

/** Ekranın ortasında zıplayarak beliren ve sönen büyük yazı ("Karıştırılıyor!" vb.). */
export async function showBanner(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  holdMs: number,
): Promise<void> {
  const label = scene.add
    .text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: '96px',
      fontStyle: '700',
      color: UI_COLORS.bannerText,
      stroke: UI_COLORS.titleStroke,
      strokeThickness: 16,
    })
    .setOrigin(0.5)
    .setDepth(50)
    .setScale(0.2)
    .setAlpha(0);
  label.setShadow(0, 8, 'rgba(0,0,0,0.35)', 0, true, true);

  await tweenAsync(scene, { targets: label, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  await waitMs(scene, holdMs);
  await tweenAsync(scene, { targets: label, scale: 1.15, alpha: 0, duration: 220, ease: 'Quad.easeIn' });
  label.destroy();
}
