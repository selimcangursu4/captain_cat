/**
 * Yer tutucu seslerin tarif biçimi: dosya yerine Web Audio ile çalınan kısa tonlar ve gürültü.
 * Gerçek ses dosyaları gelince SoundManifest'teki girdi { kind: 'file', url } yapılır.
 */

/** Tek bir ton ya da gürültü patlaması. Süreler saniye. */
export interface Tone {
  /** Frekans (Hz). Gürültüde süzgeç frekansı. */
  readonly f: number;
  /** Verilirse frekans süre boyunca buna kayar. */
  readonly f2?: number;
  /** Başlangıç (sesin başından itibaren) ve süre. */
  readonly t: number;
  readonly d: number;
  readonly type?: OscillatorType | 'noise';
  /** En yüksek ses düzeyi (0-1). */
  readonly g?: number;
  /** Gürültü süzgeci türü ve keskinliği. */
  readonly filter?: BiquadFilterType;
  readonly q?: number;
}

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4", "F#5", "Bb3" → MIDI numarası (C4 = 60). */
export function midi(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!match) throw new Error(`Geçersiz nota: ${name}`);
  const [, letter, accidental, octave] = match;
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return 12 * (Number(octave) + 1) + NOTE_INDEX[letter] + shift;
}

export function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export const hz = (name: string) => midiToHz(midi(name));
