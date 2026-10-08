import { describe, expect, it } from 'vitest';
import { ECONOMY, ITEM_IDS } from '../../src/config/economy';
import { en } from '../../src/i18n/en';
import { tr } from '../../src/i18n/tr';
import { DailyReward, dateKey } from '../../src/meta/DailyReward';
import { Inventory } from '../../src/meta/Inventory';
import { Lives } from '../../src/meta/Lives';
import { grantBundle } from '../../src/meta/rewards';
import { MemorySaveStorage, SAVE_VERSION, SaveService, defaultSave, migrate } from '../../src/services/SaveService';
import { Settings, detectLanguage, parseSettings } from '../../src/services/Settings';
import { SavedWallet } from '../../src/services/Wallet';

const MINUTE = 60_000;
const REGEN = ECONOMY.lives.regenMinutes * MINUTE;

function setup(coins = 1000) {
  const save = new SaveService(new MemorySaveStorage());
  save.update((d) => {
    d.coins = coins;
  });
  const clock = { now: new Date(2026, 9, 7, 10, 0).getTime() };
  const wallet = new SavedWallet(save);
  const inventory = new Inventory(save, wallet);
  const lives = new Lives(save, wallet, () => clock.now);
  return {
    save,
    clock,
    wallet,
    inventory,
    lives,
    daily: new DailyReward(save, (bundle) => grantBundle(save, lives, bundle), () => clock.now),
  };
}

describe('Lives', () => {
  it('başlarken can düşer, kazanınca geri gelir; dolu canda zamanlayıcı yok', () => {
    const { lives } = setup();
    expect(lives.count).toBe(5);
    expect(lives.msUntilNext).toBeNull();
    expect(lives.spend()).toBe(true);
    expect(lives.count).toBe(4);
    expect(lives.msUntilNext).toBe(REGEN);
    lives.refund();
    expect(lives.count).toBe(5);
    expect(lives.msUntilNext).toBeNull();
  });

  it('her 20 dakikada bir can yenilenir (oyun kapalıyken de)', () => {
    const { lives, clock } = setup();
    for (let i = 0; i < 5; i++) expect(lives.spend()).toBe(true);
    expect(lives.spend()).toBe(false);
    clock.now += REGEN - 1;
    expect(lives.count).toBe(0);
    clock.now += 1;
    expect(lives.count).toBe(1);
    expect(lives.msUntilNext).toBe(REGEN);
    clock.now += REGEN * 2 + 5 * MINUTE;
    expect(lives.count).toBe(3);
    expect(lives.msUntilNext).toBe(REGEN - 5 * MINUTE);
    clock.now += REGEN * 10;
    expect(lives.count).toBe(5);
    expect(lives.msUntilNext).toBeNull();
  });

  it('ödül canları 5 sınırını aşar (en çok 10); fazlası harcanırken sayaç işlemez', () => {
    const { lives } = setup();
    lives.grant(3);
    expect(lives.count).toBe(8);
    expect(lives.msUntilNext).toBeNull();
    lives.spend();
    expect(lives.count).toBe(7);
    expect(lives.msUntilNext).toBeNull(); // hâlâ 5'in üstünde: yenilenmeye gerek yok
    lives.refund();
    expect(lives.count).toBe(8);
    lives.grant(5);
    expect(lives.count).toBe(ECONOMY.lives.maxStored);
    for (let i = 0; i < 6; i++) lives.spend();
    expect(lives.count).toBe(4);
    expect(lives.msUntilNext).toBe(REGEN); // 5'in altına inince sayaç başlar
  });

  it('saat geri alınırsa bekleme bir aralığı aşmaz', () => {
    const { lives, clock } = setup();
    lives.spend();
    clock.now -= 5 * 60 * MINUTE;
    expect(lives.msUntilNext).toBe(REGEN);
  });

  it('altınla doldurulur; altın yetmezse ya da can doluysa olmaz', () => {
    const { lives, wallet } = setup(ECONOMY.lives.fullRefillCost + 10);
    expect(lives.buyRefill()).toBe(false); // zaten dolu
    lives.spend();
    lives.spend();
    expect(lives.buyRefill()).toBe(true);
    expect(lives.count).toBe(5);
    expect(wallet.coins).toBe(10);
    lives.spend();
    expect(lives.buyRefill()).toBe(false); // altın yok
  });

  it('tek can altınla alınır', () => {
    const { lives, wallet } = setup(ECONOMY.lives.refillCost);
    expect(lives.buyOneLife()).toBe(false); // dolu
    lives.spend();
    lives.spend();
    expect(lives.buyOneLife()).toBe(true);
    expect(lives.count).toBe(4);
    expect(wallet.coins).toBe(0);
    expect(lives.buyOneLife()).toBe(false);
  });
});

describe('Inventory', () => {
  it('eşyalar bölümünde açılır ve hediye verilir (bir kez)', () => {
    const { inventory } = setup();
    expect(inventory.claimUnlocks(10)).toEqual([]);
    expect(inventory.claimUnlocks(12)).toEqual(['shovel', 'helm']);
    expect(inventory.count('shovel')).toBe(ECONOMY.items.shovel.gift);
    expect(inventory.isUnlocked('helm')).toBe(true);
    expect(inventory.isUnlocked('storm')).toBe(false);
    expect(inventory.claimUnlocks(12)).toEqual([]);
    expect(inventory.claimUnlocks(30)).toEqual(['storm', 'harpoon', 'cannon', 'whirlpool']);
  });

  it('kullanınca azalır, bitince altınla paket alınır', () => {
    const { inventory, wallet } = setup(ECONOMY.items.storm.price);
    inventory.add({ storm: 1 });
    expect(inventory.use('storm')).toBe(true);
    expect(inventory.use('storm')).toBe(false);
    expect(inventory.buyPack('storm')).toBe(true);
    expect(inventory.count('storm')).toBe(ECONOMY.items.storm.pack);
    expect(wallet.coins).toBe(0);
    expect(inventory.buyPack('storm')).toBe(false);
  });
});

describe('DailyReward', () => {
  it('günde bir kez alınır; art arda günlerde takvim ilerler', () => {
    const { daily, clock, wallet } = setup(0);
    expect(daily.available).toBe(true);
    expect(daily.dayIndex).toBe(0);
    expect(daily.claim()).toEqual(ECONOMY.daily[0]);
    expect(wallet.coins).toBe(ECONOMY.daily[0].coins);
    expect(daily.available).toBe(false);
    expect(daily.claim()).toBeNull();
    clock.now += 13 * 60 * MINUTE; // aynı gün 23:00
    expect(daily.available).toBe(false);
    clock.now += 3 * 60 * MINUTE; // ertesi gün 02:00
    expect(daily.available).toBe(true);
    expect(daily.dayIndex).toBe(1);
  });

  it('bir gün atlanırsa 1. güne döner; 7. günden sonra döngü baştan başlar', () => {
    const { daily, clock, inventory } = setup(0);
    const DAY = 24 * 60 * MINUTE;
    for (let day = 0; day < 7; day++) {
      expect(daily.dayIndex).toBe(day);
      daily.claim();
      clock.now += DAY;
    }
    expect(inventory.count('cannon')).toBe(ECONOMY.daily[5].items?.cannon);
    expect(daily.dayIndex).toBe(0); // 8. gün → yeniden 1. gün
    daily.claim();
    clock.now += DAY;
    expect(daily.dayIndex).toBe(1);
    clock.now += DAY; // bir gün atlandı
    expect(daily.dayIndex).toBe(0);
  });

  it('tarih anahtarı yerel takvim gününü kullanır', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });
});

describe('kayıt sürümleri', () => {
  it('sürüm 1 kaydı varsayılan can, envanter, günlük ödül ve denemeyle taşınır', () => {
    const v1 = { version: 1, level: 12, stars: 3, coins: 450, town: { region: 0, built: {}, chests: [] }, stats: { levelsWon: 11, levelsLost: 2 } };
    const data = migrate(v1);
    const base = defaultSave();
    expect(data).toMatchObject({ version: SAVE_VERSION, level: 12, stars: 3, coins: 450, attempt: null });
    expect(data.lives).toEqual(base.lives);
    expect(data.inventory).toEqual(base.inventory);
    expect(data.daily).toEqual({ lastClaim: null, streak: 0 });
  });

  it('bozuk yeni alanları düzeltir; sürüm 2 ayarları kayıttan çıkar', () => {
    const data = migrate({
      version: 2,
      lives: { count: 99, nextAt: 'yarın' },
      inventory: { shovel: 2, helm: -1, sihir: 5 },
      unlocked: ['shovel', 'shovel', 'uçan halı'],
      daily: { lastClaim: 'dün', streak: 3 },
      settings: { sound: false },
      attempt: { level: 'beş', startedAt: 1 },
    });
    expect(data.lives).toEqual({ count: ECONOMY.lives.maxStored, nextAt: null });
    expect(data.inventory.shovel).toBe(2);
    expect(data.inventory.helm).toBe(0);
    expect(data.unlocked).toEqual(['shovel']);
    expect(data.daily).toEqual({ lastClaim: null, streak: 3 });
    expect(data.attempt).toBeNull();
    expect(data).not.toHaveProperty('settings');
    expect(migrate({ attempt: { level: 4, startedAt: 10 } }).attempt).toEqual({ level: 4, startedAt: 10, extraMoves: 0 });
  });

  it('sürüm 5: tek tür malzeme yıldıza çevrilir; gemi, inşaat ve tohum düzeltilir', () => {
    const data = migrate({
      version: 5,
      stars: 2,
      materials: 130,
      ship: { hull: 9, engine: -1, roket: 2 },
      town: { region: 0, built: {}, chests: [], construction: { task: 'lighthouse.tower', design: 1, startedAt: 10, endsAt: 5 } },
      rng: 'tohum',
    });
    expect(data.stars).toBe(2 + Math.floor(130 / ECONOMY.legacyMaterialsPerStar));
    expect(data.materials).toEqual(defaultSave().materials);
    expect(data.ship).toEqual({ hull: ECONOMY.ship.hull.levels.length, storage: 0, engine: 0 });
    expect(data.town.construction).toBeNull(); // bitişi başlangıcından önce: bozuk
    expect(data.rng).toBe(defaultSave().rng);
    const ok = migrate({ town: { construction: { task: 'lighthouse.tower', design: 1, startedAt: 10, endsAt: 70 } }, rng: 42, clock: 99 });
    expect(ok.town.construction).toEqual({ task: 'lighthouse.tower', design: 1, startedAt: 10, endsAt: 70 });
    expect(ok).toMatchObject({ rng: 42, clock: 99 });
  });
});

describe('cihaz ayarları', () => {
  it('bozuk ayarlar varsayılana döner; değişiklik kaydedilir ve bildirilir', () => {
    expect(parseSettings('{bozuk')).toEqual({ sound: true, music: true, vibration: true, language: null });
    expect(parseSettings('{"sound":false,"music":"evet","language":"de"}')).toEqual({ sound: false, music: true, vibration: true, language: null });
    const storage = new MemorySaveStorage();
    const settings = new Settings(storage, () => 'tr-TR');
    const seen: boolean[] = [];
    settings.onChange((v) => seen.push(v.music));
    settings.setToggle('music', false);
    expect(seen).toEqual([false]);
    expect(new Settings(storage).music).toBe(false);
    expect(settings.language).toBe('tr');
  });
});

describe('dil', () => {
  it('her eşyanın adı ve açıklaması iki dilde de var', () => {
    for (const id of ITEM_IDS) {
      for (const key of [`item.${id}`, `item.desc.${id}`]) {
        expect(tr, key).toHaveProperty([key]);
        expect(en, key).toHaveProperty([key]);
      }
    }
  });

  it('cihaz dili Türkçeyse Türkçe, değilse İngilizce', () => {
    expect(detectLanguage('tr-TR')).toBe('tr');
    expect(detectLanguage('TR')).toBe('tr');
    expect(detectLanguage('en-US')).toBe('en');
    expect(detectLanguage('de-DE')).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
  });
});
