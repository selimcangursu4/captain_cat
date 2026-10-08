import { applyCommand, type Command, type CommandResult, type CommandRules } from '../meta/commands';
import type { GameServices } from '../meta/game';
import { clientRules, game } from '../meta/progress';
import { LocalStorageSaveStorage } from '../services/SaveService';
import { ApiError, api } from './api';
import type { Session } from './session';

/** Tek istekte gönderilen en fazla komut. */
const MAX_BATCH = 200;
/** Komut sonrası eşitlemeden önce kısa bekleme (art arda komutlar tek istekte gitsin). */
const DEBOUNCE_MS = 1500;
/** Bekleyen komut varken düzenli deneme; çevrimdışıyken artan bekleme. */
const RETRY = { first: 2000, max: 60_000 } as const;

export type SyncStatus = 'offline' | 'pending' | 'syncing' | 'synced' | 'unauthorized';

/** Komutun "at" alanı dispatch sırasında eklenir. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type CommandInput = DistributiveOmit<Command, 'at'>;

interface SyncResponse {
  readonly revision: number;
  readonly save: unknown;
  readonly results: readonly { readonly ok: boolean; readonly reason?: string }[];
}

/**
 * Komut günlüğü ve sunucuyla eşitleme.
 *  - dispatch: komut hemen yerelde uygulanır (internetsiz oynanır) ve günlüğe yazılır.
 *  - syncNow: günlük sunucuya gider; sunucu komutları kendi kaydında yeniden oynatır ve esas kaydı
 *    döndürür. İstemci kendi kaydını onunla değiştirir; istek sürerken yapılan yeni komutları
 *    üstüne yeniden uygular. Böylece iki cihazda oynansa bile çakışma olmaz; sunucunun reddettiği
 *    komut (ör. hile) kayıttan düşer.
 * Günlük telefonda saklanır: uygulama kapanıp açılsa da gönderilmemiş komut kaybolmaz.
 */
export class SyncService {
  private userId: string | null = null;
  private token: string | null = null;
  private journal: Command[] = [];
  private revision = 0;
  private inFlight: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryMs: number = RETRY.first;
  private status: SyncStatus = 'offline';
  private readonly listeners = new Set<(status: SyncStatus) => void>();

  constructor(
    private readonly game: GameServices,
    private readonly rules: CommandRules,
  ) {}

  get state(): SyncStatus {
    return this.status;
  }

  /** Henüz sunucuya gitmemiş komut sayısı. */
  get pending(): number {
    return this.journal.length;
  }

  attach(session: Session): void {
    this.detach();
    this.userId = session.user.id;
    this.token = session.token;
    try {
      this.journal = JSON.parse(this.store('journal').read() ?? '[]') as Command[];
      this.revision = Number(JSON.parse(this.store('sync').read() ?? '{}').revision ?? 0);
    } catch {
      this.journal = [];
      this.revision = 0;
    }
    this.setStatus(this.journal.length ? 'pending' : 'offline');
  }

  detach(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.userId = null;
    this.token = null;
    this.journal = [];
    this.revision = 0;
  }

  /** Komutu uygular; başarılıysa günlüğe ekler ve eşitlemeyi planlar. */
  dispatch(input: CommandInput): CommandResult {
    const cmd = { ...input, at: Date.now() } as Command;
    const result = applyCommand(this.game, cmd, this.rules);
    if (result.ok && this.userId) {
      this.journal.push(cmd);
      this.persist();
      this.setStatus('pending');
      this.schedule(DEBOUNCE_MS);
    } else if (!result.ok && import.meta.env.DEV) {
      console.warn('[Kaptan Pati] Komut uygulanamadı:', cmd.type, result.reason);
    }
    return result;
  }

  /** Bekleyen komutları gönderir ve sunucudaki son kaydı alır (komut yoksa yalnızca çeker). */
  syncNow(): Promise<void> {
    if (!this.token) return Promise.resolve();
    if (!this.inFlight) this.inFlight = this.run().finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  /**
   * Sürmekte olan eşitlemeyi bekler ve yeni bir eşitleme yapar: sunucunun kaydı komut dışında
   * değiştiğinde (ör. doğrulanan satın alma) istemci en güncel kaydı alsın.
   */
  async refresh(): Promise<void> {
    if (this.inFlight) await this.inFlight;
    await this.syncNow();
  }

  onStatus(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async run(): Promise<void> {
    const token = this.token;
    const userId = this.userId;
    const batch = this.journal.slice(0, MAX_BATCH);
    this.setStatus('syncing');
    try {
      const res = await api<SyncResponse>('/sync', { body: { baseRevision: this.revision, commands: batch }, token });
      if (this.userId !== userId) return; // bu sırada çıkış yapıldı
      this.journal = this.journal.slice(batch.length);
      this.revision = res.revision;
      this.game.save.replace(res.save);
      // İstek sürerken yapılan komutlar sunucunun kaydına yeniden uygulanır.
      this.journal = this.journal.filter((cmd) => applyCommand(this.game, cmd, this.rules).ok);
      this.persist();
      if (import.meta.env.DEV) {
        res.results.forEach((r, i) => {
          if (!r.ok) console.warn('[Kaptan Pati] Sunucu komutu reddetti:', batch[i]?.type, r.reason);
        });
      }
      this.retryMs = RETRY.first;
      this.setStatus(this.journal.length ? 'pending' : 'synced');
      if (this.journal.length) this.schedule(100);
    } catch (error) {
      if (this.userId !== userId) return;
      if (error instanceof ApiError && error.status === 401) {
        this.setStatus('unauthorized');
        return;
      }
      this.setStatus('offline');
      this.schedule(this.retryMs);
      this.retryMs = Math.min(RETRY.max, this.retryMs * 2);
    }
  }

  private schedule(ms: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow();
    }, ms);
  }

  private persist(): void {
    if (!this.userId) return;
    this.store('journal').write(JSON.stringify(this.journal));
    this.store('sync').write(JSON.stringify({ revision: this.revision }));
  }

  private store(kind: 'journal' | 'sync'): LocalStorageSaveStorage {
    return new LocalStorageSaveStorage(`kaptan-pati/${kind}/${this.userId}`);
  }

  private setStatus(status: SyncStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }
}

export const sync = new SyncService(game, clientRules);

/** Oyundaki her ekonomik işlem buradan geçer (bkz. src/meta/commands.ts). */
export function dispatch(input: CommandInput): CommandResult {
  return sync.dispatch(input);
}

// Bağlantı gelince, uygulama öne gelince ve düzenli aralıklarla eşitle.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void sync.syncNow());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void sync.syncNow();
  });
  setInterval(() => {
    if (sync.pending > 0 || sync.state !== 'synced') void sync.syncNow();
  }, 60_000);
}
