import type Phaser from 'phaser';
import { TEXTURES, itemTexture, materialTexture } from '../../assets/AssetManifest';
import { ITEM_IDS, MATERIAL_IDS, type MaterialId, type Materials, type RewardBundle } from '../../config/economy';
import { FONT_FAMILY } from '../../config/theme';
import { t, type I18nKey } from '../../i18n';
import { recipeEntries } from '../../meta/town';
import { formatNumber } from '../format';

export const materialName = (id: MaterialId) => t(`material.${id}` as I18nKey);

/** Ödül paketinin simge + miktar listesi (gösterim sırası sabit). */
export function bundleEntries(bundle: RewardBundle): [texture: string, amount: string][] {
  const entries: [string, string][] = [];
  if (bundle.coins) entries.push([TEXTURES.coin, `+${formatNumber(bundle.coins)}`]);
  if (bundle.stars) entries.push([TEXTURES.star, `+${bundle.stars}`]);
  if (bundle.lives) entries.push([TEXTURES.heart, `+${bundle.lives}`]);
  for (const id of ITEM_IDS) if (bundle.items?.[id]) entries.push([itemTexture(id), `×${bundle.items[id]}`]);
  for (const id of MATERIAL_IDS) if (bundle.materials?.[id]) entries.push([materialTexture(id), `+${bundle.materials[id]}`]);
  return entries;
}

/** Beyaz kenarlı, kalın yazı (simgelerin altındaki sayılar). */
export function outlinedText(scene: Phaser.Scene, x: number, y: number, value: string, size: number, color = '#ffffff') {
  return scene.add
    .text(x, y, value, {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: '700',
      color,
      stroke: '#4a2a0c',
      strokeThickness: Math.max(4, Math.round(size / 6)),
    })
    .setOrigin(0.5);
}

/**
 * Tarifin malzemeleri: simge + "elde/gereken". Eksik olan kırmızı, tamam olan yeşil tik.
 * Container döner (yeniden çizmek için içi boşaltılabilir).
 */
export function recipeRow(
  scene: Phaser.Scene,
  recipe: Readonly<Materials>,
  have: Readonly<Record<MaterialId, number>>,
  options: { iconSize?: number; spacing?: number } = {},
): Phaser.GameObjects.Container {
  const size = options.iconSize ?? 100;
  const spacing = options.spacing ?? 220;
  const row = scene.add.container(0, 0);
  const entries = recipeEntries(recipe);
  entries.forEach(([id, need], i) => {
    const x = (i - (entries.length - 1) / 2) * spacing;
    const enough = have[id] >= need;
    const bg = scene.add.graphics();
    bg.fillStyle(enough ? 0xe9f8e5 : 0xfde8e4, 1).fillRoundedRect(x - spacing / 2 + 14, -size * 0.75, spacing - 28, size * 1.75, 22);
    bg.lineStyle(4, enough ? 0x5ccf5f : 0xe74c3c, 0.9).strokeRoundedRect(x - spacing / 2 + 14, -size * 0.75, spacing - 28, size * 1.75, 22);
    const icon = scene.add.image(x, -size * 0.12, materialTexture(id)).setDisplaySize(size, size);
    const amount = outlinedText(scene, x, size * 0.62, `${Math.min(have[id], need)}/${need}`, Math.round(size * 0.36), enough ? '#ffffff' : '#ffd1c9');
    const name = scene.add
      .text(x, -size * 0.62, materialName(id), { fontFamily: FONT_FAMILY, fontSize: `${Math.round(size * 0.24)}px`, fontStyle: '700', color: '#5a2d06' })
      .setOrigin(0.5);
    row.add([bg, icon, name, amount]);
    if (enough) row.add(scene.add.image(x + size * 0.45, -size * 0.45, TEXTURES.check).setDisplaySize(size * 0.38, size * 0.38));
  });
  return row;
}
