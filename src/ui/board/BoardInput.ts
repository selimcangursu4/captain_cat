import type Phaser from 'phaser';
import { INPUT } from '../../config/input';
import { isAdjacent, samePos, type Pos } from '../../core';
import type { BoardView } from './BoardView';

export interface BoardInputHandlers {
  /** Animasyon sürerken false döner; girdi yok sayılır. */
  canInteract(): boolean;
  onSwap(a: Pos, b: Pos): void;
  /** Güçlendiriciye tek dokunuş. */
  onActivate(p: Pos): void;
  /** Tahtaya her dokunuşta (ipucu zamanlayıcısını sıfırlamak için). */
  onTouch(): void;
}

/**
 * Tahta girdisi:
 *  1) Kaydırma: taşa basıp parmağı bir yöne sürükle.
 *  2) Dokun–dokun: bir taşa dokun (seçilir), sonra komşusuna dokun.
 *  3) Güçlendiriciye tek dokunuş: tetikler.
 */
export class BoardInput {
  private down: { cell: Pos; x: number; y: number } | null = null;
  private selected: Pos | null = null;
  /** Yardımcı hedef bekliyorsa: dokunulan kare buraya gider (kaydırma kapalı). */
  private targetHandler: ((p: Pos) => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly view: BoardView,
    private readonly handlers: BoardInputHandlers,
  ) {
    const input = scene.input;
    input.on('pointerdown', this.onDown, this);
    input.on('pointermove', this.onMove, this);
    input.on('pointerup', this.onUp, this);
    input.on('pointerupoutside', this.onUp, this);
    scene.events.once('shutdown', () => {
      input.off('pointerdown', this.onDown, this);
      input.off('pointermove', this.onMove, this);
      input.off('pointerup', this.onUp, this);
      input.off('pointerupoutside', this.onUp, this);
    });
  }

  clearSelection(): void {
    this.selected = null;
    this.down = null;
    this.view.setSelected(null);
  }

  /** Hedef seçme modu (Kürek, Dümen): bir kareye dokunulunca handler çağrılır. null: normal oyun. */
  setTargetMode(handler: ((p: Pos) => void) | null): void {
    this.targetHandler = handler;
    this.clearSelection();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (!this.handlers.canInteract()) return;
    const cell = this.view.pointToCell(pointer.x, pointer.y);
    // Hedef modunda taşsız kareler de (kum torbası, sandık) seçilebilir.
    if (!cell || (!this.targetHandler && !this.view.hasTile(cell))) return;
    this.handlers.onTouch();
    this.down = { cell, x: pointer.x, y: pointer.y };
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.down || !pointer.isDown || this.targetHandler) return;
    const dx = pointer.x - this.down.x;
    const dy = pointer.y - this.down.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < this.view.cellSize * INPUT.swipeThreshold) return;

    const from = this.down.cell;
    const to =
      Math.abs(dx) > Math.abs(dy)
        ? { row: from.row, col: from.col + Math.sign(dx) }
        : { row: from.row + Math.sign(dy), col: from.col };
    this.clearSelection();
    if (this.handlers.canInteract()) this.handlers.onSwap(from, to);
  }

  private onUp(): void {
    if (!this.down) return;
    const cell = this.down.cell;
    this.down = null;
    if (!this.handlers.canInteract()) return;
    if (this.targetHandler) {
      this.targetHandler(cell);
      return;
    }

    const selected = this.selected;
    if (selected && isAdjacent(selected, cell)) {
      this.clearSelection();
      this.handlers.onSwap(selected, cell);
    } else if (this.view.isSpecial(cell)) {
      // Güçlendiriciye tek dokunuş onu tetikler.
      this.clearSelection();
      this.handlers.onActivate(cell);
    } else if (selected && samePos(selected, cell)) {
      this.clearSelection();
    } else {
      this.selected = cell;
      this.view.setSelected(cell);
    }
  }
}
