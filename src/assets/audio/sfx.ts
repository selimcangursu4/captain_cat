import { hz, type Tone } from './synth';

/** Oyundaki tüm ses efektleri. */
export const SOUND_KEYS = [
  'tap',
  'popup',
  'swap',
  'invalid',
  'match',
  'land',
  'create',
  'harpoon',
  'cannon',
  'whirlpool',
  'seagull',
  'shovel',
  'helm',
  'storm',
  'booster',
  'shuffle',
  'sandbag',
  'net',
  'moss',
  'chest',
  'nest',
  'collect',
  'combo',
  'coin',
  'star',
  'win',
  'lose',
  'build',
  'unlock',
] as const;

export type SoundKey = (typeof SOUND_KEYS)[number];

const arpeggio = (notes: string[], gap: number, d: number, type: OscillatorType, g: number): Tone[] =>
  notes.map((n, i) => ({ f: hz(n), t: i * gap, d, type, g }));

/** Sentezle üretilen yer tutucu sesler (kısa, yumuşak, çocuk dostu). */
export const SYNTH_SOUNDS: Record<SoundKey, readonly Tone[]> = {
  tap: [{ f: 880, f2: 1100, t: 0, d: 0.05, g: 0.1 }],
  popup: [{ f: 600, f2: 3000, t: 0, d: 0.16, type: 'noise', filter: 'bandpass', q: 2, g: 0.12 }],
  swap: [{ f: 420, f2: 640, t: 0, d: 0.08, type: 'triangle', g: 0.09 }],
  invalid: [
    { f: 300, f2: 220, t: 0, d: 0.08, type: 'triangle', g: 0.12 },
    { f: 300, f2: 220, t: 0.1, d: 0.08, type: 'triangle', g: 0.1 },
  ],
  match: [
    { f: 520, f2: 860, t: 0, d: 0.09, type: 'triangle', g: 0.14 },
    { f: 1800, t: 0, d: 0.05, type: 'noise', filter: 'highpass', q: 1, g: 0.05 },
  ],
  land: [{ f: 220, f2: 140, t: 0, d: 0.05, type: 'sine', g: 0.08 }],
  create: [
    ...arpeggio(['E5', 'G5', 'C6'], 0.05, 0.12, 'triangle', 0.12),
    { f: 4000, t: 0.08, d: 0.15, type: 'noise', filter: 'highpass', q: 1, g: 0.04 },
  ],
  harpoon: [{ f: 400, f2: 4000, t: 0, d: 0.28, type: 'noise', filter: 'bandpass', q: 3, g: 0.2 }],
  cannon: [
    { f: 140, f2: 40, t: 0, d: 0.35, type: 'sine', g: 0.45 },
    { f: 900, f2: 200, t: 0, d: 0.4, type: 'noise', filter: 'lowpass', q: 1, g: 0.35 },
  ],
  whirlpool: [
    { f: 200, f2: 1600, t: 0, d: 0.5, type: 'sawtooth', g: 0.04 },
    { f: 300, f2: 2400, t: 0, d: 0.55, type: 'noise', filter: 'bandpass', q: 6, g: 0.12 },
  ],
  seagull: [
    { f: 1300, f2: 900, t: 0, d: 0.12, type: 'square', g: 0.05 },
    { f: 1400, f2: 950, t: 0.15, d: 0.14, type: 'square', g: 0.05 },
  ],
  shovel: [
    { f: 2500, t: 0, d: 0.06, type: 'noise', filter: 'highpass', q: 1, g: 0.15 },
    { f: 180, f2: 90, t: 0, d: 0.12, type: 'sine', g: 0.3 },
  ],
  helm: [
    { f: 300, f2: 1200, t: 0, d: 0.45, type: 'noise', filter: 'bandpass', q: 2, g: 0.15 },
    { f: 330, f2: 500, t: 0, d: 0.4, type: 'triangle', g: 0.06 },
  ],
  storm: [
    { f: 1200, f2: 150, t: 0, d: 0.9, type: 'noise', filter: 'lowpass', q: 1, g: 0.4 },
    { f: 80, f2: 40, t: 0.05, d: 0.6, type: 'sine', g: 0.3 },
  ],
  booster: [...arpeggio(['C5', 'G5', 'C6', 'E6'], 0.05, 0.14, 'triangle', 0.1)],
  shuffle: [
    { f: 400, f2: 2000, t: 0, d: 0.35, type: 'noise', filter: 'bandpass', q: 4, g: 0.12 },
    { f: 2000, f2: 400, t: 0.35, d: 0.35, type: 'noise', filter: 'bandpass', q: 4, g: 0.12 },
  ],
  sandbag: [{ f: 500, f2: 150, t: 0, d: 0.14, type: 'noise', filter: 'lowpass', q: 1, g: 0.3 }],
  net: [{ f: 3000, f2: 1200, t: 0, d: 0.12, type: 'noise', filter: 'bandpass', q: 5, g: 0.18 }],
  moss: [{ f: 700, f2: 300, t: 0, d: 0.1, type: 'noise', filter: 'bandpass', q: 3, g: 0.14 }],
  chest: [
    { f: 160, f2: 90, t: 0, d: 0.1, type: 'square', g: 0.06 },
    ...arpeggio(['G5', 'B5', 'D6'], 0.06, 0.12, 'triangle', 0.1),
  ],
  nest: [{ f: 1600, f2: 2200, t: 0, d: 0.08, type: 'triangle', g: 0.08 }],
  collect: [{ f: 1320, f2: 1760, t: 0, d: 0.07, type: 'sine', g: 0.08 }],
  combo: [...arpeggio(['C5', 'E5', 'G5', 'C6'], 0.06, 0.16, 'triangle', 0.13)],
  coin: [
    { f: 988, t: 0, d: 0.07, type: 'square', g: 0.04 },
    { f: 1319, t: 0.07, d: 0.16, type: 'square', g: 0.04 },
  ],
  star: [...arpeggio(['G5', 'C6', 'E6', 'G6'], 0.07, 0.25, 'sine', 0.1)],
  win: [
    ...arpeggio(['C5', 'E5', 'G5', 'C6'], 0.11, 0.22, 'triangle', 0.15),
    { f: hz('E6'), t: 0.48, d: 0.45, type: 'triangle', g: 0.12 },
    { f: hz('G5'), t: 0.48, d: 0.45, type: 'triangle', g: 0.08 },
  ],
  lose: arpeggio(['G4', 'E4', 'C4'], 0.16, 0.26, 'triangle', 0.13),
  build: [
    { f: 150, f2: 70, t: 0, d: 0.22, g: 0.3 },
    { f: 800, f2: 200, t: 0, d: 0.25, type: 'noise', filter: 'lowpass', q: 1, g: 0.15 },
    { f: hz('E5'), t: 0.12, d: 0.18, type: 'triangle', g: 0.12 },
    { f: hz('A5'), t: 0.22, d: 0.25, type: 'triangle', g: 0.12 },
  ],
  unlock: arpeggio(['G4', 'C5', 'E5', 'G5', 'C6'], 0.07, 0.18, 'sine', 0.12),
};
