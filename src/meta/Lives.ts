import { ECONOMY } from '../config/economy';
import type { SaveService } from '../services/SaveService';
import type { Wallet } from '../services/Wallet';

export type Clock = () => number;

/**
 * Can sistemi. Bölüme başlarken 1 can harcanır, kazanınca geri verilir; böylece can yalnızca
 * kaybedince ya da bölümü yarıda bırakınca gider (oyunu kapatmak da kaçış yolu olmaz).
 * Yenilenme kayıttaki zaman damgasından hesaplanır: oyun kapalıyken de can dolar.
 */
export class Lives {
  readonly max: number = ECONOMY.lives.max;
  private readonly intervalMs: number = ECONOMY.lives.regenMinutes * 60_000;

  constructor(
    private readonly save: SaveService,
    private readonly wallet: Wallet,
    private readonly now: Clock = Date.now,
  ) {}

  get count(): number {
    this.sync();
    return this.save.data.lives.count;
  }

  get isFull(): boolean {
    return this.count >= this.max;
  }

  /** Sıradaki cana kalan süre (ms); can doluysa null. */
  get msUntilNext(): number | null {
    this.sync();
    const { nextAt } = this.save.data.lives;
    return nextAt === null ? null : Math.max(0, nextAt - this.now());
  }

  /** Bölüme başlarken. Can yoksa false. Can sınırın altına inerse yenilenme sayacı başlar. */
  spend(): boolean {
    if (this.count <= 0) return false;
    const now = this.now();
    this.save.update((d) => {
      d.lives.count -= 1;
      if (d.lives.count < this.max && d.lives.nextAt === null) d.lives.nextAt = now + this.intervalMs;
    });
    return true;
  }

  /** Kazanınca başlangıçta harcanan can geri verilir (biriken ödül canları korunur). */
  refund(): void {
    this.grant(1);
  }

  /** Ödül canı: sınırı (5) aşabilir, en çok maxStored'a kadar birikir. */
  grant(n: number): void {
    if (n <= 0) return;
    this.sync();
    this.save.update((d) => {
      d.lives.count = Math.min(ECONOMY.lives.maxStored, d.lives.count + n);
      if (d.lives.count >= this.max) d.lives.nextAt = null;
    });
  }

  /** Altınla canları doldurur (Full Refill). Altın yetmezse ya da canlar zaten doluysa false. */
  buyRefill(): boolean {
    if (this.isFull || !this.wallet.trySpendCoins(ECONOMY.lives.fullRefillCost)) return false;
    this.save.update((d) => {
      d.lives = { count: this.max, nextAt: null };
    });
    return true;
  }

  /** Tek bir can alır (Partial Refill). */
  buyOneLife(): boolean {
    if (this.isFull || !this.wallet.trySpendCoins(ECONOMY.lives.refillCost)) return false;
    this.grant(1);
    return true;
  }

  /** Geçen süreye göre yenilenen canları kayda işler. */
  private sync(): void {
    const now = this.now();
    const { count, nextAt } = this.save.data.lives;
    if (count >= this.max) {
      if (nextAt !== null) this.save.update((d) => void (d.lives.nextAt = null));
      return;
    }
    // Saat geri alındıysa (ya da kayıt bozuksa) bekleme bir aralığı aşmasın.
    let next = nextAt === null || nextAt - now > this.intervalMs ? now + this.intervalMs : nextAt;
    let lives = count;
    while (lives < this.max && next <= now) {
      lives += 1;
      next += this.intervalMs;
    }
    const nextValue = lives >= this.max ? null : next;
    if (lives !== count || nextValue !== nextAt) {
      this.save.update((d) => {
        d.lives = { count: lives, nextAt: nextValue };
      });
    }
  }
}
