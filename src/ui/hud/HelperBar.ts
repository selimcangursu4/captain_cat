import Phaser from 'phaser';
import { TEXTURES, itemTexture } from '../../assets/AssetManifest';
import { ECONOMY, HELPER_IDS, type HelperId } from '../../config/economy';
import { HUD } from '../../config/layout';
import { FONT_FAMILY, UI_COLORS } from '../../config/theme';
import { t } from '../../i18n';
import type { Inventory } from '../../meta/Inventory';
import { IconButton } from '../components/IconButton';

const DEPTH = 30;

interface Slot {
  readonly button: IconButton;
  readonly badge: Phaser.GameObjects.Container;
  readonly badgeText: Phaser.GameObjects.Text;
  readonly plus: Phaser.GameObjects.Image;
  readonly lock: Phaser.GameObjects.Image;
  readonly lockText: Phaser.GameObjects.Text;
}

/**
 * Tahtanın altındaki bölüm içi yardımcılar: Kürek, Dümen, Fırtına.
 * Her birinde kalan adet (bitince "+"), kilitliyse açılacağı bölüm yazar.
 */
export class HelperBar {
  private readonly slots = new Map<HelperId, Slot>();
  private readonly hint: Phaser.GameObjects.Text;
  private active: HelperId | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly inventory: Inventory,
    onTap: (id: HelperId) => void,
  ) {
    for (const id of HELPER_IDS) {
      const button = new IconButton(scene, 0, 0, itemTexture(id), () => onTap(id), { size: HUD.helperSize, iconScale: 0.7 });
      button.setDepth(DEPTH);
      const offset = HUD.helperSize * 0.36;
      const circle = scene.add.circle(0, 0, 30, 0xffffff).setStrokeStyle(5, 0x0d4466);
      const badgeText = scene.add
        .text(0, -1, '0', { fontFamily: FONT_FAMILY, fontSize: '36px', fontStyle: '700', color: '#0d4466' })
        .setOrigin(0.5);
      const badge = scene.add.container(offset, offset, [circle, badgeText]);
      const plus = scene.add.image(offset, offset, TEXTURES.plus).setDisplaySize(62, 62);
      const lock = scene.add.image(0, 0, TEXTURES.lock).setDisplaySize(64, 64);
      const lockText = scene.add
        .text(0, HUD.helperSize / 2 + 4, t('item.lockedAt', { n: ECONOMY.items[id].unlockLevel }), {
          fontFamily: FONT_FAMILY,
          fontSize: '28px',
          fontStyle: '700',
          color: UI_COLORS.titleText,
          stroke: UI_COLORS.titleStroke,
          strokeThickness: 6,
        })
        .setOrigin(0.5, 0);
      button.add([badge, plus, lock, lockText]);
      this.slots.set(id, { button, badge, badgeText, plus, lock, lockText });
    }
    this.hint = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        fontStyle: '700',
        color: UI_COLORS.bannerText,
        stroke: UI_COLORS.titleStroke,
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH)
      .setVisible(false);
    this.refresh();
  }

  /** center: çubuğun ortası. */
  layout(x: number, y: number): void {
    HELPER_IDS.forEach((id, i) => this.slots.get(id)!.button.setPosition(x + (i - 1) * HUD.helperGap, y));
    this.hint.setPosition(x, y - HUD.helperSize / 2 - 46);
  }

  /** Adetleri ve kilitleri günceller. */
  refresh(): void {
    for (const [id, slot] of this.slots) {
      const unlocked = this.inventory.isUnlocked(id);
      const count = this.inventory.count(id);
      slot.button.setDimmed(!unlocked);
      slot.lock.setVisible(!unlocked);
      slot.lockText.setVisible(!unlocked);
      slot.badge.setVisible(unlocked && count > 0);
      slot.plus.setVisible(unlocked && count === 0);
      slot.badgeText.setText(String(count));
    }
  }

  /** Hedef bekleyen yardımcıyı vurgular ve üstünde ne yapılacağını yazar. */
  setActive(id: HelperId | null): void {
    if (this.active) {
      const previous = this.slots.get(this.active)!.button;
      this.scene.tweens.killTweensOf(previous);
      previous.setScale(1).setHighlighted(false);
    }
    this.active = id;
    this.hint.setVisible(id !== null);
    if (!id) return;
    const button = this.slots.get(id)!.button.setHighlighted(true);
    this.hint.setText(t(id === 'shovel' ? 'helper.hint.shovel' : 'helper.hint.helm'));
    this.scene.tweens.add({ targets: button, scale: 1.08, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  setVisible(visible: boolean): void {
    for (const slot of this.slots.values()) slot.button.setVisible(visible);
    if (!visible) this.hint.setVisible(false);
  }

  /** Yardımcının ekrandaki yeri (efekt başlangıcı). */
  pointOf(id: HelperId): { x: number; y: number } {
    const b = this.slots.get(id)!.button;
    return { x: b.x, y: b.y };
  }
}
