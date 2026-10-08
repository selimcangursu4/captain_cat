/** Engellerin varsayılan dayanıklılıkları ve ödülleri. */
export const OBSTACLE_CONFIG = {
  /** Kilitli sandık kaç vuruşta açılır. */
  chestHits: 3,
  /** Sandıktan çıkan altın. */
  chestCoins: 15,
  /** Martı yuvası kaç kez vurulabilir (her vuruşta 1 martı toplanır). */
  nestLayers: 4,
} as const;
