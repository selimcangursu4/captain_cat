import { CHEST_IDS, ECONOMY, MATERIAL_IDS, SHIP_UPGRADE_IDS, type ChestId, type MaterialId, type RewardBundle, type ShipUpgradeId } from '../config/economy';
import type { SaveService } from '../services/SaveService';
import type { Wallet } from '../services/Wallet';
import { marketBundle, nextShipLevel } from './pricing';
import { rollChest } from './rewards';

export type MarketResult<T = undefined> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

/**
 * Pazar: malzeme (yıldızla), yıldız takası (altınla), sandıklar (altınla) ve gemi atölyesi (altınla).
 * Gerçek parayla yalnızca altın alınır (Mağaza); oyundaki her şey altın ve yıldızla döner.
 */
export class Market {
  constructor(
    private readonly save: SaveService,
    private readonly wallet: Wallet,
    private readonly grant: (bundle: RewardBundle) => void,
  ) {}

  /** Yıldızla malzeme paketi alır. */
  buyMaterial(material: MaterialId, bundle: number): MarketResult<number> {
    if (!(MATERIAL_IDS as readonly string[]).includes(material)) return { ok: false, reason: 'unknown' };
    const offer = marketBundle(material, bundle);
    if (!offer) return { ok: false, reason: 'unknown' };
    if (!this.wallet.trySpendStars(offer.stars)) return { ok: false, reason: 'stars' };
    this.save.update((d) => {
      d.materials[material] += offer.amount;
    });
    return { ok: true, value: offer.amount };
  }

  /** Altınla yıldız alır. */
  buyStars(pack: number): MarketResult<number> {
    const offer = ECONOMY.starPacks[pack];
    if (!offer) return { ok: false, reason: 'unknown' };
    if (!this.wallet.trySpendCoins(offer.coins)) return { ok: false, reason: 'coins' };
    this.wallet.addStars(offer.stars);
    return { ok: true, value: offer.stars };
  }

  /** Altınla sandık açar; içerik kayıttaki tohumla belirlenir. Çıkan ödülü döndürür. */
  openChest(chest: ChestId): MarketResult<RewardBundle> {
    if (!(CHEST_IDS as readonly string[]).includes(chest)) return { ok: false, reason: 'unknown' };
    if (!this.wallet.trySpendCoins(ECONOMY.chests[chest].price)) return { ok: false, reason: 'coins' };
    const { reward, seed } = rollChest(chest, this.save.data.rng, this.save.data.unlocked);
    this.save.update((d) => {
      d.rng = seed;
    });
    this.grant(reward);
    return { ok: true, value: reward };
  }

  shipLevel(id: ShipUpgradeId): number {
    return this.save.data.ship[id];
  }

  /** Gemi atölyesi: sıradaki seviyeye altınla yükseltir. */
  upgradeShip(id: ShipUpgradeId): MarketResult<number> {
    if (!(SHIP_UPGRADE_IDS as readonly string[]).includes(id)) return { ok: false, reason: 'unknown' };
    const next = nextShipLevel(id, this.shipLevel(id));
    if (!next) return { ok: false, reason: 'max-level' };
    if (!this.wallet.trySpendCoins(next.cost)) return { ok: false, reason: 'coins' };
    this.save.update((d) => {
      d.ship[id] = next.level;
    });
    return { ok: true, value: next.level };
  }
}
