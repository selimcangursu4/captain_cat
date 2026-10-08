/** Oyundaki taş türleri. Sıra, renk paletindeki sırayla aynıdır. */
export const TILE_COLORS = ['fish', 'anchor', 'shell', 'ring', 'star'] as const;
export type TileColor = (typeof TILE_COLORS)[number];

/**
 * Güçlendiriciler (özel taşlar):
 *  harpoon-h — Harpun, satırı temizler     (4'lü düz eşleşme)
 *  harpoon-v — Harpun, sütunu temizler
 *  cannon    — Top Güllesi, 3x3 patlar     (L / T eşleşme)
 *  whirlpool — Girdap, bir rengi toplar    (5'li düz eşleşme) — renksizdir
 *  seagull   — Martı, bir hedefe uçar      (2x2 kare eşleşme)
 */
export const SPECIAL_KINDS = ['harpoon-h', 'harpoon-v', 'cannon', 'whirlpool', 'seagull'] as const;
export type SpecialKind = (typeof SPECIAL_KINDS)[number];

export function isHarpoon(kind: SpecialKind | undefined): kind is 'harpoon-h' | 'harpoon-v' {
  return kind === 'harpoon-h' || kind === 'harpoon-v';
}

/** Tahtadaki bir kare. row: yukarıdan aşağı, col: soldan sağa. */
export interface Pos {
  readonly row: number;
  readonly col: number;
}

/**
 * Tahtadaki bir taş. `id` taşın ömrü boyunca sabittir; görünüm katmanı
 * sprite'ları bu kimlikle eşler. Güçlendiriciler oluştukları eşleşmenin rengini
 * korur ve o renkle eşleşebilir (Girdap hariç).
 */
export interface Tile {
  readonly id: number;
  color: TileColor;
  special?: SpecialKind;
}

/** Bir adımda tahtadan kalkan taş. wave 0 = eşleşme, 1+ = güçlendirici dalgaları. */
export interface ClearedTile {
  readonly tileId: number;
  readonly color: TileColor;
  readonly special?: SpecialKind;
  readonly pos: Pos;
  readonly wave: number;
}
