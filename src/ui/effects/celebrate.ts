import Phaser from 'phaser';
import { TEXTURES } from '../../assets/AssetManifest';
import { quality } from '../../services/Quality';
import { tweenAsync, waitMs } from '../tweens';

type Point = { x: number; y: number };

const CONFETTI_COLORS = [0xff6b81, 0xffd23f, 0x5ccf5f, 0x4fc3f7, 0xb366d6, 0xff9a3d];

/** Ekranın üstünden yağan konfeti (kazanma). Kendi kendini temizler. */
export function confetti(scene: Phaser.Scene, depth = 102, durationMs = 900): void {
  const { width } = scene.scale;
  const emitter = scene.add
    .particles(0, -30, TEXTURES.confetti, {
      x: { min: 0, max: width },
      lifespan: { min: 2200, max: 3200 },
      speedY: { min: 250, max: 520 },
      speedX: { min: -160, max: 160 },
      gravityY: 260,
      rotate: { start: 0, end: 720 },
      scaleX: { start: 1, end: 0.2, ease: 'Sine.easeInOut' },
      scaleY: { min: 0.8, max: 1.2 },
      tint: CONFETTI_COLORS,
      frequency: Math.round(16 / quality.particleScale),
      quantity: 2,
    })
    .setDepth(depth);
  scene.time.delayedCall(durationMs, () => emitter.stop());
  scene.time.delayedCall(durationMs + 3500, () => emitter.destroy());
}

/**
 * Simgeleri (yıldız, altın) bir noktadan sayaca kavisli yolla uçurur. Her simge vardığında
 * onArrive çağrılır (ses, sayaç zıplaması). Tümü varınca çözülür.
 */
export async function flyIcons(
  scene: Phaser.Scene,
  texture: string,
  from: Point,
  to: Point,
  options: { count?: number; size?: number; depth?: number; onArrive?: (index: number) => void } = {},
): Promise<void> {
  const count = options.count ?? 1;
  const size = options.size ?? 96;
  await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      await waitMs(scene, i * 70);
      const start = { x: from.x + Phaser.Math.Between(-50, 50), y: from.y + Phaser.Math.Between(-30, 30) };
      const icon = scene.add
        .image(start.x, start.y, texture)
        .setDepth(options.depth ?? 150)
        .setDisplaySize(size, size);
      const base = icon.scale;
      icon.setScale(0);
      await tweenAsync(scene, { targets: icon, scale: base * 1.2, duration: 160, ease: 'Back.easeOut' });
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(start.x, start.y),
        new Phaser.Math.Vector2((start.x + to.x) / 2 + Phaser.Math.Between(-160, 160), Math.min(start.y, to.y) - 120),
        new Phaser.Math.Vector2(to.x, to.y),
      );
      const state = { t: 0 };
      await tweenAsync(scene, {
        targets: state,
        t: 1,
        duration: 560,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
          const p = curve.getPoint(state.t);
          icon.setPosition(p.x, p.y).setScale(base * (1.2 - 0.5 * state.t)).setAngle(state.t * 180);
        },
      });
      icon.destroy();
      options.onArrive?.(i);
    }),
  );
}
