import { TILE_COLORS, type TileColor } from '../core/types';

/** Tahta mantığı ayarları (saf veri — Phaser bağımlılığı yok). */
export const BOARD_CONFIG = {
  defaultRows: 8,
  defaultCols: 8,
  /** Eşleşme sayılması için gereken en az aynı renk taş. */
  minMatch: 3,
  /** 2x2 aynı renk kare de eşleşme sayılır (Martı oluşturur). */
  squareMatches: true,
  /** Varsayılan taş renkleri; bölüm dosyası bunu daraltabilir. */
  defaultColors: TILE_COLORS as readonly TileColor[],
  /** Sonsuz zincirlemeye karşı güvenlik sınırı. */
  maxCascadeSteps: 100,
  /** Eşleşmesiz ve hamlesi olan tahta üretmek için deneme sayısı. */
  maxGenerateAttempts: 200,
  /** Karıştırmada geçerli dizilim bulmak için deneme sayısı. */
  maxShuffleAttempts: 200,
  /** Yerçekimi simülasyonu için güvenlik sınırı (adım). */
  maxSettleTicks: 500,
} as const;
