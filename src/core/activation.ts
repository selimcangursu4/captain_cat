import { SPECIALS_CONFIG } from '../config/specials';
import type { Board } from './Board';
import { matchColor } from './matchFinder';
import type { ObstacleHit, ObstacleLayer } from './obstacles';
import { posKey, uniquePositions } from './pos';
import type { Random } from './Random';
import { areaCells, bandCells, colCells, plusCells, rowCells } from './specials';
import {
  TILE_COLORS,
  isHarpoon,
  type ClearedTile,
  type Pos,
  type SpecialKind,
  type Tile,
  type TileColor,
} from './types';

/** Etki türü: tekil güçlendiriciler + kombinasyonlar. */
export type ActivationKind =
  | SpecialKind
  | 'harpoon-cross' // Harpun + Harpun: artı (satır + sütun)
  | 'cannon-big' // Gülle + Gülle: 5x5
  | 'harpoon-cannon' // Harpun + Gülle: 3 satır + 3 sütun
  | 'whirlpool-convert' // Girdap + güçlendirici: o renkteki taşlar güçlendiriciye dönüşür
  | 'whirlpool-all' // Girdap + Girdap: tüm tahta
  | 'shovel' // Kürek yardımcısı: tek kare
  | 'helm'; // Dümen yardımcısı: bir satır

export interface ConvertedTile {
  readonly tileId: number;
  readonly pos: Pos;
  readonly special: SpecialKind;
}

/** Görünümün oynatacağı tek bir güçlendirici etkisi. */
export interface Activation {
  readonly wave: number;
  readonly kind: ActivationKind;
  readonly origin: Pos;
  /** Etkinin rengi (Girdap'ta toplanan renk; diğerlerinde güçlendiricinin rengi). */
  readonly color: TileColor;
  /** Etki alanı (Martı'da kalkış alanı). */
  readonly cells: readonly Pos[];
  /** Martı: uçtuğu hedef ve oradaki etki alanı. */
  readonly target?: Pos;
  readonly targetCells?: readonly Pos[];
  /** Martı kombosu: hedefe taşınan güçlendirici. */
  readonly carried?: SpecialKind;
  /** Girdap + güçlendirici: dönüştürülen taşlar (bir sonraki dalgada patlarlar). */
  readonly converted?: readonly ConvertedTile[];
  readonly cleared: readonly ClearedTile[];
  /** Bu etkinin engellere verdiği hasar. */
  readonly obstacleHits: readonly ObstacleHit[];
}

/** Sırada bekleyen etki. `consumed`: etkiyi başlatan taşlar (hâlâ tahtadaysa kaldırılır). */
export interface PendingActivation {
  readonly wave: number;
  readonly kind: ActivationKind;
  readonly origin: Pos;
  /** Verilmezse işlenirken belirlenir (Girdap: tahtada en çok bulunan renk). */
  readonly color?: TileColor;
  readonly consumed: readonly { readonly tile: Tile; readonly pos: Pos }[];
  readonly carried?: SpecialKind;
  readonly convertTo?: SpecialKind;
  /** Martı + Martı kombosundaki ek martılar kalkış alanını tekrar kırmaz. */
  readonly skipLaunchArea?: boolean;
}

/**
 * Martı hedef seçici. Aşama 3'te bölüm hedeflerine (engeller, toplanacak taşlar)
 * öncelik veren bir seçiciyle değiştirilecek.
 */
export type TargetPicker = (board: Board, candidates: readonly Pos[], rng: Random) => Pos | null;

export const randomTargetPicker: TargetPicker = (_board, candidates, rng) =>
  candidates.length > 0 ? rng.pick(candidates) : null;

/** Tekil güçlendiricinin kendi etkisi. */
export function singleActivation(tile: Tile, pos: Pos, wave: number): PendingActivation {
  if (!tile.special) throw new Error('singleActivation: taş güçlendirici değil');
  return {
    wave,
    kind: tile.special,
    origin: pos,
    color: tile.special === 'whirlpool' ? undefined : tile.color,
    consumed: [{ tile, pos }],
  };
}

/**
 * İki taşın kaydırılmasıyla oluşan etki(ler). En az biri güçlendirici olmalı.
 * `moved` oyuncunun sürüklediği taş (yeni yeri = kombonun merkezi), `other` diğeri.
 */
export function swapActivations(
  moved: { tile: Tile; pos: Pos },
  other: { tile: Tile; pos: Pos },
  wave: number,
): PendingActivation[] {
  const a = moved.tile.special;
  const b = other.tile.special;
  const origin = moved.pos;
  const both = [moved, other];

  if (a === 'whirlpool' && b === 'whirlpool') {
    return [{ wave, kind: 'whirlpool-all', origin, color: moved.tile.color, consumed: both }];
  }
  if (a === 'whirlpool' || b === 'whirlpool') {
    const whirl = a === 'whirlpool' ? moved : other;
    const partner = a === 'whirlpool' ? other : moved;
    if (partner.tile.special) {
      return [
        {
          wave,
          kind: 'whirlpool-convert',
          origin: whirl.pos,
          color: partner.tile.color,
          convertTo: partner.tile.special,
          consumed: [whirl],
        },
      ];
    }
    return [{ wave, kind: 'whirlpool', origin: whirl.pos, color: partner.tile.color, consumed: [whirl] }];
  }
  if (a && b) {
    const color = moved.tile.color;
    if (isHarpoon(a) && isHarpoon(b)) return [{ wave, kind: 'harpoon-cross', origin, color, consumed: both }];
    if (a === 'cannon' && b === 'cannon') return [{ wave, kind: 'cannon-big', origin, color, consumed: both }];
    if ((isHarpoon(a) && b === 'cannon') || (a === 'cannon' && isHarpoon(b))) {
      return [{ wave, kind: 'harpoon-cannon', origin, color, consumed: both }];
    }
    if (a === 'seagull' && b === 'seagull') {
      return Array.from({ length: SPECIALS_CONFIG.seagullComboCount }, (_, i) => ({
        wave,
        kind: 'seagull' as const,
        origin,
        color,
        consumed: i === 0 ? both : [],
        skipLaunchArea: i > 0,
      }));
    }
    // Martı + Harpun/Gülle: martı diğerini hedefe taşır.
    const carried = a === 'seagull' ? b : a;
    return [{ wave, kind: 'seagull', origin, color, consumed: both, carried }];
  }
  const single = a ? moved : other;
  return [singleActivation(single.tile, single.pos, wave)];
}

/**
 * Bir zincir adımındaki tüm güçlendirici etkilerini dalga dalga işler.
 * Etki alanındaki güçlendiriciler bir sonraki dalgada tetiklenir; her taş en fazla
 * bir kez tetiklenir. Korunan kareler (aynı adımda doğan güçlendiriciler) etkilenmez.
 */
export class ActivationRunner {
  readonly activations: Activation[] = [];
  readonly cleared: ClearedTile[] = [];
  readonly obstacleHits: ObstacleHit[] = [];
  private readonly queue: PendingActivation[] = [];
  private readonly activated = new Set<number>();
  private readonly targeted = new Set<string>();

  constructor(
    private readonly board: Board,
    private readonly rng: Random,
    private readonly protectedCells: ReadonlySet<string>,
    private readonly pickTarget: TargetPicker,
  ) {}

  enqueue(pending: PendingActivation): void {
    for (const c of pending.consumed) this.activated.add(c.tile.id);
    this.queue.push(pending);
  }

  /** Temizlenen taş bir güçlendiriciyse ve henüz tetiklenmediyse sıraya ekler. */
  trigger(tile: Tile, pos: Pos, wave: number): void {
    if (!tile.special || this.activated.has(tile.id)) return;
    this.enqueue(singleActivation(tile, pos, wave));
  }

  run(): void {
    // Dalgalar artan sırada işlenir (yeni etkiler hep wave + 1 ile eklenir).
    this.queue.sort((a, b) => a.wave - b.wave);
    while (this.queue.length > 0) this.process(this.queue.shift()!);
  }

  private process(p: PendingActivation): void {
    const cleared: ClearedTile[] = [];
    const hits: ObstacleHit[] = [];
    for (const { tile, pos } of p.consumed) {
      if (this.board.getTile(pos)?.id === tile.id) this.remove(pos, tile, p.wave, cleared);
    }

    const color = p.color ?? this.mostCommonColor() ?? p.consumed[0]?.tile.color ?? TILE_COLORS[0];
    const chain = p.kind !== 'whirlpool-all';
    let cells: Pos[] = [];
    let target: Pos | undefined;
    let targetCells: Pos[] | undefined;
    let converted: ConvertedTile[] | undefined;

    switch (p.kind) {
      case 'harpoon-h':
      case 'helm':
        cells = rowCells(this.board, p.origin.row);
        break;
      case 'shovel':
        cells = [p.origin];
        break;
      case 'harpoon-v':
        cells = colCells(this.board, p.origin.col);
        break;
      case 'harpoon-cross':
        cells = uniquePositions([...rowCells(this.board, p.origin.row), ...colCells(this.board, p.origin.col)]);
        break;
      case 'cannon':
        cells = areaCells(this.board, p.origin, SPECIALS_CONFIG.cannonRadius);
        break;
      case 'cannon-big':
        cells = areaCells(this.board, p.origin, SPECIALS_CONFIG.bigCannonRadius);
        break;
      case 'harpoon-cannon':
        cells = bandCells(this.board, p.origin, SPECIALS_CONFIG.harpoonCannonSpread);
        break;
      case 'whirlpool':
        cells = this.cellsOfColor(color);
        break;
      case 'whirlpool-all':
        cells = [...this.board.playablePositions()];
        break;
      case 'whirlpool-convert':
        cells = this.cellsOfColor(color);
        converted = this.convert(cells, p.convertTo!, p.wave, hits);
        break;
      case 'seagull': {
        if (!p.skipLaunchArea && SPECIALS_CONFIG.seagullHitsNeighbors) cells = plusCells(this.board, p.origin);
        this.clearCells(cells, p.wave, cleared, hits, chain);
        target = this.chooseSeagullTarget() ?? undefined;
        if (target) {
          this.targeted.add(posKey(target));
          targetCells = this.carriedArea(target, p.carried);
          this.clearCells(targetCells, p.wave, cleared, hits, chain);
        }
        break;
      }
    }

    if (p.kind !== 'seagull' && p.kind !== 'whirlpool-convert') {
      this.clearCells(cells, p.wave, cleared, hits, chain);
    }
    this.activations.push({
      wave: p.wave,
      kind: p.kind,
      origin: p.origin,
      color,
      cells,
      target,
      targetCells,
      carried: p.carried,
      converted,
      cleared,
      obstacleHits: hits,
    });
  }

  private carriedArea(target: Pos, carried: SpecialKind | undefined): Pos[] {
    if (carried === 'harpoon-h') return rowCells(this.board, target.row);
    if (carried === 'harpoon-v') return colCells(this.board, target.col);
    if (carried === 'cannon') return areaCells(this.board, target, SPECIALS_CONFIG.cannonRadius);
    return [target];
  }

  private chooseSeagullTarget(): Pos | null {
    const candidates = this.board
      .playablePositions()
      .filter(
        (q) =>
          (this.board.getTile(q) !== null || this.board.hasObstacle(q)) &&
          !this.protectedCells.has(posKey(q)) &&
          !this.targeted.has(posKey(q)),
      );
    return this.pickTarget(this.board, candidates, this.rng);
  }

  /** Girdap + güçlendirici: o renkteki sıradan taşlar güçlendiriciye dönüşür, sonraki dalgada patlar. */
  private convert(cells: readonly Pos[], to: SpecialKind, wave: number, hits: ObstacleHit[]): ConvertedTile[] {
    const converted: ConvertedTile[] = [];
    for (const pos of cells) {
      const tile = this.board.getTile(pos);
      if (!tile || this.activated.has(tile.id)) continue;
      if (this.board.isCovered(pos)) {
        // Ağdaki taş dönüşmez; Girdap yalnızca ağı yırtar.
        this.hit(pos, 'cover', wave, hits);
        continue;
      }
      if (!tile.special) {
        tile.special = isHarpoon(to) ? (this.rng.next() < 0.5 ? 'harpoon-h' : 'harpoon-v') : to;
        converted.push({ tileId: tile.id, pos, special: tile.special });
      }
      this.enqueue(singleActivation(tile, pos, wave + 1));
    }
    return converted;
  }

  private cellsOfColor(color: TileColor): Pos[] {
    return this.board
      .playablePositions()
      .filter((q) => !this.protectedCells.has(posKey(q)) && matchColor(this.board.getTile(q)) === color);
  }

  /** Tahtada en çok bulunan eşleşebilir renk (Girdap tek başına tetiklendiğinde). */
  private mostCommonColor(): TileColor | null {
    const counts = new Map<TileColor, number>();
    for (const q of this.board.playablePositions()) {
      if (this.protectedCells.has(posKey(q))) continue;
      const color = matchColor(this.board.getTile(q));
      if (color) counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    let best: TileColor | null = null;
    for (const color of TILE_COLORS) {
      if ((counts.get(color) ?? 0) > (best ? counts.get(best)! : 0)) best = color;
    }
    return best;
  }

  /**
   * Etki alanındaki kareler: blok engel hasar alır; ağdaki taş kalır, ağ yırtılır;
   * serbest taş kalkar (güçlendiriciyse zincirlenir); zemindeki yosun temizlenir.
   */
  private clearCells(
    cells: readonly Pos[],
    wave: number,
    out: ClearedTile[],
    hits: ObstacleHit[],
    chain: boolean,
  ): void {
    for (const pos of cells) {
      if (this.protectedCells.has(posKey(pos))) continue;
      if (this.board.isBlocked(pos)) {
        this.hit(pos, 'block', wave, hits);
        continue;
      }
      const tile = this.board.getTile(pos);
      if (tile && this.board.isCovered(pos)) {
        this.hit(pos, 'cover', wave, hits);
        continue;
      }
      if (tile) {
        this.remove(pos, tile, wave, out);
        if (chain) this.trigger(tile, pos, wave + 1);
        else this.activated.add(tile.id);
      }
      this.hit(pos, 'floor', wave, hits);
    }
  }

  private hit(pos: Pos, layer: ObstacleLayer, wave: number, hits: ObstacleHit[]): void {
    const hit = this.board.hitObstacle(pos, layer, 'special', wave);
    if (!hit) return;
    hits.push(hit);
    this.obstacleHits.push(hit);
  }

  private remove(pos: Pos, tile: Tile, wave: number, out: ClearedTile[]): void {
    this.board.setTile(pos, null);
    const entry: ClearedTile = { tileId: tile.id, color: tile.color, special: tile.special, pos, wave };
    out.push(entry);
    this.cleared.push(entry);
  }
}
