import { midiToHz } from '../assets/audio/synth';
import type { Song, SongNote, SongTrack } from '../assets/audio/songs';

/** Ne kadar önceden nota planlanır (sn) ve planlayıcının uyanma aralığı (ms). */
const LOOKAHEAD_S = 0.15;
const TICK_MS = 25;

/**
 * Kodla yazılmış parçayı (Song) Web Audio ile döngüde çalar. Notalar ses saatine göre
 * birkaç yüz ms önceden planlanır; JavaScript zamanlayıcısı gecikse de ritim kaymaz.
 */
export class MusicPlayer {
  private song: Song | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private byStep: { track: SongTrack; note: SongNote }[][] = [];

  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
    private readonly noise: AudioBuffer,
  ) {}

  get playing(): Song | null {
    return this.song;
  }

  start(song: Song): void {
    this.stop();
    this.song = song;
    this.byStep = Array.from({ length: song.length }, () => []);
    for (const track of song.tracks) {
      for (const note of track.notes) this.byStep[note.step % song.length].push({ track, note });
    }
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }

  private schedule(): void {
    const song = this.song;
    if (!song) return;
    const stepDuration = 60 / song.bpm / 4;
    // Sekme uzun süre uyuduysa geride kalan notaları topluca çalma, kaldığı yerden devam et.
    if (this.nextTime < this.ctx.currentTime - 0.1) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
      for (const { track, note } of this.byStep[this.step]) this.play(track, note, this.nextTime, stepDuration);
      this.step = (this.step + 1) % song.length;
      this.nextTime += stepDuration;
    }
  }

  private play(track: SongTrack, note: SongNote, time: number, stepDuration: number): void {
    const duration = track.decay ?? note.len * stepDuration * 0.9;
    const peak = track.gain * note.vel;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.connect(this.output);

    let source: AudioScheduledSourceNode;
    if (track.wave === 'noise') {
      const buffer = this.ctx.createBufferSource();
      buffer.buffer = this.noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = track.filter ?? 'bandpass';
      filter.frequency.value = track.filterHz ?? 2000;
      buffer.connect(filter).connect(gain);
      source = buffer;
    } else {
      const osc = this.ctx.createOscillator();
      osc.type = track.wave;
      const freq = midiToHz(note.note);
      osc.frequency.setValueAtTime(freq, time);
      if (track.drop) osc.frequency.exponentialRampToValueAtTime(freq * track.drop, time + duration);
      osc.connect(gain);
      source = osc;
    }
    source.start(time);
    source.stop(time + duration + 0.02);
  }
}
