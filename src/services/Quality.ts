import type Phaser from 'phaser';
import { FEEDBACK } from '../config/feedback';

/**
 * Görsel kalite. Cihaz yavaşsa (FPS birkaç saniye eşiğin altında kalırsa) parçacık sayıları
 * yarıya iner; oyun akıcı kalır. Kalite yalnızca düşer, oturum boyunca geri yükselmez
 * (iki durum arasında gidip gelmesin).
 */
export const quality = {
  particleScale: 1 as number,
  get low(): boolean {
    return this.particleScale < 1;
  },
  /** Parçacık sayısını kaliteye göre ölçekler (en az 1). */
  count(n: number): number {
    return Math.max(1, Math.round(n * this.particleScale));
  },
};

export function monitorQuality(game: Phaser.Game): void {
  let slowSeconds = 0;
  const timer = setInterval(() => {
    if (document.hidden) return;
    const fps = game.loop.actualFps;
    slowSeconds = fps < FEEDBACK.lowFpsThreshold ? slowSeconds + 1 : 0;
    if (slowSeconds >= FEEDBACK.lowFpsSeconds) {
      quality.particleScale = FEEDBACK.lowQualityParticleScale;
      clearInterval(timer);
      if (import.meta.env.DEV) console.info(`[Kaptan Pati] düşük FPS (${Math.round(fps)}): parçacıklar azaltıldı`);
    }
  }, 1000);
}
