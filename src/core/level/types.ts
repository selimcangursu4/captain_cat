import type { BoardShape } from '../BoardShape';
import type { ObstacleKind } from '../obstacles';
import type { Pos, SpecialKind, TileColor } from '../types';
import type { TutorialStep } from './tutorial';

/**
 * Bölüm hedefleri:
 *  color    — belirli renkte taş topla ("30 balık topla")
 *  obstacle — belirli türde engeli yok et ("tüm yosunları temizle")
 *  seagull  — martı yuvalarından martı topla ("10 martı topla")
 */
export type GoalDefinition =
  | { readonly type: 'color'; readonly color: TileColor; readonly count: number }
  | { readonly type: 'obstacle'; readonly kind: ObstacleKind; readonly count: number }
  | { readonly type: 'seagull'; readonly count: number };

export interface PlacedObstacleDef {
  readonly pos: Pos;
  readonly kind: ObstacleKind;
  readonly layers: number;
}

export interface PresetTile {
  readonly pos: Pos;
  readonly color: TileColor;
  readonly special?: SpecialKind;
}

/** Doğrulanmış bölüm tanımı (parseLevel çıktısı). */
export interface LevelDefinition {
  readonly id: number;
  readonly moves: number;
  readonly colors: readonly TileColor[];
  readonly shape: BoardShape;
  readonly obstacles: readonly PlacedObstacleDef[];
  readonly presetTiles: readonly PresetTile[];
  readonly goals: readonly GoalDefinition[];
  /** Aynı tahtanın her seferinde gelmesi için (öğretici bölümler). */
  readonly seed?: number;
  /** Öğretici adımları (yoksa boş). */
  readonly tutorial: readonly TutorialStep[];
}

/**
 * Bölüm JSON dosyasının biçimi. Izgaralar `board` ile aynı boyutta satır dizileridir;
 * '.' boş demektir. Kodlar engel tanımlarından gelir (src/core/obstacles.ts):
 *   floor: '1' / '2'   → 1-2 katman yosun
 *   cover: 'n'         → ağ
 *   block: '1'..'3'    → kum torbası (katman), 'c' → kilitli sandık, 'b' → martı yuvası
 *   tiles: F A S R T   → sabit taş (balık, çapa, kabuk, can simidi, yıldız)
 */
export interface LevelFile {
  id: number;
  moves: number;
  colors: string[];
  board?: string[];
  floor?: string[];
  cover?: string[];
  block?: string[];
  tiles?: string[];
  specials?: { at: [number, number]; kind: string }[];
  goals: ({ type: 'color'; color: string; count: number } | { type: 'obstacle'; kind: string; count?: number } | { type: 'seagull'; count?: number })[];
  seed?: number;
  tutorial?: TutorialFileStep[];
}

/** Dosyadaki öğretici adımı: konumlar [satır, sütun] dizisi olarak yazılır. */
export interface TutorialFileStep {
  text: string;
  swap?: [[number, number], [number, number]];
  expect?: { creates?: string };
  tap?: string;
  swapSpecials?: true;
  swapSpecialWith?: string;
  color?: string;
}
