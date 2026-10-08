import { ECONOMY, ITEM_IDS, MATERIAL_IDS, SHIP_UPGRADE_IDS, type ItemId, type MaterialId, type ShipUpgradeId } from '../config/economy';

/**
 * Kayıt sistemi. Oyuncunun ilerlemesi tek bir sürümlü JSON belgesindedir; aynı belge sunucuda
 * (PostgreSQL) da tutulur ve sunucu sürümü esastır (bkz. src/net/sync.ts).
 * Depolama `SaveStorage` arayüzünün arkasındadır: tarayıcıda localStorage (her hesap ayrı anahtar),
 * sunucuda ve testlerde bellek.
 *
 * Sürümler: 1 — bölüm, yıldız, altın, kasaba; 2 — can, envanter, günlük ödül, ayarlar;
 * 3 — açık seviye denemesi; ayarlar cihaza özgü olduğu için kayıttan çıktı (src/services/Settings.ts);
 * 4-5 — tek tür malzeme, gemi, kumbara; 6 — malzeme türleri, inşaat süresi, sandık tohumu, komut saati.
 */
export const SAVE_VERSION = 6;

/** Süren inşaat (aynı anda bir tane). */
export interface ConstructionSave {
  task: string;
  design: number;
  startedAt: number;
  endsAt: number;
}

export interface TownSave {
  region: number;
  /** Bitmiş görevler → seçilen tasarım. */
  built: Record<string, number>;
  chests: string[];
  construction: ConstructionSave | null;
}

export interface AttemptSave {
  level: number;
  startedAt: number;
  extraMoves: number;
}

export interface SaveData {
  version: number;
  level: number;
  stars: number;
  coins: number;
  materials: Record<MaterialId, number>;
  town: TownSave;
  ship: Record<ShipUpgradeId, number>;
  stats: { levelsWon: number; levelsLost: number };
  lives: { count: number; nextAt: number | null };
  inventory: Record<ItemId, number>;
  unlocked: ItemId[];
  daily: { lastClaim: string | null; streak: number };
  attempt: AttemptSave | null;
  piggyBank: { coins: number };
  /** Sandık çekilişlerinin tohumu: istemci ve sunucu aynı sonucu bulsun diye kayıtta. */
  rng: number;
  /** Kayda işlenen en geç komut anı (ms). İnşaat bu andan geriye başlatılamaz (saat geri alma hilesi). */
  clock: number;
}

export function emptyInventory(): Record<ItemId, number> {
  return Object.fromEntries(ITEM_IDS.map((id) => [id, 0])) as Record<ItemId, number>;
}

export function emptyMaterials(): Record<MaterialId, number> {
  return Object.fromEntries(MATERIAL_IDS.map((id) => [id, 0])) as Record<MaterialId, number>;
}

function emptyShip(): Record<ShipUpgradeId, number> {
  return Object.fromEntries(SHIP_UPGRADE_IDS.map((id) => [id, 0])) as Record<ShipUpgradeId, number>;
}

/** Yeni hesabın kaydı. Sunucu, kayıt olurken `rng`'ye rastgele bir tohum verir. */
export function defaultSave(rng = 0x2f6b1a3d): SaveData {
  return {
    version: SAVE_VERSION,
    level: 1,
    stars: ECONOMY.startingStars,
    coins: ECONOMY.startingCoins,
    materials: { ...emptyMaterials(), ...ECONOMY.startingMaterials },
    town: { region: 0, built: {}, chests: [], construction: null },
    ship: emptyShip(),
    stats: { levelsWon: 0, levelsLost: 0 },
    lives: { count: ECONOMY.lives.max, nextAt: null },
    inventory: emptyInventory(),
    unlocked: [],
    daily: { lastClaim: null, streak: 0 },
    attempt: null,
    piggyBank: { coins: 0 },
    rng: rng >>> 0,
    clock: 0,
  };
}

export interface SaveStorage {
  read(): string | null;
  write(value: string): void;
}

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
      // Depolama dolu ya da kapalı: kayıt bellekte sürer, sunucu eşitlemesi esastır.
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
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function migrateConstruction(raw: unknown): ConstructionSave | null {
  if (!isObject(raw)) return null;
  const { task, design, startedAt, endsAt } = raw;
  if (typeof task !== 'string' || !isInt(design) || design < 0 || design > 2) return null;
  if (!isNumber(startedAt) || !isNumber(endsAt) || endsAt < startedAt) return null;
  return { task, design, startedAt, endsAt };
}

/** Eski ya da bozuk kaydı geçerli bir kayda çevirir (geçersiz alanlar varsayılana döner). */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!isObject(raw)) return base;
  const d = raw;
  const version = isInt(d.version) ? d.version : 0;
  const town = isObject(d.town) ? d.town : {};
  const built: Record<string, number> = {};
  if (isObject(town.built)) {
    for (const [key, value] of Object.entries(town.built)) {
      if (isInt(value) && value >= 0 && value <= 2) built[key] = value;
    }
  }
  const stats = isObject(d.stats) ? d.stats : {};

  const lives = isObject(d.lives) ? d.lives : {};
  const livesCount = isInt(lives.count) ? Math.min(ECONOMY.lives.maxStored, Math.max(0, lives.count)) : base.lives.count;
  const nextAt = isNumber(lives.nextAt) ? lives.nextAt : null;

  const inventory = emptyInventory();
  const rawInventory = isObject(d.inventory) ? d.inventory : {};
  for (const id of ITEM_IDS) {
    const n = rawInventory[id];
    if (isInt(n) && n >= 0) inventory[id] = n;
  }
  const knownItem = (v: unknown): v is ItemId => (ITEM_IDS as readonly unknown[]).includes(v);

  // Sürüm 4-5: tek tür "malzeme" sayısı vardı (her seviye 25); türlü malzemeye geçerken yıldıza çevrilir.
  let stars = isInt(d.stars) && d.stars >= 0 ? d.stars : base.stars;
  let materials = base.materials;
  if (isObject(d.materials)) {
    materials = emptyMaterials();
    for (const id of MATERIAL_IDS) {
      const n = d.materials[id];
      if (isInt(n) && n >= 0) materials[id] = n;
    }
  } else if (version >= 4 && version < 6 && isInt(d.materials) && d.materials > 0) {
    stars += Math.floor(d.materials / ECONOMY.legacyMaterialsPerStar);
  }

  const ship = emptyShip();
  if (isObject(d.ship)) {
    for (const id of SHIP_UPGRADE_IDS) {
      const value = d.ship[id];
      const max = ECONOMY.ship[id].levels.length;
      if (isInt(value) && value >= 0) ship[id] = Math.min(max, value);
    }
  }

  const daily = isObject(d.daily) ? d.daily : {};
  const attempt = isObject(d.attempt) ? d.attempt : null;
  const piggyBank = isObject(d.piggyBank) ? d.piggyBank : {};

  return {
    version: SAVE_VERSION,
    level: isInt(d.level) && d.level >= 1 ? d.level : base.level,
    stars,
    coins: isInt(d.coins) && d.coins >= 0 ? d.coins : base.coins,
    materials,
    town: {
      region: isInt(town.region) && town.region >= 0 ? town.region : 0,
      built,
      chests: Array.isArray(town.chests) ? town.chests.filter((c): c is string => typeof c === 'string') : [],
      construction: migrateConstruction(town.construction),
    },
    ship,
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
      attempt && isInt(attempt.level) && attempt.level >= 1 && isNumber(attempt.startedAt)
        ? { level: attempt.level, startedAt: attempt.startedAt, extraMoves: isInt(attempt.extraMoves) && attempt.extraMoves >= 0 ? attempt.extraMoves : 0 }
        : null,
    piggyBank: {
      coins: isInt(piggyBank.coins) && piggyBank.coins >= 0 ? Math.min(ECONOMY.piggyBank.maxCoins, piggyBank.coins) : 0,
    },
    rng: isInt(d.rng) ? d.rng >>> 0 : base.rng,
    clock: isNumber(d.clock) && d.clock >= 0 ? d.clock : 0,
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

  /** İlerlemeyi sıfırlar. Sandık tohumu ve komut saati korunur (sıfırlama çekilişi baştan almaya yaramasın). */
  reset(): void {
    this.update((draft) => {
      const { rng, clock } = draft;
      Object.assign(draft, defaultSave(rng), { clock });
    });
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
