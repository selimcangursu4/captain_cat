import type { BoardShape } from './BoardShape';
import {
  OBSTACLES,
  OBSTACLE_LAYERS,
  mergeRewards,
  type HitCause,
  type Obstacle,
  type ObstacleHit,
  type ObstacleKind,
  type ObstacleLayer,
} from './obstacles';
import type { Pos, SpecialKind, Tile, TileColor } from './types';

/** Engel ve konumu (tarama sonuçları için). */
export interface PlacedObstacle {
  readonly pos: Pos;
  readonly layer: ObstacleLayer;
  readonly obstacle: Obstacle;
}

/**
 * Tahta durumu: şekil (oynanabilir kareler) + her karedeki taş + engel katmanları.
 * Saf veri yapısıdır; kurallar matchFinder/gravity/Match3Engine içindedir.
 */
export class Board {
  readonly rows: number;
  readonly cols: number;
  private readonly playable: readonly boolean[];
  private readonly tiles: (Tile | null)[];
  private readonly obstacles: Record<ObstacleLayer, (Obstacle | null)[]>;
  private readonly playableList: readonly Pos[];
  private readonly columnLists: readonly (readonly Pos[])[];
  private nextTileId: number;
  private nextObstacleId = 1;

  constructor(shape: BoardShape, nextTileId = 1) {
    this.rows = shape.rows;
    this.cols = shape.cols;
    this.playable = [...shape.playable];
    const size = this.rows * this.cols;
    this.tiles = new Array<Tile | null>(size).fill(null);
    this.obstacles = {
      floor: new Array<Obstacle | null>(size).fill(null),
      cover: new Array<Obstacle | null>(size).fill(null),
      block: new Array<Obstacle | null>(size).fill(null),
    };
    this.nextTileId = nextTileId;

    const all: Pos[] = [];
    const columns: Pos[][] = Array.from({ length: this.cols }, () => []);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.playable[row * this.cols + col]) {
          const p = { row, col };
          all.push(p);
          columns[col].push(p);
        }
      }
    }
    this.playableList = all;
    this.columnLists = columns;
  }

  get shape(): BoardShape {
    return { rows: this.rows, cols: this.cols, playable: this.playable };
  }

  inBounds(p: Pos): boolean {
    return p.row >= 0 && p.row < this.rows && p.col >= 0 && p.col < this.cols;
  }

  isPlayable(p: Pos): boolean {
    return this.inBounds(p) && this.playable[p.row * this.cols + p.col];
  }

  /** Karedeki taş; boşsa, oynanamazsa veya tahta dışındaysa null. */
  getTile(p: Pos): Tile | null {
    if (!this.isPlayable(p)) return null;
    return this.tiles[p.row * this.cols + p.col];
  }

  setTile(p: Pos, tile: Tile | null): void {
    if (!this.isPlayable(p)) {
      throw new Error(`Oynanamaz kareye taş konamaz: (${p.row},${p.col})`);
    }
    if (tile && this.isBlocked(p)) {
      throw new Error(`Engelli kareye taş konamaz: (${p.row},${p.col})`);
    }
    this.tiles[p.row * this.cols + p.col] = tile;
  }

  /** Yeni ve benzersiz kimlikli bir taş üretir (tahtaya yerleştirmez). */
  createTile(color: TileColor, special?: SpecialKind): Tile {
    const tile: Tile = { id: this.nextTileId++, color };
    if (special) tile.special = special;
    return tile;
  }

  /** Tahtada en az bir güçlendirici var mı? (Varsa oyuncunun her zaman bir hamlesi vardır.) */
  hasSpecial(): boolean {
    return this.playableList.some((p) => this.getTile(p)?.special !== undefined && !this.isCovered(p));
  }

  swap(a: Pos, b: Pos): void {
    const ta = this.getTile(a);
    this.setTile(a, this.getTile(b));
    this.setTile(b, ta);
  }

  /** Tüm oynanabilir kareler, satır öncelikli sırayla. */
  playablePositions(): readonly Pos[] {
    return this.playableList;
  }

  /** Bir sütundaki oynanabilir kareler, yukarıdan aşağıya. */
  columnPositions(col: number): readonly Pos[] {
    return this.columnLists[col] ?? [];
  }

  /** Taş alabilen her karede taş var mı? (Engel altında ulaşılamayan kareler boş kalabilir.) */
  isFull(): boolean {
    return this.playableList.every((p) => !this.canHoldTile(p) || this.getTile(p) !== null);
  }

  // ───────────────────────── engeller ─────────────────────────

  getObstacle(p: Pos, layer: ObstacleLayer): Obstacle | null {
    if (!this.isPlayable(p)) return null;
    return this.obstacles[layer][p.row * this.cols + p.col];
  }

  setObstacle(p: Pos, layer: ObstacleLayer, obstacle: Obstacle | null): void {
    if (!this.isPlayable(p)) throw new Error(`Oynanamaz kareye engel konamaz: (${p.row},${p.col})`);
    this.obstacles[layer][p.row * this.cols + p.col] = obstacle;
  }

  /** Engeli oluşturup yerleştirir (katmanı, türün tanımından gelir). */
  placeObstacle(p: Pos, kind: ObstacleKind, layers: number): Obstacle {
    const obstacle: Obstacle = { id: this.nextObstacleId++, kind, layers };
    this.setObstacle(p, OBSTACLES[kind].layer, obstacle);
    return obstacle;
  }

  /** Karede blok engel var (taş olamaz, yerçekimini keser). */
  isBlocked(p: Pos): boolean {
    return this.getObstacle(p, 'block') !== null;
  }

  /** Taşın üstünde örtü var (taş yerinden oynayamaz). */
  isCovered(p: Pos): boolean {
    return this.getObstacle(p, 'cover') !== null;
  }

  canHoldTile(p: Pos): boolean {
    return this.isPlayable(p) && !this.isBlocked(p);
  }

  /** Karede herhangi bir engel var mı? */
  hasObstacle(p: Pos): boolean {
    return OBSTACLE_LAYERS.some((layer) => this.getObstacle(p, layer) !== null);
  }

  /** Tahtadaki engeller (isteğe bağlı türe göre süzülmüş). */
  listObstacles(kind?: ObstacleKind): PlacedObstacle[] {
    const out: PlacedObstacle[] = [];
    for (const pos of this.playableList) {
      for (const layer of OBSTACLE_LAYERS) {
        const obstacle = this.getObstacle(pos, layer);
        if (obstacle && (!kind || obstacle.kind === kind)) out.push({ pos, layer, obstacle });
      }
    }
    return out;
  }

  /**
   * Engele bir vuruş uygular (tanımı bu sebepten hasar almıyorsa hiçbir şey olmaz).
   * Katman 0'a inerse engel kalkar.
   */
  hitObstacle(p: Pos, layer: ObstacleLayer, cause: HitCause, wave: number): ObstacleHit | null {
    const obstacle = this.getObstacle(p, layer);
    if (!obstacle) return null;
    const def = OBSTACLES[obstacle.kind];
    if (!def.damagedBy[cause]) return null;
    obstacle.layers -= 1;
    const destroyed = obstacle.layers <= 0;
    if (destroyed) this.setObstacle(p, layer, null);
    return {
      obstacleId: obstacle.id,
      kind: obstacle.kind,
      layer,
      pos: p,
      cause,
      wave,
      layersLeft: Math.max(0, obstacle.layers),
      destroyed,
      reward: mergeRewards(def.rewardOnHit, destroyed ? def.rewardOnDestroy : undefined),
    };
  }

  /** Taşları ve engelleri de kopyalayan derin kopya. */
  clone(): Board {
    const copy = new Board(this.shape, this.nextTileId);
    copy.nextObstacleId = this.nextObstacleId;
    for (const p of this.playableList) {
      for (const layer of OBSTACLE_LAYERS) {
        const o = this.getObstacle(p, layer);
        if (o) copy.setObstacle(p, layer, { ...o });
      }
      const t = this.getTile(p);
      copy.setTile(p, t ? { ...t } : null);
    }
    return copy;
  }
}
