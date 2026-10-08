import Phaser from 'phaser';
import { TEXTURES, materialTexture } from '../../assets/AssetManifest';
import type { MaterialId } from '../../config/economy';
import { FONT_FAMILY } from '../../config/theme';
import type { GoalDefinition, GoalState } from '../../core';
import { t, type I18nKey } from '../../i18n';
import { audio } from '../../services/Audio';
import { vibrate } from '../../services/Haptics';
import { settings } from '../../services/Settings';
import { Popup } from '../components/Popup';
import { Toggle } from '../components/Toggle';
import { confetti } from '../effects/celebrate';
import { goalIconTexture } from '../hud/goalIcon';

export const INK = '#5a2d06';

export function label(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = INK, wrap?: number) {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: '700',
      color,
      align: 'center',
      wordWrap: wrap ? { width: wrap } : undefined,
    })
    .setOrigin(0.5);
}

/** Hedef simgeleri ve sayıları yan yana. */
export function goalsRow(popup: Popup, scene: Phaser.Scene, goals: readonly { goal: GoalDefinition; count: number }[], y: number): void {
  const spacing = Math.min(200, (popup.width - 160) / Math.max(1, goals.length));
  goals.forEach(({ goal, count }, i) => {
    const x = (i - (goals.length - 1) / 2) * spacing;
    const icon = scene.add.image(x, y, goalIconTexture(goal)).setDisplaySize(124, 124);
    const text = scene.add
      .text(x + 44, y + 44, String(count), {
        fontFamily: FONT_FAMILY,
        fontSize: '50px',
        fontStyle: '700',
        color: '#ffffff',
        stroke: '#4a2a0c',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    popup.content.add([icon, text]);
  });
}

/** Kaptan Pati ve rastgele bir repliği (ya da verilen metin). */
export function captainQuip(popup: Popup, scene: Phaser.Scene, kind: 'intro' | 'win' | 'lose', y: number, text?: string): void {
  const key = `quip.${kind}.${Phaser.Math.Between(1, 3)}` as I18nKey;
  const left = -popup.width / 2 + 150;
  const captain = scene.add.image(left, y, TEXTURES.captain).setDisplaySize(190, 190);
  const quip = scene.add
    .text(left + 120, y, text ?? t(key), {
      fontFamily: FONT_FAMILY,
      fontSize: '34px',
      fontStyle: '600',
      color: INK,
      wordWrap: { width: popup.width - 400 },
    })
    .setOrigin(0, 0.5);
  popup.content.add([captain, quip]);
  scene.tweens.add({ targets: captain, angle: { from: -5, to: 5 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

export function coinLine(popup: Popup, scene: Phaser.Scene, y: number, text: string, color = INK): void {
  const value = label(scene, 30, y, text, 52, color);
  const coin = scene.add.image(value.x - value.width / 2 - 40, y, TEXTURES.coin).setDisplaySize(64, 64);
  popup.content.add([value, coin]);
}

/** Ses, müzik ve titreşim anahtarları yan yana (duraklat penceresi). */
export function soundToggles(popup: Popup, scene: Phaser.Scene, y: number): void {
  const rows = [
    ['settings.sound', 'sound'],
    ['settings.music', 'music'],
    ['settings.vibration', 'vibration'],
  ] as const;
  rows.forEach(([key, setting], i) => {
    const x = (i - 1) * 250;
    popup.content.add(label(scene, x, y - 50, t(key), 30));
    popup.content.add(new Toggle(scene, x, y + 20, settings[setting], (on) => settings.setToggle(setting, on)));
  });
}

/** Ödül satırı: simge + "+N" çipleri yan yana (yıldız, can, altın). */
function rewardChips(popup: Popup, scene: Phaser.Scene, y: number, chips: readonly [string, string][]): void {
  const gap = 24;
  const ICON = 76;
  // Çip genişliği yazıya göre: [kenar | simge | boşluk | yazı | kenar].
  const items = chips.map(([texture, amount]) => {
    const text = label(scene, 0, y + 2, amount, 46).setOrigin(0, 0.5);
    return { texture, text, width: 24 + ICON + 12 + text.width + 28 };
  });
  const total = items.reduce((s, it) => s + it.width, 0) + gap * (items.length - 1);
  let left = -total / 2;
  items.forEach(({ texture, text, width }, i) => {
    const x = left;
    left += width + gap;
    const bg = scene.add.graphics();
    bg.fillStyle(0xffffff, 0.7).fillRoundedRect(x, y - 48, width, 96, 48);
    bg.lineStyle(4, 0xd9a066).strokeRoundedRect(x, y - 48, width, 96, 48);
    const icon = scene.add.image(x + 24 + ICON / 2, y, texture).setDisplaySize(ICON, ICON);
    const iconScale = icon.scale;
    text.setX(x + 24 + ICON + 12);
    popup.content.add([bg, icon, text]);
    // Çipler sırayla zıplayarak belirir.
    icon.setScale(0);
    text.setScale(0);
    scene.tweens.add({ targets: icon, scale: iconScale, duration: 320, delay: 500 + i * 160, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: text, scale: 1, duration: 320, delay: 560 + i * 160, ease: 'Back.easeOut' });
  });
}

/**
 * Kazanınca: seviye ödülleri (yeni seviyede +1 yıldız, kasabaya malzeme, +1 can) ve kazanılan altın
 * çipler halinde; Kaptan'ın sevinci → "Devam" (kasabaya).
 */
export function showWin(
  scene: Phaser.Scene,
  coins: number,
  stars: number,
  lives = 0,
  material: { readonly id: MaterialId; readonly amount: number } | null = null,
): Promise<void> {
  return new Promise((resolve) => {
    const popup = new Popup(scene, {
      title: t('win.title'),
      height: 920,
      buttons: [{ label: t('win.next'), variant: 'green', onClick: () => void popup.close().then(resolve) }],
    });
    // Yıldızın arkasında dönen ışık halkası.
    const glow = scene.add.image(0, -240, TEXTURES.ring).setTint(0xffd23f).setDisplaySize(330, 330).setAlpha(0);
    const star = scene.add.image(0, -240, TEXTURES.star).setDisplaySize(230, 230);
    const starScale = star.scale;
    star.setScale(0);
    popup.content.add([glow, star]);
    scene.tweens.add({
      targets: star,
      scale: starScale,
      angle: 360,
      duration: 650,
      delay: 250,
      ease: 'Back.easeOut',
      onStart: () => audio.play('star'),
    });
    scene.tweens.add({ targets: glow, alpha: 0.7, duration: 400, delay: 600 });
    scene.tweens.add({ targets: glow, angle: 360, duration: 5000, repeat: -1 });
    confetti(scene);
    popup.content.add(label(scene, 0, -85, t('win.rewards'), 38));
    const chips: [string, string][] = [];
    if (stars > 0) chips.push([TEXTURES.star, `+${stars}`]);
    if (material) chips.push([materialTexture(material.id), `+${material.amount}`]);
    if (lives > 0) chips.push([TEXTURES.heart, `+${lives}`]);
    chips.push([TEXTURES.coin, `+${coins}`]);
    rewardChips(popup, scene, 10, chips);
    captainQuip(popup, scene, 'win', 170);
    audio.play('win');
    vibrate('heavy');
    void popup.open();
  });
}

/** Hamleler bitti: kalan hedefler ve "+5 hamle" teklifi. */
export function showOutOfMoves(
  scene: Phaser.Scene,
  options: { goals: readonly GoalState[]; count: number; cost: number; balance: number },
): Promise<'buy' | 'giveUp'> {
  return new Promise((resolve) => {
    const affordable = options.balance >= options.cost;
    const popup = new Popup(scene, {
      title: t('lose.title'),
      height: 860,
      buttons: [
        { label: t('lose.giveUp'), onClick: () => void popup.close().then(() => resolve('giveUp')) },
        {
          label: t('lose.buy', { n: options.count, cost: options.cost }),
          variant: 'green',
          enabled: affordable,
          onClick: () => void popup.close().then(() => resolve('buy')),
        },
      ],
    });
    const remaining = options.goals.filter((s) => s.remaining > 0).map((s) => ({ goal: s.goal, count: s.remaining }));
    goalsRow(popup, scene, remaining, -230);
    popup.content.add(label(scene, 0, -80, t('lose.offer', { n: options.count }), 42));
    coinLine(popup, scene, 30, t('coins.balance', { n: options.balance }));
    if (!affordable) popup.content.add(label(scene, 0, 110, t('lose.cantAfford'), 38, '#c0392b'));
    void popup.open();
  });
}

/** Vazgeçince: Kaptan teselli eder, kaybedilen can gösterilir → "Kasaba" ya da "Tekrar Dene". */
export function showFail(scene: Phaser.Scene): Promise<'home' | 'retry'> {
  return new Promise((resolve) => {
    const popup = new Popup(scene, {
      title: t('fail.title'),
      height: 760,
      buttons: [
        { label: t('fail.home'), onClick: () => void popup.close().then(() => resolve('home')) },
        { label: t('fail.retry'), variant: 'green', onClick: () => void popup.close().then(() => resolve('retry')) },
      ],
    });
    captainQuip(popup, scene, 'lose', -120);
    const lost = label(scene, 36, 70, t('fail.lifeLost'), 40, '#c0392b');
    const heart = scene.add.image(lost.x - lost.width / 2 - 46, 70, TEXTURES.heart).setDisplaySize(72, 72);
    popup.content.add([lost, heart]);
    scene.tweens.add({ targets: heart, scale: heart.scale * 0.8, alpha: 0.5, duration: 500, yoyo: true, repeat: 2 });
    audio.play('lose');
    void popup.open();
  });
}

/** Duraklat: ses/müzik/titreşim, çıkınca can gideceği uyarısı. */
export function showPause(scene: Phaser.Scene): Promise<'resume' | 'restart' | 'home'> {
  return new Promise((resolve) => {
    const popup = new Popup(scene, {
      title: t('pause.title'),
      width: 940,
      height: 760,
      buttons: [
        { label: t('pause.home'), onClick: () => void popup.close().then(() => resolve('home')) },
        { label: t('pause.restart'), onClick: () => void popup.close().then(() => resolve('restart')) },
        { label: t('pause.resume'), variant: 'green', onClick: () => void popup.close().then(() => resolve('resume')) },
      ],
    });
    popup.content.add(scene.add.image(0, -200, TEXTURES.captain).setDisplaySize(150, 150));
    popup.content.add(label(scene, 0, -85, t('pause.loseLife'), 36, '#c0392b'));
    soundToggles(popup, scene, 50);
    void popup.open();
  });
}
