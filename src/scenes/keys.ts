import type Phaser from 'phaser';
import type { BoosterId } from '../config/economy';

export const SCENES = {
  boot: 'Boot',
  auth: 'Auth',
  home: 'Home',
  game: 'Game',
} as const;

export interface AuthSceneData {
  /** Giriş ekranında gösterilecek bilgi (ör. "Oturumun sona erdi"). */
  readonly message?: string;
}

export interface GameSceneData {
  readonly levelId?: number;
  readonly seed?: number;
  /**
   * Kasabadaki başlangıç penceresinde seçilip ödenmiş güçlendiriciler (can da harcandı).
   * Verilmezse (ör. ?level= ile doğrudan açılış) başlangıç penceresi oyun ekranında açılır.
   */
  readonly boosters?: readonly BoosterId[];
}

export interface HomeSceneData {
  /** Bölümden yeni dönüldüyse kazanılan yıldız (sayaç animasyonu için). */
  readonly starsEarned?: number;
  /** Geçilen seviye bir hediye sandığı verdiyse o seviye (sandık kasabada açılır). */
  readonly chestLevel?: number;
}

const FADE_MS = 220;

/** Kararıp açılan sahne geçişi. */
export function goToScene(scene: Phaser.Scene, key: string, data?: object): void {
  scene.input.enabled = false;
  scene.cameras.main.fadeOut(FADE_MS, 3, 26, 43);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

export function fadeInScene(scene: Phaser.Scene): void {
  // Sahneden çıkarken kapatılan girdi, sahne yeniden açıldığında kendiliğinden geri gelmez.
  scene.input.enabled = true;
  scene.cameras.main.fadeIn(FADE_MS, 3, 26, 43);
}
