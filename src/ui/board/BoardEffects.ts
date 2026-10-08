import Phaser from 'phaser';
import { TEXTURES, itemTexture } from '../../assets/AssetManifest';
import { ANIM } from '../../config/animation';
import { vibrate } from '../../services/Haptics';
import { tweenAsync } from '../tweens';
import type { BoardView } from './BoardView';

type Point = { x: number; y: number };

/**
 * Güçlendirici efektleri (zıpkın mermisi, şok dalgası, girdap ışını, martı uçuşu).
 * Tümü tahta yerel koordinatlarında, taşların üstündeki efekt katmanına çizilir.
 */
export class BoardEffects {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly view: BoardView,
  ) {}

  private get layer(): Phaser.GameObjects.Container {
    return this.view.effectLayer;
  }

  private get cell(): number {
    return this.view.cellSize;
  }

  /** Zıpkın: from'dan to'ya uçar, sonda söner. */
  async projectile(from: Point, to: Point, durationMs: number): Promise<void> {
    const image = this.scene.add
      .image(from.x, from.y, TEXTURES.harpoonProjectile)
      .setOrigin(0.8, 0.5)
      .setRotation(Math.atan2(to.y - from.y, to.x - from.x))
      .setScale(this.cell / 110);
    this.layer.add(image);
    await tweenAsync(this.scene, { targets: image, x: to.x, y: to.y, duration: durationMs, ease: 'Linear' });
    await tweenAsync(this.scene, { targets: image, alpha: 0, duration: 90 });
    image.destroy();
  }

  /** Gülle: genişleyen renkli halka. */
  async shockwave(center: Point, radiusCells: number, tint: number): Promise<void> {
    const ring = this.scene.add.image(center.x, center.y, TEXTURES.ring).setTint(tint).setScale(0.2);
    const flash = this.scene.add
      .image(center.x, center.y, TEXTURES.particleDot)
      .setScale((this.cell * 2) / 32)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.layer.add([flash, ring]);
    const endScale = (radiusCells * 2 + 1) * this.cell / 128;
    await Promise.all([
      tweenAsync(this.scene, { targets: ring, scale: endScale, alpha: 0, duration: ANIM.shockwaveMs, ease: 'Cubic.easeOut' }),
      tweenAsync(this.scene, { targets: flash, alpha: 0, scale: flash.scale * 1.6, duration: ANIM.shockwaveMs * 0.6 }),
    ]);
    ring.destroy();
    flash.destroy();
  }

  /** Girdap ışını: merkezden hedefe uzanan parlak şerit. */
  async beam(from: Point, to: Point, tint: number): Promise<void> {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const image = this.scene.add
      .image(from.x, from.y, TEXTURES.beam)
      .setOrigin(0, 0.5)
      .setRotation(Math.atan2(to.y - from.y, to.x - from.x))
      .setTint(tint)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0, this.cell / 60);
    this.layer.add(image);
    await tweenAsync(this.scene, { targets: image, scaleX: length / 64, duration: ANIM.beamMs, ease: 'Quad.easeOut' });
    await tweenAsync(this.scene, { targets: image, alpha: 0, duration: 140 });
    image.destroy();
  }

  /** Girdap dokusu merkezde dönerek büyür ve söner. */
  async swirl(center: Point, scale: number, durationMs: number = ANIM.swirlMs): Promise<void> {
    const image = this.scene.add
      .image(center.x, center.y, 'special.whirlpool')
      .setScale((this.cell / 144) * scale * 0.6)
      .setAlpha(0.95);
    this.layer.add(image);
    await tweenAsync(this.scene, {
      targets: image,
      angle: 540,
      scale: (this.cell / 144) * scale * 1.4,
      alpha: 0,
      duration: durationMs,
      ease: 'Cubic.easeIn',
    });
    image.destroy();
  }

  /** Martı: kavisli bir yolla hedefe uçar. */
  async seagullFlight(from: Point, to: Point, durationMs: number = ANIM.seagullFlightMs): Promise<void> {
    const bird = this.scene.add
      .image(from.x, from.y, TEXTURES.flyingSeagull)
      .setScale((this.cell / 144) * 1.1)
      .setFlipX(to.x < from.x);
    this.layer.add(bird);
    const control = {
      x: (from.x + to.x) / 2,
      y: Math.min(from.y, to.y) - this.cell * ANIM.seagullArc,
    };
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(from.x, from.y),
      new Phaser.Math.Vector2(control.x, control.y),
      new Phaser.Math.Vector2(to.x, to.y),
    );
    const state = { t: 0 };
    const baseScale = bird.scale;
    await tweenAsync(this.scene, {
      targets: state,
      t: 1,
      duration: durationMs,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const p = curve.getPoint(state.t);
        bird.setPosition(p.x, p.y);
        // Kanat çırpma hissi için hafif ölçek salınımı.
        bird.setScale(baseScale * (1 + 0.12 * Math.sin(state.t * Math.PI * 6)), baseScale);
      },
    });
    await tweenAsync(this.scene, { targets: bird, scale: baseScale * 0.4, alpha: 0, duration: 120 });
    bird.destroy();
  }

  /** Kürek: kareye yukarıdan iner (ANIM.shovelStrikeMs'de vurur), toz kalkar, söner. */
  async shovelStrike(center: Point): Promise<void> {
    const cell = this.cell;
    const shovel = this.scene.add
      .image(center.x + cell * 0.7, center.y - cell * 1.3, itemTexture('shovel'))
      .setScale((cell * 1.4) / 128)
      .setAngle(-35)
      .setAlpha(0);
    this.layer.add(shovel);
    await tweenAsync(this.scene, {
      targets: shovel,
      x: center.x + cell * 0.2,
      y: center.y - cell * 0.35,
      angle: 25,
      alpha: 1,
      duration: ANIM.shovelStrikeMs,
      ease: 'Quad.easeIn',
    });
    this.shake('small');
    this.view.debris(center, 0xc8a26a, 12);
    await tweenAsync(this.scene, { targets: shovel, y: shovel.y - cell * 0.4, alpha: 0, angle: 5, duration: 220, ease: 'Quad.easeOut' });
    shovel.destroy();
  }

  /** Dümen: satırın solundan sağına dönerek yuvarlanır (her kareye ANIM.helmMsPerCell'de bir ulaşır). */
  async helmSweep(row: number): Promise<void> {
    const cell = this.cell;
    const width = this.view.bounds.width;
    const y = (row + 0.5) * cell;
    const wheel = this.scene.add.image(-cell / 2, y, itemTexture('helm')).setScale((cell * 1.15) / 128);
    const trail = this.scene.add
      .image(-cell / 2, y, TEXTURES.beam)
      .setOrigin(1, 0.5)
      .setTint(0xffe08a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0, cell / 40);
    this.layer.add([trail, wheel]);
    const cells = width / cell + 1;
    await tweenAsync(this.scene, {
      targets: wheel,
      x: width + cell / 2,
      angle: 720,
      duration: cells * ANIM.helmMsPerCell,
      ease: 'Linear',
      onUpdate: () => trail.setPosition(wheel.x, y).setScale(Math.min(3, (wheel.x + cell / 2) / 64), cell / 40),
    });
    await tweenAsync(this.scene, { targets: [wheel, trail], alpha: 0, duration: 160 });
    wheel.destroy();
    trail.destroy();
  }

  shake(strength: 'small' | 'big'): void {
    const config = strength === 'big' ? ANIM.shakeBig : ANIM.shakeSmall;
    this.scene.cameras.main.shake(config.ms, config.intensity);
    if (strength === 'big') vibrate('medium');
  }
}
