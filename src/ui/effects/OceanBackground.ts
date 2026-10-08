import Phaser from 'phaser';
import { TEXTURES } from '../../assets/AssetManifest';

const BUBBLE_COUNT = 14;

/** Ekranı dolduran okyanus arka planı ve yavaşça yükselen kabarcıklar. */
export class OceanBackground {
  private readonly image: Phaser.GameObjects.Image;
  private bubbles: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.image = scene.add.image(0, 0, TEXTURES.background).setOrigin(0).setDepth(-10);
  }

  layout(width: number, height: number): void {
    this.image.setDisplaySize(width, height);
    for (const bubble of this.bubbles) {
      this.scene.tweens.killTweensOf(bubble);
      bubble.destroy();
    }
    this.bubbles = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) this.bubbles.push(this.spawnBubble(width, height, i));
  }

  private spawnBubble(width: number, height: number, index: number): Phaser.GameObjects.Image {
    const x = Phaser.Math.Between(20, width - 20);
    const bubble = this.scene.add
      .image(x, height + 40, TEXTURES.bubble)
      .setDepth(-9)
      .setScale(Phaser.Math.FloatBetween(0.3, 0.9))
      .setAlpha(Phaser.Math.FloatBetween(0.35, 0.7));
    const duration = Phaser.Math.Between(7000, 14000);
    this.scene.tweens.add({
      targets: bubble,
      y: -60,
      duration,
      delay: (duration / BUBBLE_COUNT) * index,
      repeat: -1,
    });
    this.scene.tweens.add({
      targets: bubble,
      x: x + Phaser.Math.Between(-40, 40),
      duration: Phaser.Math.Between(1400, 2400),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return bubble;
  }
}
