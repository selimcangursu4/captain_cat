import { describe, expect, it } from 'vitest';
import { MUSIC_MANIFEST, SOUND_KEYS, SOUND_MANIFEST } from '../../src/assets/SoundManifest';
import { GAME_SONG, HOME_SONG, parseMelody } from '../../src/assets/audio/songs';
import { midi, midiToHz } from '../../src/assets/audio/synth';
import { FEEDBACK } from '../../src/config/feedback';
import { en } from '../../src/i18n/en';
import { tr } from '../../src/i18n/tr';
import { comboTier } from '../../src/ui/effects/comboTier';

describe('kombo yazıları', () => {
  it('küçük hamlede yazı yok; zincir ya da kırılan taş arttıkça seviye yükselir', () => {
    expect(comboTier(0, 3)).toBe(0);
    expect(comboTier(1, 9)).toBe(0);
    expect(comboTier(2, 9)).toBe(1);
    expect(comboTier(0, 15)).toBe(1);
    expect(comboTier(3, 10)).toBe(2);
    expect(comboTier(1, 40)).toBe(3);
    expect(comboTier(9, 0)).toBe(4);
    expect(comboTier(0, 64)).toBe(4);
  });

  it('her seviyenin metni iki dilde, rengi ayarda var', () => {
    FEEDBACK.comboTiers.forEach((_, i) => {
      const key = `combo.${i + 1}`;
      expect(tr).toHaveProperty([key]);
      expect(en).toHaveProperty([key]);
      expect(FEEDBACK.comboColors[i]).toMatch(/^#[0-9a-f]{6}$/);
    });
  });
});

describe('sesler', () => {
  it('nota adları doğru frekansa çevrilir', () => {
    expect(midi('C4')).toBe(60);
    expect(midi('A4')).toBe(69);
    expect(midi('F#5')).toBe(78);
    expect(midi('Bb3')).toBe(58);
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(() => midi('H2')).toThrow();
  });

  it('her ses efektinin bir girdisi ve geçerli tonları var', () => {
    for (const key of SOUND_KEYS) {
      const entry = SOUND_MANIFEST[key];
      expect(entry, key).toBeDefined();
      if (entry.kind !== 'synth') continue;
      expect(entry.tones.length, key).toBeGreaterThan(0);
      for (const tone of entry.tones) {
        expect(tone.f, key).toBeGreaterThan(0);
        expect(tone.d, key).toBeGreaterThan(0);
        expect(tone.t, key).toBeGreaterThanOrEqual(0);
        expect(tone.g ?? 0.1, key).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('melodi yazımı: "-" notayı uzatır, "." susar', () => {
    expect(parseMelody('C5 - . E5 | G5 - - .')).toEqual([
      { step: 0, note: 72, len: 4, vel: 1 },
      { step: 6, note: 76, len: 2, vel: 1 },
      { step: 8, note: 79, len: 6, vel: 1 },
    ]);
  });

  it('müzik parçaları düzgün: notalar parçanın içinde, melodiler tam 8 ölçü', () => {
    for (const song of [HOME_SONG, GAME_SONG]) {
      expect(song.length).toBe(8 * 16);
      for (const track of song.tracks) {
        for (const note of track.notes) {
          expect(note.step, track.name).toBeGreaterThanOrEqual(0);
          expect(note.step + note.len, track.name).toBeLessThanOrEqual(song.length);
        }
      }
      const lead = song.tracks.find((tr) => tr.name === 'lead')!;
      const last = lead.notes[lead.notes.length - 1];
      expect(last.step).toBeLessThan(song.length);
    }
    expect(Object.keys(MUSIC_MANIFEST).sort()).toEqual(['game', 'home']);
  });
});
