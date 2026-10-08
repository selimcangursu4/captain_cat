import type Phaser from 'phaser';

/** Tween'i Promise olarak çalıştırır; tamamlanınca veya durdurulunca çözülür. */
export function tweenAsync(
  scene: Phaser.Scene,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({
      ...config,
      onComplete: () => resolve(),
      onStop: () => resolve(),
    });
  });
}

export function waitMs(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(ms, () => resolve());
  });
}

/** Ardışık tween'leri (her biri kendi gecikmesiyle) zincir olarak çalıştırır. */
export function chainAsync(
  scene: Phaser.Scene,
  tweens: Phaser.Types.Tweens.TweenBuilderConfig[],
): Promise<void> {
  if (tweens.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    scene.tweens.chain({ tweens, onComplete: () => resolve(), onStop: () => resolve() });
  });
}
