import { MUSIC_MANIFEST, SOUND_MANIFEST, type MusicKey, type SoundKey } from '../assets/SoundManifest';
import type { Tone } from '../assets/audio/synth';
import { MusicPlayer } from './MusicPlayer';
import { settings } from './Settings';

export type { MusicKey, SoundKey };

export interface PlayOptions {
  /** Yarım ses cinsinden perde kaydırma (zincirde yükselen eşleşme sesi). */
  readonly pitch?: number;
  readonly volume?: number;
}

/** Aynı ses art arda çok sık çalmasın (zincirlerde onlarca eşleşme olabilir). */
const MIN_GAP_MS = 45;
const VOLUME = { sfx: 0.9, music: 0.55 } as const;
const MUSIC_FADE_S = 0.4;

/**
 * Ses servisi: efektler ve müzik ayrı kanallarda (ayarlardan ayrı ayrı kapatılır).
 * Sesler SoundManifest'ten gelir: bugün sentez, ileride dosya (çağıran kod değişmez).
 * Tarayıcılar sesi ancak bir dokunuştan sonra açar; ilk dokunuşta bağlam uyandırılır.
 * Sekme / uygulama arka plana geçince ses tamamen durdurulur (pil).
 */
export class AudioService {
  private ctx: AudioContext | null | undefined;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noise!: AudioBuffer;
  private music: MusicPlayer | null = null;
  private fileMusic: AudioBufferSourceNode | null = null;
  private wantedMusic: MusicKey | null = null;
  private musicGeneration = 0;
  private readonly lastPlayed = new Map<SoundKey, number>();
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();

  play(key: SoundKey, options: PlayOptions = {}): void {
    if (!settings.sound) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < MIN_GAP_MS) return;
    this.lastPlayed.set(key, now);
    const ctx = this.context();
    if (!ctx || ctx.state !== 'running') return;
    const entry = SOUND_MANIFEST[key];
    const rate = Math.pow(2, (options.pitch ?? 0) / 12);
    const volume = options.volume ?? 1;
    if (entry.kind === 'file') {
      void this.playFile(ctx, entry.url, (entry.volume ?? 1) * volume, rate, this.sfxGain);
      return;
    }
    const start = ctx.currentTime + 0.005;
    for (const tone of entry.tones) this.playTone(ctx, tone, start, rate, volume);
  }

  /** Sahnenin müziği (kasaba / bölüm). Aynı parça çalıyorsa baştan başlatmaz. */
  playMusic(key: MusicKey): void {
    this.wantedMusic = key;
    this.syncMusic();
  }

  stopMusic(): void {
    this.wantedMusic = null;
    this.syncMusic();
  }

  /** Müzik ayarı ya da istenen parça değişince çalan parçayı ona uydurur. */
  private syncMusic(): void {
    const ctx = this.context();
    if (!ctx) return;
    const target = settings.music ? this.wantedMusic : null;
    const entry = target ? MUSIC_MANIFEST[target] : null;
    const playingSong = this.music?.playing ?? null;
    if (entry?.kind === 'procedural' && playingSong === entry.song) return;

    // Eski parçayı söndür.
    this.musicGain.gain.cancelScheduledValues(ctx.currentTime);
    this.musicGain.gain.setTargetAtTime(0, ctx.currentTime, MUSIC_FADE_S / 3);
    const oldMusic = this.music;
    const oldFile = this.fileMusic;
    this.music = null;
    this.fileMusic = null;
    const fadeOutMs = playingSong || oldFile ? MUSIC_FADE_S * 1000 : 0;
    // Söndürme sürerken yeni bir parça istenirse yalnızca en son istek çalar.
    const generation = ++this.musicGeneration;

    setTimeout(() => {
      oldMusic?.stop();
      oldFile?.stop();
      if (generation !== this.musicGeneration || !entry || !this.ctx) return;
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setTargetAtTime(VOLUME.music, this.ctx.currentTime, MUSIC_FADE_S / 3);
      if (entry.kind === 'procedural') {
        this.music = new MusicPlayer(this.ctx, this.musicGain, this.noise);
        this.music.start(entry.song);
      } else {
        void this.startFileMusic(this.ctx, entry.url, entry.volume ?? 1);
      }
    }, fadeOutMs);
  }

  private async startFileMusic(ctx: AudioContext, url: string, volume: number): Promise<void> {
    const buffer = await this.loadBuffer(ctx, url);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.musicGain);
    source.start();
    this.fileMusic = source;
  }

  private playTone(ctx: AudioContext, tone: Tone, start: number, rate: number, volume: number): void {
    const t0 = start + tone.t;
    const t1 = t0 + tone.d;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, (tone.g ?? 0.1) * volume), t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    gain.connect(this.sfxGain);

    let source: AudioScheduledSourceNode;
    if (tone.type === 'noise') {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = tone.filter ?? 'bandpass';
      filter.Q.value = tone.q ?? 1;
      filter.frequency.setValueAtTime(tone.f * rate, t0);
      if (tone.f2) filter.frequency.exponentialRampToValueAtTime(tone.f2 * rate, t1);
      noise.connect(filter).connect(gain);
      source = noise;
    } else {
      const osc = ctx.createOscillator();
      osc.type = tone.type ?? 'sine';
      osc.frequency.setValueAtTime(tone.f * rate, t0);
      if (tone.f2) osc.frequency.exponentialRampToValueAtTime(tone.f2 * rate, t1);
      osc.connect(gain);
      source = osc;
    }
    source.start(t0);
    source.stop(t1 + 0.02);
  }

  private async playFile(ctx: AudioContext, url: string, volume: number, rate: number, out: AudioNode): Promise<void> {
    const buffer = await this.loadBuffer(ctx, url);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(out);
    source.start();
  }

  private loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    let pending = this.buffers.get(url);
    if (!pending) {
      pending = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => null);
      this.buffers.set(url, pending);
    }
    return pending;
  }

  /** İlk çağrıda bağlamı, kanalları ve gürültü tamponunu kurar (yalnızca tarayıcıda). */
  private context(): AudioContext | null {
    if (this.ctx !== undefined) return this.ctx;
    const Ctor =
      globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    try {
      this.ctx = Ctor ? new Ctor() : null;
    } catch {
      this.ctx = null;
    }
    const ctx = this.ctx;
    if (!ctx) return null;

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = VOLUME.sfx;
    this.sfxGain.connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Tarayıcı sesi kapalı başlatır: ilk dokunuşta aç.
    const unlock = () => {
      if (ctx.state === 'suspended' && !document.hidden) void ctx.resume();
    };
    for (const event of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(event, unlock, { passive: true });
    // Arka plana geçince ses tamamen dursun.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
    // Ayarlardan müzik açılıp kapanınca.
    let musicOn = settings.music;
    settings.onChange(() => {
      if (settings.music === musicOn) return;
      musicOn = settings.music;
      this.syncMusic();
    });
    return ctx;
  }
}

export const audio = new AudioService();
