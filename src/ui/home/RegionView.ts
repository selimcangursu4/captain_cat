import Phaser from 'phaser';
import {
  ASSET_MANIFEST,
  TEXTURES,
  TOWN_STAGE,
  townBackgroundTexture,
  townPartBox,
  townPartTexture,
  townRegionTextures,
} from '../../assets/AssetManifest';
import { ensureTextures, releaseTextures } from '../../assets/loadAssets';
import { FONT_FAMILY } from '../../config/theme';
import type { RegionId, TownRegion } from '../../meta/town';
import { tweenAsync } from '../tweens';

type Point = { x: number; y: number };

const FRAME = { pad: 18, slice: 40 } as const;
/** Süren inşaatın üstündeki geri sayım çubuğu (sahne koordinatı). */
const PILL = { width: 300, height: 70, bar: 14 } as const;

interface ConstructionView {
  readonly taskId: string;
  readonly objects: Phaser.GameObjects.GameObject[];
  readonly label: Phaser.GameObjects.Text;
  readonly bar: Phaser.GameObjects.Graphics;
}

/**
 * Kasaba bölgesinin sahnesi (1000x820 tasarım alanı, ekrana ölçeklenir): arka plan,
 * yapılmış parçalar, süzülen bulutlar. Bölgenin dokuları yalnızca gösterilirken yüklenir.
 */
export class RegionView {
  private readonly frame: Phaser.GameObjects.NineSlice;
  private readonly stage: Phaser.GameObjects.Container;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private parts = new Map<string, Phaser.GameObjects.Image>();
  private construction: ConstructionView | null = null;
  private region: RegionId | null = null;
  private origin: Point = { x: 0, y: 0 };
  private scale = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    depth: number,
    /** Yapılmış bir parçaya dokunulunca (tasarımını değiştirmek için). */
    private readonly onPartTap?: (taskId: string) => void,
    /** Süren inşaata dokunulunca (geri sayım, hızlandırma). */
    private readonly onConstructionTap?: () => void,
  ) {
    this.frame = scene.add
      .nineslice(0, 0, TEXTURES.hudPanel, undefined, 100, 100, FRAME.slice, FRAME.slice, FRAME.slice, FRAME.slice)
      .setDepth(depth - 1);
    this.stage = scene.add.container(0, 0).setDepth(depth);
    this.maskShape = scene.make.graphics({}, false);
    this.stage.setMask(this.maskShape.createGeometryMask());
    this.dust = scene.add
      .particles(0, 0, TEXTURES.particleDot, {
        emitting: false,
        lifespan: { min: 500, max: 900 },
        speed: { min: 60, max: 260 },
        scale: { start: 1.6, end: 0.2 },
        alpha: { start: 0.8, end: 0 },
        tint: 0xe8d6b0,
        gravityY: -60,
      })
      .setDepth(depth + 1);
    this.sparks = scene.add
      .particles(0, 0, TEXTURES.particleSpark, {
        emitting: false,
        lifespan: 700,
        speed: { min: 120, max: 360 },
        scale: { start: 1, end: 0 },
        rotate: { min: 0, max: 180 },
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(depth + 1);
  }

  /** Sahnenin sol üst köşesi ve genişliği (ekran koordinatı). */
  layout(x: number, y: number, width: number): void {
    this.origin = { x, y };
    this.scale = width / TOWN_STAGE.width;
    const height = TOWN_STAGE.height * this.scale;
    this.stage.setPosition(x, y).setScale(this.scale);
    this.frame.setPosition(x + width / 2, y + height / 2).setSize(width + FRAME.pad * 2, height + FRAME.pad * 2);
    this.maskShape.clear().fillStyle(0xffffff).fillRoundedRect(x, y, width, height, 24);
  }

  /** Harita gösterilirken bölge sahnesi gizlenir. */
  setVisible(visible: boolean): void {
    this.frame.setVisible(visible);
    this.stage.setVisible(visible);
  }

  get bounds(): { x: number; y: number; width: number; height: number } {
    return { ...this.origin, width: TOWN_STAGE.width * this.scale, height: TOWN_STAGE.height * this.scale };
  }

  /** Bölgeyi gösterir (dokularını yükler, önceki bölgeninkileri bırakır). */
  async show(region: TownRegion, built: Readonly<Record<string, number>>): Promise<void> {
    await ensureTextures(this.scene, townRegionTextures(region.id, built));
    const previous = this.region;
    for (const child of this.stage.list) this.scene.tweens.killTweensOf(child);
    this.stage.removeAll(true);
    this.parts.clear();
    this.construction = null;
    this.region = region.id;
    if (previous && previous !== region.id) releaseTextures(this.scene, regionTextureKeys(previous));

    this.stage.add(this.scene.add.image(0, 0, townBackgroundTexture(region.id)).setOrigin(0));
    this.addClouds();
    for (const task of region.tasks) {
      const design = built[task.id];
      if (design !== undefined) this.placePart(task.id, design);
    }
  }

  private addClouds(): void {
    // [y, ölçek, tur süresi, başlangıç ilerlemesi] — bulutlar sahneye farklı yerlerden girer.
    for (const [y, scale, duration, progress] of [
      [60, 0.9, 48000, 0.15],
      [170, 0.6, 64000, 0.6],
    ] as const) {
      const cloud = this.scene.add.image(-200, y, TEXTURES.cloud).setScale(scale).setAlpha(0.85);
      this.stage.add(cloud);
      const tween = this.scene.tweens.add({ targets: cloud, x: TOWN_STAGE.width + 200, duration, repeat: -1 });
      tween.seek(duration * progress);
    }
  }

  private placePart(taskId: string, design: number): Phaser.GameObjects.Image {
    const [x, y, w, h] = townPartBox(taskId);
    const image = this.scene.add.image(x + w / 2, y + h / 2, townPartTexture(taskId, design));
    if (this.onPartTap) {
      // Piksel hassas: parçanın saydam kenarlarına değil, görünen kısmına dokunulunca açılır.
      image.setInteractive({ pixelPerfect: true, alphaTolerance: 1, useHandCursor: true });
      image.on('pointerup', () => this.onPartTap?.(taskId));
    }
    this.stage.add(image);
    this.parts.get(taskId)?.destroy();
    this.parts.set(taskId, image);
    return image;
  }

  /**
   * Süren inşaat: parçanın soluk hali, iskele, sallanan çekiç ve geri sayım çubuğu. Bölge
   * gösterildikten sonra çağrılır; inşaat bitince clearConstruction ile kaldırılır.
   */
  async showConstruction(taskId: string, design: number): Promise<void> {
    if (this.construction?.taskId === taskId) return;
    this.clearConstruction();
    if (this.region === null || !taskId.startsWith(`${this.region}.`)) return;
    await ensureTextures(this.scene, [townPartTexture(taskId, design)]);
    const [x, y, w, h] = townPartBox(taskId);
    const ghost = this.scene.add.image(x + w / 2, y + h / 2, townPartTexture(taskId, design)).setAlpha(0.38).setTint(0xd8c9b0);

    // İskele: kutunun iki yanında direkler, aralıklı kalaslar ve çapraz destekler.
    const scaffold = this.scene.add.graphics();
    const poles = [x + 6, x + w - 6];
    const floors = Math.max(2, Math.round(h / 90));
    scaffold.lineStyle(6, 0x8b5a2b, 0.95);
    for (const px of poles) scaffold.lineBetween(px, y + 6, px, y + h);
    for (let i = 0; i <= floors; i++) {
      const py = y + 10 + ((h - 14) * i) / floors;
      scaffold.lineStyle(9, 0xc98a4b, 0.95).lineBetween(x - 4, py, x + w + 4, py);
      scaffold.lineStyle(3, 0x4a2a0c, 0.8).lineBetween(x - 4, py + 5, x + w + 4, py + 5);
      if (i < floors) {
        const ny = y + 10 + ((h - 14) * (i + 1)) / floors;
        scaffold.lineStyle(4, 0x8b5a2b, 0.7).lineBetween(poles[i % 2], py, poles[(i + 1) % 2], ny);
      }
    }

    const hammer = this.scene.add.image(x + w * 0.72, y + h * 0.4, TEXTURES.hammer).setDisplaySize(84, 84);
    this.scene.tweens.add({ targets: hammer, angle: { from: -30, to: 20 }, duration: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const pillX = Phaser.Math.Clamp(x + w / 2, PILL.width / 2 + 10, TOWN_STAGE.width - PILL.width / 2 - 10);
    const pillY = Math.max(PILL.height / 2 + 10, y - PILL.height / 2 - 6);
    const pill = this.scene.add
      .graphics()
      .fillStyle(0x0d2f4a, 0.9)
      .fillRoundedRect(pillX - PILL.width / 2, pillY - PILL.height / 2, PILL.width, PILL.height, PILL.height / 2)
      .lineStyle(4, 0xffd23f)
      .strokeRoundedRect(pillX - PILL.width / 2, pillY - PILL.height / 2, PILL.width, PILL.height, PILL.height / 2);
    const bar = this.scene.add.graphics().setPosition(pillX, pillY);
    const label = this.scene.add
      .text(pillX, pillY - 8, '', { fontFamily: FONT_FAMILY, fontSize: '34px', fontStyle: '700', color: '#ffffff' })
      .setOrigin(0.5);

    const objects: Phaser.GameObjects.GameObject[] = [ghost, scaffold, hammer, pill, bar, label];
    if (this.onConstructionTap) {
      // Dokunma alanı: parça + üstündeki çubuk.
      const top = Math.min(y, pillY - PILL.height / 2);
      const bottom = y + h;
      const hit = this.scene.add.zone(x + w / 2, (top + bottom) / 2, Math.max(w, PILL.width), bottom - top);
      hit.setInteractive({ useHandCursor: true }).on('pointerup', () => this.onConstructionTap?.());
      objects.push(hit);
    }
    this.stage.add(objects);
    this.construction = { taskId, objects, label, bar };
  }

  /** Geri sayım yazısı ve ilerleme (0..1). */
  updateConstruction(text: string, progress: number): void {
    const c = this.construction;
    if (!c) return;
    if (c.label.text !== text) c.label.setText(text);
    const inner = PILL.width - 50;
    c.bar
      .clear()
      .fillStyle(0xffffff, 0.25)
      .fillRoundedRect(-inner / 2, 14, inner, PILL.bar, PILL.bar / 2)
      .fillStyle(0xffd23f, 1)
      .fillRoundedRect(-inner / 2, 14, Math.max(PILL.bar, inner * Phaser.Math.Clamp(progress, 0, 1)), PILL.bar, PILL.bar / 2);
  }

  clearConstruction(): void {
    if (!this.construction) return;
    for (const obj of this.construction.objects) {
      this.scene.tweens.killTweensOf(obj);
      obj.destroy();
    }
    this.construction = null;
  }

  /** Parçanın ekrandaki merkezi. */
  partPoint(taskId: string): Point {
    const [x, y, w, h] = townPartBox(taskId);
    return { x: this.origin.x + (x + w / 2) * this.scale, y: this.origin.y + (y + h / 2) * this.scale };
  }

  /** Yeni yapılan parça: toz bulutu içinden zıplayarak belirir. */
  async build(taskId: string, design: number): Promise<void> {
    await ensureTextures(this.scene, [townPartTexture(taskId, design)]);
    if (this.construction?.taskId === taskId) this.clearConstruction();
    const image = this.placePart(taskId, design).setScale(0.3).setAlpha(0);
    const p = this.partPoint(taskId);
    const [, , w, h] = townPartBox(taskId);
    const spread = Math.max(w, h) * this.scale * 0.4;
    for (let i = 0; i < 4; i++) {
      this.dust.explode(8, p.x + Phaser.Math.Between(-spread, spread), p.y + Phaser.Math.Between(-spread / 2, spread / 2));
    }
    this.scene.cameras.main.shake(160, 0.004);
    await tweenAsync(this.scene, { targets: image, scale: 1, alpha: 1, duration: 520, ease: 'Back.easeOut' });
    this.sparks.explode(14, p.x, p.y);
  }

  /** Tasarım değişikliği: parça küçülüp yenisiyle yer değiştirir. */
  async changeDesign(taskId: string, design: number): Promise<void> {
    await ensureTextures(this.scene, [townPartTexture(taskId, design)]);
    const old = this.parts.get(taskId);
    if (old) await tweenAsync(this.scene, { targets: old, scale: 0.85, alpha: 0.4, duration: 140 });
    const image = this.placePart(taskId, design).setScale(0.85);
    const p = this.partPoint(taskId);
    this.sparks.explode(10, p.x, p.y);
    await tweenAsync(this.scene, { targets: image, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }
}

/** Bir bölgenin manifestteki tüm dokuları (bırakmak için). */
function regionTextureKeys(region: RegionId): string[] {
  return Object.keys(ASSET_MANIFEST).filter((key) => key.startsWith(`town.${region}.`));
}
