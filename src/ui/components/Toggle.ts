import Phaser from 'phaser';
import { audio } from '../../services/Audio';

const SIZE = { width: 150, height: 74 } as const;
const COLORS = { on: 0x5ccf5f, onRim: 0x1f6b2d, off: 0xbdc3c7, offRim: 0x5d6d7e } as const;

/** Açma/kapama anahtarı (ayarlar). Topuz kayarak yer değiştirir. */
export class Toggle extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Arc;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private value: boolean,
    onChange: (value: boolean) => void,
  ) {
    super(scene, x, y);
    this.track = scene.add.graphics();
    this.knob = scene.add.circle(0, 0, SIZE.height / 2 - 9, 0xffffff).setStrokeStyle(4, 0x2b3a4a);
    this.add([this.track, this.knob]);
    this.draw(false);
    this.setSize(SIZE.width, SIZE.height).setInteractive({ useHandCursor: true });
    this.on('pointerup', () => {
      this.value = !this.value;
      this.draw(true);
      onChange(this.value);
      audio.play('tap');
    });
    scene.add.existing(this);
  }

  private draw(animate: boolean): void {
    const { width: w, height: h } = SIZE;
    this.track
      .clear()
      .fillStyle(this.value ? COLORS.on : COLORS.off)
      .fillRoundedRect(-w / 2, -h / 2, w, h, h / 2)
      .lineStyle(5, this.value ? COLORS.onRim : COLORS.offRim)
      .strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const x = (this.value ? 1 : -1) * (w / 2 - h / 2);
    if (animate) this.scene.tweens.add({ targets: this.knob, x, duration: 140, ease: 'Quad.easeOut' });
    else this.knob.setX(x);
  }
}
