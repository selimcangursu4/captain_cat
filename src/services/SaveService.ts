import { ECONOMY, ITEM_IDS, type ItemId } from '../config/economy';

/**
 * Kayıt sistemi. Oyuncunun ilerlemesi tek bir sürümlü JSON belgesindedir; aynı belge sunucuda
 * (PostgreSQL) da tutulur ve sunucu sürümü esastır (bkz. src/net/sync.ts).
 * Depolama `SaveStorage` arayüzünün arkasındadır: tarayıcıda localStorage (her hesap ayrı anahtar),
 * sunucuda ve testlerde bellek.
 *
 * Sürümler: 1 — bölüm, yıldız, altın, kasaba; 2 — can, envanter, günlük ödül, ayarlar;
 * 3 — açık seviye denemesi; ayarlar cihaza özgü olduğu için kayıttan çıktı (src/services/Settings.ts).
 */
export const SAVE_VERSION = 3;

export interface TownSave {
  /** Şu an inşa edilen bölgenin sırası (0 = Deniz Feneri). */
  region: number;
  /** Yapılmış görevler: görev kimliği → seçilen tasarım (0-2). */
  built: Record<string, number>;
  /** Ödül sandığı alınmış bölgeler. */
  chests: string[];
}

/** Başlatılmış ama henüz bitmemiş seviye (can harcandı; kazanınca geri gelir). */
export interface AttemptSave {
  level: number;
  /** Başlama anı (ms). */
  startedAt: number;
  /** Bu denemede satın alınan ek hamle (altın sınırı hesabında kullanılır). */
  extraMoves: number;
}

export interface SaveData {
  version: number;
  /** Oynanacak sıradaki seviye (açılmış en yüksek seviye). */
  level: number;
  stars: number;
  coins: number;
  town: TownSave;
  stats: { levelsWon: number; levelsLost: number };
  /** nextAt: sıradaki canın geleceği an (ms, Date.now); can doluysa null. */
  lives: { count: number; nextAt: number | null };
  inventory: Record<ItemId, number>;
  /** Açılış hediyesi verilmiş (kullanıma açılmış) eşyalar. */
  unlocked: ItemId[];
  /** lastClaim: son alınan günün tarihi (YYYY-AA-GG, oyuncunun saat dilimi); streak: art arda alınan gün. */
  daily: { lastClaim: string | null; streak: number };
  attempt: AttemptSave | null;
}

export function emptyInventory(): Record<ItemId, number> {
  return Object.fromEntries(ITEM_IDS.map((id) => [id, 0])) as Record<ItemId, number>;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    level: 1,
    stars: 0,
    coins: ECONOMY.startingCoins,
    town: { region: 0, built: {}, chests: [] },
    stats: { levelsWon: 0, levelsLost: 0 },
    lives: { count: ECONOMY.lives.max, nextAt: null },
    inventory: emptyInventory(),
    unlocked: [],
    daily: { lastClaim: null, streak: 0 },
    attempt: null,
  };
}

export interface SaveStorage {
  read(): string | null;
  write(value: string): void;
}

/** Tarayıcı / Android WebView localStorage. Erişilemezse (gizli mod vb.) sessizce bellekte kalır. */
export class LocalStorageSaveStorage implements SaveStorage {
  constructor(private readonly key = 'kaptan-pati/save') {}

  read(): string | null {
    try {
      return globalThis.localStorage?.getItem(this.key) ?? null;
    } catch {
      return null;
    }
  }

  write(value: string): void {
    try {
      globalThis.localStorage?.setItem(this.key, value);
    } catch {
      // Kota dolu ya da depolama kapalı: oyun çalışmaya devam eder, kayıt bir sonraki yazımda denenir.
    }
  }
}

export class MemorySaveStorage implements SaveStorage {
  constructor(public value: string | null = null) {}
  read(): string | null {
    return this.value;
  }
  write(value: string): void {
    this.value = value;
  }
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Okunan veriyi doğrular ve güncel sürüme taşır. Bozuk alanlar varsayılanla değiştirilir;
 * hiçbir durumda istisna fırlatmaz (bozuk kayıt oyunu açılmaz hale getirmemeli).
 * Eski sürümlerde olmayan alanlar varsayılanla dolar.
 */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (typeof raw !== 'object' || raw === null) return base;
  const d = raw as Record<string, unknown>;
  const town = (typeof d.town === 'object' && d.town !== null ? d.town : {}) as Record<string, unknown>;
  const built: Record<string, number> = {};
  if (typeof town.built === 'object' && town.built !== null) {
    for (const [key, value] of Object.entries(town.built as Record<string, unknown>)) {
      if (isInt(value) && value >= 0 && value <= 2) built[key] = value;
    }
  }
  const stats = (typeof d.stats === 'object' && d.stats !== null ? d.stats : {}) as Record<string, unknown>;

  const lives = isObject(d.lives) ? d.lives : {};
  const livesCount = isInt(lives.count) ? Math.min(ECONOMY.lives.maxStored, Math.max(0, lives.count)) : base.lives.count;
  const nextAt = typeof lives.nextAt === 'number' && Number.isFinite(lives.nextAt) ? lives.nextAt : null;

  const inventory = emptyInventory();
  const rawInventory = isObject(d.inventory) ? d.inventory : {};
  for (const id of ITEM_IDS) {
    const n = rawInventory[id];
    if (isInt(n) && n >= 0) inventory[id] = n;
  }
  const knownItem = (v: unknown): v is ItemId => (ITEM_IDS as readonly unknown[]).includes(v);

  const daily = isObject(d.daily) ? d.daily : {};
  const attempt = isObject(d.attempt) ? d.attempt : null;

  return {
    version: SAVE_VERSION,
    level: isInt(d.level) && d.level >= 1 ? d.level : base.level,
    stars: isInt(d.stars) && d.stars >= 0 ? d.stars : base.stars,
    coins: isInt(d.coins) && d.coins >= 0 ? d.coins : base.coins,
    town: {
      region: isInt(town.region) && town.region >= 0 ? town.region : 0,
      built,
      chests: Array.isArray(town.chests) ? town.chests.filter((c): c is string => typeof c === 'string') : [],
    },
    stats: {
      levelsWon: isInt(stats.levelsWon) ? stats.levelsWon : 0,
      levelsLost: isInt(stats.levelsLost) ? stats.levelsLost : 0,
    },
    lives: { count: livesCount, nextAt: livesCount >= ECONOMY.lives.max ? null : nextAt },
    inventory,
    unlocked: Array.isArray(d.unlocked) ? [...new Set(d.unlocked.filter(knownItem))] : [],
    daily: {
      lastClaim: typeof daily.lastClaim === 'string' && DATE_KEY.test(daily.lastClaim) ? daily.lastClaim : null,
      streak: isInt(daily.streak) && daily.streak >= 0 ? daily.streak : 0,
    },
    attempt:
      attempt && isInt(attempt.level) && attempt.level >= 1 && typeof attempt.startedAt === 'number'
        ? { level: attempt.level, startedAt: attempt.startedAt, extraMoves: isInt(attempt.extraMoves) ? attempt.extraMoves : 0 }
        : null,
  };
}

export class SaveService {
  private state: SaveData;
  private readonly listeners = new Set<(data: Readonly<SaveData>) => void>();

  constructor(private storage: SaveStorage) {
    this.state = SaveService.parse(storage.read());
  }

  private static parse(text: string | null): SaveData {
    if (!text) return defaultSave();
    try {
      return migrate(JSON.parse(text));
    } catch {
      return defaultSave();
    }
  }

  get data(): Readonly<SaveData> {
    return this.state;
  }

  /** Durumu değiştirir ve hemen kaydeder (küçük belge; localStorage yazımı ~1 ms). */
  update(mutate: (draft: SaveData) => void): void {
    const draft = structuredClone(this.state);
    mutate(draft);
    this.state = draft;
    this.storage.write(JSON.stringify(draft));
    this.notify();
  }

  /** Durumun tamamını değiştirir (ör. sunucudan gelen kayıt). */
  replace(data: unknown): void {
    this.state = migrate(data);
    this.storage.write(JSON.stringify(this.state));
    this.notify();
  }

  /** Başka bir depoya geçer ve kaydı oradan okur (ör. giriş yapan hesabın kaydı). */
  useStorage(storage: SaveStorage): void {
    this.storage = storage;
    this.state = SaveService.parse(storage.read());
    this.notify();
  }

  onChange(listener: (data: Readonly<SaveData>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** İlerlemeyi sıfırlar (geliştirici paneli). */
  reset(): void {
    this.update((draft) => Object.assign(draft, defaultSave()));
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}

/** Hesabın kaydının tarayıcıdaki anahtarı (her hesap ayrı). */
export const userSaveKey = (userId: string) => `kaptan-pati/save/${userId}`;

/**
 * Oyunun tek kayıt servisi. Giriş yapılana kadar bellekte boş kayıt durur; giriş yapılınca
 * (ve açılışta kayıtlı oturum varsa) hesabın deposuna geçilir (src/net/session.ts).
 */
export const saveService = new SaveService(new MemorySaveStorage());
