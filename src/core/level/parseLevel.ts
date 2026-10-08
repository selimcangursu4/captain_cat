import { BOARD_CONFIG } from '../../config/board';
import { parseShape, rectShape, type BoardShape } from '../BoardShape';
import { OBSTACLES, OBSTACLE_KINDS, obstacleCodes, type ObstacleKind, type ObstacleLayer } from '../obstacles';
import { SPECIAL_KINDS, TILE_COLORS, type SpecialKind, type TileColor } from '../types';
import type { TutorialStep } from './tutorial';
import type { GoalDefinition, LevelDefinition, PlacedObstacleDef, PresetTile } from './types';

export class LevelError extends Error {
  constructor(levelId: unknown, message: string) {
    super(`Bölüm ${String(levelId ?? '?')}: ${message}`);
    this.name = 'LevelError';
  }
}

const TILE_LETTERS: Readonly<Record<string, TileColor>> = { F: 'fish', A: 'anchor', S: 'shell', R: 'ring', T: 'star' };
const LAYERS: readonly ObstacleLayer[] = ['floor', 'cover', 'block'];
const CODES = Object.fromEntries(LAYERS.map((layer) => [layer, obstacleCodes(layer)])) as Record<
  ObstacleLayer,
  ReturnType<typeof obstacleCodes>
>;

/**
 * Bölüm JSON'unu doğrular ve oyun mantığının kullandığı tanıma çevirir.
 * Hatalarda hangi bölüm ve hangi alan olduğunu söyleyen LevelError fırlatır.
 */
export function parseLevel(raw: unknown): LevelDefinition {
  if (typeof raw !== 'object' || raw === null) throw new LevelError('?', 'nesne bekleniyordu');
  const data = raw as Record<string, unknown>;
  const id = data.id;
  const fail = (message: string): never => {
    throw new LevelError(id, message);
  };

  if (!Number.isInteger(id) || (id as number) < 1) fail('"id" pozitif tam sayı olmalı');
  if (!Number.isInteger(data.moves) || (data.moves as number) < 1) fail('"moves" pozitif tam sayı olmalı');

  // Renkler
  if (!Array.isArray(data.colors)) fail('"colors" dizi olmalı');
  const colors = data.colors as unknown[];
  for (const c of colors) {
    if (!TILE_COLORS.includes(c as TileColor)) fail(`bilinmeyen renk "${String(c)}" (geçerli: ${TILE_COLORS.join(', ')})`);
  }
  if (new Set(colors).size !== colors.length) fail('"colors" tekrar içeriyor');
  if (colors.length < 3) fail('en az 3 renk gerekli');

  // Tahta şekli
  let shape: BoardShape;
  try {
    shape = data.board === undefined
      ? rectShape(BOARD_CONFIG.defaultRows, BOARD_CONFIG.defaultCols)
      : parseShape(data.board as string[]);
  } catch (error) {
    return fail(`"board": ${(error as Error).message}`);
  }
  const isPlayable = (row: number, col: number) => shape.playable[row * shape.cols + col];

  const readGrid = (name: string): string[] | null => {
    const grid = data[name];
    if (grid === undefined) return null;
    if (!Array.isArray(grid) || grid.length !== shape.rows || grid.some((l) => typeof l !== 'string' || l.length !== shape.cols)) {
      fail(`"${name}" ${shape.rows} satır x ${shape.cols} sütun olmalı`);
    }
    return grid as string[];
  };

  // Engel katmanları
  const obstacles: PlacedObstacleDef[] = [];
  const occupied: Record<ObstacleLayer, Set<string>> = { floor: new Set(), cover: new Set(), block: new Set() };
  for (const layer of LAYERS) {
    const grid = readGrid(layer);
    if (!grid) continue;
    grid.forEach((line, row) =>
      [...line].forEach((ch, col) => {
        if (ch === '.') return;
        const entry = CODES[layer].get(ch);
        if (!entry) fail(`"${layer}" satır ${row}, sütun ${col}: bilinmeyen kod '${ch}'`);
        if (!isPlayable(row, col)) fail(`"${layer}" (${row},${col}) boşluğa engel konamaz`);
        obstacles.push({ pos: { row, col }, kind: entry!.kind, layers: entry!.layers });
        occupied[layer].add(`${row},${col}`);
      }),
    );
  }
  for (const key of occupied.block) {
    if (occupied.cover.has(key) || occupied.floor.has(key)) fail(`(${key}) blok engelle aynı karede ağ/yosun olamaz`);
  }

  // Sabit taşlar
  const presetTiles: PresetTile[] = [];
  const tiles = readGrid('tiles');
  tiles?.forEach((line, row) =>
    [...line].forEach((ch, col) => {
      if (ch === '.') return;
      const color = TILE_LETTERS[ch];
      if (!color) fail(`"tiles" (${row},${col}): bilinmeyen taş '${ch}' (F A S R T)`);
      if (!colors.includes(color)) fail(`"tiles" (${row},${col}): '${color}' bu bölümün renklerinde yok`);
      if (!isPlayable(row, col) || occupied.block.has(`${row},${col}`)) fail(`"tiles" (${row},${col}): taş konamayan kare`);
      presetTiles.push({ pos: { row, col }, color });
    }),
  );
  const specials = data.specials;
  if (specials !== undefined) {
    if (!Array.isArray(specials)) fail('"specials" dizi olmalı');
    for (const s of specials as { at?: unknown; kind?: unknown }[]) {
      const at = s.at as number[] | undefined;
      if (!Array.isArray(at) || at.length !== 2) fail('"specials[].at" [satır, sütun] olmalı');
      if (!SPECIAL_KINDS.includes(s.kind as SpecialKind)) fail(`bilinmeyen güçlendirici "${String(s.kind)}"`);
      const preset = presetTiles.find((t) => t.pos.row === at![0] && t.pos.col === at![1]);
      if (!preset) fail(`"specials" (${at![0]},${at![1]}): önce "tiles" ile o kareye taş yazılmalı`);
      (preset as { special?: SpecialKind }).special = s.kind as SpecialKind;
    }
  }

  // Hedefler
  if (!Array.isArray(data.goals) || data.goals.length === 0) fail('en az bir hedef ("goals") gerekli');
  const countOf = (kind: ObstacleKind) => obstacles.filter((o) => o.kind === kind).length;
  const nestLayers = obstacles.filter((o) => o.kind === 'nest').reduce((sum, o) => sum + o.layers, 0);
  const goals: GoalDefinition[] = (data.goals as Record<string, unknown>[]).map((goal, i) => {
    const where = `"goals[${i}]"`;
    const explicit = goal.count;
    if (explicit !== undefined && (!Number.isInteger(explicit) || (explicit as number) < 1)) fail(`${where}.count pozitif tam sayı olmalı`);
    switch (goal.type) {
      case 'color': {
        if (!colors.includes(goal.color)) fail(`${where}: "${String(goal.color)}" bu bölümün renklerinde yok`);
        if (explicit === undefined) fail(`${where}: renk hedefinde "count" gerekli`);
        return { type: 'color', color: goal.color as TileColor, count: explicit as number };
      }
      case 'obstacle': {
        const kind = goal.kind as ObstacleKind;
        if (!OBSTACLE_KINDS.includes(kind)) fail(`${where}: bilinmeyen engel "${String(goal.kind)}"`);
        const total = countOf(kind);
        if (total === 0) fail(`${where}: tahtada hiç "${kind}" yok`);
        if (explicit !== undefined && (explicit as number) > total) fail(`${where}: ${String(explicit)} > tahtadaki ${total} ${kind}`);
        return { type: 'obstacle', kind, count: (explicit as number | undefined) ?? total };
      }
      case 'seagull': {
        if (nestLayers === 0) fail(`${where}: martı hedefi için martı yuvası ('b') gerekli`);
        if (explicit !== undefined && (explicit as number) > nestLayers) fail(`${where}: yuvalar en fazla ${nestLayers} martı verir`);
        return { type: 'seagull', count: (explicit as number | undefined) ?? nestLayers };
      }
      default:
        return fail(`${where}: bilinmeyen hedef türü "${String(goal.type)}"`);
    }
  });

  if (data.seed !== undefined && !Number.isInteger(data.seed)) fail('"seed" tam sayı olmalı');
  const tutorial: TutorialStep[] = [];
  if (data.tutorial !== undefined) {
    if (!Array.isArray(data.tutorial)) fail('"tutorial" dizi olmalı');
    (data.tutorial as Record<string, unknown>[]).forEach((step, i) => {
      const where = `"tutorial[${i}]"`;
      if (typeof step.text !== 'string' || step.text.length === 0) fail(`${where}.text gerekli`);
      const text = step.text as string;
      const pos = (value: unknown): { row: number; col: number } => {
        const arr = value as number[];
        if (!Array.isArray(arr) || arr.length !== 2 || !arr.every(Number.isInteger)) {
          fail(`${where}: konum [satır, sütun] olmalı`);
        }
        if (arr[0] < 0 || arr[0] >= shape.rows || arr[1] < 0 || arr[1] >= shape.cols || !isPlayable(arr[0], arr[1])) {
          fail(`${where}: (${arr[0]},${arr[1]}) tahtada değil`);
        }
        return { row: arr[0], col: arr[1] };
      };
      const special = (value: unknown): SpecialKind => {
        if (!SPECIAL_KINDS.includes(value as SpecialKind)) fail(`${where}: bilinmeyen güçlendirici "${String(value)}"`);
        return value as SpecialKind;
      };
      if (step.swap !== undefined) {
        const pair = step.swap as unknown[];
        if (!Array.isArray(pair) || pair.length !== 2) fail(`${where}.swap iki konum olmalı`);
        const a = pos(pair[0]);
        const b = pos(pair[1]);
        if (Math.abs(a.row - b.row) + Math.abs(a.col - b.col) !== 1) fail(`${where}.swap komşu kareler olmalı`);
        const creates = (step.expect as { creates?: unknown } | undefined)?.creates;
        tutorial.push({ text, swap: [a, b], expect: creates === undefined ? undefined : { creates: special(creates) } });
      } else if (step.tap !== undefined) {
        tutorial.push({ text, tap: special(step.tap) });
      } else if (step.swapSpecials === true) {
        tutorial.push({ text, swapSpecials: true });
      } else if (step.swapSpecialWith !== undefined) {
        const color = step.color as TileColor | undefined;
        if (color !== undefined && !colors.includes(color)) fail(`${where}.color bu bölümün renklerinde yok`);
        tutorial.push({ text, swapSpecialWith: special(step.swapSpecialWith), color });
      } else {
        tutorial.push({ text });
      }
    });
  }

  return {
    id: id as number,
    moves: data.moves as number,
    colors: colors as TileColor[],
    shape,
    obstacles,
    presetTiles,
    goals,
    seed: data.seed as number | undefined,
    tutorial,
  };
}

/** Bir engel türünün hangi katmanda durduğu (görünüm/araçlar için kısayol). */
export function layerOf(kind: ObstacleKind): ObstacleLayer {
  return OBSTACLES[kind].layer;
}
