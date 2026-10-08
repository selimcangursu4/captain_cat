import { midi } from './synth';

/** Bir notanın başladığı on altılık adım, süresi (adım) ve şiddeti. */
export interface SongNote {
  readonly step: number;
  readonly note: number;
  readonly len: number;
  readonly vel: number;
}

export interface SongTrack {
  readonly name: string;
  readonly wave: OscillatorType | 'noise';
  readonly gain: number;
  /** Gürültü davulları için süzgeç. */
  readonly filter?: BiquadFilterType;
  readonly filterHz?: number;
  /** Davul vuruşu gibi kısa sesler: notanın uzunluğundan bağımsız sönümleme (sn). */
  readonly decay?: number;
  /** Tonun düşmesi (kick davulu): başlangıç frekansının bu oranına iner. */
  readonly drop?: number;
  readonly notes: readonly SongNote[];
}

/** Döngüyle çalan parça. 1 vuruş = 4 adım; uzunluk adım cinsinden. */
export interface Song {
  readonly bpm: number;
  readonly length: number;
  readonly tracks: readonly SongTrack[];
}

const STEPS_PER_BAR = 16;

/** Akor: kök nota (bas için) ve arpej notaları. */
interface Chord {
  readonly bass: string;
  readonly tones: readonly string[];
}

const CHORDS: Record<string, Chord> = {
  C: { bass: 'C3', tones: ['C4', 'E4', 'G4', 'C5'] },
  Am: { bass: 'A2', tones: ['A3', 'C4', 'E4', 'A4'] },
  F: { bass: 'F2', tones: ['F3', 'A3', 'C4', 'F4'] },
  G: { bass: 'G2', tones: ['G3', 'B3', 'D4', 'G4'] },
  Dm: { bass: 'D3', tones: ['D4', 'F4', 'A4', 'D5'] },
  D: { bass: 'D3', tones: ['D4', 'F#4', 'A4', 'D5'] },
  Em: { bass: 'E3', tones: ['E4', 'G4', 'B4', 'E5'] },
};

/**
 * Melodi yazımı: her parça bir sekizlik. "E5" nota, "-" önceki notayı uzatır, "." sus.
 * Ölçüler "|" ile ayrılabilir (okunabilirlik için).
 */
export function parseMelody(text: string, vel = 1): SongNote[] {
  const tokens = text.split(/\s+/).filter((t) => t && t !== '|');
  const notes: SongNote[] = [];
  let current: { step: number; note: number; len: number } | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '-') {
      if (current) current.len += 2;
      continue;
    }
    if (current) notes.push({ ...current, vel });
    current = token === '.' ? null : { step: i * 2, note: midi(token), len: 2 };
  }
  if (current) notes.push({ ...current, vel });
  return notes;
}

function bassLine(progression: readonly string[], hits: readonly number[], len: number): SongNote[] {
  return progression.flatMap((name, bar) =>
    hits.map((h) => ({ step: bar * STEPS_PER_BAR + h, note: midi(CHORDS[name].bass), len, vel: h === 0 ? 1 : 0.75 })),
  );
}

/** Her sekizlikte akorun bir notası (pattern: akor notalarının sırası). */
function arpeggio(progression: readonly string[], pattern: readonly number[]): SongNote[] {
  return progression.flatMap((name, bar) =>
    pattern.map((index, i) => ({
      step: bar * STEPS_PER_BAR + i * 2,
      note: midi(CHORDS[name].tones[index]),
      len: 2,
      vel: i % 2 === 0 ? 0.9 : 0.6,
    })),
  );
}

function drums(bars: number, steps: readonly number[], vel = 1): SongNote[] {
  return Array.from({ length: bars }, (_, bar) => steps.map((s) => ({ step: bar * STEPS_PER_BAR + s, note: 0, len: 1, vel }))).flat();
}

/** Kasaba: sakin, sallanan bir liman ezgisi (Do majör, 90 BPM). */
const HOME_PROGRESSION = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'];
const HOME_MELODY = `
  E5 . G5 . A5 G5 E5 . | C5 . E5 . D5 . C5 . | A4 . C5 . F5 E5 C5 . | D5 - - - G4 . . . |
  E5 . G5 . C6 . A5 G5 | E5 - . G5 A5 . E5 . | F5 . E5 . D5 . A4 . | B4 . D5 . G5 - - . `;

export const HOME_SONG: Song = {
  bpm: 90,
  length: HOME_PROGRESSION.length * STEPS_PER_BAR,
  tracks: [
    { name: 'bass', wave: 'sine', gain: 0.22, notes: bassLine(HOME_PROGRESSION, [0, 8], 6) },
    { name: 'arp', wave: 'triangle', gain: 0.05, notes: arpeggio(HOME_PROGRESSION, [0, 1, 2, 3, 2, 1, 2, 3]) },
    { name: 'lead', wave: 'triangle', gain: 0.09, notes: parseMelody(HOME_MELODY) },
  ],
};

/** Bölüm: daha canlı, hafif davullu (Sol majör, 116 BPM). */
const GAME_PROGRESSION = ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D'];
const GAME_MELODY = `
  B4 - D5 . G5 - F#5 . | A5 - F#5 . D5 - . . | G5 . F#5 . E5 . B4 . | C5 - E5 . G5 - . . |
  B5 . A5 . G5 . D5 . | F#5 . A5 . D6 - . . | E5 . G5 . C6 . B5 . | A5 - - - D5 - . . `;

export const GAME_SONG: Song = {
  bpm: 116,
  length: GAME_PROGRESSION.length * STEPS_PER_BAR,
  tracks: [
    { name: 'bass', wave: 'sine', gain: 0.2, notes: bassLine(GAME_PROGRESSION, [0, 4, 8, 12], 3) },
    { name: 'arp', wave: 'triangle', gain: 0.045, notes: arpeggio(GAME_PROGRESSION, [0, 2, 3, 2, 1, 2, 3, 2]) },
    { name: 'lead', wave: 'square', gain: 0.025, notes: parseMelody(GAME_MELODY) },
    { name: 'kick', wave: 'sine', gain: 0.35, decay: 0.16, drop: 0.3, notes: drums(8, [0, 8]).map((n) => ({ ...n, note: midi('C2') })) },
    { name: 'snare', wave: 'noise', gain: 0.07, filter: 'bandpass', filterHz: 1800, decay: 0.12, notes: drums(8, [4, 12]) },
    { name: 'hat', wave: 'noise', gain: 0.03, filter: 'highpass', filterHz: 7000, decay: 0.04, notes: drums(8, [2, 6, 10, 14], 0.8) },
  ],
};

export const SONGS = { home: HOME_SONG, game: GAME_SONG } as const;
export type MusicKey = keyof typeof SONGS;
