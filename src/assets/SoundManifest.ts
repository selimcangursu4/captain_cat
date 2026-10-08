import { SOUND_KEYS, SYNTH_SOUNDS, type SoundKey } from './audio/sfx';
import { SONGS, type MusicKey, type Song } from './audio/songs';
import type { Tone } from './audio/synth';

export { SOUND_KEYS, type SoundKey, type MusicKey };

/**
 * TÜM seslerin tek kaynağı (görseller için AssetManifest neyse sesler için bu).
 * Şimdilik hepsi Web Audio ile üretilen yer tutuculardır (çevrimdışı, sıfır dosya boyutu).
 *
 * Gerçek sese geçiş: girdiyi
 *   { kind: 'file', url: 'assets/sfx/match.mp3', volume: 0.8 }
 * yapmak yeterli (dosya public/assets altına konur). Oyun kodu yalnızca anahtarı bilir.
 */
export type SoundEntry =
  | { readonly kind: 'synth'; readonly tones: readonly Tone[] }
  | { readonly kind: 'file'; readonly url: string; readonly volume?: number };

export type MusicEntry =
  | { readonly kind: 'procedural'; readonly song: Song }
  | { readonly kind: 'file'; readonly url: string; readonly volume?: number };

export const SOUND_MANIFEST: Readonly<Record<SoundKey, SoundEntry>> = Object.fromEntries(
  SOUND_KEYS.map((key) => [key, { kind: 'synth', tones: SYNTH_SOUNDS[key] }]),
) as Record<SoundKey, SoundEntry>;

export const MUSIC_MANIFEST: Readonly<Record<MusicKey, MusicEntry>> = {
  home: { kind: 'procedural', song: SONGS.home },
  game: { kind: 'procedural', song: SONGS.game },
};
