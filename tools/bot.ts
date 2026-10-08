import { LevelSession, OBSTACLE_LAYERS, Random, findPossibleMoves, offset, type Board, type GoalState, type LevelDefinition, type Pos } from '../src/core';

/**
 * Denge ölçümü için oyuncu botu.
 * skill = 1: her hamlede en iyisini seçer (çok güçlü).
 * skill < 1: hamlelerin (1 - skill) kadarında rastgele geçerli bir hamle yapar (sıradan oyuncu).
 */
export type BotMove = { kind: 'swap'; a: Pos; b: Pos } | { kind: 'tap'; at: Pos };

const NEIGHBORS: readonly [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

/** Bir karenin açık hedeflere katkısı (hedef renk, hedef engel, yandaki hedef bloklar). */
function goalValue(board: Board, p: Pos, open: readonly GoalState[]): number {
  let value = 0;
  const tile = board.getTile(p);
  const isGoal = (kind: string, goal: GoalState['goal']) =>
    (goal.type === 'obstacle' && goal.kind === kind) || (goal.type === 'seagull' && kind === 'nest');
  for (const { goal } of open) {
    if (goal.type === 'color' && tile?.color === goal.color) value += 2;
    for (const layer of OBSTACLE_LAYERS) {
      const o = board.getObstacle(p, layer);
      if (o && isGoal(o.kind, goal)) value += 3;
    }
    for (const [dRow, dCol] of NEIGHBORS) {
      const n = offset(p, dRow, dCol);
      for (const layer of ['block', 'cover'] as const) {
        const o = board.getObstacle(n, layer);
        if (o && isGoal(o.kind, goal)) value += 1.5;
      }
    }
  }
  return value;
}

export function chooseMove(session: LevelSession, rng: Random, skill: number): BotMove | null {
  const board = session.engine.board;
  const open = session.goals.states.filter((s) => s.remaining > 0);
  const options: { score: number; move: BotMove }[] = [];

  for (const p of board.playablePositions()) {
    const tile = board.getTile(p);
    if (!tile?.special || board.isCovered(p)) continue;
    options.push({ score: 9, move: { kind: 'tap', at: p } });
    for (const [dRow, dCol] of NEIGHBORS) {
      const q = offset(p, dRow, dCol);
      if (board.getTile(q)?.special && !board.isCovered(q)) options.push({ score: 16, move: { kind: 'swap', a: p, b: q } });
    }
  }
  for (const move of findPossibleMoves(board)) {
    const size = move.matchCells.length;
    const goals = move.matchCells.reduce((sum, c) => sum + goalValue(board, c, open), 0);
    options.push({ score: size + (size >= 4 ? 5 : 0) + goals, move: { kind: 'swap', a: move.a, b: move.b } });
  }
  if (options.length === 0) return null;
  if (rng.next() >= skill) return rng.pick(options).move;
  return options.reduce((best, o) => (o.score > best.score ? o : best)).move;
}

export interface PlayResult {
  readonly won: boolean;
  readonly movesUsed: number;
  readonly movesLeft: number;
  /** Hedeflerin tamamlanan oranı (0-1). */
  readonly progress: number;
}

/** Bölümü sonuna kadar oynar. `moves` verilirse bölümün hamle sayısı yerine o kullanılır. */
export function playLevel(level: LevelDefinition, seed: number, skill: number, moves?: number): PlayResult {
  const def = moves === undefined ? level : { ...level, moves };
  const session = new LevelSession(def, level.seed ?? seed);
  const rng = new Random(seed * 31 + 7);
  const total = session.goals.states.reduce((s, g) => s + g.goal.count, 0);
  while (session.status === 'playing') {
    const move = chooseMove(session, rng, skill);
    if (!move) break;
    if (move.kind === 'tap') session.activateAt(move.at);
    else session.trySwap(move.a, move.b);
  }
  const left = session.goals.states.reduce((s, g) => s + g.remaining, 0);
  return {
    won: session.status === 'won',
    movesUsed: def.moves - session.movesLeft,
    movesLeft: session.movesLeft,
    progress: 1 - left / total,
  };
}
