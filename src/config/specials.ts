/** Güçlendirici etki alanları ve kombinasyon ayarları. */
export const SPECIALS_CONFIG = {
  /** Gülle: merkezden bu kadar kare (1 → 3x3). */
  cannonRadius: 1,
  /** Gülle + Gülle (1 → 3x3, 2 → 5x5). */
  bigCannonRadius: 2,
  /** Harpun + Gülle: merkez satır/sütunun iki yanındaki ek satır/sütun sayısı (1 → 3 satır + 3 sütun). */
  harpoonCannonSpread: 1,
  /** Martı kalkarken 4 komşusunu da kırar mı? */
  seagullHitsNeighbors: true,
  /** Martı + Martı kombosunda uçan martı sayısı. */
  seagullComboCount: 3,
} as const;
