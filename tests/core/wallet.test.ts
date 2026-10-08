import { describe, expect, it } from 'vitest';
import { MemorySaveStorage, SaveService, SAVE_VERSION, defaultSave, migrate } from '../../src/services/SaveService';
import { SavedWallet } from '../../src/services/Wallet';

describe('SaveService', () => {
  it('kayıt yoksa varsayılanla başlar; güncellemeyi hemen yazar ve geri okur', () => {
    const storage = new MemorySaveStorage();
    const save = new SaveService(storage);
    expect(save.data).toEqual(defaultSave());
    save.update((d) => {
      d.stars = 3;
      d.town.built['lighthouse.tower'] = 2;
    });
    const reloaded = new SaveService(storage);
    expect(reloaded.data.stars).toBe(3);
    expect(reloaded.data.town.built).toEqual({ 'lighthouse.tower': 2 });
  });

  it('bozuk JSON oyunu bozmaz: varsayılana döner', () => {
    expect(new SaveService(new MemorySaveStorage('{bozuk')).data).toEqual(defaultSave());
    expect(new SaveService(new MemorySaveStorage('42')).data).toEqual(defaultSave());
  });

  it('geçersiz alanları düzeltir, geçerlileri korur', () => {
    const data = migrate({
      version: 0,
      level: 7,
      stars: -4,
      coins: 'çok',
      town: { region: 1, built: { a: 1, b: 9, c: 'x' }, chests: ['lighthouse', 5] },
    });
    expect(data).toMatchObject({ version: SAVE_VERSION, level: 7, stars: 0, coins: defaultSave().coins });
    expect(data.town).toEqual({ region: 1, built: { a: 1 }, chests: ['lighthouse'] });
  });

  it('güncellemeler önceki durumu değiştirmez (değişmez anlık görüntü)', () => {
    const save = new SaveService(new MemorySaveStorage());
    const before = save.data;
    save.update((d) => {
      d.town.chests.push('pier');
    });
    expect(before.town.chests).toEqual([]);
    expect(save.data.town.chests).toEqual(['pier']);
  });
});

describe('SavedWallet', () => {
  it('altın ekler, yetiyorsa harcar, değişiklikleri bildirir ve kaydeder', () => {
    const storage = new MemorySaveStorage();
    const save = new SaveService(storage);
    save.update((d) => {
      d.coins = 50;
    });
    const wallet = new SavedWallet(save);
    const seen: number[] = [];
    const stop = wallet.onCoinsChange((c) => seen.push(c));
    wallet.addCoins(30);
    expect(wallet.trySpendCoins(100)).toBe(false);
    expect(wallet.trySpendCoins(80)).toBe(true);
    stop();
    wallet.addCoins(5);
    expect(wallet.coins).toBe(5);
    expect(seen).toEqual([80, 0]);
    expect(new SaveService(storage).data.coins).toBe(5);
  });
});
