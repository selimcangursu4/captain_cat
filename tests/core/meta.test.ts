import { describe, expect, it } from 'vitest';
import { ECONOMY, MATERIAL_IDS } from '../../src/config/economy';
import { en } from '../../src/i18n/en';
import { tr } from '../../src/i18n/tr';
import { LevelProgress } from '../../src/meta/LevelProgress';
import { hasChest, levelReward, nextChestLevel } from '../../src/meta/levelRewards';
import { Lives } from '../../src/meta/Lives';
import { speedUpCost, starValue } from '../../src/meta/pricing';
import { DESIGN_THEMES, TOWN, getTask } from '../../src/meta/town';
import { TownProgress } from '../../src/meta/TownProgress';
import { MemorySaveStorage, SaveService } from '../../src/services/SaveService';
import { SavedWallet } from '../../src/services/Wallet';

const T0 = Date.UTC(2026, 9, 8, 10, 0);
const MINUTE = 60_000;

/** Kayıt + kasaba; rich: her malzemeden bol miktarda. */
function setup(rich = false) {
  const save = new SaveService(new MemorySaveStorage());
  if (rich) save.update((d) => void MATERIAL_IDS.forEach((id) => (d.materials[id] = 10_000)));
  const clock = { now: T0 };
  const wallet = new SavedWallet(save);
  const town = new TownProgress(save, wallet, () => clock.now);
  /** Süren inşaatı süresini bekleyerek bitirir. */
  const wait = () => {
    clock.now = town.construction!.endsAt;
    return town.finish();
  };
  return { save, town, clock, wallet, wait };
}

describe('kasaba tanımları', () => {
  it('5 bölge, her birinde 5-8 görev; kimlikler benzersiz', () => {
    expect(TOWN.map((r) => r.id)).toEqual(['lighthouse', 'pier', 'fishShop', 'cafe', 'ship']);
    for (const r of TOWN) {
      expect(r.tasks.length).toBeGreaterThanOrEqual(5);
      expect(r.tasks.length).toBeLessThanOrEqual(8);
    }
    const ids = TOWN.flatMap((r) => r.tasks.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(getTask('lighthouse.door')?.recipe).toEqual({ wood: 10, nails: 5 });
  });

  it('her görevin tarifi ve süresi var; bölgeler giderek pahalılaşır ve uzar; her malzeme kullanılır', () => {
    const used = new Set<string>();
    let previousValue = 0;
    let previousMinutes = 0;
    for (const region of TOWN) {
      for (const task of region.tasks) {
        expect(task.minutes, task.id).toBeGreaterThan(0);
        expect(starValue(task.recipe), task.id).toBeGreaterThan(1);
        for (const [id, n] of Object.entries(task.recipe)) {
          expect(n, task.id).toBeGreaterThan(0);
          used.add(id);
        }
      }
      const value = region.tasks.reduce((sum, t) => sum + starValue(t.recipe), 0);
      const minutes = region.tasks.reduce((sum, t) => sum + t.minutes, 0);
      expect(value).toBeGreaterThan(previousValue);
      expect(minutes).toBeGreaterThan(previousMinutes);
      previousValue = value;
      previousMinutes = minutes;
    }
    expect([...used].sort()).toEqual([...MATERIAL_IDS].sort());
  });
});

describe('kasaba metinleri', () => {
  it('her bölge, görev, replik ve malzeme iki dilde de tanımlı', () => {
    const keys = [
      ...TOWN.flatMap((r) => [`region.${r.id}`, `quip.region.${r.id}`]),
      ...TOWN.flatMap((r) => r.tasks.flatMap((task) => [`task.${task.id}`, `quip.task.${task.id}`])),
      ...DESIGN_THEMES.map((theme) => `design.${theme}`),
      ...MATERIAL_IDS.map((id) => `material.${id}`),
    ];
    for (const key of keys) {
      expect(tr, key).toHaveProperty([key]);
      expect(en, key).toHaveProperty([key]);
    }
  });
});

describe('TownProgress: inşaat', () => {
  it('görevler sırayla açılır; malzeme harcanır, inşaat süresi kadar sürer, süre dolunca biter', () => {
    const { save, town, clock } = setup(true);
    expect(town.nextTask()?.id).toBe('lighthouse.tower');
    expect(town.build('lighthouse.lantern', 0)).toEqual({ ok: false, reason: 'locked' });
    const result = town.build('lighthouse.tower', 2);
    expect(result).toMatchObject({ ok: true, endsAt: T0 + MINUTE });
    expect(save.data.materials.stone).toBe(10_000 - 8);
    expect(save.data.materials.paint).toBe(10_000 - 2);
    // İnşaat sürerken görev bitmiş sayılmaz, ikinci inşaat başlamaz.
    expect(town.isBuilt('lighthouse.tower')).toBe(false);
    expect(town.isUnderConstruction('lighthouse.tower')).toBe(true);
    expect(town.build('lighthouse.tower', 0)).toEqual({ ok: false, reason: 'busy' });
    expect(town.canBuildNext()).toBe(false);
    clock.now = T0 + MINUTE - 1;
    expect(town.msLeft).toBe(1);
    expect(town.finish()).toEqual({ ok: false, reason: 'not-ready' });
    clock.now = T0 + MINUTE;
    expect(town.finish()).toMatchObject({ ok: true, task: { id: 'lighthouse.tower' }, design: 2, paid: 0 });
    expect(town.isBuilt('lighthouse.tower')).toBe(true);
    expect(town.designOf('lighthouse.tower')).toBe(2);
    expect(town.construction).toBeNull();
    expect(town.nextTask()?.id).toBe('lighthouse.lantern');
    expect(town.build('lighthouse.tower', 0)).toEqual({ ok: false, reason: 'built' });
    expect(town.finish()).toEqual({ ok: false, reason: 'none' });
  });

  it('malzeme yetmezse başlamaz; eksikler yıldızla ya da doğrudan altınla tamamlanır', () => {
    const { save, town } = setup();
    const tower = getTask('lighthouse.tower')!;
    // Başlangıç malzemesi: 5 taş (kule 8 ister).
    expect(town.missingFor(tower)).toEqual({ stone: 3 });
    expect(town.build(tower.id, 0)).toEqual({ ok: false, reason: 'materials' });
    expect(town.fillMissing(tower.id, 'stars')).toEqual({ ok: false, reason: 'stars' });
    save.update((d) => void (d.stars = 1));
    expect(town.fillMissing(tower.id, 'stars')).toEqual({ ok: true, paid: 1 });
    expect(save.data.stars).toBe(0);
    expect(town.missingFor(tower)).toEqual({});
    expect(town.fillMissing(tower.id, 'stars')).toEqual({ ok: false, reason: 'nothing' });
    expect(town.build(tower.id, 0).ok).toBe(true);
    expect(save.data.materials.stone).toBe(0);

    // Fener camı: 4 cam eksik → 4/3 yıldız değeri × 120 altın.
    const coins = save.data.coins;
    expect(town.missingFor(getTask('lighthouse.lantern')!)).toEqual({ glass: 4 });
    expect(town.fillMissing('lighthouse.lantern', 'coins')).toEqual({ ok: true, paid: 160 });
    expect(save.data.coins).toBe(coins - 160);
    expect(save.data.materials.glass).toBe(4);
  });

  it('hızlandırma: kalan süreye göre altın; son 30 saniye ücretsiz; altın yetmezse olmaz', () => {
    expect(speedUpCost(30_000)).toBe(0);
    expect(speedUpCost(MINUTE)).toBe(10);
    expect(speedUpCost(60 * MINUTE)).toBe(265);
    expect(speedUpCost(120 * MINUTE)).toBe(465);
    expect(speedUpCost(8 * 60 * MINUTE)).toBeGreaterThan(speedUpCost(4 * 60 * MINUTE));

    const { save, town, clock } = setup(true);
    town.build('lighthouse.tower', 0);
    expect(town.speedUpCost).toBe(10);
    save.update((d) => void (d.coins = 5));
    expect(town.speedUp()).toEqual({ ok: false, reason: 'coins' });
    clock.now = T0 + 31_000; // 29 saniye kaldı: ücretsiz
    expect(town.speedUpCost).toBe(0);
    expect(town.speedUp()).toMatchObject({ ok: true, paid: 0 });
    expect(save.data.coins).toBe(5);

    town.build('lighthouse.lantern', 0); // 3 dakika
    save.update((d) => void (d.coins = 100));
    const cost = town.speedUpCost!;
    expect(cost).toBeGreaterThan(0);
    expect(town.speedUp()).toMatchObject({ ok: true, paid: cost });
    expect(save.data.coins).toBe(100 - cost);
    expect(town.isBuilt('lighthouse.lantern')).toBe(true);
  });

  it('bölgenin bütün inşaatları bitmeden sıradaki bölge açılmaz; bitince sandık altını ve yeni bölge', () => {
    const { save, town, wait } = setup(true);
    const coins = save.data.coins;
    const lighthouse = TOWN[0];
    let last;
    for (const task of lighthouse.tasks) {
      expect(town.build(task.id, 0).ok).toBe(true);
      // Son görevin inşaatı sürerken bile bölge açılmaz.
      expect(town.currentRegion.id).toBe('lighthouse');
      expect(town.build('pier.deck', 0)).toMatchObject({ ok: false });
      last = wait();
    }
    expect(last).toMatchObject({ ok: true, regionCompleted: { chestCoins: lighthouse.chestCoins, next: { id: 'pier' } } });
    expect(save.data.coins).toBe(coins + lighthouse.chestCoins);
    expect(town.currentRegion.id).toBe('pier');
    expect(town.unlockedRegions.map((r) => r.id)).toEqual(['lighthouse', 'pier']);
    expect(save.data.town.chests).toEqual(['lighthouse']);
  });

  it('saat geri alınarak inşaat geçmişte başlatılamaz (kaydın saatinden başlar)', () => {
    const { save, town, clock } = setup(true);
    save.update((d) => void (d.clock = T0 + 60 * MINUTE));
    clock.now = T0; // telefon saati 1 saat geri
    expect(town.build('lighthouse.tower', 0)).toMatchObject({ ok: true, endsAt: T0 + 61 * MINUTE });
    clock.now = T0 + 2 * MINUTE;
    expect(town.finish()).toEqual({ ok: false, reason: 'not-ready' });
  });

  it('bitmiş görevin tasarımı ücretsiz değişir; süren ya da yapılmamışınki değişmez', () => {
    const { save, town, wait } = setup(true);
    town.build('lighthouse.tower', 0);
    expect(town.changeDesign('lighthouse.tower', 1)).toBe(false);
    wait();
    const before = structuredClone(save.data.materials);
    expect(town.changeDesign('lighthouse.tower', 1)).toBe(true);
    expect(town.designOf('lighthouse.tower')).toBe(1);
    expect(save.data.materials).toEqual(before);
    expect(town.changeDesign('lighthouse.lantern', 1)).toBe(false);
    expect(town.changeDesign('lighthouse.tower', 5)).toBe(false);
  });

  it('tüm kasaba bitince son bölgede kalınır', () => {
    const { town, wait } = setup(true);
    for (const region of TOWN) {
      for (const task of region.tasks) {
        expect(town.build(task.id, 1).ok).toBe(true);
        expect(wait().ok).toBe(true);
      }
    }
    expect(town.townComplete).toBe(true);
    expect(town.currentRegion.id).toBe('ship');
    expect(town.nextTask()).toBeNull();
  });

  it('seviye malzemesi: sıradaki görevde en çok eksik olan; yoksa bölgenin kalanında', () => {
    const { save, town } = setup();
    expect(town.mostNeededMaterial(1)).toBe('stone'); // kule: 3 taş eksik
    save.update((d) => void (d.materials.stone = 8));
    // Kule tamam: bölgenin kalanında en çok eksik olan.
    expect(town.mostNeededMaterial(1)).toBe('wood');
  });
});

describe('LevelProgress', () => {
  function levels(levelCount = 30) {
    const { save, town } = setup();
    const lives = new Lives(save, new SavedWallet(save));
    return { save, lives, progress: new LevelProgress(save, () => levelCount, lives, town) };
  }

  it('yeni seviye: +1 yıldız, kasabaya malzeme, +1 can, kumbara; eski seviye yalnızca altın', () => {
    const { save, progress } = levels();
    const coins = save.data.coins;
    expect(progress.recordWin(1, 25)).toEqual({
      stars: 1,
      material: { id: 'stone', amount: ECONOMY.levelWinMaterial },
      coins: 25,
      nextLevel: 2,
      reward: { lives: 1, coins: 0, items: {}, chest: 'none' },
    });
    expect(save.data.lives.count).toBe(6); // 5 + 1: ödül canı sınırı aşabilir
    expect(save.data.materials.stone).toBe(5 + ECONOMY.levelWinMaterial);
    expect(save.data.piggyBank.coins).toBe(ECONOMY.piggyBank.coinsPerWin);
    expect(progress.recordWin(1, 10)).toMatchObject({ stars: 0, material: null, coins: 10, nextLevel: 2, reward: null });
    expect(save.data).toMatchObject({ stars: 1, level: 2, coins: coins + 35, stats: { levelsWon: 2 } });
    expect(save.data.piggyBank.coins).toBe(ECONOMY.piggyBank.coinsPerWin);
  });

  it('gemi: gövde bölüm altınını, ambar seviye malzemesini artırır', () => {
    const { save, progress } = levels();
    save.update((d) => {
      d.ship.hull = 1;
      d.ship.storage = 2;
    });
    const result = progress.recordWin(1, 100);
    expect(result.coins).toBe(100 + ECONOMY.ship.hull.levels[0].bonus);
    expect(result.material?.amount).toBe(ECONOMY.levelWinMaterial + ECONOMY.ship.storage.levels[1].bonus);
  });

  it('her 10 seviyede hediye sandığı: altın ve açılmış eşyalar', () => {
    const { save, progress } = levels(200);
    save.update((d) => void (d.level = 20));
    const coins = save.data.coins;
    const result = progress.recordWin(20, 30);
    expect(result.reward).toEqual(levelReward(20));
    expect(result.reward?.chest).toBe('normal');
    expect(save.data.coins).toBe(coins + 30 + levelReward(20).coins);
    expect(save.data.inventory.helm).toBe(1);
    expect(save.data.inventory.cannon).toBe(1);
  });

  it('kumbara en çok maxCoins kadar birikir', () => {
    const { save, progress } = levels(200);
    save.update((d) => void (d.piggyBank.coins = ECONOMY.piggyBank.maxCoins - 1));
    progress.recordWin(1, 0);
    expect(save.data.piggyBank.coins).toBe(ECONOMY.piggyBank.maxCoins);
  });

  it('son seviyeden sonra yeni seviye kalmaz; seviye sayısı artınca devam edilir', () => {
    let count = 30;
    const { save } = setup();
    save.update((d) => void (d.level = 30));
    const progress = new LevelProgress(save, () => count);
    progress.recordWin(30, 0);
    expect(progress.currentLevel).toBeNull();
    expect(progress.allLevelsDone).toBe(true);
    count = 40;
    expect(progress.currentLevel).toBe(31);
  });
});

describe('seviye ödülleri', () => {
  it('her seviye 1 can; her 10 seviyede sandık, altın artar ve sınırlanır; 50 katlarında büyük sandık', () => {
    expect(levelReward(7)).toEqual({ lives: 1, coins: 0, items: {}, chest: 'none' });
    const ten = levelReward(10);
    expect(ten.chest).toBe('normal');
    expect(ten.coins).toBe(100);
    expect(ten.items).toEqual({ shovel: 1 }); // harpun henüz açılmadı (14)
    expect(levelReward(30).coins).toBe(140);
    expect(levelReward(30).items).toEqual({ storm: 1, whirlpool: 1 });
    const fifty = levelReward(50);
    expect(fifty.chest).toBe('big');
    expect(fifty.coins).toBe(2 * 180);
    expect(fifty.items).toEqual({ helm: 2, cannon: 2 });
    expect(levelReward(400).coins).toBeLessThanOrEqual(2 * 500);
  });

  it('sıradaki sandık seviyesi', () => {
    expect(hasChest(20)).toBe(true);
    expect(hasChest(21)).toBe(false);
    expect(nextChestLevel(1)).toBe(10);
    expect(nextChestLevel(10)).toBe(10);
    expect(nextChestLevel(11)).toBe(20);
  });
});
