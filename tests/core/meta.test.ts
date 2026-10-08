import { describe, expect, it } from 'vitest';
import { LevelProgress } from '../../src/meta/LevelProgress';
import { hasChest, levelReward, nextChestLevel } from '../../src/meta/levelRewards';
import { Lives } from '../../src/meta/Lives';
import { SavedWallet } from '../../src/services/Wallet';
import { DESIGN_THEMES, TOWN, getTask } from '../../src/meta/town';
import { en } from '../../src/i18n/en';
import { tr } from '../../src/i18n/tr';
import { TownProgress } from '../../src/meta/TownProgress';
import { MemorySaveStorage, SaveService } from '../../src/services/SaveService';

function setup(stars = 0) {
  const save = new SaveService(new MemorySaveStorage());
  save.update((d) => {
    d.stars = stars;
  });
  return { save, town: new TownProgress(save) };
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
    expect(getTask('lighthouse.tower')?.cost).toBe(1);
  });
});

describe('kasaba metinleri', () => {
  it('her bölge, görev ve replik iki dilde de tanımlı', () => {
    const keys = [
      ...TOWN.flatMap((r) => [`region.${r.id}`, `quip.region.${r.id}`]),
      ...TOWN.flatMap((r) => r.tasks.flatMap((task) => [`task.${task.id}`, `quip.task.${task.id}`])),
      ...DESIGN_THEMES.map((theme) => `design.${theme}`),
    ];
    for (const key of keys) {
      expect(tr, key).toHaveProperty([key]);
      expect(en, key).toHaveProperty([key]);
    }
  });
});

describe('TownProgress', () => {
  it('görevler sırayla açılır ve yıldız harcar; tasarım kaydedilir', () => {
    const { save, town } = setup(5);
    expect(town.nextTask()?.id).toBe('lighthouse.tower');
    expect(town.build('lighthouse.lantern', 0)).toEqual({ ok: false, reason: 'locked' });
    const result = town.build('lighthouse.tower', 2);
    expect(result.ok).toBe(true);
    expect(save.data.stars).toBe(4);
    expect(town.designOf('lighthouse.tower')).toBe(2);
    expect(town.nextTask()?.id).toBe('lighthouse.lantern');
    expect(town.build('lighthouse.tower', 0)).toEqual({ ok: false, reason: 'built' });
  });

  it('yıldız yetmezse görev yapılmaz', () => {
    const { save, town } = setup(0);
    expect(town.canBuildNext()).toBe(false);
    expect(town.build('lighthouse.tower', 0)).toEqual({ ok: false, reason: 'stars' });
    expect(save.data.town.built).toEqual({});
  });

  it('bölge bitince sandık altını verilir ve sıradaki bölge açılır', () => {
    const { save, town } = setup(100);
    const coins = save.data.coins;
    const lighthouse = TOWN[0];
    let last;
    for (const task of lighthouse.tasks) last = town.build(task.id, 0);
    expect(last).toMatchObject({ ok: true, regionCompleted: { chestCoins: lighthouse.chestCoins, next: { id: 'pier' } } });
    expect(save.data.coins).toBe(coins + lighthouse.chestCoins);
    expect(town.currentRegion.id).toBe('pier');
    expect(town.unlockedRegions.map((r) => r.id)).toEqual(['lighthouse', 'pier']);
    expect(save.data.town.chests).toEqual(['lighthouse']);
  });

  it('yapılmış görevin tasarımı ücretsiz değişir; yapılmamışınki değişmez', () => {
    const { save, town } = setup(1);
    town.build('lighthouse.tower', 0);
    expect(town.changeDesign('lighthouse.tower', 1)).toBe(true);
    expect(town.designOf('lighthouse.tower')).toBe(1);
    expect(save.data.stars).toBe(0);
    expect(town.changeDesign('lighthouse.lantern', 1)).toBe(false);
    expect(town.changeDesign('lighthouse.tower', 5)).toBe(false);
  });

  it('tüm kasaba bitince son bölgede kalınır', () => {
    const { town } = setup(10_000);
    for (const region of TOWN) for (const task of region.tasks) expect(town.build(task.id, 1).ok).toBe(true);
    expect(town.townComplete).toBe(true);
    expect(town.currentRegion.id).toBe('ship');
    expect(town.nextTask()).toBeNull();
  });
});

describe('LevelProgress', () => {
  it('yeni seviye kazanınca +1 yıldız, +1 can ve sıradaki seviye; eski seviye yalnızca altın verir', () => {
    const { save } = setup(0);
    const lives = new Lives(save, new SavedWallet(save));
    const progress = new LevelProgress(save, () => 30, lives);
    const coins = save.data.coins;
    expect(progress.recordWin(1, 25)).toMatchObject({ stars: 1, coins: 25, nextLevel: 2, reward: { lives: 1, chest: 'none' } });
    expect(save.data.lives.count).toBe(6); // 5 + 1: ödül canı sınırı aşabilir
    expect(progress.recordWin(1, 10)).toMatchObject({ stars: 0, coins: 10, nextLevel: 2, reward: null });
    expect(save.data).toMatchObject({ stars: 1, level: 2, coins: coins + 35, stats: { levelsWon: 2 } });
    expect(save.data.lives.count).toBe(6);
  });

  it('her 10 seviyede hediye sandığı: altın ve açılmış eşyalar', () => {
    const { save } = setup(0);
    save.update((d) => {
      d.level = 20;
    });
    const progress = new LevelProgress(save, () => 200);
    const coins = save.data.coins;
    const result = progress.recordWin(20, 30);
    expect(result.reward).toEqual(levelReward(20));
    expect(result.reward?.chest).toBe('normal');
    expect(save.data.coins).toBe(coins + 30 + levelReward(20).coins);
    expect(save.data.inventory.helm).toBe(1);
    expect(save.data.inventory.cannon).toBe(1);
  });

  it('son seviyeden sonra yeni seviye kalmaz; seviye sayısı artınca devam edilir', () => {
    const { save } = setup(0);
    save.update((d) => {
      d.level = 30;
    });
    let count = 30;
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
