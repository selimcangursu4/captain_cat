import { BOARD_CONFIG } from '../../config/board';
import { Board } from '../Board';
import { generateBoard } from '../generator';
import { hasAnyMatch } from '../matchFinder';
import { Match3Engine, type MoveResult, type ToolKind } from '../Match3Engine';
import type { Pos, SpecialKind } from '../types';
import { Random } from '../Random';
import type { ShuffleMove } from '../shuffle';
import { RandomSpawner } from '../spawner';
import { GoalTracker, goalTargetPicker, stepCoins, type GoalDelta } from './goals';
import { LevelError } from './parseLevel';
import type { LevelDefinition } from './types';

export type LevelStatus = 'playing' | 'won' | 'lost';

export interface TurnResult {
  readonly move: MoveResult;
  /** Her zincir adımı için hedef ilerlemeleri (move.steps ile aynı sırada). */
  readonly goalDeltas: readonly (readonly GoalDelta[])[];
  /** Bu hamlede sandıklardan çıkan altın. */
  readonly coins: number;
  readonly status: LevelStatus;
  readonly movesLeft: number;
}

/** Kutlama turunda kalan hamlelerin dönüştüğü güçlendiriciler ve birlikte patlamaları. */
export interface CelebrationTurn {
  readonly converted: readonly { readonly tileId: number; readonly pos: Pos; readonly special: SpecialKind }[];
  readonly move: MoveResult;
  readonly coins: number;
}

/** Kutlamada kalan hamlelerin dönüştüğü güçlendiriciler (Girdap hariç: tahtayı silip süpürmesin). */
const CELEBRATION_KINDS: readonly SpecialKind[] = ['harpoon-h', 'harpoon-v', 'cannon'];

/** Bölüm tanımından tahtayı kurar: engeller + sabit taşlar + eşleşmesiz rastgele dolgu. */
export function createLevelBoard(level: LevelDefinition, rng: Random): Board {
  const prepare = (board: Board) => {
    for (const o of level.obstacles) board.placeObstacle(o.pos, o.kind, o.layers);
    for (const t of level.presetTiles) board.setTile(t.pos, board.createTile(t.color, t.special));
  };
  const check = new Board(level.shape);
  prepare(check);
  if (hasAnyMatch(check)) throw new LevelError(level.id, 'sabit taşlar ("tiles") hazır bir eşleşme içeriyor');
  return generateBoard(level.shape, rng, level.colors, BOARD_CONFIG.minMatch, BOARD_CONFIG.maxGenerateAttempts, prepare);
}

/**
 * Bir bölümün oynanışı: hamle sayısı, hedefler, kazanma/kaybetme, +hamle, kutlama turu.
 * Saf mantıktır; görünüm sonuçları (TurnResult) oynatır.
 */
export class LevelSession {
  readonly engine: Match3Engine;
  readonly goals: GoalTracker;
  private moves: number;
  private state: LevelStatus = 'playing';
  /** Bölüm boyunca sandıklardan toplanan altın. */
  coinsCollected = 0;
  extraMovesAdded = 0;

  constructor(
    readonly level: LevelDefinition,
    seed: number = level.seed ?? Math.floor(Math.random() * 1_000_000_000),
  ) {
    const rng = new Random(seed);
    this.goals = new GoalTracker(level.goals);
    this.moves = level.moves;
    this.engine = new Match3Engine(createLevelBoard(level, rng), rng, new RandomSpawner(rng, level.colors), {
      colors: level.colors,
      targetPicker: goalTargetPicker(this.goals),
    });
  }

  get movesLeft(): number {
    return this.moves;
  }

  get status(): LevelStatus {
    return this.state;
  }

  trySwap(a: Pos, b: Pos): TurnResult {
    return this.play(() => this.engine.trySwap(a, b));
  }

  activateAt(p: Pos): TurnResult {
    return this.play(() => this.engine.activateAt(p));
  }

  /** Kürek / Dümen: hamle harcamaz ama hedefleri ilerletir (bölümü kazandırabilir). */
  useTool(tool: ToolKind, p: Pos): TurnResult {
    return this.play(() => this.engine.useTool(tool, p), false);
  }

  /** Fırtına: tahtayı karıştırır, hamle harcamaz. Karıştırılamazsa null. */
  useStorm(): ShuffleMove[] | null {
    this.assertPlaying();
    return this.engine.shuffle();
  }

  /** Bölüm öncesi güçlendirici: rastgele bir taş verilen türlerden birine dönüşür. */
  placeBooster(kinds: readonly SpecialKind[]): { tileId: number; pos: Pos; special: SpecialKind } | null {
    this.assertPlaying();
    return this.engine.convertRandomTile(kinds);
  }

  private assertPlaying(): void {
    if (this.state !== 'playing') throw new Error(`Bölüm oynanmıyor (durum: ${this.state})`);
  }

  private play(apply: () => MoveResult, costsMove = true): TurnResult {
    this.assertPlaying();
    const move = apply();
    if (move.kind !== 'resolved') {
      return { move, goalDeltas: [], coins: 0, status: this.state, movesLeft: this.moves };
    }
    if (costsMove) this.moves -= 1;
    const goalDeltas = move.steps.map((step) => this.goals.applyStep(step));
    const coins = move.steps.reduce((sum, step) => sum + stepCoins(step), 0);
    this.coinsCollected += coins;
    if (this.goals.complete) this.state = 'won';
    else if (this.moves <= 0) this.state = 'lost';
    return { move, goalDeltas, coins, status: this.state, movesLeft: this.moves };
  }

  /** Hamleler bitince satın alınan ek hamle ("+5 hamle"). */
  addMoves(count: number): void {
    if (this.state === 'won') throw new Error('Kazanılmış bölüme hamle eklenemez');
    this.moves += count;
    this.extraMovesAdded += count;
    this.state = 'playing';
  }

  /**
   * Kazandıktan sonra: kalan hamlelerden en çok `batch` tanesi güçlendiriciye dönüşüp birlikte patlar.
   * Kalan hamle yoksa (ya da dönüşecek taş kalmadıysa) null.
   */
  celebrationTurn(batch = 1): CelebrationTurn | null {
    if (this.state !== 'won' || this.moves <= 0) return null;
    const converted: { tileId: number; pos: Pos; special: SpecialKind }[] = [];
    for (let i = 0; i < Math.min(batch, this.moves); i++) {
      const tile = this.engine.convertRandomTile(CELEBRATION_KINDS);
      if (!tile) break;
      converted.push(tile);
    }
    if (converted.length === 0) {
      this.moves = 0;
      return null;
    }
    this.moves -= converted.length;
    const move = this.engine.activateMany(converted.map((c) => c.pos));
    const coins = move.kind === 'resolved' ? move.steps.reduce((sum, step) => sum + stepCoins(step), 0) : 0;
    this.coinsCollected += coins;
    return { converted, move, coins };
  }
}
