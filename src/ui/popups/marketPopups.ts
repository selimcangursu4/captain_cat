import Phaser from 'phaser';
import { TEXTURES, chestTexture, itemTexture, materialTexture, shipUpgradeTexture } from '../../assets/AssetManifest';
import {
  CHEST_IDS,
  ECONOMY,
  MATERIAL_IDS,
  SHIP_UPGRADE_IDS,
  type ChestId,
  type MaterialId,
  type RewardBundle,
  type ShipUpgradeId,
} from '../../config/economy';
import { FONT_FAMILY } from '../../config/theme';
import { getLanguage, t, type I18nKey } from '../../i18n';
import { marketBundle, nextShipLevel, shipBonus } from '../../meta/pricing';
import { canBreakPiggy } from '../../meta/purchases';
import { market, townProgress } from '../../meta/progress';
import { buyProduct, loadStorePrices, purchasesAvailable, retryPendingPurchases, type PurchaseResult } from '../../net/purchases';
import { dispatch } from '../../net/sync';
import { audio } from '../../services/Audio';
import { saveService } from '../../services/SaveService';
import { wallet } from '../../services/Wallet';
import { Popup } from '../components/Popup';
import { TextButton } from '../components/TextButton';
import { showToast } from '../components/toast';
import { confetti } from '../effects/celebrate';
import { formatNumber } from '../format';
import { tweenAsync, waitMs } from '../tweens';
import { INK, label } from './levelPopups';
import { bundleEntries, materialName, outlinedText } from './rewardViews';

const GOLD = '#b07800';
const MUTED = '#8a7a6a';

/** Beyaz yarı saydam kart zemini. */
function card(scene: Phaser.Scene, x: number, y: number, width: number, height: number, accent = 0xd9a066): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.75).fillRoundedRect(x - width / 2, y - height / 2, width, height, 26);
  g.lineStyle(4, accent).strokeRoundedRect(x - width / 2, y - height / 2, width, height, 26);
  return g;
}

function leftText(scene: Phaser.Scene, x: number, y: number, value: string, size: number, color = INK, wrap?: number) {
  return scene.add
    .text(x, y, value, { fontFamily: FONT_FAMILY, fontSize: `${size}px`, fontStyle: '700', color, wordWrap: wrap ? { width: wrap } : undefined })
    .setOrigin(0, 0.5);
}

/** Üstteki bakiye satırı (yıldız ve altın); kayıt değişince güncellenir. */
function balanceRow(scene: Phaser.Scene, popup: Popup, y: number, show: { stars: boolean }): () => void {
  const row = scene.add.container(0, y);
  popup.content.add(row);
  const draw = () => {
    row.removeAll(true);
    const items: [string, number][] = [];
    if (show.stars) items.push([TEXTURES.star, wallet.stars]);
    items.push([TEXTURES.coin, wallet.coins]);
    items.forEach(([texture, value], i) => {
      const x = (i - (items.length - 1) / 2) * 300;
      const pill = scene.add.graphics();
      pill.fillStyle(0x06263d, 0.18).fillRoundedRect(x - 130, -38, 260, 76, 38);
      row.add([pill, scene.add.image(x - 90, 0, texture).setDisplaySize(68, 68), leftText(scene, x - 45, 0, formatNumber(value), 44)]);
    });
  };
  draw();
  return saveService.onChange(draw);
}

// ───────────────────────── Mağaza (gerçek para → altın) ─────────────────────────

/** Satın alma sonucunu oyuncuya bildirir. */
function reportPurchase(scene: Phaser.Scene, outcome: PurchaseResult): void {
  switch (outcome.outcome) {
    case 'ok':
      audio.play('coin');
      confetti(scene);
      showToast(scene, t('shop.thanks', { n: formatNumber(outcome.coins ?? 0) }));
      return;
    case 'pending':
      showToast(scene, t('shop.pending'));
      return;
    case 'unavailable':
      showToast(scene, t('shop.unavailable'));
      return;
    case 'failed':
      showToast(scene, t('shop.failed'));
      return;
    case 'cancelled':
      return;
  }
}

/**
 * Mağaza: yalnızca altın satılır (gerçek para). Altın paketleri + kumbara. Ödeme mağazada yapılır,
 * altın sunucu ödemeyi doğruladıktan sonra hesaba eklenir (src/net/purchases.ts).
 */
export function showShop(scene: Phaser.Scene): Promise<void> {
  return new Promise((resolve) => {
    let buying = false;
    const height = 1560;
    const popup = new Popup(scene, {
      title: t('shop.title'),
      width: 960,
      height,
      onClose: () => {
        if (buying) return;
        stopBalance();
        void popup.close().then(resolve);
      },
    });
    const stopBalance = balanceRow(scene, popup, -640, { stars: false });
    const language = getLanguage();
    const priceButtons = new Map<string, TextButton>();

    const purchase = async (productId: string, button: TextButton, label: string) => {
      if (buying) return;
      buying = true;
      button.setLabel(t('shop.processing'));
      const result = await buyProduct(productId);
      buying = false;
      if (!popup.content.active) return;
      button.setLabel(label);
      reportPurchase(scene, result);
      drawPiggy();
    };

    ECONOMY.shop.forEach((pack, i) => {
      const x = (i % 2 === 0 ? -1 : 1) * 218;
      const y = -440 + Math.floor(i / 2) * 280;
      const c = scene.add.container(x, y);
      c.add(card(scene, 0, 0, 410, 260, pack.tag ? 0xf0a000 : 0xd9a066));
      const pile = Math.min(5, i + 1);
      for (let k = 0; k < pile; k++) {
        c.add(scene.add.image((k - (pile - 1) / 2) * 34, -66 - (k % 2) * 14, TEXTURES.coin).setDisplaySize(78, 78));
      }
      c.add(label(scene, 0, 5, formatNumber(pack.coins), 48, GOLD));
      const price = pack.price[language];
      const button = new TextButton(scene, 0, 82, price, () => void purchase(pack.id, button, priceButtons.get(pack.id)?.getData('price') ?? price), {
        width: 260,
        height: 80,
        fontSize: 34,
        variant: 'green',
      });
      button.setData('price', price);
      priceButtons.set(pack.id, button);
      c.add(button);
      if (pack.tag) {
        c.add(
          scene.add
            .text(-185, -130, t(pack.tag === 'popular' ? 'shop.popular' : 'shop.best'), {
              fontFamily: FONT_FAMILY,
              fontSize: '28px',
              fontStyle: '700',
              color: '#ffffff',
              backgroundColor: '#e74c3c',
              padding: { x: 14, y: 6 },
            })
            .setOrigin(0, 0.5)
            .setAngle(-6),
        );
      }
      popup.content.add(c);
    });

    // Kumbara: her yeni seviyede dolar; en az minBreak birikince gerçek parayla kırılır.
    const piggy = scene.add.container(0, 410);
    popup.content.add(piggy);
    const piggyPrice = ECONOMY.piggyBank.price[language];
    let piggyButton: TextButton | null = null;
    const drawPiggy = () => {
      piggy.removeAll(true);
      const { coins } = saveService.data.piggyBank;
      const { maxCoins, minBreak, coinsPerWin, productId } = ECONOMY.piggyBank;
      const ready = canBreakPiggy(saveService);
      piggy.add(card(scene, 0, 0, 860, 250, ready ? 0x2e8b3d : 0xd9a066));
      piggy.add(scene.add.image(-330, -5, TEXTURES.piggy).setDisplaySize(150, 150));
      piggy.add(leftText(scene, -235, -78, t('piggy.title'), 40));
      piggy.add(leftText(scene, -235, -30, t('piggy.desc', { n: coinsPerWin }), 26, MUTED, 340));
      const barW = 330;
      const fraction = Math.min(1, coins / maxCoins);
      const bar = scene.add.graphics();
      bar.fillStyle(0x06263d, 0.2).fillRoundedRect(-235, 30, barW, 34, 17);
      bar.fillStyle(0xffd23f, 1).fillRoundedRect(-235, 30, Math.max(34, barW * fraction), 34, 17);
      bar.lineStyle(3, 0xd9a066).strokeRoundedRect(-235, 30, barW, 34, 17);
      piggy.add(bar);
      piggy.add(label(scene, -235 + barW / 2, 47, `${formatNumber(coins)} / ${formatNumber(maxCoins)}`, 24, INK));
      piggy.add(leftText(scene, -235, 92, ready ? t('piggy.ready') : t('piggy.locked', { n: formatNumber(minBreak) }), 24, ready ? '#2e8b3d' : MUTED));
      const price = piggyButton?.getData('price') ?? piggyPrice;
      piggyButton = new TextButton(scene, 270, 0, ready ? price : t('piggy.break'), () => {
        if (!canBreakPiggy(saveService)) {
          showToast(scene, t('piggy.locked', { n: formatNumber(minBreak) }));
          return;
        }
        void purchase(productId, piggyButton!, price);
      }, { width: 250, height: 96, fontSize: 36, variant: ready ? 'green' : 'orange' });
      piggyButton.setData('price', price);
      piggyButton.setAlpha(ready ? 1 : 0.6);
      piggy.add(piggyButton);
    };
    drawPiggy();

    const note = !purchasesAvailable() ? t('shop.unavailable') : import.meta.env.DEV ? t('shop.sandbox') : t('shop.secure');
    popup.content.add(label(scene, 0, 610, note, 26, MUTED, 820));

    // Mağazanın yerel fiyatları (yüklenemezse yedek fiyatlar kalır) ve bekleyen ödemeler.
    void loadStorePrices().then((prices) => {
      if (!popup.content.active) return;
      for (const [id, button] of priceButtons) {
        if (!prices[id]) continue;
        button.setData('price', prices[id]).setLabel(prices[id]);
      }
      if (prices[ECONOMY.piggyBank.productId] && piggyButton) {
        piggyButton.setData('price', prices[ECONOMY.piggyBank.productId]);
        drawPiggy();
      }
    });
    void retryPendingPurchases().then((coins) => {
      if (coins > 0 && popup.content.active) reportPurchase(scene, { outcome: 'ok', coins });
    });
    void popup.open();
  });
}

// ───────────────────────── Pazar (altın / yıldız → malzeme, sandık, gemi) ─────────────────────────

export type MarketTab = 'materials' | 'stars' | 'chests' | 'ship';
const TABS: readonly MarketTab[] = ['materials', 'stars', 'chests', 'ship'];

/** Pazar kapanınca: 'shop' ise altın yetmedi, oyuncu mağazaya yönlendirilir. */
export type MarketExit = 'shop' | null;

/**
 * Pazar: malzemeler (yıldızla), yıldız (altınla), sandıklar (altınla, rastgele ödül) ve gemi
 * atölyesi (altınla kalıcı yükseltme). Sekmeler aynı pencerede; her şey pencerenin içine sığar.
 */
export function showMarket(scene: Phaser.Scene, initial: MarketTab = 'materials'): Promise<MarketExit> {
  return new Promise((resolve) => {
    let tab = initial;
    let nested = false;
    let stopBalance = () => undefined as unknown;
    const height = 1660;
    const finish = (value: MarketExit) => {
      stopBalance();
      void popup.close().then(() => resolve(value));
    };
    const popup = new Popup(scene, { title: t('market.title'), width: 980, height, onClose: () => !nested && finish(null) });
    stopBalance = balanceRow(scene, popup, -690, { stars: true });

    const tabs = scene.add.container(0, -585);
    const body = scene.add.container(0, 0);
    popup.content.add([tabs, body]);

    const notEnough = (currency: 'stars' | 'coins') => {
      showToast(scene, t(currency === 'stars' ? 'error.starsMarket' : 'error.coins'));
      if (currency === 'stars') draw('stars');
    };

    const drawTabs = () => {
      tabs.removeAll(true);
      TABS.forEach((id, i) => {
        const button = new TextButton(scene, (i - 1.5) * 228, 0, t(`market.tab.${id}` as I18nKey), () => draw(id), {
          width: 216,
          height: 92,
          fontSize: 34,
          variant: id === tab ? 'green' : 'orange',
        });
        tabs.add(button);
      });
    };

    const drawMaterials = () => {
      body.add(label(scene, 0, -505, t('market.materialsHint'), 28, MUTED, 860));
      MATERIAL_IDS.forEach((id, i) => {
        const y = -405 + i * 146;
        body.add(card(scene, 0, y, 900, 134));
        body.add(scene.add.image(-385, y, materialTexture(id)).setDisplaySize(104, 104));
        body.add(leftText(scene, -315, y - 22, materialName(id), 36));
        body.add(leftText(scene, -315, y + 24, t('market.owned', { n: townProgress.materials[id] }), 26, MUTED));
        ECONOMY.market.forEach((_, bundle) => {
          const offer = marketBundle(id, bundle)!;
          const button = new TextButton(scene, 110 + bundle * 230, y, t('market.bundle', { n: offer.amount, cost: offer.stars }), () => buyMaterial(id, bundle), {
            width: 214,
            height: 88,
            fontSize: 32,
            variant: bundle === 1 ? 'green' : 'orange',
            icon: TEXTURES.star,
          });
          body.add(button);
        });
      });
    };

    const buyMaterial = (id: MaterialId, bundle: number) => {
      const offer = marketBundle(id, bundle)!;
      if (wallet.stars < offer.stars) return notEnough('stars');
      if (!dispatch({ type: 'buyMaterial', material: id, bundle }).ok) return;
      audio.play('coin');
      showToast(scene, t('market.bought', { n: offer.amount, item: materialName(id) }));
      draw('materials');
    };

    const drawStars = () => {
      body.add(scene.add.image(0, -400, TEXTURES.star).setDisplaySize(170, 170));
      body.add(label(scene, 0, -265, t('market.starsHint'), 30, INK, 820));
      ECONOMY.starPacks.forEach((pack, i) => {
        const x = (i - 1) * 300;
        const y = -20;
        body.add(card(scene, x, y, 280, 330, i === 2 ? 0xf0a000 : 0xd9a066));
        const pile = Math.min(3, i + 1);
        for (let k = 0; k < pile; k++) body.add(scene.add.image(x + (k - (pile - 1) / 2) * 46, y - 95 - (k % 2) * 12, TEXTURES.star).setDisplaySize(86, 86));
        body.add(outlinedText(scene, x, y + 10, `+${pack.stars}`, 56, '#ffe066'));
        body.add(
          new TextButton(scene, x, y + 105, formatNumber(pack.coins), () => buyStars(i), {
            width: 230,
            height: 88,
            fontSize: 36,
            variant: 'green',
            icon: TEXTURES.coin,
          }),
        );
      });
      body.add(label(scene, 0, 260, t('market.starsInfo'), 28, MUTED, 820));
    };

    const buyStars = (pack: number) => {
      const offer = ECONOMY.starPacks[pack];
      if (wallet.coins < offer.coins) {
        showToast(scene, t('error.coins'));
        finish('shop');
        return;
      }
      if (!dispatch({ type: 'buyStars', pack }).ok) return;
      audio.play('star');
      showToast(scene, t('market.starsBought', { n: offer.stars }));
      draw('stars');
    };

    const drawChests = () => {
      body.add(label(scene, 0, -505, t('market.chestsHint'), 28, MUTED, 860));
      CHEST_IDS.forEach((id, i) => {
        const y = -300 + i * 330;
        const config = ECONOMY.chests[id];
        body.add(card(scene, 0, y, 900, 300, i === 2 ? 0x9b59b6 : i === 1 ? 0x3b8fd9 : 0xd9a066));
        body.add(scene.add.image(-330, y - 10, chestTexture(id)).setDisplaySize(190, 190));
        body.add(leftText(scene, -200, y - 95, t(`chest.${id}` as I18nKey), 40));
        body.add(leftText(scene, -200, y - 45, t('chest.rolls', { n: config.rolls }), 28, MUTED));
        const guaranteed = bundleEntries(config.guaranteed);
        if (guaranteed.length > 0) {
          const title = leftText(scene, -200, y + 2, t('chest.guaranteed'), 26, '#2e8b3d');
          body.add(title);
          guaranteed.forEach(([texture, amount], k) => {
            const gx = -200 + title.width + 40 + k * 110;
            body.add(scene.add.image(gx, y + 2, texture).setDisplaySize(48, 48));
            body.add(leftText(scene, gx + 28, y + 2, amount, 26, INK));
          });
        }
        // Çıkabilecekler: simge şeridi.
        const kinds = [...new Set(config.drops.map((d) => d.kind))];
        const textures: Record<string, string> = {
          material: materialTexture('wood'),
          coins: TEXTURES.coin,
          item: itemTexture('harpoon'),
          lives: TEXTURES.heart,
          stars: TEXTURES.star,
        };
        body.add(leftText(scene, -200, y + 52, t('chest.contains'), 26, MUTED));
        kinds.forEach((kind, k) => body.add(scene.add.image(-200 + 27 + k * 64, y + 102, textures[kind]).setDisplaySize(54, 54)));
        body.add(
          new TextButton(scene, 300, y + 85, formatNumber(config.price), () => void openChest(id), {
            width: 230,
            height: 92,
            fontSize: 38,
            variant: 'green',
            icon: TEXTURES.coin,
          }),
        );
      });
    };

    const openChest = async (id: ChestId) => {
      if (wallet.coins < ECONOMY.chests[id].price) {
        showToast(scene, t('error.coins'));
        finish('shop');
        return;
      }
      const result = dispatch({ type: 'openChest', chest: id });
      if (!result.ok) return;
      nested = true;
      await showChestReward(scene, id, result.value as RewardBundle);
      nested = false;
      draw('chests');
    };

    const drawShip = () => {
      body.add(label(scene, 0, -505, t('market.shipHint'), 28, MUTED, 860));
      SHIP_UPGRADE_IDS.forEach((id, i) => {
        const y = -300 + i * 330;
        const level = market.shipLevel(id);
        const max = ECONOMY.ship[id].levels.length;
        const next = nextShipLevel(id, level);
        body.add(card(scene, 0, y, 900, 300, 0x3b8fd9));
        body.add(scene.add.image(-330, y - 10, shipUpgradeTexture(id)).setDisplaySize(170, 170));
        body.add(leftText(scene, -200, y - 95, t(`ship.${id}` as I18nKey), 40));
        body.add(leftText(scene, 60, y - 95, t('ship.level', { n: level, max }), 30, '#2e86de'));
        // Seviye noktaları
        for (let k = 0; k < max; k++) {
          body.add(scene.add.circle(250 + k * 40, y - 95, 13, k < level ? 0xffd23f : 0xffffff).setStrokeStyle(4, 0x8a5a00));
        }
        const now = shipBonus(id, level);
        body.add(leftText(scene, -200, y - 35, level > 0 ? shipEffect(id, now) : t('ship.none'), 28, INK, 380));
        if (next) {
          body.add(leftText(scene, -200, y + 30, t('ship.next', { effect: shipEffect(id, next.bonus) }), 26, '#2e8b3d', 380));
          body.add(
            new TextButton(scene, 300, y + 85, formatNumber(next.cost), () => upgrade(id), {
              width: 230,
              height: 92,
              fontSize: 38,
              variant: 'green',
              icon: TEXTURES.coin,
            }),
          );
        } else {
          body.add(label(scene, 300, y + 85, t('ship.max'), 32, GOLD));
        }
      });
    };

    const upgrade = (id: ShipUpgradeId) => {
      const next = nextShipLevel(id, market.shipLevel(id));
      if (!next) return;
      if (wallet.coins < next.cost) {
        showToast(scene, t('error.coins'));
        finish('shop');
        return;
      }
      if (!dispatch({ type: 'upgradeShip', upgrade: id }).ok) return;
      audio.play('build');
      confetti(scene);
      showToast(scene, t('ship.upgraded', { name: t(`ship.${id}` as I18nKey), n: next.level }));
      draw('ship');
    };

    const draw = (next: MarketTab) => {
      if (nested) return;
      if (next !== tab) audio.play('tap');
      tab = next;
      drawTabs();
      body.removeAll(true);
      if (tab === 'materials') drawMaterials();
      else if (tab === 'stars') drawStars();
      else if (tab === 'chests') drawChests();
      else drawShip();
    };

    draw(tab);
    void popup.open();
  });
}

/** Gemi yükseltmesinin etkisi ("Bölüm altınına +%10"). */
export function shipEffect(id: ShipUpgradeId, bonus: number): string {
  return t(`ship.effect.${id}` as I18nKey, { n: bonus });
}

/** Sandık açılışı: sandık sallanıp açılır, ödüller sırayla belirir. Ödül kayda zaten işlenmiştir. */
export function showChestReward(scene: Phaser.Scene, id: ChestId, reward: RewardBundle): Promise<void> {
  return new Promise((resolve) => {
    const entries = bundleEntries(reward);
    const rows = Math.ceil(entries.length / 4);
    const height = 760 + rows * 190;
    const popup = new Popup(scene, {
      title: t(`chest.${id}` as I18nKey),
      height,
      buttons: [{ label: t('chest.collect'), variant: 'green', onClick: () => void popup.close().then(resolve) }],
    });
    const top = -height / 2 + 280;
    const glow = scene.add.image(0, top, TEXTURES.ring).setTint(0xffd23f).setDisplaySize(300, 300).setAlpha(0);
    const chest = scene.add.image(0, top, chestTexture(id)).setDisplaySize(240, 240);
    popup.content.add([glow, chest]);
    const prizes = entries.map(([texture, amount], i) => {
      const row = Math.floor(i / 4);
      const inRow = Math.min(4, entries.length - row * 4);
      const x = ((i % 4) - (inRow - 1) / 2) * 190;
      const y = top + 220 + row * 190;
      const icon = scene.add.image(x, y, texture).setDisplaySize(110, 110);
      const scale = icon.scale;
      const text = outlinedText(scene, x, y + 72, amount, 44);
      icon.setScale(0);
      text.setAlpha(0);
      popup.content.add([icon, text]);
      return { icon, text, scale };
    });
    void popup.open().then(async () => {
      audio.play('chest');
      await tweenAsync(scene, { targets: chest, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 3 });
      await tweenAsync(scene, { targets: chest, scale: chest.scale * 1.3, alpha: 0, duration: 220 });
      scene.tweens.add({ targets: glow, alpha: 0.8, duration: 300 });
      scene.tweens.add({ targets: glow, angle: 360, duration: 5000, repeat: -1 });
      for (const prize of prizes) {
        audio.play('coin');
        await Promise.all([
          tweenAsync(scene, { targets: prize.icon, scale: prize.scale, duration: 260, ease: 'Back.easeOut' }),
          tweenAsync(scene, { targets: prize.text, alpha: 1, duration: 180 }),
        ]);
        await waitMs(scene, 60);
      }
    });
  });
}
