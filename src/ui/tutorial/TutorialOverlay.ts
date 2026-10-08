import Phaser from 'phaser';
import { TEXTURES } from '../../assets/AssetManifest';
import { LAYOUT } from '../../config/layout';
import type { Pos, ResolvedTutorialStep } from '../../core';
import { t, type I18nKey } from '../../i18n';
import type { BoardView } from '../board/BoardView';
import { CAPTAIN_BUBBLE_HEIGHT, createCaptainBubble } from '../components/CaptainBubble';
import { tweenAsync } from '../tweens';

const DEPTH = { dim: 24, bubble: 26, hand: 27, catcher: 28 } as const;
const BUBBLE_GAP = 26;
const HAND_MOVE_MS = 650;

/**
 * Öğretici katmanı: tahtayı karartır (yalnızca ilgili kareler aydınlık), el işaretiyle hamleyi
 * gösterir, Kaptan Pati'nin balonunda açıklamayı yazar. Hamle denetimini GameScene yapar.
 */
export class TutorialOverlay {
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly view: BoardView,
  ) {}

  /** Mesaj adımı: balonu gösterir, oyuncu ekrana dokununca kapanır. */
  showMessage(textKey: string): Promise<void> {
    this.hide();
    this.bubble(textKey, true);
    return new Promise((resolve) => {
      const { width, height } = this.scene.scale;
      const catcher = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0).setOrigin(0).setDepth(DEPTH.catcher);
      catcher.setInteractive();
      catcher.once('pointerup', () => {
        this.hide();
        resolve();
      });
      this.objects.push(catcher);
    });
  }

  /** Kaydırma/dokunma adımı: karartma + aydınlık kareler + el animasyonu + balon. */
  showAction(step: Exclude<ResolvedTutorialStep, { kind: 'message' }>): void {
    this.hide();
    this.dim(step.highlight);
    this.bubble(step.text, false);
    if (step.kind === 'swap') this.handSwipe(step.a, step.b);
    else this.handTap(step.at);
  }

  hide(): void {
    for (const o of this.objects) {
      this.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objects = [];
  }

  private world(p: Pos): { x: number; y: number } {
    return this.view.toWorld(this.view.cellCenter(p));
  }

  private dim(highlight: readonly Pos[]): void {
    const { width, height } = this.scene.scale;
    const rt = this.scene.add.renderTexture(0, 0, width, height).setOrigin(0).setDepth(DEPTH.dim);
    rt.fill(0x031a2b, 0.62);
    const cell = this.view.cellSize;
    const holes = this.scene.make.graphics({}, false);
    holes.fillStyle(0xffffff, 1);
    for (const p of highlight) {
      const c = this.world(p);
      holes.fillRoundedRect(c.x - cell / 2 - 4, c.y - cell / 2 - 4, cell + 8, cell + 8, 18);
    }
    rt.erase(holes);
    holes.destroy();
    rt.setAlpha(0);
    this.scene.tweens.add({ targets: rt, alpha: 1, duration: 220 });
    this.objects.push(rt);
  }

  /**
   * Kaptan Pati'nin balonu tahtanın hemen altında durur: tahtadaki hiçbir kareyi örtmez ve
   * üst paneldeki hamle/hedef bilgisini kapatmaz.
   */
  private bubble(textKey: string, tapToContinue: boolean): void {
    const board = this.view.bounds;
    const frame = LAYOUT.framePadding + LAYOUT.frameBorder;
    const x = board.x + board.width / 2;
    const y = board.y + board.height + frame + BUBBLE_GAP + CAPTAIN_BUBBLE_HEIGHT / 2;
    this.objects.push(
      createCaptainBubble(this.scene, x, y, t(textKey as I18nKey), { depth: DEPTH.bubble, tapHint: tapToContinue }),
    );
  }

  private createHand(at: { x: number; y: number }): Phaser.GameObjects.Image {
    // Parmak ucu (dokunma noktası) dokunun 57,6 pikselindedir.
    const hand = this.scene.add
      .image(at.x, at.y, TEXTURES.hand)
      .setOrigin(57 / 128, 6 / 128)
      .setDepth(DEPTH.hand)
      .setDisplaySize(this.view.cellSize * 1.1, this.view.cellSize * 1.1);
    this.objects.push(hand);
    return hand;
  }

  private handSwipe(a: Pos, b: Pos): void {
    const from = this.world(a);
    const to = this.world(b);
    const hand = this.createHand(from);
    const loop = async () => {
      while (hand.active) {
        hand.setPosition(from.x, from.y).setAlpha(0);
        await tweenAsync(this.scene, { targets: hand, alpha: 1, duration: 180 });
        if (!hand.active) return;
        await tweenAsync(this.scene, { targets: hand, x: to.x, y: to.y, duration: HAND_MOVE_MS, ease: 'Sine.easeInOut' });
        if (!hand.active) return;
        await tweenAsync(this.scene, { targets: hand, alpha: 0, duration: 220, delay: 200 });
      }
    };
    void loop();
  }

  private handTap(at: Pos): void {
    const hand = this.createHand(this.world(at));
    const base = hand.scale;
    this.scene.tweens.add({ targets: hand, scale: base * 0.82, duration: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
