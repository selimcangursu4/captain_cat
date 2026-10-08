import type Phaser from 'phaser';
import { ANIM } from '../../config/animation';
import { TILE_PALETTE, hexToNumber } from '../../config/theme';
import { FEEDBACK } from '../../config/feedback';
import { posKey, type Activation, type ActivationKind, type CascadeStep, type Pos } from '../../core';
import { audio, type SoundKey } from '../../services/Audio';
import { waitMs } from '../tweens';
import type { BoardEffects } from './BoardEffects';
import type { BoardView } from './BoardView';

/** Her etki türünün sesi. */
const ACTIVATION_SOUNDS: Record<ActivationKind, SoundKey> = {
  'harpoon-h': 'harpoon',
  'harpoon-v': 'harpoon',
  'harpoon-cross': 'harpoon',
  'harpoon-cannon': 'cannon',
  cannon: 'cannon',
  'cannon-big': 'cannon',
  whirlpool: 'whirlpool',
  'whirlpool-convert': 'whirlpool',
  'whirlpool-all': 'whirlpool',
  seagull: 'seagull',
  shovel: 'shovel',
  helm: 'helm',
};

const chebyshev = (a: Pos, b: Pos) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const manhattan = (a: Pos, b: Pos) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

/**
 * Bir zincir adımını oynatır:
 *  dalga 0 → eşleşen taşlar kırılır / güçlendiricide birleşir, eşleşmenin engellere hasarı,
 *  dalga 1, 2, … → güçlendirici etkileri (aynı dalgadakiler eşzamanlı),
 *  son olarak taşlar yol boyunca düşer, yenileri gelir.
 */
export class StepPlayer {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly view: BoardView,
    private readonly fx: BoardEffects,
  ) {}

  async play(step: CascadeStep): Promise<void> {
    await this.playMatches(step);
    const waves = [...new Set(step.activations.map((a) => a.wave))].sort((a, b) => a - b);
    for (const wave of waves) {
      await Promise.all(step.activations.filter((a) => a.wave === wave).map((a) => this.playActivation(a)));
    }
    await this.view.animateFalls(step.falls, step.spawns);
  }

  private async playMatches(step: CascadeStep): Promise<void> {
    const merged = new Set(step.created.flatMap((c) => c.mergedTileIds));
    const plain = step.cleared.filter((c) => c.wave === 0 && !merged.has(c.tileId));
    if (step.groups.length > 0) {
      // Zincir ilerledikçe eşleşme sesi incelir (tatmin edici "tırmanma" hissi).
      audio.play('match', { pitch: Math.min(FEEDBACK.maxCascadePitch, step.index * FEEDBACK.cascadePitchStep) });
    }
    await Promise.all([
      this.view.popTiles(plain),
      this.view.hitObstacles(step.obstacleHits),
      ...step.created.map((c) => this.view.mergeInto(c)),
    ]);
  }

  /**
   * Her etki türü için: görsel efekt + "etki bu kareye ne zaman ulaşır" (ms).
   * Taş kırılmaları ve engel vuruşları aynı zamanlamayı kullanır.
   */
  private async playActivation(act: Activation): Promise<void> {
    audio.play(ACTIVATION_SOUNDS[act.kind]);
    const origin = this.view.cellCenter(act.origin);
    const tint = hexToNumber(TILE_PALETTE[act.color].base);
    let effect: Promise<unknown> = Promise.resolve();
    let delayAt: (p: Pos) => number = () => 0;

    switch (act.kind) {
      case 'harpoon-h':
      case 'harpoon-v':
      case 'harpoon-cross':
      case 'harpoon-cannon': {
        const spread = act.kind === 'harpoon-cannon' ? [-1, 0, 1] : [0];
        const rows = act.kind === 'harpoon-v' ? [] : spread.map((d) => act.origin.row + d);
        const cols = act.kind === 'harpoon-h' ? [] : spread.map((d) => act.origin.col + d);
        if (act.kind === 'harpoon-cannon') this.fx.shake('big');
        else if (act.kind === 'harpoon-cross') this.fx.shake('small');
        effect = Promise.all([
          this.launchLines(act.origin, rows, cols),
          act.kind === 'harpoon-cannon' ? this.fx.shockwave(origin, 1, tint) : Promise.resolve(),
        ]);
        delayAt = (p) => lineDelay(p, act.origin, rows, cols);
        break;
      }
      case 'cannon':
      case 'cannon-big': {
        const big = act.kind === 'cannon-big';
        this.fx.shake(big ? 'big' : 'small');
        effect = this.fx.shockwave(origin, big ? 2.5 : 1.5, tint);
        delayAt = (p) => chebyshev(p, act.origin) * ANIM.cannonMsPerRing;
        break;
      }
      case 'whirlpool': {
        const targets = act.cleared.filter((c) => posKey(c.pos) !== posKey(act.origin)).map((c) => c.pos);
        targets.push(...act.obstacleHits.map((h) => h.pos));
        const order = new Map(targets.map((p, i) => [posKey(p), i * ANIM.beamStaggerMs]));
        const selfDelay = targets.length * ANIM.beamStaggerMs + ANIM.beamMs;
        effect = Promise.all([
          this.fx.swirl(origin, 1.4),
          ...targets.map(async (p, i) => {
            await waitMs(this.scene, i * ANIM.beamStaggerMs);
            await this.fx.beam(origin, this.view.cellCenter(p), tint);
          }),
        ]);
        delayAt = (p) => (posKey(p) === posKey(act.origin) ? selfDelay : (order.get(posKey(p)) ?? 0) + ANIM.beamMs);
        break;
      }
      case 'whirlpool-convert': {
        const converted = act.converted ?? [];
        const hitTargets = act.obstacleHits.map((h) => h.pos);
        const order = new Map([...converted.map((c) => c.pos), ...hitTargets].map((p, i) => [posKey(p), i * ANIM.beamStaggerMs]));
        const selfDelay = order.size * ANIM.beamStaggerMs + ANIM.beamMs;
        effect = Promise.all([
          this.fx.swirl(origin, 1.6),
          ...converted.map(async (c, i) => {
            await waitMs(this.scene, i * ANIM.beamStaggerMs);
            await this.fx.beam(origin, this.view.cellCenter(c.pos), tint);
            await this.view.convertTile(c.tileId, c.special);
          }),
          ...hitTargets.map(async (p) => {
            await waitMs(this.scene, order.get(posKey(p))!);
            await this.fx.beam(origin, this.view.cellCenter(p), tint);
          }),
        ]).then(() => waitMs(this.scene, ANIM.convertPopMs));
        delayAt = (p) => (posKey(p) === posKey(act.origin) ? selfDelay : (order.get(posKey(p)) ?? 0) + ANIM.beamMs);
        break;
      }
      case 'whirlpool-all':
        this.fx.shake('big');
        effect = this.fx.swirl(origin, 2.5, ANIM.swirlMs * 1.3);
        delayAt = (p) => chebyshev(p, act.origin) * ANIM.boardWipeMsPerRing;
        break;
      case 'shovel':
        effect = this.fx.shovelStrike(origin);
        delayAt = () => ANIM.shovelStrikeMs;
        break;
      case 'helm':
        effect = this.fx.helmSweep(act.origin.row);
        delayAt = (p) => (p.col + 1) * ANIM.helmMsPerCell;
        break;
      case 'seagull': {
        const launch = new Set(act.cells.map(posKey));
        launch.add(posKey(act.origin));
        const target = act.target;
        const flight = ANIM.seagullFlightMs;
        if (target) {
          effect = Promise.all([
            this.fx.seagullFlight(origin, this.view.cellCenter(target), flight),
            this.seagullArrival(target, act, tint, flight),
          ]);
        }
        delayAt = (p) => {
          if (launch.has(posKey(p)) || !target) return chebyshev(p, act.origin) * ANIM.launchMsPerCell;
          if (act.carried === 'cannon') return flight + chebyshev(p, target) * ANIM.cannonMsPerRing;
          if (act.carried) return flight + manhattan(p, target) * ANIM.harpoonMsPerCell;
          return flight;
        };
        break;
      }
    }

    await Promise.all([
      effect,
      this.view.popTiles(act.cleared, (c) => delayAt(c.pos)),
      this.view.hitObstacles(act.obstacleHits, (h) => delayAt(h.pos)),
    ]);
  }

  private async seagullArrival(target: Pos, act: Activation, tint: number, flight: number): Promise<void> {
    await waitMs(this.scene, flight);
    if (act.carried === 'cannon') {
      this.fx.shake('small');
      await this.fx.shockwave(this.view.cellCenter(target), 1.5, tint);
    } else if (act.carried === 'harpoon-h' || act.carried === 'harpoon-v') {
      const horizontal = act.carried === 'harpoon-h';
      await this.launchLines(target, horizontal ? [target.row] : [], horizontal ? [] : [target.col]);
    }
  }

  /** Verilen satır ve sütunlarda merkezden iki yöne zıpkın fırlatır. */
  private async launchLines(origin: Pos, rows: number[], cols: number[]): Promise<void> {
    const bounds = this.view.bounds;
    const cell = this.view.cellSize;
    const flights: Promise<void>[] = [];
    const ms = (cells: number) => Math.max(1, cells) * ANIM.harpoonMsPerCell;
    for (const row of rows) {
      const y = (row + 0.5) * cell;
      if (y < 0 || y > bounds.height) continue;
      const start = { x: (origin.col + 0.5) * cell, y };
      flights.push(this.fx.projectile(start, { x: -cell / 2, y }, ms(origin.col + 1)));
      flights.push(this.fx.projectile(start, { x: bounds.width + cell / 2, y }, ms(bounds.width / cell - origin.col)));
    }
    for (const col of cols) {
      const x = (col + 0.5) * cell;
      if (x < 0 || x > bounds.width) continue;
      const start = { x, y: (origin.row + 0.5) * cell };
      flights.push(this.fx.projectile(start, { x, y: -cell / 2 }, ms(origin.row + 1)));
      flights.push(this.fx.projectile(start, { x, y: bounds.height + cell / 2 }, ms(bounds.height / cell - origin.row)));
    }
    await Promise.all(flights);
  }
}

/** Zıpkın o kareye ne zaman ulaşır (satır/sütun boyunca merkeze uzaklık). */
function lineDelay(p: Pos, origin: Pos, rows: number[], cols: number[]): number {
  const distances: number[] = [];
  if (rows.includes(p.row)) distances.push(Math.abs(p.col - origin.col));
  if (cols.includes(p.col)) distances.push(Math.abs(p.row - origin.row));
  return (distances.length > 0 ? Math.min(...distances) : 0) * ANIM.harpoonMsPerCell;
}
