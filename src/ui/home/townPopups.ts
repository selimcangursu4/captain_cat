import Phaser from 'phaser';
import { TEXTURES, obstacleTexture, townPartTexture } from '../../assets/AssetManifest';
import { ensureTextures } from '../../assets/loadAssets';
import { FONT_FAMILY } from '../../config/theme';
import { t, type I18nKey } from '../../i18n';
import { goldCostOf, isEmpty, starCostOf } from '../../meta/pricing';
import { DESIGN_THEMES, getTask, type TownRegion, type TownTask } from '../../meta/town';
import type { TownProgress } from '../../meta/TownProgress';
import { dispatch } from '../../net/sync';
import { audio } from '../../services/Audio';
import { wallet } from '../../services/Wallet';
import { Popup } from '../components/Popup';
import { TextButton } from '../components/TextButton';
import { showToast } from '../components/toast';
import { formatClock, formatDuration, formatNumber } from '../format';
import { recipeRow } from '../popups/rewardViews';
import { tweenAsync, waitMs } from '../tweens';

const INK = '#5a2d06';
const MUTED = '#8a7a6a';
const RED = '#c0392b';

export const taskName = (task: TownTask) => t(`task.${task.id}` as I18nKey);

function text(scene: Phaser.Scene, x: number, y: number, value: string, size: number, color = INK) {
  return scene.add
    .text(x, y, value, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, fontStyle: '700', color, align: 'center' })
    .setOrigin(0.5);
}

/** Görseli en-boy oranını koruyarak `width` x `height` kutusuna sığdırır. */
function fit(image: Phaser.GameObjects.Image, width: number, height: number = width): Phaser.GameObjects.Image {
  return image.setScale(Math.min(width / image.width, height / image.height));
}

/** Saat simgesi + süre (görev listesi ve inşaat penceresi). */
function durationLine(scene: Phaser.Scene, x: number, y: number, value: string, size: number, color = MUTED, originX = 0.5): Phaser.GameObjects.GameObject[] {
  const label = scene.add
    .text(0, y, value, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, fontStyle: '700', color })
    .setOrigin(0, 0.5);
  const iconSize = size * 1.15;
  const width = iconSize + 8 + label.width;
  const left = x - width * originX;
  const icon = scene.add.image(left + iconSize / 2, y, TEXTURES.clock).setDisplaySize(iconSize, iconSize);
  label.setX(left + iconSize + 8);
  return [icon, label];
}

export type TaskAction = { readonly action: 'build' | 'change' | 'construction'; readonly task: TownTask };

/**
 * Bölgenin görev listesi: bitenler (✓, Değiştir), süren inşaat (geri sayım, Hızlandır),
 * sıradaki (süre, Yap) ve kilitliler. Usta aynı anda tek inşaat yapar.
 */
export async function showTaskList(scene: Phaser.Scene, region: TownRegion, town: TownProgress): Promise<TaskAction | null> {
  const icons = region.tasks.map((task) => townPartTexture(task.id, town.designOf(task.id) ?? town.construction?.design ?? 0));
  await ensureTextures(scene, icons);
  const next = town.nextTask(region);
  const busy = town.construction !== null;
  const rowHeight = 116;
  const footer = 90;
  const height = 170 + region.tasks.length * rowHeight + footer;

  return new Promise((resolve) => {
    let timer: Phaser.Time.TimerEvent | null = null;
    const finish = (value: TaskAction | null) => {
      timer?.remove();
      void popup.close().then(() => resolve(value));
    };
    const popup = new Popup(scene, { title: t(`region.${region.id}` as I18nKey), width: 920, height, onClose: () => finish(null) });
    const top = -height / 2 + 150;
    let countdown: Phaser.GameObjects.Text | null = null;

    region.tasks.forEach((task, i) => {
      const y = top + i * rowHeight;
      const built = town.isBuilt(task.id);
      const building = town.isUnderConstruction(task.id);
      const isNext = next?.id === task.id && !building;
      const locked = !built && !building && !isNext;
      const highlight = isNext || building;
      const row = scene.add.graphics();
      row.fillStyle(highlight ? 0xfff0c2 : 0xffffff, highlight ? 1 : 0.55).fillRoundedRect(-420, y - 52, 840, 104, 20);
      if (highlight) row.lineStyle(4, 0xf0a000).strokeRoundedRect(-420, y - 52, 840, 104, 20);
      // Geniş parçalar (çit, bahçe) ince kalmasın diye simge kutusu yatayda geniş.
      const icon = fit(scene.add.image(-355, y, icons[i]), 120, 84);
      if (locked) icon.setTint(0x9aa5b1).setAlpha(0.6);
      if (building) icon.setAlpha(0.55);
      const name = scene.add
        .text(-282, y - 18, taskName(task), {
          fontFamily: FONT_FAMILY,
          fontSize: '31px',
          fontStyle: '600',
          color: locked ? '#9a8a7a' : INK,
          wordWrap: { width: 400 },
        })
        .setOrigin(0, 0.5);
      popup.content.add([row, icon, name]);

      if (built) {
        popup.content.add(text(scene, -282, y + 24, t('tasks.done'), 26, '#2e8b3d').setOrigin(0, 0.5));
        popup.content.add(scene.add.image(175, y, TEXTURES.check).setDisplaySize(56, 56));
        popup.content.add(
          new TextButton(scene, 315, y, t('tasks.change'), () => finish({ action: 'change', task }), { width: 190, height: 76, fontSize: 30 }),
        );
      } else if (building) {
        countdown = text(scene, -282, y + 24, '', 26, '#b07800').setOrigin(0, 0.5);
        popup.content.add(countdown);
        popup.content.add(scene.add.image(175, y, TEXTURES.hammer).setDisplaySize(64, 64));
        popup.content.add(
          new TextButton(scene, 315, y, t('tasks.view'), () => finish({ action: 'construction', task }), {
            width: 190,
            height: 76,
            fontSize: 30,
            variant: 'green',
          }),
        );
      } else {
        popup.content.add(durationLine(scene, -282, y + 24, formatDuration(task.minutes * 60_000), 26, MUTED, 0));
        if (isNext) {
          const build = new TextButton(scene, 315, y, t('tasks.build'), () => finish({ action: 'build', task }), {
            width: 190,
            height: 76,
            fontSize: 32,
            variant: 'green',
          });
          build.setEnabled(!busy);
          popup.content.add(build);
          if (!isEmpty(town.missingFor(task))) popup.content.add(scene.add.image(175, y, TEXTURES.plus).setDisplaySize(52, 52).setAlpha(0.9));
        } else {
          popup.content.add(scene.add.image(315, y, TEXTURES.lock).setDisplaySize(52, 52));
        }
      }
    });

    const note = busy ? t('tasks.busy') : next ? t('tasks.gate') : t('tasks.regionDone');
    popup.content.add(text(scene, 0, height / 2 - 70, note, 28, busy ? '#b07800' : MUTED).setWordWrapWidth(780));

    const update = () => {
      const ms = town.msLeft;
      countdown?.setText(ms === null ? '' : ms > 0 ? t('tasks.building', { time: formatClock(ms) }) : t('construction.done'));
    };
    update();
    if (countdown) timer = scene.time.addEvent({ delay: 1000, loop: true, callback: update });
    void popup.open();
  });
}

/**
 * İnşaat penceresi: 3 tasarım, gereken malzemeler (elde/gereken), inşaat süresi. Malzeme eksikse
 * eksikler yıldızla ya da doğrudan altınla tamamlanır (komutla). "İnşaata Başla" → seçilen tasarım;
 * kapatılırsa null. 'market': oyuncu Pazar'a gitmek istedi.
 */
export async function showBuildPopup(scene: Phaser.Scene, task: TownTask, town: TownProgress): Promise<number | 'market' | null> {
  const keys = DESIGN_THEMES.map((_, d) => townPartTexture(task.id, d));
  await ensureTextures(scene, keys);

  return new Promise((resolve) => {
    let selected = 0;
    const finish = (value: number | 'market' | null) => void popup.close().then(() => resolve(value));
    const height = 1500;
    const popup = new Popup(scene, { title: t('build.title'), width: 960, height, onClose: () => finish(null) });
    popup.content.add(text(scene, 0, -610, taskName(task), 44));

    // Tasarımlar
    const frames: Phaser.GameObjects.Graphics[] = [];
    const designY = -420;
    const drawFrame = (g: Phaser.GameObjects.Graphics, x: number, on: boolean) => {
      g.clear();
      g.fillStyle(on ? 0xfff0c2 : 0xffffff, on ? 1 : 0.6).fillRoundedRect(x - 135, designY - 140, 270, 280, 26);
      g.lineStyle(on ? 8 : 3, on ? 0xf0a000 : 0xd9a066).strokeRoundedRect(x - 135, designY - 140, 270, 280, 26);
    };
    DESIGN_THEMES.forEach((theme, d) => {
      const x = (d - 1) * 290;
      const frame = scene.add.graphics();
      drawFrame(frame, x, d === selected);
      frames.push(frame);
      const preview = fit(scene.add.image(x, designY - 25, keys[d]), 230, 180);
      const label = text(scene, x, designY + 102, t(`design.${theme}` as I18nKey), 32);
      const hit = scene.add.zone(x, designY, 270, 280).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        selected = d;
        audio.play('tap');
        frames.forEach((f, i) => drawFrame(f, (i - 1) * 290, i === selected));
        scene.tweens.add({ targets: preview, scale: preview.scale * 1.08, duration: 90, yoyo: true });
      });
      popup.content.add([frame, preview, label, hit]);
    });

    popup.content.add(scene.add.graphics().lineStyle(4, 0xd9a066, 0.8).lineBetween(-380, -230, 380, -230));
    popup.content.add(text(scene, 0, -185, t('build.materials'), 40));
    popup.content.add(durationLine(scene, 0, 120, t('build.duration', { time: formatDuration(task.minutes * 60_000) }), 34, INK));

    // Malzemeler ve eksik tamamlama: her değişiklikte yeniden çizilir.
    const dynamic = scene.add.container(0, 0);
    popup.content.add(dynamic);
    const render = () => {
      dynamic.removeAll(true);
      const row = recipeRow(scene, task.recipe, town.materials, { iconSize: 104, spacing: 230 });
      row.setY(-35);
      dynamic.add(row);
      const missing = town.missingFor(task);
      const busy = town.construction !== null;
      const ready = isEmpty(missing);

      if (!ready) {
        const stars = starCostOf(missing);
        const coins = goldCostOf(missing);
        dynamic.add(text(scene, 0, 205, t('build.missing'), 32, RED));
        const byStars = new TextButton(scene, -215, 300, t('build.fill', { n: stars }), () => fill('stars', stars), {
          width: 400,
          height: 100,
          fontSize: 34,
          icon: TEXTURES.star,
        });
        const byCoins = new TextButton(scene, 215, 300, t('build.fill', { n: formatNumber(coins) }), () => fill('coins', coins), {
          width: 400,
          height: 100,
          fontSize: 34,
          icon: TEXTURES.coin,
        });
        byStars.setAlpha(wallet.stars >= stars ? 1 : 0.6);
        byCoins.setAlpha(wallet.coins >= coins ? 1 : 0.6);
        dynamic.add([byStars, byCoins]);
        const market = scene.add
          .text(0, 395, t('build.toMarket'), { fontFamily: FONT_FAMILY, fontSize: '32px', fontStyle: '700', color: '#2e86de' })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true });
        market.on('pointerup', () => finish('market'));
        dynamic.add(market);
      } else {
        dynamic.add(text(scene, 0, 240, busy ? t('tasks.busy') : t('build.ready'), 32, busy ? '#b07800' : '#2e8b3d').setWordWrapWidth(800));
      }
      const start = new TextButton(scene, 0, height / 2 - 110, t('build.start'), () => finish(selected), {
        width: 480,
        height: 110,
        fontSize: 44,
        variant: 'green',
      });
      start.setEnabled(ready && !busy);
      dynamic.add(start);
    };

    const fill = (currency: 'stars' | 'coins', cost: number) => {
      const balance = currency === 'stars' ? wallet.stars : wallet.coins;
      if (balance < cost) {
        showToast(scene, t(currency === 'stars' ? 'error.stars' : 'error.coins'));
        return;
      }
      if (!dispatch({ type: 'fillMaterials', task: task.id, currency }).ok) return;
      audio.play('coin');
      render();
    };

    render();
    void popup.open();
  });
}

export type ConstructionChoice = 'speedUp' | 'ready' | 'shop' | null;

/**
 * Süren inşaat: parça, ilerleme çubuğu, canlı geri sayım ve "Hemen bitir" (altın; son saniyeler
 * ücretsiz). Süre pencere açıkken dolarsa 'ready' ile kapanır.
 */
export async function showConstruction(scene: Phaser.Scene, town: TownProgress): Promise<ConstructionChoice> {
  const c = town.construction;
  if (!c) return null;
  const task = getTask(c.task);
  if (!task) return null;
  const key = townPartTexture(task.id, c.design);
  await ensureTextures(scene, [key]);

  return new Promise((resolve) => {
    let timer: Phaser.Time.TimerEvent | null = null;
    const finish = (value: ConstructionChoice) => {
      timer?.remove();
      void popup.close().then(() => resolve(value));
    };
    const height = 1120;
    const popup = new Popup(scene, { title: t('construction.title'), width: 900, height, onClose: () => finish(null) });
    popup.content.add(text(scene, 0, -440, taskName(task), 42));
    const part = fit(scene.add.image(0, -260, key), 300, 240).setAlpha(0.55);
    const hammer = scene.add.image(120, -200, TEXTURES.hammer).setDisplaySize(120, 120);
    scene.tweens.add({ targets: hammer, angle: { from: -25, to: 15 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    popup.content.add([part, hammer]);

    const barWidth = 640;
    const track = scene.add
      .graphics()
      .fillStyle(0x06263d, 0.25)
      .fillRoundedRect(-barWidth / 2, -70, barWidth, 46, 23)
      .lineStyle(4, 0xd9a066)
      .strokeRoundedRect(-barWidth / 2, -70, barWidth, 46, 23);
    const fill = scene.add.graphics();
    const left = text(scene, 0, 20, '', 42);
    popup.content.add([track, fill, left]);

    const speed = new TextButton(scene, 0, 170, '', () => {
      const cost = town.speedUpCost ?? 0;
      if (cost > wallet.coins) {
        showToast(scene, t('error.coins'));
        finish('shop');
        return;
      }
      finish('speedUp');
    }, { width: 520, height: 116, fontSize: 42, variant: 'green', icon: TEXTURES.coin });
    popup.content.add(speed);
    popup.content.add(text(scene, 0, 270, t('construction.hint'), 28, MUTED).setWordWrapWidth(760));

    const captain = scene.add.image(-300, 400, TEXTURES.captain).setDisplaySize(150, 150);
    const quip = scene.add
      .text(-210, 400, t('construction.quip'), { fontFamily: FONT_FAMILY, fontSize: '32px', fontStyle: '600', color: INK, wordWrap: { width: 520 } })
      .setOrigin(0, 0.5);
    popup.content.add([captain, quip]);

    const update = () => {
      const ms = town.msLeft ?? 0;
      const progress = town.constructionProgress ?? 1;
      fill.clear().fillStyle(0xffd23f, 1).fillRoundedRect(-barWidth / 2, -70, Math.max(46, barWidth * progress), 46, 23);
      left.setText(t('construction.left', { time: formatClock(ms) }));
      const cost = town.speedUpCost ?? 0;
      speed.setLabel(cost === 0 ? t('construction.free') : t('construction.speedUp', { n: formatNumber(cost) }));
      if (ms <= 0) finish('ready');
    };
    update();
    timer = scene.time.addEvent({ delay: 1000, loop: true, callback: update });
    void popup.open();
  });
}

/** Tasarım değiştirme: bitmiş görevin 3 tasarımı, mevcut tasarım seçili gelir. Kapatılırsa null. */
export async function showDesignPicker(scene: Phaser.Scene, task: TownTask, current = 0): Promise<number | null> {
  const keys = DESIGN_THEMES.map((_, d) => townPartTexture(task.id, d));
  await ensureTextures(scene, keys);

  return new Promise((resolve) => {
    let selected = current;
    const finish = (value: number | null) => void popup.close().then(() => resolve(value));
    const popup = new Popup(scene, {
      title: t('design.title'),
      width: 940,
      height: 760,
      onClose: () => finish(null),
      buttons: [{ label: t('design.confirm'), variant: 'green', onClick: () => finish(selected) }],
    });
    popup.content.add(text(scene, 0, -250, taskName(task), 42));

    const frames: Phaser.GameObjects.Graphics[] = [];
    const drawFrame = (g: Phaser.GameObjects.Graphics, x: number, on: boolean) => {
      g.clear();
      g.fillStyle(on ? 0xfff0c2 : 0xffffff, on ? 1 : 0.6).fillRoundedRect(x - 135, -190, 270, 330, 26);
      g.lineStyle(on ? 8 : 3, on ? 0xf0a000 : 0xd9a066).strokeRoundedRect(x - 135, -190, 270, 330, 26);
    };
    DESIGN_THEMES.forEach((theme, d) => {
      const x = (d - 1) * 290;
      const frame = scene.add.graphics();
      drawFrame(frame, x, d === selected);
      frames.push(frame);
      const preview = fit(scene.add.image(x, -45, keys[d]), 240, 220);
      const label = text(scene, x, 100, t(`design.${theme}` as I18nKey), 36);
      const hit = scene.add.zone(x, -25, 270, 330).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        selected = d;
        frames.forEach((f, i) => drawFrame(f, (i - 1) * 290, i === selected));
        scene.tweens.add({ targets: preview, scale: preview.scale * 1.08, duration: 90, yoyo: true });
      });
      popup.content.add([frame, preview, label, hit]);
    });
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
