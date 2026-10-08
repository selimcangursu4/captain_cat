import Phaser from 'phaser';
import { TEXTURES, obstacleTexture, townPartTexture } from '../../assets/AssetManifest';
import { ensureTextures } from '../../assets/loadAssets';
import { FONT_FAMILY } from '../../config/theme';
import { t, type I18nKey } from '../../i18n';
import { DESIGN_THEMES, type TownRegion, type TownTask } from '../../meta/town';
import type { TownProgress } from '../../meta/TownProgress';
import { Popup } from '../components/Popup';
import { TextButton } from '../components/TextButton';
import { tweenAsync, waitMs } from '../tweens';

const INK = '#5a2d06';

const taskName = (task: TownTask) => t(`task.${task.id}` as I18nKey);

function text(scene: Phaser.Scene, x: number, y: number, value: string, size: number, color = INK) {
  return scene.add
    .text(x, y, value, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, fontStyle: '700', color })
    .setOrigin(0.5);
}

/** Görseli en-boy oranını koruyarak `width` x `height` kutusuna sığdırır. */
function fit(image: Phaser.GameObjects.Image, width: number, height: number = width): Phaser.GameObjects.Image {
  return image.setScale(Math.min(width / image.width, height / image.height));
}

/** Yıldız simgesi + sayı (bedel). */
function starCost(scene: Phaser.Scene, x: number, y: number, cost: number, dim = false): Phaser.GameObjects.GameObject[] {
  const star = scene.add.image(x - 22, y, TEXTURES.star).setDisplaySize(52, 52);
  const label = text(scene, x + 18, y + 2, String(cost), 40, dim ? '#9a8a7a' : INK);
  if (dim) star.setAlpha(0.5);
  return [star, label];
}

export type TaskAction = { readonly action: 'build' | 'change'; readonly task: TownTask };

/** Bölgenin görev listesi: yapılanlar (✓, Değiştir), sıradaki (Yap), kilitliler. */
export async function showTaskList(scene: Phaser.Scene, region: TownRegion, town: TownProgress): Promise<TaskAction | null> {
  const icons = region.tasks.map((task) => townPartTexture(task.id, town.designOf(task.id) ?? 0));
  await ensureTextures(scene, icons);
  const next = town.nextTask(region);
  const needStars = next !== null && town.materials < next.cost;
  const rowHeight = 112;
  const height = 150 + region.tasks.length * rowHeight + (needStars ? 80 : 0);

  return new Promise((resolve) => {
    const finish = (value: TaskAction | null) => void popup.close().then(() => resolve(value));
    const popup = new Popup(scene, { title: t(`region.${region.id}` as I18nKey), width: 900, height, onClose: () => finish(null) });
    const top = -height / 2 + 130;

    region.tasks.forEach((task, i) => {
      const y = top + i * rowHeight;
      const built = town.isBuilt(task.id);
      const isNext = next?.id === task.id;
      const row = scene.add.graphics();
      row.fillStyle(isNext ? 0xfff0c2 : 0xffffff, isNext ? 1 : 0.55).fillRoundedRect(-400, y - 48, 800, 96, 20);
      if (isNext) row.lineStyle(4, 0xf0a000).strokeRoundedRect(-400, y - 48, 800, 96, 20);
      // Geniş parçalar (çit, bahçe) ince kalmasın diye simge kutusu yatayda geniş.
      const icon = fit(scene.add.image(-335, y, icons[i]), 120, 84);
      const locked = !built && !isNext;
      if (locked) icon.setTint(0x9aa5b1).setAlpha(0.6);
      const name = scene.add
        .text(-262, y, taskName(task), { fontFamily: FONT_FAMILY, fontSize: '34px', fontStyle: '600', color: locked ? '#9a8a7a' : INK })
        .setOrigin(0, 0.5);
      popup.content.add([row, icon, name]);

      if (built) {
        popup.content.add(scene.add.image(150, y, TEXTURES.check).setDisplaySize(56, 56));
        const change = new TextButton(scene, 300, y, t('tasks.change'), () => finish({ action: 'change', task }), {
          width: 180,
          height: 76,
          fontSize: 30,
        });
        popup.content.add(change);
      } else if (isNext) {
        popup.content.add(starCost(scene, 150, y, task.cost));
        const build = new TextButton(scene, 300, y, t('tasks.build'), () => finish({ action: 'build', task }), {
          width: 180,
          height: 76,
          fontSize: 32,
          variant: 'green',
        });
        build.setEnabled(town.materials >= task.cost);
        popup.content.add(build);
      } else {
        popup.content.add(starCost(scene, 150, y, task.cost, true));
        popup.content.add(scene.add.image(300, y, TEXTURES.lock).setDisplaySize(52, 52));
      }
    });
    if (needStars) popup.content.add(text(scene, 0, height / 2 - 70, t('tasks.needStars'), 32, '#c0392b'));
    void popup.open();
  });
}

/**
 * Tasarım seçici: görevin 3 tasarımı yan yana. build modunda yıldız bedeli gösterilir;
 * change modunda mevcut tasarım seçili gelir. Kapatılırsa null.
 */
export async function showDesignPicker(
  scene: Phaser.Scene,
  task: TownTask,
  mode: 'build' | 'change',
  current = 0,
): Promise<number | null> {
  const keys = DESIGN_THEMES.map((_, d) => townPartTexture(task.id, d));
  await ensureTextures(scene, keys);

  return new Promise((resolve) => {
    let selected = current;
    const finish = (value: number | null) => void popup.close().then(() => resolve(value));
    const popup = new Popup(scene, {
      title: t('design.title'),
      width: 940,
      height: 820,
      onClose: () => finish(null),
      buttons: [{ label: t('design.confirm'), variant: 'green', onClick: () => finish(selected) }],
    });
    popup.content.add(text(scene, 0, -270, taskName(task), 42));

    const frames: Phaser.GameObjects.Graphics[] = [];
    const drawFrame = (g: Phaser.GameObjects.Graphics, x: number, on: boolean) => {
      g.clear();
      g.fillStyle(on ? 0xfff0c2 : 0xffffff, on ? 1 : 0.6).fillRoundedRect(x - 135, -200, 270, 330, 26);
      g.lineStyle(on ? 8 : 3, on ? 0xf0a000 : 0xd9a066).strokeRoundedRect(x - 135, -200, 270, 330, 26);
    };
    DESIGN_THEMES.forEach((theme, d) => {
      const x = (d - 1) * 290;
      const frame = scene.add.graphics();
      drawFrame(frame, x, d === selected);
      frames.push(frame);
      const preview = fit(scene.add.image(x, -55, keys[d]), 240, 220);
      const label = text(scene, x, 90, t(`design.${theme}` as I18nKey), 36);
      const hit = scene.add.zone(x, -35, 270, 330).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        selected = d;
        frames.forEach((f, i) => drawFrame(f, (i - 1) * 290, i === selected));
        scene.tweens.add({ targets: preview, scale: preview.scale * 1.08, duration: 90, yoyo: true });
      });
      popup.content.add([frame, preview, label, hit]);
    });
    if (mode === 'build') popup.content.add(starCost(scene, 0, 200, task.cost));
    void popup.open();
  });
}

/** Bölge bitti: sandık sallanıp açılır, altın çıkar, Kaptan Pati sevinir. */
export function showRegionChest(scene: Phaser.Scene, region: TownRegion, coins: number, next?: TownRegion): Promise<void> {
  return new Promise((resolve) => {
    const popup = new Popup(scene, {
      title: t('chest.title'),
      height: 900,
      buttons: [{ label: t('chest.collect'), variant: 'green', onClick: () => void popup.close().then(resolve) }],
    });
    popup.content.add(text(scene, 0, -300, t('chest.reward'), 42));
    const chest = scene.add.image(0, -150, obstacleTexture('chest', 1)).setDisplaySize(230, 230);
    const coinIcon = scene.add.image(-60, -150, TEXTURES.coin).setDisplaySize(96, 96).setAlpha(0);
    const coinText = text(scene, 50, -148, `+${coins}`, 72, '#b07800').setAlpha(0);
    const captain = scene.add.image(-300, 30, TEXTURES.captain).setDisplaySize(150, 150);
    const quip = scene.add
      .text(captain.x + 95, 30, t(`quip.region.${region.id}` as I18nKey), {
        fontFamily: FONT_FAMILY,
        fontSize: '34px',
        fontStyle: '600',
        color: INK,
        wordWrap: { width: 470 },
      })
      .setOrigin(0, 0.5);
    popup.content.add([chest, coinIcon, coinText, captain, quip]);
    if (next) popup.content.add(text(scene, 0, 160, t('chest.next', { region: t(`region.${next.id}` as I18nKey) }), 38, '#2e86de'));

    void popup.open().then(async () => {
      await tweenAsync(scene, { targets: chest, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 3 });
      await tweenAsync(scene, { targets: chest, scale: chest.scale * 1.25, alpha: 0, duration: 220 });
      await Promise.all([
        tweenAsync(scene, { targets: coinIcon, alpha: 1, duration: 200 }),
        tweenAsync(scene, { targets: coinText, alpha: 1, scale: { from: 0.4, to: 1 }, duration: 320, ease: 'Back.easeOut' }),
      ]);
      await waitMs(scene, 100);
    });
  });
}

export function showMissingMaterialBuy(scene: Phaser.Scene, missingCount: number, costGold: number, currentGold: number): Promise<boolean> {
  return new Promise((resolve) => {
    const affordable = currentGold >= costGold;
    const popup = new Popup(scene, {
      title: t('tasks.buyMissing'),
      height: 600,
      buttons: [
        { label: t('lose.giveUp'), onClick: () => void popup.close().then(() => resolve(false)) },
        { 
          label: t('tasks.buyAndBuild', { cost: costGold }),
          variant: 'green',
          enabled: affordable,
          onClick: () => void popup.close().then(() => resolve(true))
        }
      ]
    });
    popup.content.add(text(scene, 0, -60, t('tasks.missingAmount', { n: missingCount }), 42));
    const coin = scene.add.image(-40, 20, TEXTURES.coin).setDisplaySize(64, 64);
    const bal = text(scene, 30, 20, String(currentGold), 52, INK).setOrigin(0, 0.5);
    popup.content.add([coin, bal]);
    if (!affordable) popup.content.add(text(scene, 0, 100, t('lose.cantAfford'), 38, '#c0392b'));
    void popup.open();
  });
}
