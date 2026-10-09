import type Phaser from 'phaser';
import { TEXTURES, itemTexture, obstacleTexture } from '../../assets/AssetManifest';
import { APP_VERSION } from '../../config/app';
import { BOOSTER_IDS, ECONOMY, HELPER_IDS, type BoosterId, type DailyRewardConfig, type ItemId } from '../../config/economy';
import { FONT_FAMILY } from '../../config/theme';
import { getLevel } from '../../data/levels';
import { t, type I18nKey, type Language } from '../../i18n';
import type { DailyReward } from '../../meta/DailyReward';
import type { LevelReward } from '../../meta/levelRewards';
import { inventory, lives } from '../../meta/progress';
import { audio } from '../../services/Audio';
import { settings } from '../../services/Settings';
import { wallet } from '../../services/Wallet';
import { currentUser, isGuest } from '../../net/account';
import { legalUrl, openExternal, type LegalPage } from '../../net/links';
import { dispatch, sync, type SyncStatus } from '../../net/sync';
import { formatCountdown } from '../components/CounterPill';
import { Popup } from '../components/Popup';
import { TextButton } from '../components/TextButton';
import { showToast } from '../components/toast';
import { Toggle } from '../components/Toggle';
import { tweenAsync, waitMs } from '../tweens';
import { INK, captainQuip, coinLine, goalsRow, label } from './levelPopups';
import { bundleEntries } from './rewardViews';

const RED = '#c0392b';
const GOLD = '#b07800';

export const itemName = (id: ItemId) => t(`item.${id}` as I18nKey);
const itemDescription = (id: ItemId) => t(`item.desc.${id}` as I18nKey);
const isHelper = (id: ItemId) => (HELPER_IDS as readonly ItemId[]).includes(id);

/** Simgenin sağ altında beyaz daire içinde sayı. */
function countBadge(scene: Phaser.Scene, x: number, y: number, value: string): Phaser.GameObjects.GameObject[] {
  const circle = scene.add.circle(x, y, 30, 0xffffff).setStrokeStyle(5, 0x4a2a0c);
  const text = scene.add
    .text(x, y - 1, value, { fontFamily: FONT_FAMILY, fontSize: '36px', fontStyle: '700', color: INK })
    .setOrigin(0.5);
  return [circle, text];
}

/** Yeni açılan eşya: simge, ne işe yaradığı ve hediye adedi. */
export function showItemUnlock(scene: Phaser.Scene, id: ItemId): Promise<void> {
  return new Promise((resolve) => {
    const popup = new Popup(scene, {
      title: t(isHelper(id) ? 'unlock.helper' : 'unlock.booster'),
      height: 820,
      buttons: [{ label: t('unlock.ok'), variant: 'green', onClick: () => void popup.close().then(resolve) }],
    });
    const glow = scene.add.image(0, -160, TEXTURES.ring).setTint(0xffd23f).setDisplaySize(300, 300).setAlpha(0.6);
    const icon = scene.add.image(0, -160, itemTexture(id)).setDisplaySize(210, 210);
    popup.content.add([glow, icon]);
    popup.content.add(label(scene, 0, 0, itemName(id), 56));
    popup.content.add(label(scene, 0, 75, itemDescription(id), 36, INK, 700));
    popup.content.add(label(scene, 0, 160, t('unlock.gift', { n: ECONOMY.items[id].gift }), 42, GOLD));
    scene.tweens.add({ targets: glow, angle: 360, duration: 6000, repeat: -1 });
    scene.tweens.add({ targets: icon, scale: { from: icon.scale * 0.2, to: icon.scale }, duration: 520, ease: 'Back.easeOut', delay: 150 });
    audio.play('unlock');
    void popup.open();
  });
}

/** Eşya bitince altınla paket veya tekli alma. Alındıysa true. */
export function showBuyItem(scene: Phaser.Scene, id: ItemId, isSingle = false): Promise<boolean> {
  return new Promise((resolve) => {
    const { pack, price, singlePrice } = ECONOMY.items[id];
    const cost = isSingle ? singlePrice : price;
    const amount = isSingle ? 1 : pack;
    const affordable = wallet.coins >= cost;
    const finish = (bought: boolean) => void popup.close().then(() => resolve(bought));
    const popup = new Popup(scene, {
      title: t('buy.title'),
      height: 800,
      onClose: () => finish(false),
      buttons: [
        {
          label: t(isSingle ? 'buy.singleButton' : 'buy.button', { n: amount, cost }),
          variant: 'green',
          icon: TEXTURES.coin,
          enabled: affordable,
          onClick: () => {
            if (!dispatch({ type: isSingle ? 'buySingleItem' : 'buyPack', item: id }).ok) return;
            audio.play('coin');
            finish(true);
          },
        },
      ],
    });
    popup.content.add(scene.add.image(0, -180, itemTexture(id)).setDisplaySize(190, 190));
    popup.content.add(countBadge(scene, 80, -110, `×${amount}`));
    popup.content.add(label(scene, 0, -30, itemName(id), 52));
    popup.content.add(label(scene, 0, 35, itemDescription(id), 34, INK, 700));
    coinLine(popup, scene, 125, t('coins.balance', { n: wallet.coins }));
    if (!affordable) popup.content.add(label(scene, 0, 195, t('lose.cantAfford'), 36, RED));
    void popup.open();
  });
}

/**
 * Canlar: sayı, sıradaki cana kalan süre (canlı), altınla doldurma.
 * 'refilled': dolduruldu; 'closed': kapatıldı.
 */
export function showLives(scene: Phaser.Scene): Promise<'refilled' | 'closed'> {
  return new Promise((resolve) => {
    const full = lives.isFull;
    const cost = ECONOMY.lives.refillCost;
    let timer: Phaser.Time.TimerEvent | null = null;
    const finish = (result: 'refilled' | 'closed') => {
      timer?.remove();
      void popup.close().then(() => resolve(result));
    };
    const popup = new Popup(scene, {
      title: t(lives.count === 0 ? 'lives.empty' : 'lives.title'),
      height: full ? 640 : 900,
      onClose: () => finish('closed'),
      buttons: full
        ? []
        : [
            {
              label: t('lives.buyOne', { cost: ECONOMY.lives.refillCost }),
              icon: TEXTURES.coin,
              enabled: wallet.coins >= ECONOMY.lives.refillCost,
              onClick: () => {
                if (!dispatch({ type: 'buyOneLife' }).ok) return;
                audio.play('coin');
                finish('refilled');
              },
            },
            {
              label: t('lives.refill', { cost: ECONOMY.lives.fullRefillCost }),
              variant: 'green',
              icon: TEXTURES.coin,
              enabled: wallet.coins >= ECONOMY.lives.fullRefillCost,
              onClick: () => {
                if (!dispatch({ type: 'refillLives' }).ok) return;
                audio.play('coin');
                finish('refilled');
              },
            },
          ],
    });
    const top = full ? -120 : -230;
    const heart = scene.add.image(0, top, TEXTURES.heart).setDisplaySize(220, 220);
    const count = scene.add
      .text(0, top - 4, String(lives.count), {
        fontFamily: FONT_FAMILY,
        fontSize: '96px',
        fontStyle: '700',
        color: '#ffffff',
        stroke: '#7b1d1d',
        strokeThickness: 14,
      })
      .setOrigin(0.5);
    const status = label(scene, 0, top + 160, '', 42);
    popup.content.add([heart, count, status]);
    scene.tweens.add({ targets: heart, scale: heart.scale * 1.06, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const update = () => {
      count.setText(String(lives.count));
      const ms = lives.msUntilNext;
      status.setText(ms === null ? t('lives.fullMessage') : t('lives.next', { time: formatCountdown(ms) }));
    };
    update();
    timer = scene.time.addEvent({ delay: 1000, loop: true, callback: update });
    if (!full) {
      captainQuip(popup, scene, 'lose', 110, t('lives.quip'));
      if (wallet.coins < cost) popup.content.add(label(scene, 0, 240, t('lose.cantAfford'), 34, RED));
    }
    void popup.open();
  });
}

/**
 * Bölüm başlangıcı: hedefler, hamle sayısı, bölüm öncesi güçlendirici seçimi.
 * Seçilen güçlendiricileri döndürür; kapatılırsa null.
 */
export function showLevelStart(scene: Phaser.Scene, levelId: number): Promise<BoosterId[] | null> {
  return new Promise((resolve) => {
    const level = getLevel(levelId);
    const selected = new Set<BoosterId>();
    let nested = false;
    const finish = (value: BoosterId[] | null) => void popup.close().then(() => resolve(value));
    const popup = new Popup(scene, {
      title: t('level.title', { n: levelId }),
      height: 1060,
      onClose: () => !nested && finish(null),
      buttons: [{ label: t('level.play'), variant: 'green', onClick: () => !nested && finish([...selected]) }],
    });
    popup.content.add(label(scene, 0, -390, t('level.goals'), 46));
    goalsRow(popup, scene, level.goals.map((goal) => ({ goal, count: goal.count })), -270);
    popup.content.add(label(scene, 0, -150, t('level.moves', { n: level.moves }), 40));

    const divider = scene.add.graphics().lineStyle(4, 0xd9a066, 0.8).lineBetween(-340, -90, 340, -90);
    popup.content.add(divider);
    popup.content.add(label(scene, 0, -40, t('start.boosters'), 44));

    const slotY = 110;
    BOOSTER_IDS.forEach((id, i) => {
      const x = (i - 1) * 240;
      const container = scene.add.container(x, slotY);
      popup.content.add(container);
      const draw = () => {
        container.removeAll(true);
        const unlocked = inventory.isUnlocked(id);
        const count = inventory.count(id);
        const on = selected.has(id);
        const face = scene.add.image(0, 0, on ? TEXTURES.roundButtonActive : TEXTURES.roundButton).setDisplaySize(180, 180);
        const icon = scene.add.image(0, 0, itemTexture(id)).setDisplaySize(118, 118);
        container.add([face, icon]);
        if (!unlocked) {
          face.setAlpha(0.6);
          icon.setAlpha(0.35);
          container.add(scene.add.image(0, 0, TEXTURES.lock).setDisplaySize(72, 72));
          container.add(label(scene, 0, 118, t('item.lockedAt', { n: ECONOMY.items[id].unlockLevel }), 30, '#8a7a6a'));
          return;
        }
        if (count === 0) container.add(scene.add.image(62, 62, TEXTURES.plus).setDisplaySize(64, 64));
        else container.add(countBadge(scene, 62, 62, String(count)));
        if (on) container.add(scene.add.image(-62, -62, TEXTURES.check).setDisplaySize(64, 64));
        container.add(label(scene, 0, 118, itemName(id), 30));
      };
      draw();
      const hit = scene.add.zone(x, slotY, 190, 190).setInteractive({ useHandCursor: true });
      hit.on('pointerup', async () => {
        if (nested) return;
        audio.play('tap');
        if (!inventory.isUnlocked(id)) {
          showToast(scene, t('item.lockedToast', { item: itemName(id), n: ECONOMY.items[id].unlockLevel }));
          return;
        }
        if (inventory.count(id) === 0) {
          nested = true;
          const bought = await showBuyItem(scene, id);
          nested = false;
          if (bought) selected.add(id);
        } else if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        draw();
        scene.tweens.add({ targets: container, scale: { from: 1.12, to: 1 }, duration: 180, ease: 'Back.easeOut' });
      });
      popup.content.add(hit);
    });
    if (BOOSTER_IDS.some((id) => inventory.isUnlocked(id))) {
      popup.content.add(label(scene, 0, 295, t('start.boostersHint'), 32, '#8a5a2b'));
    }
    void popup.open();
  });
}

/** Ödülün simgeleri ve miktarları (günlük ödül kartı). */
function rewardIcons(scene: Phaser.Scene, reward: DailyRewardConfig, y: number, size: number): Phaser.GameObjects.GameObject[] {
  const entries = bundleEntries(reward).map(([texture, amount]): [string, string] => [texture, amount.replace(/^\+/, '')]);
  const spacing = size * 1.05;
  return entries.flatMap(([texture, amount], i) => {
    const x = (i - (entries.length - 1) / 2) * spacing;
    const icon = scene.add.image(x, y, texture).setDisplaySize(size, size);
    const text = scene.add
      .text(x, y + size * 0.55, amount, {
        fontFamily: FONT_FAMILY,
        fontSize: `${Math.round(size * 0.42)}px`,
        fontStyle: '700',
        color: '#ffffff',
        stroke: '#4a2a0c',
        strokeThickness: 7,
      })
      .setOrigin(0.5);
    return [icon, text];
  });
}

/**
 * Seviye hediye sandığı (her 10 seviyede, 50'nin katlarında büyük): sandık sallanıp açılır,
 * altın ve eşyalar sırayla çıkar. Ödül kayda zaten işlenmiştir; bu yalnızca gösterimdir.
 */
export function showLevelChest(scene: Phaser.Scene, levelId: number, reward: LevelReward): Promise<void> {
  return new Promise((resolve) => {
    const big = reward.chest === 'big';
    const popup = new Popup(scene, {
      title: t(big ? 'levelChest.bigTitle' : 'levelChest.title'),
      height: 900,
      buttons: [{ label: t('chest.collect'), variant: 'green', onClick: () => void popup.close().then(resolve) }],
    });
    popup.content.add(label(scene, 0, -335, t('levelChest.subtitle', { n: levelId }), 40));
    const glow = scene.add.image(0, -150, TEXTURES.ring).setTint(0xffd23f).setDisplaySize(260, 260).setAlpha(0);
    const chest = scene.add.image(0, -150, obstacleTexture('chest', 1)).setDisplaySize(big ? 270 : 230, big ? 270 : 230);
    popup.content.add([glow, chest]);

    const entries: [string, string][] = [];
    if (reward.coins > 0) entries.push([TEXTURES.coin, `+${reward.coins}`]);
    for (const [id, n] of Object.entries(reward.items) as [ItemId, number][]) entries.push([itemTexture(id), `×${n}`]);
    const prizes = entries.map(([texture, amount], i) => {
      const x = (i - (entries.length - 1) / 2) * 200;
      const icon = scene.add.image(x, -170, texture).setDisplaySize(110, 110);
      const scale = icon.scale;
      const text = scene.add
        .text(x, -90, amount, {
          fontFamily: FONT_FAMILY,
          fontSize: '50px',
          fontStyle: '700',
          color: '#ffffff',
          stroke: '#4a2a0c',
          strokeThickness: 10,
        })
        .setOrigin(0.5);
      icon.setScale(0);
      text.setAlpha(0);
      popup.content.add([icon, text]);
      return { icon, text, scale };
    });
    captainQuip(popup, scene, 'win', 120, t('levelChest.quip'));

    void popup.open().then(async () => {
      audio.play('chest');
      await tweenAsync(scene, { targets: chest, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 3 });
      await tweenAsync(scene, { targets: chest, scale: chest.scale * 1.3, alpha: 0, duration: 220 });
      scene.tweens.add({ targets: glow, alpha: 0.8, duration: 300 });
      scene.tweens.add({ targets: glow, angle: 360, duration: 5000, repeat: -1 });
      for (const prize of prizes) {
        audio.play('coin');
        await Promise.all([
          tweenAsync(scene, { targets: prize.icon, scale: prize.scale, duration: 300, ease: 'Back.easeOut' }),
          tweenAsync(scene, { targets: prize.text, alpha: 1, duration: 200 }),
        ]);
      }
    });
  });
}

/** Alınmış günün kartında ödülün üstüne büyük onay işareti. */
function claimedMark(scene: Phaser.Scene): Phaser.GameObjects.Image {
  return scene.add.image(0, 15, TEXTURES.check).setDisplaySize(84, 84);
}

/** Günlük ödül takvimi: 7 gün, bugünün kartı parlar → "Al". */
export function showDailyReward(scene: Phaser.Scene, daily: DailyReward): Promise<DailyRewardConfig | null> {
  return new Promise((resolve) => {
    const today = daily.dayIndex;
    let claimed = false;
    const popup = new Popup(scene, {
      title: t('daily.title'),
      width: 960,
      height: 1140,
      buttons: [
        {
          label: t('daily.claim'),
          variant: 'green',
          onClick: () => {
            if (claimed) return;
            claimed = true;
            const result = dispatch({ type: 'claimDaily', tz: new Date().getTimezoneOffset() });
            const reward = result.ok ? (result.value as DailyRewardConfig) : null;
            audio.play('coin');
            const card = cards[today];
            scene.tweens.killTweensOf(card);
            card.setScale(1);
            void tweenAsync(scene, { targets: card, scale: 1.15, duration: 160, yoyo: true, ease: 'Quad.easeOut' })
              .then(() => {
                card.add(claimedMark(scene));
                return waitMs(scene, 450);
              })
              .then(() => popup.close())
              .then(() => resolve(reward));
          },
        },
      ],
    });
    // Üst sırada 1-4. günler, alt sırada 5-6. günler ve geniş 7. gün kartı.
    const ROW2_X = [-310, -105, 205];
    const cards = daily.rewards.map((reward, i) => {
      const last = i === daily.rewards.length - 1;
      const row = i < 4 ? 0 : 1;
      const width = last ? 400 : 190;
      const x = row === 0 ? (i - 1.5) * 205 : ROW2_X[i - 4];
      const y = row === 0 ? -300 : -40;
      const past = i < today;
      const current = i === today;
      const card = scene.add.container(x, y);
      const bg = scene.add.graphics();
      bg.fillStyle(current ? 0xfff0c2 : past ? 0xe8dcc4 : 0xffffff, current ? 1 : 0.7).fillRoundedRect(-width / 2, -115, width, 230, 24);
      bg.lineStyle(current ? 7 : 3, current ? 0xf0a000 : 0xd9a066).strokeRoundedRect(-width / 2, -115, width, 230, 24);
      const day = scene.add
        .text(0, -85, t('daily.day', { n: i + 1 }), { fontFamily: FONT_FAMILY, fontSize: '30px', fontStyle: '700', color: INK })
        .setOrigin(0.5);
      card.add([bg, day, ...rewardIcons(scene, reward, 5, last ? 84 : 76)]);
      if (past) {
        card.setAlpha(0.7);
        card.add(claimedMark(scene));
      }
      if (current) scene.tweens.add({ targets: card, scale: 1.05, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      popup.content.add(card);
      return card;
    });
    captainQuip(popup, scene, 'win', 200, t('daily.quip'));
    void popup.open();
  });
}

/** Eşitleme durumunun metni ve rengi (ayarlardaki hesap bölümü). */
function syncStatusText(status: SyncStatus): [string, string] {
  if (sync.pending > 0 && status !== 'syncing') return [t('account.pending', { n: sync.pending }), '#b07800'];
  switch (status) {
    case 'synced':
      return [t('account.synced'), '#2e8b3d'];
    case 'syncing':
      return [t('account.syncing'), '#2e86de'];
    case 'unauthorized':
      return [t('account.expired'), RED];
    default:
      return [t('account.offline'), '#8a7a6a'];
  }
}

export type SettingsChoice = 'language' | 'logout' | 'reset' | 'createAccount' | 'deleteAccount' | null;

/**
 * Ayarlar: ses, müzik, titreşim, dil ve hesap (ad, e-posta ya da misafir durumu, eşitleme durumu,
 * çıkış ya da hesabı kaydetme, kaydı sıfırlama, hesabı silme) ve gizlilik/koşullar/destek bağlantıları.
 * 'language': dil değişti (çağıran sahne kendini yeniden başlatır); diğerleri oyuncunun seçtiği eylem
 * (sıfırlama ve silme için onay ayrıca sorulur); null: kapatıldı.
 */
export function showSettings(scene: Phaser.Scene): Promise<SettingsChoice> {
  return new Promise((resolve) => {
    let stopListening = () => undefined as unknown;
    const finish = (result: SettingsChoice) => {
      stopListening();
      void popup.close().then(() => resolve(result));
    };
    const popup = new Popup(scene, { title: t('settings.title'), height: 1640, onClose: () => finish(null) });
    const rows = [
      ['settings.sound', 'sound'],
      ['settings.music', 'music'],
      ['settings.vibration', 'vibration'],
    ] as const;
    rows.forEach(([key, setting], i) => {
      const y = -610 + i * 110;
      const name = scene.add
        .text(-330, y, t(key), { fontFamily: FONT_FAMILY, fontSize: '44px', fontStyle: '700', color: INK })
        .setOrigin(0, 0.5);
      popup.content.add([name, new Toggle(scene, 250, y, settings[setting], (on) => settings.setToggle(setting, on))]);
    });
    popup.content.add(label(scene, 0, -285, t('settings.language'), 44));
    const languages: [Language, string][] = [
      ['tr', 'Türkçe'],
      ['en', 'English'],
    ];
    languages.forEach(([language, name], i) => {
      const current = settings.language === language;
      const button = new TextButton(
        scene,
        (i - 0.5) * 320,
        -190,
        name,
        () => {
          if (current) return;
          settings.setLanguage(language);
          finish('language');
        },
        { width: 290, height: 96, fontSize: 40, variant: current ? 'green' : 'orange' },
      );
      popup.content.add(button);
    });

    // Hesap
    popup.content.add(scene.add.graphics().lineStyle(4, 0xd9a066, 0.8).lineBetween(-340, -110, 340, -110));
    const user = currentUser();
    const guest = isGuest();
    popup.content.add(label(scene, 0, -60, t('account.title'), 44));
    popup.content.add(label(scene, 0, 0, user?.displayName ?? '-', 40, '#2e86de'));
    popup.content.add(label(scene, 0, 52, guest ? t('account.guest') : (user?.email ?? ''), 28, guest ? '#b07800' : '#8a7a6a', 760));
    const status = label(scene, 0, 104, '', 28);
    popup.content.add(status);
    const showStatus = (s: SyncStatus) => {
      const [text, color] = syncStatusText(s);
      status.setText(text).setColor(color);
    };
    showStatus(sync.state);
    stopListening = sync.onStatus(showStatus);
    const half = { width: 370, height: 96, fontSize: 36 };
    // Misafir çıkış yaparsa hesabına bir daha giremez: çıkış yerine hesabı kaydetme sunulur.
    popup.content.add(
      guest
        ? new TextButton(scene, -195, 205, t('account.createAccount'), () => finish('createAccount'), { ...half, variant: 'green' })
        : new TextButton(scene, -195, 205, t('account.logout'), () => finish('logout'), half),
    );
    popup.content.add(new TextButton(scene, 195, 205, t('account.reset'), () => finish('reset'), half));
    popup.content.add(new TextButton(scene, 0, 320, t('account.delete'), () => finish('deleteAccount'), { width: 500, height: 96, fontSize: 36 }));
    popup.content.add(label(scene, 0, 410, t('account.dangerHint'), 26, '#8a7a6a', 760));

    // Gizlilik / koşullar / destek (tarayıcıda açılır).
    const links: [I18nKey, LegalPage][] = [
      ['account.privacy', 'privacy'],
      ['account.terms', 'terms'],
      ['account.support', 'support'],
    ];
    links.forEach(([key, page], i) => {
      const link = label(scene, (i - 1) * 240, 500, t(key), 32, '#2e86de').setInteractive({ useHandCursor: true });
      link.on('pointerup', () => openExternal(legalUrl(page)));
      popup.content.add(link);
    });
    popup.content.add(label(scene, 0, 575, t('settings.version', { v: APP_VERSION }), 28, '#8a7a6a'));
    void popup.open();
  });
}

/** Geri alınamaz işlem onayı (kaydı sıfırlama, hesabı silme). Onaylanırsa true. */
export function showConfirm(scene: Phaser.Scene, options: { title: string; message: string; confirm: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (value: boolean) => void popup.close().then(() => resolve(value));
    const popup = new Popup(scene, {
      title: options.title,
      height: 780,
      onClose: () => finish(false),
      buttons: [
        { label: t('reset.cancel'), variant: 'green', onClick: () => finish(false) },
        { label: options.confirm, onClick: () => finish(true) },
      ],
    });
    popup.content.add(scene.add.image(0, -170, TEXTURES.captain).setDisplaySize(170, 170));
    popup.content.add(label(scene, 0, 30, options.message, 36, RED, 700));
    void popup.open();
  });
}
