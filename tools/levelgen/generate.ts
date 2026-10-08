import { OBSTACLE_CONFIG } from '../../src/config/obstacles';
import { Random, TILE_COLORS, type TileColor } from '../../src/core';
import { density, progress, wave } from './plan';

/** Seviye dosyasının (src/data/levels/level-NNN.json) biçimi. */
export interface LevelJson {
  id: number;
  moves: number;
  colors: TileColor[];
  board?: string[];
  floor?: string[];
  cover?: string[];
  block?: string[];
  goals: GoalJson[];
}

export type GoalJson =
  | { type: 'color'; color: TileColor; count: number }
  | { type: 'obstacle'; kind: 'moss' | 'net' | 'sandbag' | 'chest' }
  | { type: 'seagull'; count: number };

/** Seviye türleri: her 10'luk blokta karışık sırayla gelir (ardışık seviyeler birbirine benzemesin). */
export const ARCHETYPES = ['color', 'moss', 'sandbag', 'net', 'chest', 'nest', 'mixed'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

/** Basit karakter ızgarası; setSym sol-sağ aynalı yerleştirir (seviyeler simetrik ve düzenli görünür). */
class Grid {
  readonly cells: string[][];

  constructor(
    readonly rows: number,
    readonly cols: number,
    fill: string,
  ) {
    this.cells = Array.from({ length: rows }, () => Array<string>(cols).fill(fill));
  }

  get(r: number, c: number): string | undefined {
    return this.cells[r]?.[c];
  }

  set(r: number, c: number, ch: string): void {
    if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) this.cells[r][c] = ch;
  }

  setSym(r: number, c: number, ch: string): void {
    this.set(r, c, ch);
    this.set(r, this.cols - 1 - c, ch);
  }

  lines(): string[] {
    return this.cells.map((row) => row.join(''));
  }

  count(predicate: (ch: string) => boolean): number {
    return this.cells.flat().filter(predicate).length;
  }

  isEmpty(): boolean {
    return this.count((ch) => ch !== '.') === 0;
  }
}

// ───────────────────────── tahta şekli ─────────────────────────

const SHAPE_STYLES = ['rect', 'corners', 'center', 'notches', 'hourglass', 'bites', 'cornersCenter'] as const;

function connected(shape: Grid): boolean {
  const cells: [number, number][] = [];
  for (let r = 0; r < shape.rows; r++) for (let c = 0; c < shape.cols; c++) if (shape.get(r, c) === 'x') cells.push([r, c]);
  if (cells.length === 0) return false;
  const seen = new Set<string>([cells[0].join()]);
  const stack = [cells[0]];
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const key = `${r + dr},${c + dc}`;
      if (shape.get(r + dr, c + dc) === 'x' && !seen.has(key)) {
        seen.add(key);
        stack.push([r + dr, c + dc]);
      }
    }
  }
  return seen.size === cells.length;
}

function makeShape(rng: Random, size: number, d: number): Grid {
  for (let attempt = 0; attempt < 30; attempt++) {
    const g = new Grid(size, size, 'x');
    // Kolay seviyelerde çoğunlukla düz tahta; zorlaştıkça şekilli tahtalar.
    const style = rng.next() < 0.45 - 0.3 * d ? 'rect' : rng.pick(SHAPE_STYLES);
    const mid = Math.floor((size - 1) / 2);
    const corners = (k: number, bottom: boolean) => {
      for (let r = 0; r < k; r++) {
        for (let c = 0; c < k - r; c++) {
          g.setSym(r, c, '.');
          if (bottom) g.setSym(size - 1 - r, c, '.');
        }
      }
    };
    switch (style) {
      case 'corners':
        corners(1 + rng.int(size > 8 ? 3 : 2), rng.next() < 0.5);
        break;
      case 'center':
      case 'cornersCenter': {
        const r0 = Math.floor(size / 2) - 1 - rng.int(2);
        const tall = 2 + rng.int(2);
        for (let r = r0; r < r0 + tall; r++) g.setSym(r, mid, '.');
        if (style === 'cornersCenter') corners(1 + rng.int(2), false);
        break;
      }
      case 'notches': {
        const r0 = 2 + rng.int(size - 5);
        for (let r = r0; r < r0 + 2 + rng.int(2); r++) g.setSym(r, 0, '.');
        break;
      }
      case 'hourglass': {
        const center = Math.floor(size / 2);
        for (let r = center - 2; r <= center + 1; r++) g.setSym(r, 0, '.');
        g.setSym(center - 1, 1, '.');
        g.setSym(center, 1, '.');
        break;
      }
      case 'bites': {
        const col = 1 + rng.int(Math.max(1, mid - 1));
        g.setSym(0, col, '.');
        g.setSym(1, col, '.');
        if (rng.next() < 0.5) {
          g.setSym(size - 1, col, '.');
          g.setSym(size - 2, col, '.');
        }
        break;
      }
      default:
        break;
    }
    const playable = g.count((ch) => ch === 'x');
    const rowsOk = g.cells.every((row) => row.filter((ch) => ch === 'x').length >= 4);
    if (playable >= size * size * 0.78 && rowsOk && connected(g)) return g;
  }
  return new Grid(size, size, 'x');
}

// ───────────────────────── engel yerleşimi ─────────────────────────

interface Layout {
  shape: Grid;
  floor: Grid;
  cover: Grid;
  block: Grid;
}

const isPlayable = (l: Layout, r: number, c: number) => l.shape.get(r, c) === 'x';
const isFree = (l: Layout, r: number, c: number) =>
  isPlayable(l, r, c) && l.block.get(r, c) === '.' && l.floor.get(r, c) === '.' && l.cover.get(r, c) === '.';

/** Bir satırdaki blok engel sayısı sınırı: tüm satırı kapatan duvar olmasın (yerçekimi akmalı). */
function rowBlocks(l: Layout, r: number): number {
  return l.block.cells[r].filter((ch) => ch !== '.').length;
}

/** Sol yarıdaki (orta sütun dahil) kareler; aynası otomatik yerleşir. */
function leftHalf(l: Layout): [number, number][] {
  const cells: [number, number][] = [];
  const half = Math.ceil(l.shape.cols / 2);
  for (let r = 0; r < l.shape.rows; r++) for (let c = 0; c < half; c++) cells.push([r, c]);
  return cells;
}

/** Blok engelleri (kum torbası, sandık, yuva) simetrik yerleştirir; yaklaşık `count` kare. */
function placeBlocks(rng: Random, l: Layout, count: number, code: () => string, style: string): void {
  const { rows, cols } = l.shape;
  const maxPerRow = cols - 3;
  const candidates = leftHalf(l).filter(([r, c]) => {
    if (!isFree(l, r, c) || !isFree(l, r, cols - 1 - c) || r === 0) return false;
    switch (style) {
      case 'band':
        return r === Math.floor(rows / 2) || r === Math.floor(rows / 2) + (rows > 8 ? 1 : -1);
      case 'pillars':
        return c === 1 || c === 2;
      case 'corners':
        return (r <= 2 || r >= rows - 3) && c <= 2;
      case 'bottom':
        return r >= rows - 3;
      default:
        return true;
    }
  });
  rng.shuffle(candidates);
  let placed = 0;
  for (const [r, c] of candidates) {
    if (placed >= count) break;
    const mirrored = c !== cols - 1 - c;
    const add = mirrored ? 2 : 1;
    if (rowBlocks(l, r) + add > maxPerRow) continue;
    const ch = code();
    l.block.setSym(r, c, ch);
    placed += add;
  }
}

const FLOOR_STYLES = ['bottom', 'top', 'center', 'ring', 'stripes', 'diamond', 'checker'] as const;

/** Yosun deseni: oynanabilir alanın yaklaşık `fraction` kadarı; iç kısım iki katlı olabilir. */
function placeFloor(rng: Random, l: Layout, fraction: number, doubleChance: number): void {
  const { rows, cols } = l.shape;
  const style = rng.pick(FLOOR_STYLES);
  const cr = (rows - 1) / 2;
  const cc = (cols - 1) / 2;
  const k = Math.max(1, Math.round(fraction * rows));
  const radius = Math.max(1, Math.round(fraction * (rows + cols) * 0.45));
  const inside = (r: number, c: number): 0 | 1 | 2 => {
    switch (style) {
      case 'bottom':
        return r >= rows - k ? (r >= rows - Math.ceil(k / 2) ? 2 : 1) : 0;
      case 'top':
        return r >= 1 && r <= k ? (r <= Math.ceil(k / 2) ? 2 : 1) : 0;
      case 'center': {
        const h = Math.max(1, Math.round(Math.sqrt(fraction) * rows * 0.55));
        const dist = Math.max(Math.abs(r - cr), Math.abs(c - cc));
        return dist <= h ? (dist <= h / 2 ? 2 : 1) : 0;
      }
      case 'ring': {
        const edge = Math.min(r, c, rows - 1 - r, cols - 1 - c);
        return edge === 1 || (fraction > 0.4 && edge === 0) ? 1 : 0;
      }
      case 'stripes': {
        const stripes = Math.max(1, Math.round(fraction * cols * 0.5));
        const col = Math.min(c, cols - 1 - c);
        return col % 2 === 1 && col <= stripes * 2 - 1 ? 2 : 0;
      }
      case 'diamond': {
        const dist = Math.abs(r - cr) + Math.abs(c - cc);
        return dist <= radius ? (dist <= radius / 2 ? 2 : 1) : 0;
      }
      case 'checker':
        return (r + c) % 2 === 0 && Math.abs(r - cr) <= rows * 0.35 ? 1 : 0;
    }
  };
  const double = rng.next() < doubleChance;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isPlayable(l, r, c) || l.block.get(r, c) !== '.') continue;
      const level = inside(r, c);
      if (level > 0) l.floor.set(r, c, level === 2 && double ? '2' : '1');
    }
  }
}

/** Ağlar: simetrik dağınık ya da bir satır boyunca. */
function placeNets(rng: Random, l: Layout, count: number): void {
  const { rows, cols } = l.shape;
  const rowStyle = rng.next() < 0.35;
  const targetRow = 1 + rng.int(rows - 2);
  const candidates = leftHalf(l).filter(
    ([r, c]) => isPlayable(l, r, c) && l.block.get(r, c) === '.' && l.block.get(r, cols - 1 - c) === '.' && (!rowStyle || r === targetRow || r === targetRow + 2),
  );
  rng.shuffle(candidates);
  let placed = 0;
  for (const [r, c] of candidates) {
    if (placed >= count) break;
    l.cover.setSym(r, c, 'n');
    placed += c === cols - 1 - c ? 1 : 2;
  }
}

// ───────────────────────── seviye ─────────────────────────

/** Bu seviyenin türü: 10'luk bloğun kendi tohumuyla karıştırılmış listesinden. */
export function archetypeOf(id: number): Archetype {
  const block = Math.floor((id - 1) / 10);
  const rng = new Random(block * 2654435761 + 17);
  const p = progress(block * 10 + 5);
  const extras: Archetype[] = p < 0.3 ? ['moss', 'sandbag', 'color'] : ['mixed', 'chest', 'nest'];
  const list = rng.shuffle([...ARCHETYPES, ...extras]);
  return list[(id - 1) % 10];
}

const sandbagCode = (rng: Random, d: number) => () => {
  const x = rng.next();
  return x < 0.55 - 0.35 * d ? '1' : x < 0.85 - 0.2 * d ? '2' : '3';
};

/**
 * Seviyeyi üretir (hamle sayısı tahminidir; tune ile bot ölçümüne göre ayarlanır).
 * Aynı id ve deneme numarası her zaman aynı seviyeyi verir.
 */
export function generateLevel(id: number, attempt = 0): LevelJson {
  const rng = new Random(id * 7919 + attempt * 104729 + 1);
  const d = density(id);
  const size = rng.next() < 0.12 + 0.3 * progress(id) ? 9 : 8;
  const shape = makeShape(rng, size, d);
  const layout: Layout = {
    shape,
    floor: new Grid(size, size, '.'),
    cover: new Grid(size, size, '.'),
    block: new Grid(size, size, '.'),
  };
  // Rahatlatan seviyelerde bazen 4 renk (daha çok zincir, daha keyifli).
  const colors: TileColor[] = [...TILE_COLORS];
  if (wave(id) < 0 && rng.next() < 0.5) colors.splice(rng.int(colors.length), 1);
  const goalColors = rng.shuffle([...colors]);
  const colorCount = () => 15 + Math.round(25 * Math.min(1, d)) + rng.int(4);
  const goals: GoalJson[] = [];
  const archetype = archetypeOf(id);
  const blockStyle = () => rng.pick(['band', 'pillars', 'corners', 'bottom', 'scatter']);

  switch (archetype) {
    case 'color': {
      const n = d > 0.6 ? 3 : 2;
      for (let i = 0; i < n; i++) goals.push({ type: 'color', color: goalColors[i], count: colorCount() });
      if (d > 0.4) placeBlocks(rng, layout, 2 + rng.int(3), () => '1', blockStyle());
      break;
    }
    case 'moss': {
      if (d > 0.6) placeBlocks(rng, layout, 2 + rng.int(4), sandbagCode(rng, d), blockStyle());
      placeFloor(rng, layout, 0.22 + 0.25 * Math.min(1, d), 0.2 + 0.6 * d);
      goals.push({ type: 'obstacle', kind: 'moss' });
      break;
    }
    case 'sandbag': {
      placeBlocks(rng, layout, 4 + Math.round(8 * Math.min(1, d)), sandbagCode(rng, d), blockStyle());
      goals.push({ type: 'obstacle', kind: 'sandbag' });
      if (d > 0.5) goals.push({ type: 'color', color: goalColors[0], count: colorCount() });
      break;
    }
    case 'net': {
      placeNets(rng, layout, 6 + Math.round(10 * Math.min(1, d)));
      goals.push({ type: 'obstacle', kind: 'net' });
      goals.push({ type: 'color', color: goalColors[0], count: colorCount() });
      break;
    }
    case 'chest': {
      placeBlocks(rng, layout, 2 + (d > 0.5 ? 2 : 0), () => 'c', rng.pick(['corners', 'band', 'scatter']));
      placeBlocks(rng, layout, 2 + rng.int(4), sandbagCode(rng, d), blockStyle());
      goals.push({ type: 'obstacle', kind: 'chest' });
      if (d > 0.5) goals.push({ type: 'obstacle', kind: 'sandbag' });
      break;
    }
    case 'nest': {
      const nests = d > 0.45 ? 2 : 1;
      placeBlocks(rng, layout, nests, () => 'b', 'scatter');
      const placedNests = layout.block.count((ch) => ch === 'b');
      const seagulls = Math.min(placedNests * OBSTACLE_CONFIG.nestLayers, 4 + Math.round(6 * Math.min(1, d)));
      goals.push({ type: 'seagull', count: Math.max(1, seagulls) });
      if (rng.next() < 0.5) {
        placeFloor(rng, layout, 0.18, 0.3 * d);
        goals.push({ type: 'obstacle', kind: 'moss' });
      } else {
        goals.push({ type: 'color', color: goalColors[0], count: colorCount() });
      }
      break;
    }
    case 'mixed': {
      const second = rng.pick(['sandbag', 'net', 'chest'] as const);
      if (second === 'sandbag') placeBlocks(rng, layout, 4 + Math.round(6 * Math.min(1, d)), sandbagCode(rng, d), blockStyle());
      if (second === 'chest') placeBlocks(rng, layout, 2, () => 'c', 'corners');
      placeFloor(rng, layout, 0.2 + 0.2 * Math.min(1, d), 0.5 * d);
      if (second === 'net') placeNets(rng, layout, 4 + Math.round(6 * Math.min(1, d)));
      goals.push({ type: 'obstacle', kind: 'moss' });
      goals.push({ type: 'obstacle', kind: second });
      if (d > 0.8) goals.push({ type: 'color', color: goalColors[0], count: colorCount() });
      break;
    }
  }

  // Yerleşemeyen engellerin hedefleri çıkarılır (ör. küçük tahtada yer kalmadıysa).
  const has = {
    moss: !layout.floor.isEmpty(),
    net: !layout.cover.isEmpty(),
    sandbag: layout.block.count((ch) => /[123]/.test(ch)) > 0,
    chest: layout.block.count((ch) => ch === 'c') > 0,
    nest: layout.block.count((ch) => ch === 'b') > 0,
  };
  const validGoals = goals.filter((g) => (g.type === 'obstacle' ? has[g.kind] : g.type === 'seagull' ? has.nest : true));
  if (validGoals.length === 0) validGoals.push({ type: 'color', color: goalColors[0], count: colorCount() });

  const json: LevelJson = { id, moves: 20 + Math.round(12 * d), colors, goals: validGoals };
  const fullRect = shape.count((ch) => ch === 'x') === 64 && size === 8;
  if (!fullRect) json.board = shape.lines();
  if (!layout.floor.isEmpty()) json.floor = layout.floor.lines();
  if (!layout.cover.isEmpty()) json.cover = layout.cover.lines();
  if (!layout.block.isEmpty()) json.block = layout.block.lines();
  return json;
}

/** Seviye dosyası metni (elle yazılmış dosyalarla aynı düzen: ızgaralar satır satır). */
export function formatLevel(level: LevelJson): string {
  const lines: string[] = ['{', `  "id": ${level.id},`, `  "moves": ${level.moves},`];
  lines.push(`  "colors": [${level.colors.map((c) => JSON.stringify(c)).join(', ')}],`);
  for (const key of ['board', 'floor', 'cover', 'block'] as const) {
    const grid = level[key];
    if (!grid) continue;
    lines.push(`  "${key}": [`);
    grid.forEach((row, i) => lines.push(`    ${JSON.stringify(row)}${i < grid.length - 1 ? ',' : ''}`));
    lines.push('  ],');
  }
  const goals = level.goals.map((g) => JSON.stringify(g).replace(/,"/g, ', "').replace(/":/g, '": '));
  lines.push(goals.length === 1 ? `  "goals": [${goals[0]}]` : `  "goals": [\n    ${goals.join(',\n    ')}\n  ]`);
  lines.push('}');
  return `${lines.join('\n')}\n`;
}
