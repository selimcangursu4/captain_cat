import Phaser from 'phaser';
import { TEXTURES } from '../../assets/AssetManifest';
import { HUD } from '../../config/layout';
import { FONT_FAMILY, UI_COLORS } from '../../config/theme';
import type { GoalDelta, GoalState, Pos } from '../../core';
import { t } from '../../i18n';
import { audio } from '../../services/Audio';
import { tweenAsync, waitMs } from '../tweens';
import { goalIconTexture } from './goalIcon';

type Point = { x: number; y: number };

interface GoalSlot {
  readonly icon: Phaser.GameObjects.Image;
  readonly count: Phaser.GameObjects.Text;
  readonly check: Phaser.GameObjects.Image;
  readonly texture: string;
  shown: number;
  /** Simgenin normal ölçeği (nabız animasyonları üst üste binince büyümesin diye). */
  baseScale: number;
}

const DEPTH = 30;
const FLY_DEPTH = 40;
const PANEL_SLICE = 40;

/**
 * Oyun ekranının üst paneli: hamle sayacı, bölüm hedefleri ve duraklat butonu.
 * Hedef sayaçları, tahtadan uçan simgeler panele vardıkça azalır.
 */
export class GameHud {
  private readonly movesPanel: Phaser.GameObjects.NineSlice;
  private readonly movesLabel: Phaser.GameObjects.Text;
  private readonly movesText: Phaser.GameObjects.Text;
  private readonly goalsPanel: Phaser.GameObjects.NineSlice;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly pauseButton: Phaser.GameObjects.Image;
  private slots: GoalSlot[] = [];
  private center: Point = { x: 0, y: 0 };
  private lowPulse: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    onPause: () => void,
  ) {
    const panel = (w: number, h: number) =>
      scene.add
        .nineslice(0, 0, TEXTURES.hudPanel, undefined, w, h, PANEL_SLICE, PANEL_SLICE, PANEL_SLICE, PANEL_SLICE)
        .setDepth(DEPTH);
    this.movesPanel = panel(HUD.movesWidth, HUD.panelHeight);
    this.goalsPanel = panel(HUD.goalsWidth, HUD.panelHeight);

    const text = (size: number, color: string = UI_COLORS.titleText) =>
      scene.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          fontSize: `${size}px`,
          fontStyle: '700',
          color,
          stroke: UI_COLORS.titleStroke,
          strokeThickness: Math.round(size / 6),
        })
        .setOrigin(0.5)
        .setDepth(DEPTH + 1);
    this.movesLabel = text(34, UI_COLORS.bannerText).setText(t('hud.moves'));
    this.movesText = text(96);
    this.levelText = text(32, UI_COLORS.bannerText);

    this.pauseButton = scene.add
      .image(0, 0, TEXTURES.pause)
      .setDepth(DEPTH)
      .setDisplaySize(HUD.pauseSize, HUD.pauseSize)
      .setInteractive({ useHandCursor: true });
    this.pauseButton.on('pointerup', onPause);
  }

  /** Bölümün hedeflerini ve hamle sayısını gösterir (yeni bölümde çağrılır). */
  setLevel(levelId: number, goals: readonly GoalState[], moves: number): void {
    for (const slot of this.slots) {
      slot.icon.destroy();
      slot.count.destroy();
      slot.check.destroy();
    }
    this.levelText.setText(t('level.title', { n: levelId }));
    this.slots = goals.map((state) => {
      const texture = goalIconTexture(state.goal);
      const icon = this.scene.add.image(0, 0, texture).setDepth(DEPTH + 1);
      const count = this.scene.add
        .text(0, 0, String(state.remaining), {
          fontFamily: FONT_FAMILY,
          fontSize: '46px',
          fontStyle: '700',
          color: UI_COLORS.titleText,
          stroke: UI_COLORS.titleStroke,
          strokeThickness: 9,
        })
        .setOrigin(0.5)
        .setDepth(DEPTH + 2);
      const check = this.scene.add.image(0, 0, TEXTURES.check).setDepth(DEPTH + 2).setVisible(false);
      return { icon, count, check, texture, shown: state.remaining, baseScale: 1 };
    });
    this.setMoves(moves, false);
    this.layout(this.center);
  }

  /** center: üst panelin yatay merkezi ve dikey ortası. */
  layout(center: Point): void {
    this.center = center;
    const { x, y } = center;
    const half = HUD.contentWidth / 2;
    const movesX = x - half + HUD.movesWidth / 2;
    this.movesPanel.setPosition(movesX, y);
    this.movesLabel.setPosition(movesX, y - HUD.panelHeight * 0.3);
    this.movesText.setPosition(movesX, y + HUD.panelHeight * 0.1);

    const pauseX = x + half - HUD.pauseSize / 2;
    this.pauseButton.setPosition(pauseX, y - HUD.panelHeight / 2 + HUD.pauseSize / 2);

    const goalsLeft = x - half + HUD.movesWidth + HUD.gap;
    const goalsX = goalsLeft + HUD.goalsWidth / 2;
    this.goalsPanel.setPosition(goalsX, y);
    this.levelText.setPosition(goalsX, y - HUD.panelHeight * 0.33);

    const slotWidth = Math.min(HUD.goalSlotWidth, (HUD.goalsWidth - 40) / Math.max(1, this.slots.length));
    this.slots.forEach((slot, i) => {
      const sx = goalsX + (i - (this.slots.length - 1) / 2) * slotWidth;
      const sy = y + HUD.panelHeight * 0.08;
      slot.icon.setPosition(sx, sy).setDisplaySize(HUD.goalIconSize, HUD.goalIconSize);
      slot.baseScale = slot.icon.scale;
      slot.count.setPosition(sx + HUD.goalIconSize * 0.38, sy + HUD.goalIconSize * 0.38);
      slot.check.setPosition(sx + HUD.goalIconSize * 0.36, sy + HUD.goalIconSize * 0.36).setDisplaySize(56, 56);
    });
  }

  setMoves(moves: number, animate = true): void {
    this.movesText.setText(String(moves));
    const low = moves <= HUD.lowMoves;
    this.movesText.setColor(low ? '#ffb3b3' : UI_COLORS.titleText);
    if (animate) this.pulse(this.movesText, 1, 1.25);
    // Az hamle kalınca panel kalp atışı gibi nabız atar.
    if (low && moves > 0 && !this.lowPulse) {
      this.lowPulse = this.scene.tweens.add({
        targets: this.movesPanel,
        scale: 1.06,
        duration: 320,
        yoyo: true,
        repeat: -1,
        repeatDelay: 380,
        ease: 'Sine.easeInOut',
      });
    } else if ((!low || moves === 0) && this.lowPulse) {
      this.lowPulse.stop();
      this.lowPulse = null;
      this.movesPanel.setScale(1);
    }
  }

  /** Panelde i. hedefin simgesinin yeri (uçan simgelerin varış noktası). */
  goalPoint(index: number): Point {
    const icon = this.slots[index]?.icon;
    return icon ? { x: icon.x, y: icon.y } : this.center;
  }

  /**
   * Toplanan hedef simgelerini tahtadaki kareden panele uçurur; vardıkça sayaç azalır.
   * Çok fazla parça varsa bir kısmı uçar, kalanı doğrudan sayaca eklenir.
   */
  async collect(deltas: readonly GoalDelta[], cellToWorld: (p: Pos) => Point, iconSize: number): Promise<void> {
    const byGoal = new Map<number, GoalDelta[]>();
    for (const d of deltas) {
      const list = byGoal.get(d.goalIndex);
      if (list) list.push(d);
      else byGoal.set(d.goalIndex, [d]);
    }
    const flights: Promise<void>[] = [];
    for (const [goalIndex, list] of byGoal) {
      const slot = this.slots[goalIndex];
      if (!slot) continue;
      const flying = list.slice(0, HUD.maxFlightsPerGoal);
      const rest = list.slice(HUD.maxFlightsPerGoal).reduce((sum, d) => sum + d.amount, 0);
      flying.forEach((delta, i) => {
        flights.push(
          this.fly(slot, cellToWorld(delta.from), this.goalPoint(goalIndex), iconSize, i * HUD.flightStaggerMs).then(() =>
            this.decrement(slot, delta.amount + (i === flying.length - 1 ? rest : 0)),
          ),
        );
      });
    }
    await Promise.all(flights);
  }

  private async fly(slot: GoalSlot, from: Point, to: Point, size: number, delay: number): Promise<void> {
    if (delay > 0) await waitMs(this.scene, delay);
    const image = this.scene.add.image(from.x, from.y, slot.texture).setDepth(FLY_DEPTH).setDisplaySize(size, size);
    const startScale = image.scale;
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(from.x, from.y),
      new Phaser.Math.Vector2((from.x + to.x) / 2 + (from.x < to.x ? -120 : 120), Math.min(from.y, to.y) - 80),
      new Phaser.Math.Vector2(to.x, to.y),
    );
    const state = { t: 0 };
    await tweenAsync(this.scene, {
      targets: state,
      t: 1,
      duration: HUD.flightMs,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const p = curve.getPoint(state.t);
        image.setPosition(p.x, p.y).setScale(startScale * (1 - 0.3 * state.t));
      },
    });
    image.destroy();
  }

  private decrement(slot: GoalSlot, amount: number): void {
    audio.play('collect');
    slot.shown = Math.max(0, slot.shown - amount);
    slot.count.setText(String(slot.shown));
    if (slot.shown === 0) {
      slot.count.setVisible(false);
      slot.check.setVisible(true).setScale(0);
      this.scene.tweens.add({ targets: slot.check, scale: 56 / 64, duration: 260, ease: 'Back.easeOut' });
    }
    this.pulse(slot.icon, slot.baseScale, 1.15);
  }

  /** Kısa büyüyüp küçülme; önceki nabız yarıda kesilir, ölçek hep temel değerden başlar. */
  private pulse(target: Phaser.GameObjects.Image | Phaser.GameObjects.Text, base: number, factor: number): void {
    this.scene.tweens.killTweensOf(target);
    target.setScale(base);
    this.scene.tweens.add({ targets: target, scale: base * factor, duration: 100, yoyo: true, ease: 'Quad.easeOut' });
  }
}
