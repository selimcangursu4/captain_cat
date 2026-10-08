/**
 * Tohumlanabilir sözde rastgele sayı üreteci (mulberry32).
 * Aynı tohum → aynı tahta; testler ve hata ayıklama için tekrarlanabilirlik sağlar.
 */
export class Random {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0;
  }

  /** [0, 1) aralığında sayı. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [0, maxExclusive) aralığında tam sayı. */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Random.pick: boş liste');
    return items[this.int(items.length)];
  }

  /** Fisher–Yates; diziyi yerinde karıştırır ve aynı diziyi döndürür. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}
