import { CHEST_IDS, ITEM_IDS, MATERIAL_IDS, SHIP_UPGRADE_IDS, type ChestId, type ItemId, type MaterialId, type ShipUpgradeId } from '../config/economy';
import type { ObstacleKind } from '../core/obstacles';
import { chestVariantSvg, clockSvg, hammerSvg, marketSvg, materialSvg, piggySvg, shipUpgradeSvg } from './svg/economy';
import { gearSvg, heartSvg, itemSvg, plusBadgeSvg, roundButtonSvg, shopSvg } from './svg/items';
import { DESIGN_THEMES, REGION_IDS, TOWN, partOf, type RegionId } from '../meta/town';
import { REGION_ART, STAGE, THEME_PALETTES, backgroundSvg, partSvg } from './svg/town';
import { regionIconSvg, townMapSvg } from './svg/town/map';
import { SPECIAL_KINDS, TILE_COLORS, type SpecialKind, type TileColor } from '../core/types';
import { cellSvg, selectionSvg } from './svg/board';
import { captainPatiSvg } from './svg/characters';
import { bubbleSvg, cloudSvg, confettiSvg, dotSvg, sparkSvg } from './svg/effects';
import { oceanBackgroundSvg } from './svg/scenery';
import {
  beamSvg,
  flyingSeagullSvg,
  harpoonProjectileSvg,
  ringSvg,
  specialSvg,
} from './svg/specials';
import { chestSvg, mossSvg, nestSvg, netSvg, sandbagSvg } from './svg/obstacles';
import { tileSvg } from './svg/tiles';
import { bigStarSvg, buttonSvg, checkSvg, closeIconSvg, coinSvg, handSvg, hudPanelSvg, lockIconSvg, pauseIconSvg, popupPanelSvg } from './svg/ui';

/**
 * TÜM görsellerin tek kaynağı. Oyun kodu dokulara yalnızca TEXTURES anahtarlarıyla erişir.
 *
 * Gerçek çizimlere geçiş: ilgili girdiyi
 *   { kind: 'image', url: 'assets/tiles/fish.png' }
 * yapmak yeterli (dosya public/assets altına konur). Anahtar değişmediği için
 * oyun kodunda başka hiçbir şeyin değişmesi gerekmez.
 */
export type AssetEntry = (
  | { readonly kind: 'svg'; readonly width: number; readonly height: number; readonly render: () => string }
  | { readonly kind: 'image'; readonly url: string }
) & {
  /** true: açılışta yüklenmez, gerektiğinde ensureTextures ile yüklenir (kasaba bölgeleri). */
  readonly lazy?: boolean;
};

/** Taş dokularının piksel boyutu (ekranda ~120px gösterilir; biraz büyük üretip netlik korunur). */
const TILE_TEXTURE_SIZE = 144;
const CELL_TEXTURE_SIZE = 128;

export const TEXTURES = {
  tiles: {
    fish: 'tile.fish',
    anchor: 'tile.anchor',
    shell: 'tile.shell',
    ring: 'tile.ring',
    star: 'tile.star',
  } satisfies Record<TileColor, string>,
  cellLight: 'board.cell.light',
  cellDark: 'board.cell.dark',
  selection: 'board.selection',
  particleDot: 'fx.dot',
  particleSpark: 'fx.spark',
  bubble: 'fx.bubble',
  harpoonProjectile: 'fx.harpoon',
  ring: 'fx.ring',
  beam: 'fx.beam',
  flyingSeagull: 'fx.seagull',
  button: 'ui.button',
  buttonPressed: 'ui.button.pressed',
  buttonGreen: 'ui.button.green',
  buttonGreenPressed: 'ui.button.green.pressed',
  hudPanel: 'ui.hudPanel',
  popupPanel: 'ui.popupPanel',
  coin: 'icon.coin',
  star: 'icon.star',
  check: 'icon.check',
  pause: 'icon.pause',
  hand: 'ui.hand',
  close: 'icon.close',
  lock: 'icon.lock',
  background: 'bg.ocean',
  captain: 'char.captain',
  cloud: 'fx.cloud',
  heart: 'icon.heart',
  gear: 'icon.gear',
  shop: 'icon.shop',
  plus: 'icon.plus',
  roundButton: 'ui.roundButton',
  roundButtonActive: 'ui.roundButton.active',
  confetti: 'fx.confetti',
  market: 'icon.market',
  hammer: 'icon.hammer',
  clock: 'icon.clock',
  piggy: 'icon.piggy',
  /** Liman haritasının zemini (tembel: yalnızca harita gösterilirken). */
  townMap: 'town.map',
} as const;

/** Haritadaki bölge simgesi. */
export function regionIconTexture(id: RegionId): string {
  return `region.${id}`;
}

/** Kasaba malzemesi simgesi. */
export function materialTexture(id: MaterialId): string {
  return `material.${id}`;
}

/** Gemi atölyesi yükseltmesi simgesi. */
export function shipUpgradeTexture(id: ShipUpgradeId): string {
  return `ship.${id}`;
}

/** Pazar sandığı simgesi. */
export function chestTexture(id: ChestId): string {
  return `chest.${id}`;
}

/** Yardımcı / güçlendirici simgesi. */
export function itemTexture(id: ItemId): string {
  return `item.${id}`;
}

/** Taşın dokusu: sıradan taş, renkli güçlendirici veya (renksiz) Girdap. */
export function tileTexture(color: TileColor, special?: SpecialKind): string {
  if (!special) return TEXTURES.tiles[color];
  if (special === 'whirlpool') return 'special.whirlpool';
  return `special.${special}.${color}`;
}

/** Engelin o anki görünümü (katman sayısına göre değişenler: yosun, kum torbası). */
export function obstacleTexture(kind: ObstacleKind, layers: number): string {
  if (kind === 'moss') return `obstacle.moss.${Math.min(2, Math.max(1, layers))}`;
  if (kind === 'sandbag') return `obstacle.sandbag.${Math.min(3, Math.max(1, layers))}`;
  return `obstacle.${kind}`;
}

const svg = (width: number, height: number, render: () => string): AssetEntry => ({
  kind: 'svg',
  width,
  height,
  render,
});

const tileEntries: [string, AssetEntry][] = TILE_COLORS.flatMap((color) => [
  [tileTexture(color), svg(TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE, () => tileSvg(color, TILE_TEXTURE_SIZE))],
  ...SPECIAL_KINDS.filter((s) => s !== 'whirlpool').map(
    (special): [string, AssetEntry] => [
      tileTexture(color, special),
      svg(TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE, () => specialSvg(special, color, TILE_TEXTURE_SIZE)),
    ],
  ),
]);

export const ASSET_MANIFEST: Readonly<Record<string, AssetEntry>> = {
  ...Object.fromEntries(tileEntries),
  [tileTexture('fish', 'whirlpool')]: svg(TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE, () =>
    specialSvg('whirlpool', 'fish', TILE_TEXTURE_SIZE),
  ),
  [TEXTURES.cellLight]: svg(CELL_TEXTURE_SIZE, CELL_TEXTURE_SIZE, () => cellSvg(CELL_TEXTURE_SIZE, '#D3EEF9')),
  [TEXTURES.cellDark]: svg(CELL_TEXTURE_SIZE, CELL_TEXTURE_SIZE, () => cellSvg(CELL_TEXTURE_SIZE, '#B4DDF0')),
  [TEXTURES.selection]: svg(CELL_TEXTURE_SIZE, CELL_TEXTURE_SIZE, () => selectionSvg(CELL_TEXTURE_SIZE)),
  [TEXTURES.particleDot]: svg(32, 32, () => dotSvg(32)),
  [TEXTURES.particleSpark]: svg(48, 48, () => sparkSvg(48)),
  [TEXTURES.bubble]: svg(64, 64, () => bubbleSvg(64)),
  [TEXTURES.harpoonProjectile]: svg(160, 48, () => harpoonProjectileSvg(160, 48)),
  [TEXTURES.ring]: svg(128, 128, () => ringSvg(128)),
  [TEXTURES.beam]: svg(64, 24, () => beamSvg(64, 24)),
  [TEXTURES.flyingSeagull]: svg(144, 144, () => flyingSeagullSvg(144)),
  [TEXTURES.button]: svg(120, 120, () => buttonSvg(120, false)),
  [TEXTURES.buttonPressed]: svg(120, 120, () => buttonSvg(120, true)),
  [TEXTURES.buttonGreen]: svg(120, 120, () => buttonSvg(120, false, 'green')),
  [TEXTURES.buttonGreenPressed]: svg(120, 120, () => buttonSvg(120, true, 'green')),
  [TEXTURES.hudPanel]: svg(120, 120, () => hudPanelSvg(120)),
  [TEXTURES.popupPanel]: svg(160, 160, () => popupPanelSvg(160)),
  [TEXTURES.coin]: svg(64, 64, () => coinSvg(64)),
  [TEXTURES.star]: svg(160, 160, () => bigStarSvg(160)),
  [TEXTURES.check]: svg(64, 64, () => checkSvg(64)),
  [TEXTURES.pause]: svg(96, 96, () => pauseIconSvg(96)),
  [TEXTURES.hand]: svg(128, 128, () => handSvg(128)),
  [TEXTURES.close]: svg(96, 96, () => closeIconSvg(96)),
  [TEXTURES.lock]: svg(64, 64, () => lockIconSvg(64)),
  [obstacleTexture('moss', 1)]: svg(CELL_TEXTURE_SIZE, CELL_TEXTURE_SIZE, () => mossSvg(CELL_TEXTURE_SIZE, 1)),
  [obstacleTexture('moss', 2)]: svg(CELL_TEXTURE_SIZE, CELL_TEXTURE_SIZE, () => mossSvg(CELL_TEXTURE_SIZE, 2)),
  [obstacleTexture('net', 1)]: svg(CELL_TEXTURE_SIZE, CELL_TEXTURE_SIZE, () => netSvg(CELL_TEXTURE_SIZE)),
  [obstacleTexture('sandbag', 1)]: svg(TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE, () => sandbagSvg(TILE_TEXTURE_SIZE, 1)),
  [obstacleTexture('sandbag', 2)]: svg(TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE, () => sandbagSvg(TILE_TEXTURE_SIZE, 2)),
  [obstacleTexture('sandbag', 3)]: svg(TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE, () => sandbagSvg(TILE_TEXTURE_SIZE, 3)),
  [obstacleTexture('chest', 1)]: svg(TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE, () => chestSvg(TILE_TEXTURE_SIZE)),
  [obstacleTexture('nest', 1)]: svg(TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE, () => nestSvg(TILE_TEXTURE_SIZE)),
  [TEXTURES.background]: svg(540, 960, () => oceanBackgroundSvg(540, 960)),
  [TEXTURES.captain]: svg(256, 256, () => captainPatiSvg(256)),
  [TEXTURES.cloud]: svg(256, 110, () => cloudSvg(256, 110)),
  [TEXTURES.confetti]: svg(24, 14, () => confettiSvg(24, 14)),
  [TEXTURES.heart]: svg(128, 128, () => heartSvg(128)),
  [TEXTURES.gear]: svg(128, 128, () => gearSvg(128)),
  [TEXTURES.shop]: svg(128, 128, () => shopSvg(128)),
  [TEXTURES.plus]: svg(64, 64, () => plusBadgeSvg(64)),
  [TEXTURES.roundButton]: svg(128, 128, () => roundButtonSvg(128, false)),
  [TEXTURES.roundButtonActive]: svg(128, 128, () => roundButtonSvg(128, true)),
  ...Object.fromEntries(ITEM_IDS.map((id) => [itemTexture(id), svg(128, 128, () => itemSvg(id, 128))])),
  ...Object.fromEntries(MATERIAL_IDS.map((id) => [materialTexture(id), svg(128, 128, () => materialSvg(id, 128))])),
  ...Object.fromEntries(SHIP_UPGRADE_IDS.map((id) => [shipUpgradeTexture(id), svg(128, 128, () => shipUpgradeSvg(id, 128))])),
  ...Object.fromEntries(CHEST_IDS.map((id) => [chestTexture(id), svg(160, 160, () => chestVariantSvg(id, 160))])),
  [TEXTURES.market]: svg(128, 128, () => marketSvg(128)),
  [TEXTURES.hammer]: svg(128, 128, () => hammerSvg(128)),
  [TEXTURES.clock]: svg(128, 128, () => clockSvg(128)),
  [TEXTURES.piggy]: svg(128, 128, () => piggySvg(128)),
  ...Object.fromEntries(REGION_IDS.map((id) => [regionIconTexture(id), svg(160, 160, () => regionIconSvg(id, 160))])),
  [TEXTURES.townMap]: { kind: 'svg', width: STAGE.width, height: STAGE.height, render: townMapSvg, lazy: true },
  ...townEntries(),
};

// ───────────────────────── kasaba (tembel yüklenir) ─────────────────────────

export function townBackgroundTexture(region: RegionId): string {
  return `town.${region}.bg`;
}

/** Görevin parça dokusu; design: 0 Klasik, 1 Okyanus, 2 Gün Batımı. */
export function townPartTexture(taskId: string, design: number): string {
  return `town.${taskId}.${design}`;
}

/** Bölgenin ekranda gösterilmesi için gereken dokular (arka plan + verilen tasarımlar). */
export function townRegionTextures(region: RegionId, built: Readonly<Record<string, number>>): string[] {
  return [
    townBackgroundTexture(region),
    ...Object.entries(built)
      .filter(([taskId]) => taskId.startsWith(`${region}.`))
      .map(([taskId, design]) => townPartTexture(taskId, design)),
  ];
}

/** Parçanın sahnedeki kutusu [x, y, w, h] (1000x820 bölge sahnesinde). */
export function townPartBox(taskId: string): readonly [number, number, number, number] {
  const region = taskId.slice(0, taskId.indexOf('.')) as RegionId;
  return REGION_ART[region].parts[partOf(taskId)].box;
}

export const TOWN_STAGE = STAGE;

function townEntries(): Record<string, AssetEntry> {
  const entries: Record<string, AssetEntry> = {};
  for (const region of TOWN) {
    const art = REGION_ART[region.id];
    entries[townBackgroundTexture(region.id)] = {
      kind: 'svg',
      width: STAGE.width,
      height: STAGE.height,
      render: () => backgroundSvg(art),
      lazy: true,
    };
    for (const task of region.tasks) {
      const part = art.parts[partOf(task.id)];
      DESIGN_THEMES.forEach((theme, design) => {
        entries[townPartTexture(task.id, design)] = {
          kind: 'svg',
          width: part.box[2],
          height: part.box[3],
          render: () => partSvg(part, THEME_PALETTES[theme]),
          lazy: true,
        };
      });
    }
  }
  return entries;
}
