/// <reference types="node" />
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseLevel } from '../../src/core/level/parseLevel';
import { DEFAULT_MIN_LEVEL_MS, type CommandRules } from '../../src/meta/commands';
import type { LevelRow } from './store';

/** Paketle gelen seviye dosyaları (veritabanı boşsa ve db:seed için). */
export const LEVEL_FILES_DIR = fileURLToPath(new URL('../../src/data/levels/', import.meta.url));

export async function readLevelFiles(dir = LEVEL_FILES_DIR): Promise<LevelRow[]> {
  const names = (await readdir(dir)).filter((n) => /^level-\d+\.json$/.test(n)).sort();
  return Promise.all(
    names.map(async (name) => {
      const data = JSON.parse(await readFile(`${dir}${name}`, 'utf8')) as { id: number };
      return { id: data.id, data };
    }),
  );
}

/**
 * Sunucunun bildiği seviyeler: komut doğrulaması için hamle ve sandık sayıları.
 * Yalnızca 1'den başlayıp ardışık giden geçerli seviyeler sayılır.
 */
export class LevelCatalog {
  private info = new Map<number, { moves: number; chests: number }>();

  get count(): number {
    return this.info.size;
  }

  load(rows: readonly LevelRow[]): void {
    const next = new Map<number, { moves: number; chests: number }>();
    const sorted = [...rows].sort((a, b) => a.id - b.id);
    for (const row of sorted) {
      if (row.id !== next.size + 1) break;
      try {
        const level = parseLevel(row.data);
        next.set(level.id, { moves: level.moves, chests: level.obstacles.filter((o) => o.kind === 'chest').length });
      } catch {
        break;
      }
    }
    this.info = next;
  }

  rules(allowDev: boolean): CommandRules {
    return {
      level: (id) => this.info.get(id) ?? null,
      allowDev,
      minLevelMs: DEFAULT_MIN_LEVEL_MS,
    };
  }
}
