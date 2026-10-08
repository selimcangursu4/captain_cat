import { LevelSession, parseLevel, type LevelDefinition } from '../../src/core';
import { playLevel } from '../bot';
import { archetypeOf, generateLevel, type LevelJson } from './generate';
import { targetWinRate } from './plan';

/** Hamle arama aralığı ve oyuncu için keyifli aralık (çok kısa/uzun seviye olmasın). */
const MOVES = { min: 10, max: 50, generous: 70, comfortMin: 15, comfortMax: 40 } as const;
const GAMES = { check: 16, search: 40, verify: 80 } as const;
const CASUAL = 0.6;
const STRONG = 1;
const MAX_ATTEMPTS = 20;
/** Doğrulamada hedefin bu kadar altına inilirse hamle eklenir (farklı tohumlarla ölçüm gürültüsü). */
const VERIFY_SLACK = 0.04;

/** Arama ve doğrulama ayrı tohum setleriyle yapılır: ayar tek bir tohum setine "ezber" olmasın. */
const SEARCH_SEEDS = (i: number) => 5000 + i * 7919;
const VERIFY_SEEDS = (i: number) => 900_001 + i * 104_729;

/** Sabit tohumlarla kazanma oranı (aynı seviye + aynı hamle → aynı sonuç). */
export function winRate(level: LevelDefinition, moves: number, games: number, skill: number, seeds = SEARCH_SEEDS): number {
  let wins = 0;
  for (let i = 0; i < games; i++) if (playLevel(level, seeds(i), skill, moves).won) wins++;
  return wins / games;
}

export interface TuneResult {
  readonly moves: number;
  readonly casual: number;
  readonly strong: number;
}

/**
 * Hamle sayısını ayarlar: sıradan botun kazanma oranı hedefe ulaşan en az hamle (ikili arama),
 * sonra bağımsız tohumlarla doğrulama (gerekirse hamle eklenir). Hedefe hiç ulaşılamıyorsa null.
 */
export function tuneMoves(level: LevelDefinition, target: number): TuneResult | null {
  if (winRate(level, MOVES.max, GAMES.search, CASUAL) < target) return null;
  let lo: number = MOVES.min;
  let hi: number = MOVES.max;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (winRate(level, mid, GAMES.search, CASUAL) >= target) hi = mid;
    else lo = mid + 1;
  }
  let moves = lo;
  let casual = winRate(level, moves, GAMES.verify, CASUAL, VERIFY_SEEDS);
  while (casual < target - VERIFY_SLACK && moves < MOVES.max) {
    moves++;
    casual = winRate(level, moves, GAMES.verify, CASUAL, VERIFY_SEEDS);
  }
  return { moves, casual, strong: winRate(level, moves, GAMES.verify, STRONG, VERIFY_SEEDS) };
}

export interface TuneReport extends TuneResult {
  readonly id: number;
  readonly archetype: string;
  readonly attempt: number;
  readonly target: number;
}

/**
 * Seviyeyi üretir, doğrular ve hamle sayısını ayarlar:
 *  1) dosya geçerli ve tahta kurulabiliyor mu,
 *  2) güçlü bot bol hamleyle neredeyse her zaman kazanıyor mu (imkânsız seviye olmasın),
 *  3) tuneMoves: hedef kazanma oranı için hamle sayısı,
 *  4) bu hamle sayısı keyifli aralıkta mı (15-40).
 * Olmazsa sıradaki denemeyle (farklı tohum) yeniden üretir; hiçbiri aralığa girmezse en yakını seçilir.
 */
export function buildLevel(id: number): { json: LevelJson; report: TuneReport } {
  const target = targetWinRate(id);
  let fallback: { json: LevelJson; report: TuneReport; distance: number } | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const json = generateLevel(id, attempt);
    let level: LevelDefinition;
    try {
      level = parseLevel(json);
      new LevelSession(level, 1);
    } catch {
      continue;
    }
    if (winRate(level, MOVES.generous, GAMES.check, STRONG) < 0.9) continue;
    const tuned = tuneMoves(level, target);
    if (!tuned) continue;
    const distance = Math.max(0, MOVES.comfortMin - tuned.moves, tuned.moves - MOVES.comfortMax);
    if (distance > 0 && fallback && fallback.distance <= distance) continue;
    json.moves = tuned.moves;
    const result = { json, report: { id, archetype: archetypeOf(id), attempt, target, ...tuned } };
    if (distance === 0) return result;
    fallback = { ...result, distance };
  }
  if (fallback) return { json: fallback.json, report: fallback.report };
  throw new Error(`Seviye ${id}: ${MAX_ATTEMPTS} denemede uygun seviye üretilemedi`);
}

/** Var olan bir seviyenin (tasarımına dokunmadan) yalnızca hamle sayısını yeniden ayarlar. */
export function retuneLevel(raw: LevelJson): TuneReport {
  const level = parseLevel(raw);
  const target = targetWinRate(level.id);
  const tuned = tuneMoves(level, target);
  if (!tuned) throw new Error(`Seviye ${level.id}: ${MOVES.max} hamleyle bile hedefe (%${Math.round(target * 100)}) ulaşılamıyor`);
  return { id: level.id, archetype: archetypeOf(level.id), attempt: 0, target, ...tuned };
}
