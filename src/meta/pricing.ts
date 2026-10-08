import { ECONOMY, MATERIAL_IDS, type MaterialId, type Materials, type ShipUpgradeId } from '../config/economy';

/**
 * Ekonominin fiyat hesapları (saf fonksiyonlar). İstemci gösterimde, komut kuralları doğrulamada
 * aynı fonksiyonları kullanır; böylece ekranda yazan fiyat ile sunucunun aldığı fiyat hep aynıdır.
 */

/** Kayan nokta artığı (0.30000000000000004) yukarı yuvarlamayı bozmasın. */
const EPSILON = 1e-9;

/** Malzemelerin yıldız değeri (Pazar fiyatıyla). */
export function starValue(materials: Readonly<Materials>): number {
  return MATERIAL_IDS.reduce((sum, id) => sum + (materials[id] ?? 0) / ECONOMY.materials[id].perStar, 0);
}

/** Tarif için eldekine göre eksik kalan malzemeler (eksik yoksa boş). */
export function missingMaterials(recipe: Readonly<Materials>, have: Readonly<Record<MaterialId, number>>): Materials {
  const missing: Materials = {};
  for (const id of MATERIAL_IDS) {
    const lack = (recipe[id] ?? 0) - have[id];
    if (lack > 0) missing[id] = lack;
  }
  return missing;
}

export function isEmpty(materials: Readonly<Materials>): boolean {
  return MATERIAL_IDS.every((id) => (materials[id] ?? 0) <= 0);
}

/** Eksik malzemeyi yıldızla tamamlama bedeli (en az 1). */
export function starCostOf(materials: Readonly<Materials>): number {
  if (isEmpty(materials)) return 0;
  return Math.max(1, Math.ceil(starValue(materials) - EPSILON));
}

/** Eksik malzemeyi doğrudan altınla tamamlama bedeli. */
export function goldCostOf(materials: Readonly<Materials>): number {
  if (isEmpty(materials)) return 0;
  return Math.ceil(starValue(materials) * ECONOMY.goldPerStar - EPSILON);
}

/** Pazar paketi: kaç yıldıza kaç adet. */
export function marketBundle(material: MaterialId, bundle: number): { stars: number; amount: number } | null {
  const config = ECONOMY.market[bundle];
  if (!config) return null;
  return { stars: config.stars, amount: Math.round(ECONOMY.materials[material].perStar * config.stars * config.bonus) };
}

/** İnşaatı hemen bitirmenin altın bedeli (kalan süreye göre; son saniyeler ücretsiz). */
export function speedUpCost(remainingMs: number): number {
  const { factor, exponent, min, round, freeSeconds } = ECONOMY.speedUp;
  if (remainingMs <= freeSeconds * 1000) return 0;
  const minutes = remainingMs / 60_000;
  const raw = factor * minutes ** exponent;
  return Math.max(min, Math.ceil(raw / round) * round);
}

/** Bu denemede `bought` kez ek hamle alındıysa sıradaki alımın fiyatı (100, 150, 200…). */
export function extraMovesCost(bought: number): number {
  return ECONOMY.extraMoves.cost + bought * ECONOMY.extraMoves.costStep;
}

/** Denemedeki ek hamleden kaç kez satın alındığı. */
export function extraMovesBought(extraMoves: number): number {
  return Math.floor(extraMoves / ECONOMY.extraMoves.count);
}

/** Gemi yükseltmesinin sıradaki seviyesi (en üst seviyedeyse null). */
export function nextShipLevel(id: ShipUpgradeId, level: number): { level: number; cost: number; bonus: number } | null {
  const next = ECONOMY.ship[id].levels[level];
  return next ? { level: level + 1, ...next } : null;
}

/** Yükseltmenin şu anki etkisi (seviye 0: 0). */
export function shipBonus(id: ShipUpgradeId, level: number): number {
  return level > 0 ? (ECONOMY.ship[id].levels[level - 1]?.bonus ?? 0) : 0;
}
