import { ECONOMY, type DailyRewardConfig } from '../config/economy';
import type { SaveService } from '../services/SaveService';
import type { Wallet } from '../services/Wallet';
import type { Inventory } from './Inventory';
import type { Clock } from './Lives';

/** Saat dilimi farkı (dakika, Date.getTimezoneOffset biçiminde: İstanbul = -180). */
export type TzOffset = () => number;

const localTz: TzOffset = () => new Date().getTimezoneOffset();

/**
 * Oyuncunun takvim günü: "2026-10-07". offsetMinutes verilmezse cihazın saat dilimi.
 * Sunucu, oyuncunun gönderdiği saat dilimiyle aynı günü hesaplar.
 */
export function dateKey(ms: number, offsetMinutes = new Date(ms).getTimezoneOffset()): string {
  const d = new Date(ms - offsetMinutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function previousDay(ms: number, offsetMinutes: number): string {
  const d = new Date(ms - offsetMinutes * 60_000);
  d.setUTCDate(d.getUTCDate() - 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Günlük giriş ödülü: 7 günlük takvim. Her takvim gününde bir kez alınır; art arda gelinirse
 * sıradaki güne geçilir, bir gün atlanırsa 1. güne dönülür, 7. günden sonra döngü baştan başlar.
 */
export class DailyReward {
  readonly rewards: readonly DailyRewardConfig[] = ECONOMY.daily;

  constructor(
    private readonly save: SaveService,
    private readonly wallet: Wallet,
    private readonly inventory: Inventory,
    private readonly now: Clock = Date.now,
    private readonly tz: TzOffset = localTz,
  ) {}

  private today(): string {
    return dateKey(this.now(), this.tz());
  }

  /** Bugünün ödülü henüz alınmadı mı? */
  get available(): boolean {
    return this.save.data.daily.lastClaim !== this.today();
  }

  /** Bugün alınacak (ya da bugün alınmış) günün sırası (0-6). */
  get dayIndex(): number {
    const { streak } = this.save.data.daily;
    if (!this.available) return (streak - 1 + this.rewards.length) % this.rewards.length;
    return this.continues ? streak % this.rewards.length : 0;
  }

  /** Bugünün ödülünü verir; bugün zaten alındıysa null. */
  claim(): DailyRewardConfig | null {
    if (!this.available) return null;
    const reward = this.rewards[this.dayIndex];
    const streak = (this.continues ? this.save.data.daily.streak : 0) + 1;
    const today = this.today();
    this.save.update((d) => {
      d.daily = { lastClaim: today, streak };
    });
    if (reward.coins) this.wallet.addCoins(reward.coins);
    if (reward.items) this.inventory.add(reward.items);
    return reward;
  }

  /** Dün de alındıysa seri sürüyor. */
  private get continues(): boolean {
    return this.save.data.daily.lastClaim === previousDay(this.now(), this.tz());
  }
}
