import type { TargetPicker } from '../activation';
import type { CascadeStep } from '../Match3Engine';
import { OBSTACLE_LAYERS, type ObstacleHit } from '../obstacles';
import type { Pos } from '../types';
import type { GoalDefinition } from './types';

export interface GoalState {
  readonly goal: GoalDefinition;
  remaining: number;
}

/** Bir hedefin ilerlemesi ve kaynağı (görünüm, simgeyi o kareden hedef paneline uçurur). */
export interface GoalDelta {
  readonly goalIndex: number;
  readonly amount: number;
  readonly from: Pos;
  readonly wave: number;
}

export function stepObstacleHits(step: CascadeStep): ObstacleHit[] {
  return [...step.obstacleHits, ...step.activations.flatMap((a) => a.obstacleHits)];
}

/** Adımda sandıklardan çıkan altın. */
export function stepCoins(step: CascadeStep): number {
  return stepObstacleHits(step).reduce((sum, h) => sum + (h.reward?.coins ?? 0), 0);
}

/** Hedeflerin kalan miktarlarını adım olaylarından günceller. */
export class GoalTracker {
  readonly states: GoalState[];

  constructor(goals: readonly GoalDefinition[]) {
    this.states = goals.map((goal) => ({ goal, remaining: goal.count }));
  }

  get complete(): boolean {
    return this.states.every((s) => s.remaining <= 0);
  }

  applyStep(step: CascadeStep): GoalDelta[] {
    const deltas: GoalDelta[] = [];
    const hits = stepObstacleHits(step);
    this.states.forEach((state, goalIndex) => {
      const credit = (amount: number, from: Pos, wave: number) => {
        const take = Math.min(amount, state.remaining);
        if (take <= 0) return;
        state.remaining -= take;
        deltas.push({ goalIndex, amount: take, from, wave });
      };
      const goal = state.goal;
      switch (goal.type) {
        case 'color':
          for (const c of step.cleared) {
            if (c.color === goal.color && c.special !== 'whirlpool') credit(1, c.pos, c.wave);
          }
          break;
        case 'obstacle':
          for (const h of hits) if (h.destroyed && h.kind === goal.kind) credit(1, h.pos, h.wave);
          break;
        case 'seagull':
          for (const h of hits) if (h.reward?.seagulls) credit(h.reward.seagulls, h.pos, h.wave);
          break;
      }
    });
    return deltas;
  }
}

/**
 * Martı hedef seçici: önce hâlâ toplanması gereken engeller (yuva dahil),
 * sonra hedef renkteki taşlar, sonra herhangi bir kare.
 */
export function goalTargetPicker(tracker: GoalTracker): TargetPicker {
  return (board, candidates, rng) => {
    if (candidates.length === 0) return null;
    const open = tracker.states.filter((s) => s.remaining > 0).map((s) => s.goal);
    const score = (p: Pos): number => {
      for (const layer of OBSTACLE_LAYERS) {
        const obstacle = board.getObstacle(p, layer);
        if (!obstacle) continue;
        if (open.some((g) => (g.type === 'obstacle' && g.kind === obstacle.kind) || (g.type === 'seagull' && obstacle.kind === 'nest'))) {
          return 2;
        }
      }
      const tile = board.getTile(p);
      if (tile && open.some((g) => g.type === 'color' && g.color === tile.color)) return 1;
      return 0;
    };
    let best = -1;
    let pool: Pos[] = [];
    for (const c of candidates) {
      const s = score(c);
      if (s > best) {
        best = s;
        pool = [c];
      } else if (s === best) {
        pool.push(c);
      }
    }
    return rng.pick(pool);
  };
}
