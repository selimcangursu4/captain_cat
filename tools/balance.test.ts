/**
 * Seviye dengesi ölçümü: `npm run balance`
 *
 * Bot her seviyeyi sabit tohumlarla, ek hamle almadan oynar. İki profil:
 *  güçlü   (beceri 1.0): her hamlede en iyisini seçer
 *  sıradan (beceri 0.6): hamlelerin %40'ında rastgele geçerli bir hamle yapar
 * Gerçek oyuncu bottan farklı oynar; tablo seviyeleri birbirine göre kıyaslamak,
 * imkânsız ya da fazla kolay seviyeleri yakalamak içindir. 200 seviyede birkaç dakika sürer.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { playLevel, type PlayResult } from './bot';

const GAMES = 60;

function summarize(results: readonly PlayResult[]) {
  const wins = results.filter((r) => r.won);
  const losses = results.filter((r) => !r.won);
  return {
    rate: wins.length / results.length,
    movesLeft: wins.length ? wins.reduce((s, r) => s + r.movesLeft, 0) / wins.length : 0,
    lossProgress: losses.length ? losses.reduce((s, r) => s + r.progress, 0) / losses.length : 1,
  };
}

const pct = (x: number) => `%${String(Math.round(x * 100)).padStart(3)}`;

describe('seviye dengesi', () => {
  it('her seviye kazanılabilir; öğreticiler kolay; zorluk kademeli artar', () => {
    const rows: string[] = [];
    const casualRates: number[] = [];
    for (const level of LEVELS) {
      const seeds = Array.from({ length: GAMES }, (_, s) => 1000 + s * 7919);
      const strong = summarize(seeds.map((seed) => playLevel(level, seed, 1)));
      const casual = summarize(seeds.map((seed) => playLevel(level, seed, 0.6)));
      casualRates.push(casual.rate);
      rows.push(
        `${String(level.id).padStart(3)} | ${String(level.moves).padStart(2)} hamle | güçlü ${pct(strong.rate)}` +
          ` | sıradan ${pct(casual.rate)} (kalan ort. ${casual.movesLeft.toFixed(1).padStart(4)}, kayıpta ilerleme ${pct(casual.lossProgress)})`,
      );
    }
    console.log(`\nSeviye dengesi (${GAMES} oyun / profil, ek hamle yok)\n${rows.join('\n')}\n`);

    const band = (from: number, to: number) => {
      const rates = casualRates.slice(from - 1, Math.min(to, casualRates.length));
      return rates.reduce((s, r) => s + r, 0) / rates.length;
    };
    const bands: string[] = [];
    for (let from = 1; from <= LEVELS.length; from += 10) bands.push(`${from}-${from + 9}: ${pct(band(from, from + 9))}`);
    console.log(`10'luk bant ortalamaları (sıradan): ${bands.join(' · ')}\n`);

    LEVELS.forEach((level, i) => {
      expect(casualRates[i], `seviye ${level.id} fazla zor`).toBeGreaterThanOrEqual(0.4);
      if (level.id <= 10) expect(casualRates[i], `öğretici seviye ${level.id} zor`).toBeGreaterThanOrEqual(0.9);
    });
    // Ortalama zorluk ilerledikçe artmalı (bantlar arasında küçük dalgalanma olabilir).
    expect(band(1, 10)).toBeGreaterThan(band(11, 20));
    expect(band(11, 20)).toBeGreaterThan(band(21, 30));
    if (LEVELS.length >= 200) expect(band(31, 80)).toBeGreaterThan(band(151, 200));
  });
});
