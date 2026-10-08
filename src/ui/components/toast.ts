import type Phaser from 'phaser';
import { FONT_FAMILY } from '../../config/theme';

const DEPTH = 150;
let current: Phaser.GameObjects.Container | null = null;

/** Ekranın alt kısmında kısa süre görünen bilgi şeridi ("Kürek kilitli…"). Yenisi eskisinin yerini alır. */
export function showToast(scene: Phaser.Scene, text: string, y = scene.scale.height * 0.78): void {
  if (current?.active) current.destroy();
  const label = scene.add
    .text(0, 0, text, {
      fontFamily: FONT_FAMILY,
      fontSize: '38px',
      fontStyle: '700',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: Math.min(900, scene.scale.width - 120) },
    })
    .setOrigin(0.5);
  const width = label.width + 80;
  const height = label.height + 44;
  const bg = scene.add.graphics().fillStyle(0x0d2f4a, 0.92).fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
  bg.lineStyle(4, 0x7fd6f5).strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
  const toast = scene.add.container(scene.scale.width / 2, y, [bg, label]).setDepth(DEPTH).setAlpha(0);
  current = toast;
  scene.tweens.chain({
    targets: toast,
    tweens: [
      { alpha: 1, y: y - 20, duration: 180, ease: 'Quad.easeOut' },
      { alpha: 0, duration: 260, delay: 1800 },
    ],
    onComplete: () => toast.destroy(),
  });
}
