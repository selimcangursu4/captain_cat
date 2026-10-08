import { OBSTACLE_CONFIG } from '../config/obstacles';
import type { Pos } from './types';

/**
 * Engeller. Yeni bir engel eklemek için:
 *  1) OBSTACLE_KINDS'e adını ekle,
 *  2) OBSTACLES'a tanımını yaz (katman, bölüm kodu, hasar kuralları, ödül),
 *  3) görselini AssetManifest'e ekle.
 * Oyun mantığı engelleri yalnızca bu tanımlar üzerinden tanır.
 */
export const OBSTACLE_KINDS = ['moss', 'net', 'sandbag', 'chest', 'nest'] as const;
export type ObstacleKind = (typeof OBSTACLE_KINDS)[number];

/**
 * floor: taşın altında (taş üstünde hareket eder)
 * cover: taşın üstünde (taş yerinden oynayamaz ama eşleşebilir)
 * block: kareyi kaplar (karede taş olamaz)
 */
export type ObstacleLayer = 'floor' | 'cover' | 'block';
export const OBSTACLE_LAYERS: readonly ObstacleLayer[] = ['floor', 'cover', 'block'];

/** match: üstündeki/içindeki taş eşleşti · adjacent: yanında eşleşme oldu · special: güçlendirici değdi */
export type HitCause = 'match' | 'adjacent' | 'special';

export interface ObstacleReward {
  readonly seagulls?: number;
  readonly coins?: number;
}

export interface ObstacleDefinition {
  readonly kind: ObstacleKind;
  readonly layer: ObstacleLayer;
  /** Bölüm dosyasındaki karakter → başlangıç katman sayısı (katman içinde benzersiz). */
  readonly codes: Readonly<Record<string, number>>;
  readonly damagedBy: Readonly<Record<HitCause, boolean>>;
  /** Her vuruşta verilen ödül (ör. martı yuvası: 1 martı). */
  readonly rewardOnHit?: ObstacleReward;
  /** Yok edilince verilen ödül (ör. sandık: altın). */
  readonly rewardOnDestroy?: ObstacleReward;
}

export const OBSTACLES: Readonly<Record<ObstacleKind, ObstacleDefinition>> = {
  moss: {
    kind: 'moss',
    layer: 'floor',
    codes: { '1': 1, '2': 2 },
    damagedBy: { match: true, adjacent: false, special: true },
  },
  net: {
    kind: 'net',
    layer: 'cover',
    codes: { n: 1 },
    damagedBy: { match: true, adjacent: true, special: true },
  },
  sandbag: {
    kind: 'sandbag',
    layer: 'block',
    codes: { '1': 1, '2': 2, '3': 3 },
    damagedBy: { match: false, adjacent: true, special: true },
  },
  chest: {
    kind: 'chest',
    layer: 'block',
    codes: { c: OBSTACLE_CONFIG.chestHits },
    damagedBy: { match: false, adjacent: true, special: true },
    rewardOnDestroy: { coins: OBSTACLE_CONFIG.chestCoins },
  },
  nest: {
    kind: 'nest',
    layer: 'block',
    codes: { b: OBSTACLE_CONFIG.nestLayers },
    damagedBy: { match: false, adjacent: true, special: true },
    rewardOnHit: { seagulls: 1 },
  },
};

/** Tahtadaki bir engel. `id` görünümün sprite eşlemesi içindir. */
export interface Obstacle {
  readonly id: number;
  readonly kind: ObstacleKind;
  layers: number;
}

/** Bir engelin aldığı tek vuruş (görünüm ve hedef sayacı bunu kullanır). */
export interface ObstacleHit {
  readonly obstacleId: number;
  readonly kind: ObstacleKind;
  readonly layer: ObstacleLayer;
  readonly pos: Pos;
  readonly cause: HitCause;
  readonly wave: number;
  readonly layersLeft: number;
  readonly destroyed: boolean;
  readonly reward?: ObstacleReward;
}

/** Katman → (kod → tür, katman sayısı). Bölüm dosyası okunurken kullanılır. */
export function obstacleCodes(layer: ObstacleLayer): Map<string, { kind: ObstacleKind; layers: number }> {
  const map = new Map<string, { kind: ObstacleKind; layers: number }>();
  for (const def of Object.values(OBSTACLES)) {
    if (def.layer !== layer) continue;
    for (const [code, layers] of Object.entries(def.codes)) {
      if (map.has(code)) throw new Error(`Engel kodu çakışması: '${code}' (${layer})`);
      map.set(code, { kind: def.kind, layers });
    }
  }
  return map;
}

export function mergeRewards(a?: ObstacleReward, b?: ObstacleReward): ObstacleReward | undefined {
  if (!a) return b;
  if (!b) return a;
  return { seagulls: (a.seagulls ?? 0) + (b.seagulls ?? 0) || undefined, coins: (a.coins ?? 0) + (b.coins ?? 0) || undefined };
}
