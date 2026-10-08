/// <reference types="node" />
/**
 * Seviye üretici: `npm run levels`
 *
 * HANDMADE_LEVELS'tan sonra TARGET_LEVELS'a kadar EKSİK seviye dosyalarını üretir ve hamle
 * sayılarını denge botuyla ayarlar (var olan dosyalara dokunmaz). Seçenekler (PowerShell):
 *   $env:LEVELS_TO='60'; npm run levels             → yalnızca 60. seviyeye kadar
 *   $env:LEVELS_FROM='183'; $env:LEVELS_TO='183'; $env:LEVELS_FORCE='1'; npm run levels → tek seviyeyi yeniden üret
 *   $env:LEVELS_FORCE='1'; npm run levels           → var olanları da yeniden üret
 *   $env:LEVELS_RETUNE='100,119'; npm run levels    → bu seviyelerin yalnızca hamle sayısını yeniden ayarla
 *   $env:LEVELS_RETUNE='all'; npm run levels        → üretilmiş tüm seviyeleri yeniden ayarla
 * Plan ve zorluk eğrisi: tools/levelgen/plan.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { it } from 'vitest';
import { formatLevel, type LevelJson } from './levelgen/generate';
import { HANDMADE_LEVELS, TARGET_LEVELS } from './levelgen/plan';
import { buildLevel, retuneLevel, type TuneReport } from './levelgen/tune';

const pct = (x: number) => `%${String(Math.round(x * 100)).padStart(3)}`;
const fileOf = (id: number) => resolve(process.cwd(), `src/data/levels/level-${String(id).padStart(3, '0')}.json`);

function line(report: TuneReport, note = ''): string {
  return (
    `${String(report.id).padStart(3)} | ${report.archetype.padEnd(7)} | ${String(report.moves).padStart(2)} hamle` +
    ` | hedef ${pct(report.target)} | sıradan ${pct(report.casual)} | güçlü ${pct(report.strong)}` +
    (report.attempt > 0 ? ` | deneme ${report.attempt + 1}` : '') +
    note
  );
}

it('eksik seviyeleri üret ve dengele', () => {
  const force = process.env.LEVELS_FORCE === '1';
  const retune = process.env.LEVELS_RETUNE;
  const first = Number(process.env.LEVELS_FROM ?? HANDMADE_LEVELS + 1);
  const last = Number(process.env.LEVELS_TO ?? TARGET_LEVELS);
  if (first <= HANDMADE_LEVELS) throw new Error(`İlk ${HANDMADE_LEVELS} seviye elle tasarlandı; üretici onlara dokunmaz`);
  const written: string[] = [];

  if (retune) {
    const ids =
      retune === 'all'
        ? Array.from({ length: last - HANDMADE_LEVELS }, (_, i) => HANDMADE_LEVELS + 1 + i).filter((id) => existsSync(fileOf(id)))
        : retune.split(',').map((s) => Number(s.trim()));
    for (const id of ids) {
      const file = fileOf(id);
      const text = readFileSync(file, 'utf8');
      const before = (JSON.parse(text) as LevelJson).moves;
      const report = retuneLevel(JSON.parse(text) as LevelJson);
      // Yalnızca "moves" satırı değişir; dosyanın geri kalanı (elle düzenlemeler) korunur.
      writeFileSync(file, text.replace(/"moves":\s*\d+/, `"moves": ${report.moves}`));
      const out = line(report, ` | önce ${before}`);
      written.push(out);
      console.log(out);
    }
    console.log(`\n${written.length} seviyenin hamle sayısı yeniden ayarlandı.`);
    return;
  }

  for (let id = first; id <= last; id++) {
    const file = fileOf(id);
    if (existsSync(file) && !force) continue;
    const { json, report } = buildLevel(id);
    writeFileSync(file, formatLevel(json));
    const out = line(report);
    written.push(out);
    console.log(out);
  }
  console.log(written.length ? `\n${written.length} seviye üretildi.` : 'Eksik seviye yok.');
});
