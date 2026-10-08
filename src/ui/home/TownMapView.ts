import Phaser from 'phaser';
import { TEXTURES, TOWN_STAGE, regionIconTexture } from '../../assets/AssetManifest';
import { ensureTextures } from '../../assets/loadAssets';
import { MAP_NODES } from '../../assets/svg/town/map';
import { FONT_FAMILY } from '../../config/theme';
import { t, type I18nKey } from '../../i18n';
import { TOWN, type TownRegion } from '../../meta/town';
import type { TownProgress } from '../../meta/TownProgress';
import { audio } from '../../services/Audio';

const FRAME = { pad: 18, slice: 40 } as const;
const NODE = { radius: 80, icon: 124 } as const;
/** Rota noktaları arası uzaklık (sahne koordinatı). */
const DOT_SPACING = 30;

export type RegionStatus = 'done' | 'current' | 'locked';

/**
 * Liman haritası: bölgeler sırayla adacıklarda, aralarında kıvrılan rota. Bitmiş bölge yeşil (✓),
 * şu anki bölge altın renkte nabız atar (ilerleme ve süren inşaat), kilitliler gri. Açık bir
 * bölgeye dokununca o bölgenin kasaba sahnesi açılır. Bölge sahnesiyle aynı alanı kullanır.
 */
export class TownMapView {
  private readonly frame: Phaser.GameObjects.NineSlice;
  private readonly stage: Phaser.GameObjects.Container;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private scale = 1;
  private key = '';
  private ready = false;

  constructor(
    private readonly scene: Phaser.Scene,
    depth: number,
    private readonly onRegionTap: (region: TownRegion, status: RegionStatus) => void,
  ) {
    this.frame = scene.add
      .nineslice(0, 0, TEXTURES.hudPanel, undefined, 100, 100, FRAME.slice, FRAME.slice, FRAME.slice, FRAME.slice)
      .setDepth(depth - 1);
    this.stage = scene.add.container(0, 0).setDepth(depth);
    this.maskShape = scene.make.graphics({}, false);
    this.stage.setMask(this.maskShape.createGeometryMask());
  }

  layout(x: number, y: number, width: number): void {
    this.scale = width / TOWN_STAGE.width;
    const height = TOWN_STAGE.height * this.scale;
    this.stage.setPosition(x, y).setScale(this.scale);
    this.frame.setPosition(x + width / 2, y + height / 2).setSize(width + FRAME.pad * 2, height + FRAME.pad * 2);
    this.maskShape.clear().fillStyle(0xffffff).fillRoundedRect(x, y, width, height, 24);
  }

  setVisible(visible: boolean): void {
    this.frame.setVisible(visible);
    this.stage.setVisible(visible);
  }

  /** Bölgenin haritadaki durumu. */
  static status(town: TownProgress, region: TownRegion): RegionStatus {
    if (town.isRegionComplete(region)) return 'done';
    return town.unlockedRegions.includes(region) ? 'current' : 'locked';
  }

  /** Haritayı kasabanın durumuna göre çizer (durum değişmediyse yeniden çizmez). */
  async refresh(town: TownProgress): Promise<void> {
    if (!this.ready) {
      await ensureTextures(this.scene, [TEXTURES.townMap]);
      this.ready = true;
    }
    const construction = town.construction?.task.split('.')[0] ?? '';
    const key = TOWN.map((r) => `${TownMapView.status(town, r)}:${town.regionProgress(r).built}`).join('|') + `|${construction}`;
    if (key === this.key) return;
    this.key = key;
    for (const child of this.stage.list) this.scene.tweens.killTweensOf(child);
    this.stage.removeAll(true);
    this.stage.add(this.scene.add.image(0, 0, TEXTURES.townMap).setOrigin(0));
    this.drawRoute(town);
    for (const region of TOWN) this.drawNode(town, region, construction === region.id);
  }

  /** Yeni açılan bölgeye dikkat çeker. */
  celebrate(region: TownRegion): void {
    const p = MAP_NODES[region.id];
    const ring = this.scene.add.image(p.x, p.y, TEXTURES.ring).setTint(0xffd23f).setDisplaySize(260, 260).setAlpha(0.9);
    this.stage.add(ring);
    this.scene.tweens.add({
      targets: ring,
      scale: ring.scale * 1.8,
      alpha: 0,
      duration: 900,
      repeat: 2,
      onComplete: () => ring.destroy(),
    });
  }

  /** Bölgeler arası rota: açılmış bölgeye giden yol altın, kilitliye giden yol soluk noktalı. */
  private drawRoute(town: TownProgress): void {
    const g = this.scene.add.graphics();
    for (let i = 0; i < TOWN.length - 1; i++) {
      const a = MAP_NODES[TOWN[i].id];
      const b = MAP_NODES[TOWN[i + 1].id];
      const open = town.unlockedRegions.includes(TOWN[i + 1]);
      // Kıvrım: iki düğümün ortasından dik yönde kaydırılmış kontrol noktası.
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      const bend = i % 2 === 0 ? 60 : -60;
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(a.x, a.y),
        new Phaser.Math.Vector2(mx + (nx / len) * bend, my + (ny / len) * bend),
        new Phaser.Math.Vector2(b.x, b.y),
      );
      const count = Math.max(4, Math.round(curve.getLength() / DOT_SPACING));
      for (let k = 1; k < count; k++) {
        const p = curve.getPoint(k / count);
        if (Math.hypot(p.x - a.x, p.y - a.y) < NODE.radius + 8 || Math.hypot(p.x - b.x, p.y - b.y) < NODE.radius + 8) continue;
        if (open) g.fillStyle(0x8a5a00, 1).fillCircle(p.x, p.y + 2, 9).fillStyle(0xffd23f, 1).fillCircle(p.x, p.y, 8);
        else g.fillStyle(0xffffff, 0.55).fillCircle(p.x, p.y, 6);
      }
    }
    this.stage.add(g);
  }

  private drawNode(town: TownProgress, region: TownRegion, building: boolean): void {
    const { x, y } = MAP_NODES[region.id];
    const status = TownMapView.status(town, region);
    const { built, total } = town.regionProgress(region);
    const color = status === 'done' ? 0x2ecc71 : status === 'current' ? 0xffd23f : 0x95a5a6;
    const node = this.scene.add.container(x, y);
    const shadow = this.scene.add.circle(0, 8, NODE.radius, 0x06263d, 0.35);
    const disc = this.scene.add.circle(0, 0, NODE.radius, color).setStrokeStyle(8, 0xffffff);
    const icon = this.scene.add.image(0, -4, regionIconTexture(region.id)).setDisplaySize(NODE.icon, NODE.icon);
    node.add([shadow, disc, icon]);
    if (status === 'locked') {
      disc.setAlpha(0.75);
      icon.setTint(0x7f8c8d).setAlpha(0.6);
      node.add(this.scene.add.image(NODE.radius * 0.62, -NODE.radius * 0.62, TEXTURES.lock).setDisplaySize(64, 64));
    } else if (status === 'done') {
      node.add(this.scene.add.image(NODE.radius * 0.66, -NODE.radius * 0.66, TEXTURES.check).setDisplaySize(64, 64));
    } else {
      // Şu anki bölge: ilerleme rozeti, nabız; inşaat sürüyorsa sallanan çekiç.
      const badge = this.scene.add
        .text(NODE.radius * 0.7, -NODE.radius * 0.7, `${built}/${total}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '30px',
          fontStyle: '700',
          color: '#ffffff',
          backgroundColor: '#e74c3c',
          padding: { x: 10, y: 4 },
        })
        .setOrigin(0.5);
      node.add(badge);
      this.scene.tweens.add({ targets: node, scale: 1.07, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (building) {
        const hammer = this.scene.add.image(-NODE.radius * 0.72, -NODE.radius * 0.6, TEXTURES.hammer).setDisplaySize(70, 70);
        node.add(hammer);
        this.scene.tweens.add({ targets: hammer, angle: { from: -30, to: 20 }, duration: 360, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      const captain = this.scene.add.image(x - NODE.radius - 46, y + 30, TEXTURES.captain).setDisplaySize(96, 96);
      this.stage.add(captain);
      this.scene.tweens.add({ targets: captain, y: y + 18, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const name = this.scene.add
      .text(x, y + NODE.radius + 34, t(`region.${region.id}` as I18nKey), {
        fontFamily: FONT_FAMILY,
        fontSize: '34px',
        fontStyle: '700',
        color: status === 'locked' ? '#d5dde5' : '#ffffff',
        stroke: '#06263d',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.stage.add([node, name]);

    const hit = this.scene.add.zone(x, y + 20, NODE.radius * 2.4, NODE.radius * 2.6).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      audio.play('tap');
      this.scene.tweens.add({ targets: icon, scale: icon.scale * 1.12, duration: 100, yoyo: true });
      this.onRegionTap(region, status);
    });
    this.stage.add(hit);
  }
}
