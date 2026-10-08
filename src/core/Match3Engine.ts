import { BOARD_CONFIG } from '../config/board';
import {
  ActivationRunner,
  randomTargetPicker,
  singleActivation,
  swapActivations,
  type Activation,
  type PendingActivation,
  type TargetPicker,
} from './activation';
import type { Board } from './Board';
import type { BoardShape } from './BoardShape';
import { generateBoard } from './generator';
import { settle, type FallMove, type SpawnMove } from './gravity';
import { findMatchGroups, type MatchGroup } from './matchFinder';
import type { ObstacleHit, ObstacleLayer } from './obstacles';
import { offset, posKey } from './pos';
import { canSwap, findPossibleMoves, hasPossibleMove, isSwappable, type PossibleMove } from './possibleMoves';
import { Random } from './Random';
import { shuffleBoard, type ShuffleMove } from './shuffle';
import { RandomSpawner, type TileSpawner } from './spawner';
import { planSpecial, type PlanContext } from './specials';
import type { ClearedTile, Pos, SpecialKind, Tile, TileColor } from './types';

export interface EngineOptions {
  colors?: readonly TileColor[];
  minMatch?: number;
  maxCascadeSteps?: number;
  maxShuffleAttempts?: number;
  /** Martı hedef seçici (Aşama 3: bölüm hedeflerine öncelik). */
  targetPicker?: TargetPicker;
}

/** Hedef seçilerek kullanılan yardımcılar (Fırtına hedefsizdir: shuffle()). */
export type ToolKind = 'shovel' | 'helm';

/** Eşleşmeden doğan güçlendirici: grup taşları `pos` karesinde birleşir, yeni taş oluşur. */
export interface CreatedSpecial {
  readonly tile: Tile;
  readonly pos: Pos;
  readonly mergedTileIds: readonly number[];
}

/**
 * Zincirin bir adımı. Görünüm sırayla oynatır:
 *  1) dalga 0: eşleşen taşlar temizlenir, güçlendiriciler oluşur (created)
 *  2) dalga 1, 2, …: güçlendirici etkileri (activations, wave'e göre)
 *  3) taşlar düşer, yenileri gelir (falls, spawns)
 */
export interface CascadeStep {
  /** 0 = oyuncunun hamlesi, 1+ = zincirleme (cascade). */
  readonly index: number;
  readonly groups: readonly MatchGroup[];
  readonly created: readonly CreatedSpecial[];
  readonly activations: readonly Activation[];
  /** Bu adımda kalkan tüm taşlar (eşleşme + etkiler). */
  readonly cleared: readonly ClearedTile[];
  /** Eşleşmelerin (dalga 0) engellere verdiği hasar. Etkilerinki activations içinde. */
  readonly obstacleHits: readonly ObstacleHit[];
  readonly falls: readonly FallMove[];
  readonly spawns: readonly SpawnMove[];
  /** Yerçekimi simülasyonunun sürdüğü adım sayısı (animasyon süresi için). */
  readonly settleTicks: number;
}

/**
 * Hamle sonucu:
 * - invalid:  komşu değil / taş yok / boşluk → hiçbir şey olmadı
 * - rejected: geçerli kaydırma ama eşleşme yok → taşlar geri döner, hamle harcanmaz
 * - resolved: hamle gerçekleşti; adımlar sırayla animasyona dönüştürülür
 * Dokunarak tetiklemede a ve b aynı karedir.
 */
export type MoveResult =
  | { readonly kind: 'invalid'; readonly a: Pos; readonly b: Pos }
  | { readonly kind: 'rejected'; readonly a: Pos; readonly b: Pos }
  | {
      readonly kind: 'resolved';
      readonly a: Pos;
      readonly b: Pos;
      readonly steps: readonly CascadeStep[];
      /** Hamle kalmadığı için tahta karıştırıldıysa. */
      readonly shuffle?: readonly ShuffleMove[];
    };

const NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/**
 * Tahta kurallarının tek giriş noktası. Durumu anında ve senkron günceller;
 * görünüm katmanı dönen olay listesini kendi hızında oynatır.
 */
export class Match3Engine {
  readonly colors: readonly TileColor[];
  readonly minMatch: number;
  private readonly maxCascadeSteps: number;
  private readonly maxShuffleAttempts: number;
  private readonly targetPicker: TargetPicker;

  constructor(
    readonly board: Board,
    private readonly rng: Random,
    private readonly spawner: TileSpawner,
    options: EngineOptions = {},
  ) {
    this.colors = options.colors ?? BOARD_CONFIG.defaultColors;
    this.minMatch = options.minMatch ?? BOARD_CONFIG.minMatch;
    this.maxCascadeSteps = options.maxCascadeSteps ?? BOARD_CONFIG.maxCascadeSteps;
    this.maxShuffleAttempts = options.maxShuffleAttempts ?? BOARD_CONFIG.maxShuffleAttempts;
    this.targetPicker = options.targetPicker ?? randomTargetPicker;
  }

  /** Verilen şekil ve tohumla oynanabilir yeni bir tahta kurar. */
  static create(shape: BoardShape, seed: number, options: EngineOptions = {}): Match3Engine {
    const rng = new Random(seed);
    const colors = options.colors ?? BOARD_CONFIG.defaultColors;
    const board = generateBoard(shape, rng, colors, options.minMatch ?? BOARD_CONFIG.minMatch);
    return new Match3Engine(board, rng, new RandomSpawner(rng, colors), options);
  }

  /**
   * a'daki taşı b'ye kaydırır.
   * - İki sıradan taş: eşleşme yoksa geri döner (rejected).
   * - İçlerinden biri güçlendiriciyse hamle her zaman geçerlidir ve güçlendirici tetiklenir;
   *   ikisi de güçlendiriciyse (veya biri Girdap'sa) kombinasyon oluşur.
   */
  trySwap(a: Pos, b: Pos): MoveResult {
    if (!canSwap(this.board, a, b)) return { kind: 'invalid', a, b };

    const movedTile = this.board.getTile(a)!;
    const otherTile = this.board.getTile(b)!;
    this.board.swap(a, b);
    const ctx: PlanContext = {
      swapCells: [b, a],
      swapAxis: a.row === b.row ? 'horizontal' : 'vertical',
    };

    if (!movedTile.special && !otherTile.special) {
      if (findMatchGroups(this.board, this.minMatch).length === 0) {
        this.board.swap(a, b);
        return { kind: 'rejected', a, b };
      }
      return this.finish(a, b, this.resolve(ctx, [], false));
    }

    const moved = { tile: movedTile, pos: b };
    const other = { tile: otherTile, pos: a };
    const isCombo =
      (movedTile.special && otherTile.special) ||
      movedTile.special === 'whirlpool' ||
      otherTile.special === 'whirlpool';
    const forced = swapActivations(moved, other, 1);
    // Kombinasyonda önce etki çalışır; tek güçlendirici + sıradan taşta oluşan eşleşmeler de çözülür.
    return this.finish(a, b, this.resolve(ctx, forced, Boolean(isCombo)));
  }

  /** Güçlendiriciye tek dokunuşla tetikleme. */
  activateAt(p: Pos): MoveResult {
    const tile = this.board.getTile(p);
    if (!tile?.special || this.board.isCovered(p)) return { kind: 'invalid', a: p, b: p };
    return this.finish(p, p, this.resolve({}, [singleActivation(tile, p, 1)], true));
  }

  /** Birden çok güçlendiriciyi aynı anda tetikler (bölüm sonu kutlaması). Etkiler aynı dalgada oynar. */
  activateMany(points: readonly Pos[]): MoveResult {
    const forced = points.flatMap((p) => {
      const tile = this.board.getTile(p);
      return tile?.special && !this.board.isCovered(p) ? [singleActivation(tile, p, 1)] : [];
    });
    const first = points[0] ?? { row: 0, col: 0 };
    if (forced.length === 0) return { kind: 'invalid', a: first, b: first };
    return this.finish(first, first, this.resolve({}, forced, true));
  }

  /**
   * Bölüm içi yardımcı: Kürek tek kareyi, Dümen o karenin satırını temizler.
   * Güçlendirici gibi işler: taşlar kırılır, engeller hasar alır, alandaki güçlendiriciler patlar.
   */
  useTool(tool: ToolKind, p: Pos): MoveResult {
    if (!this.board.isPlayable(p)) return { kind: 'invalid', a: p, b: p };
    const tile = this.board.getTile(p);
    if (tool === 'shovel' && !tile && !this.board.hasObstacle(p)) return { kind: 'invalid', a: p, b: p };
    const color = tile?.color ?? this.colors[0];
    return this.finish(p, p, this.resolve({}, [{ wave: 1, kind: tool, origin: p, color, consumed: [] }], true));
  }

  private finish(a: Pos, b: Pos, steps: CascadeStep[]): MoveResult {
    const shuffle = this.ensurePlayable() ?? undefined;
    return { kind: 'resolved', a, b, steps, shuffle };
  }

  /** Eşleşme ve etki kalmayana kadar adımları çalıştırır. */
  private resolve(
    firstContext: PlanContext,
    forced: readonly PendingActivation[],
    skipFirstMatch: boolean,
  ): CascadeStep[] {
    const steps: CascadeStep[] = [];
    let recentlyMoved: Set<string> | undefined;
    for (let index = 0; index < this.maxCascadeSteps; index++) {
      const first = index === 0;
      const groups = first && skipFirstMatch ? [] : findMatchGroups(this.board, this.minMatch);
      const pending = first ? forced : [];
      if (groups.length === 0 && pending.length === 0) break;

      const step = this.runStep(index, groups, pending, first ? firstContext : { recentlyMoved });
      steps.push(step);
      recentlyMoved = new Set([...step.falls.map((f) => posKey(f.to)), ...step.spawns.map((s) => posKey(s.to))]);
    }
    return steps;
  }

  private runStep(
    index: number,
    groups: readonly MatchGroup[],
    forced: readonly PendingActivation[],
    ctx: PlanContext,
  ): CascadeStep {
    const protectedCells = new Set<string>();
    const runner = new ActivationRunner(this.board, this.rng, protectedCells, this.targetPicker);
    for (const pending of forced) runner.enqueue(pending);

    const matchCleared: ClearedTile[] = [];
    const created: CreatedSpecial[] = [];
    const obstacleHits: ObstacleHit[] = [];
    const hitIds = new Set<number>();
    /** Eşleşme aşamasında her engel en fazla bir kez hasar alır. */
    const hit = (pos: Pos, layer: ObstacleLayer, cause: 'match' | 'adjacent') => {
      const obstacle = this.board.getObstacle(pos, layer);
      if (!obstacle || hitIds.has(obstacle.id)) return;
      const result = this.board.hitObstacle(pos, layer, cause, 0);
      if (!result) return;
      hitIds.add(obstacle.id);
      obstacleHits.push(result);
    };

    const isCovered = (p: Pos) => this.board.isCovered(p);
    const matchedCells = new Set<string>();
    for (const group of groups) {
      const plan = planSpecial(group, { ...ctx, isExcluded: isCovered });
      const merged: number[] = [];
      for (const pos of group.cells) {
        matchedCells.add(posKey(pos));
        const tile = this.board.getTile(pos);
        if (!tile) continue;
        if (this.board.isCovered(pos)) {
          // Ağdaki taş eşleşmeye katılır ama yerinde kalır; ağ yırtılır.
          hit(pos, 'cover', 'match');
          continue;
        }
        this.board.setTile(pos, null);
        matchCleared.push({ tileId: tile.id, color: tile.color, special: tile.special, pos, wave: 0 });
        merged.push(tile.id);
        runner.trigger(tile, pos, 1);
        hit(pos, 'floor', 'match');
      }
      if (plan) {
        const tile = this.board.createTile(group.color, plan.special);
        this.board.setTile(plan.pos, tile);
        protectedCells.add(posKey(plan.pos));
        created.push({ tile, pos: plan.pos, mergedTileIds: merged });
      }
    }

    // Eşleşmenin yanındaki engeller (kum torbası, sandık, yuva, ağ).
    for (const group of groups) {
      for (const pos of group.cells) {
        for (const [dRow, dCol] of NEIGHBORS) {
          const n = offset(pos, dRow, dCol);
          if (matchedCells.has(posKey(n))) continue;
          hit(n, 'block', 'adjacent');
          hit(n, 'cover', 'adjacent');
        }
      }
    }

    runner.run();
    const settled = settle(this.board, (p) => this.spawner.spawn(this.board, p));
    return {
      index,
      groups,
      created,
      activations: runner.activations,
      cleared: [...matchCleared, ...runner.cleared],
      obstacleHits,
      falls: settled.falls,
      spawns: settled.spawns,
      settleTicks: settled.ticks,
    };
  }

  /** Olası hamle yoksa tahtayı karıştırır. Karıştırma olduysa hareketleri döndürür. */
  ensurePlayable(): ShuffleMove[] | null {
    if (hasPossibleMove(this.board, this.minMatch)) return null;
    return this.shuffle();
  }

  /** Tahtayı koşulsuz karıştırır (hamle kalmayınca ve "Fırtına" yardımcısıyla). */
  shuffle(): ShuffleMove[] | null {
    return shuffleBoard(this.board, this.rng, this.colors, this.minMatch, this.maxShuffleAttempts);
  }

  /**
   * İpucu: en çok taş eşleştiren hamle (rastgelelik tüketmez, deterministik).
   * Eşleşen hamle yoksa bir güçlendiriciyi gösterir (a = b).
   */
  findHint(): PossibleMove | null {
    let best: PossibleMove | null = null;
    for (const move of findPossibleMoves(this.board, this.minMatch)) {
      if (!best || move.matchCells.length > best.matchCells.length) best = move;
    }
    if (best) return best;
    const special = this.board
      .playablePositions()
      .find((p) => this.board.getTile(p)?.special && isSwappable(this.board, p));
    return special ? { a: special, b: special, matchCells: [special] } : null;
  }

  countPossibleMoves(): number {
    return findPossibleMoves(this.board, this.minMatch).length;
  }

  /**
   * Bölüm sonu kutlaması için: rastgele bir serbest sıradan taşı güçlendiriciye çevirir.
   * Ardından activateAt(pos) ile patlatılır. Uygun taş yoksa null.
   */
  convertRandomTile(kinds: readonly SpecialKind[]): { tileId: number; pos: Pos; special: SpecialKind } | null {
    const candidates = this.board
      .playablePositions()
      .filter((p) => isSwappable(this.board, p) && !this.board.getTile(p)!.special);
    if (candidates.length === 0) return null;
    const pos = this.rng.pick(candidates);
    const tile = this.board.getTile(pos)!;
    tile.special = this.rng.pick(kinds);
    return { tileId: tile.id, pos, special: tile.special };
  }

  /** Geliştirici aracı: bir taşı güçlendiriciye çevirir (test paneli için). */
  debugSetSpecial(p: Pos, special: SpecialKind | undefined): Tile | null {
    const tile = this.board.getTile(p);
    if (!tile) return null;
    if (special) tile.special = special;
    else delete tile.special;
    return tile;
  }
}
