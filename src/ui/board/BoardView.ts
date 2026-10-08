import Phaser from 'phaser';
import { TEXTURES, obstacleTexture, tileTexture } from '../../assets/AssetManifest';
import { ANIM } from '../../config/animation';
import { LAYOUT } from '../../config/layout';
import { FONT_FAMILY, OBSTACLE_TINTS, TILE_PALETTE, UI_COLORS, hexToNumber } from '../../config/theme';
import {
  TILE_COLORS,
  findEnclosedHoles,
  samePos,
  type Board,
  type ClearedTile,
  type CreatedSpecial,
  type FallMove,
  type ObstacleHit,
  type ObstacleKind,
  type ObstacleLayer,
  type PathStep,
  type Pos,
  type PossibleMove,
  type ShuffleMove,
  type SpawnMove,
  type SpecialKind,
  type Tile,
  type TileColor,
} from '../../core';
import { audio } from '../../services/Audio';
import { quality } from '../../services/Quality';
import { chainAsync, tweenAsync, waitMs } from '../tweens';
import type { BoardLayout } from './layout';

interface TileSprite {
  readonly id: number;
  color: TileColor;
  special?: SpecialKind;
  pos: Pos;
  readonly image: Phaser.GameObjects.Image;
}

type Point = { x: number; y: number };

interface ObstacleSprite {
  readonly kind: ObstacleKind;
  readonly layer: ObstacleLayer;
  readonly pos: Pos;
  readonly image: Phaser.GameObjects.Image;
  /** Sandık ve yuvada kalan vuruş sayısı. */
  readonly badge?: Phaser.GameObjects.Text;
}

/** Sandık ve yuvanın üstünde kalan vuruş sayısı gösterilir. */
const BADGED: ReadonlySet<ObstacleKind> = new Set(['chest', 'nest']);

/** Görünüm katmanları (alttan üste). */
const DEPTH = { board: 10, floor: 10.5, tiles: 11, block: 11.4, cover: 11.6, fx: 12, particles: 20 } as const;

/**
 * Tahtanın Phaser görünümü. Mantık bilmez: Match3Engine'in ürettiği olayları
 * (kaydırma, temizleme, düşme, karıştırma) animasyona dönüştürür.
 * Sprite'lar taş kimliğiyle (tileId) eşlenir.
 */
export class BoardView {
  private readonly root: Phaser.GameObjects.Container;
  /** Çerçeve + kareler tek dokuya önceden çizilir (her karede yeniden çizilmez). */
  private boardTexture: Phaser.GameObjects.RenderTexture | null = null;
  private readonly floorLayer: Phaser.GameObjects.Container;
  private readonly tileLayer: Phaser.GameObjects.Container;
  private readonly blockLayer: Phaser.GameObjects.Container;
  private readonly coverLayer: Phaser.GameObjects.Container;
  private readonly fxLayer: Phaser.GameObjects.Container;
  private readonly obstacleSprites = new Map<number, ObstacleSprite>();
  private readonly debrisEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly tileMask: Phaser.Display.Masks.GeometryMask;
  private readonly selection: Phaser.GameObjects.Image;
  private readonly emitters = new Map<TileColor, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly sparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

  private rows = 0;
  private cols = 0;
  private playable: boolean[] = [];
  private enclosedHoles: Pos[] = [];
  private grid: (TileSprite | null)[] = [];
  private readonly byId = new Map<number, TileSprite>();
  private layout: BoardLayout = { cellSize: 1, x: 0, y: 0, width: 0, height: 0 };
  /** Taş sprite'ının normal ölçeği (kare boyutuna göre). */
  private tileScale = 1;

  private selectedSprite: TileSprite | null = null;
  private selectionTweens: Phaser.Tweens.Tween[] = [];
  private hintTweens: Phaser.Tweens.Tween[] = [];
  private hinted: TileSprite[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    // Katmanlar ayrı üst seviye container'lar: Phaser 3'te maske yalnızca
    // iç içe olmayan container'larda güvenilir çalışır.
    this.root = scene.add.container(0, 0).setDepth(DEPTH.board);
    this.floorLayer = scene.add.container(0, 0).setDepth(DEPTH.floor);
    this.tileLayer = scene.add.container(0, 0).setDepth(DEPTH.tiles);
    this.blockLayer = scene.add.container(0, 0).setDepth(DEPTH.block);
    this.coverLayer = scene.add.container(0, 0).setDepth(DEPTH.cover);
    this.fxLayer = scene.add.container(0, 0).setDepth(DEPTH.fx);

    // Taşlar yalnızca oynanabilir karelerin içinde görünür: yukarıdan gelen
    // yeni taşlar tahtaya girene kadar ve boşlukların üzerinden geçerken gizlenir.
    this.maskShape = scene.make.graphics({}, false);
    this.tileMask = this.maskShape.createGeometryMask();
    this.tileLayer.setMask(this.tileMask);

    this.selection = scene.add.image(0, 0, TEXTURES.selection).setVisible(false);
    this.fxLayer.add(this.selection);

    for (const color of TILE_COLORS) {
      this.emitters.set(
        color,
        scene.add
          .particles(0, 0, TEXTURES.particleDot, {
            emitting: false,
            lifespan: { min: 380, max: 620 },
            speed: { min: 180, max: 520 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.9, end: 0 },
            alpha: { start: 1, end: 0 },
            gravityY: 900,
            tint: hexToNumber(TILE_PALETTE[color].base),
          })
          .setDepth(DEPTH.particles),
      );
    }
    this.sparkEmitter = scene.add
      .particles(0, 0, TEXTURES.particleSpark, {
        emitting: false,
        lifespan: 420,
        speed: { min: 60, max: 200 },
        scale: { start: 0.9, end: 0 },
        rotate: { min: 0, max: 180 },
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(DEPTH.particles);
    this.debrisEmitter = scene.add
      .particles(0, 0, TEXTURES.particleDot, {
        emitting: false,
        lifespan: { min: 400, max: 700 },
        speed: { min: 140, max: 420 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.8, end: 0.1 },
        alpha: { start: 1, end: 0 },
        gravityY: 1100,
      })
      .setDepth(DEPTH.particles);

    // WebGL bağlamı kaybolup geri gelirse (Android'de uygulama arka plana atılınca) önceden
    // çizilmiş tahta dokusu boşalır; yeniden çiz.
    const renderer = scene.game.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const redraw = () => this.drawFrameAndCells();
      renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, redraw);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, redraw));
    }
  }

  get cellSize(): number {
    return this.layout.cellSize;
  }

  get bounds(): BoardLayout {
    return this.layout;
  }

  /** Efektlerin çizildiği katman (tahta yerel koordinatları, taşların üstünde, maskesiz). */
  get effectLayer(): Phaser.GameObjects.Container {
    return this.fxLayer;
  }

  // ───────────────────────── kurulum ve yerleşim ─────────────────────────

  /** Tahtayı sıfırdan çizer ve taş sprite'larını oluşturur. */
  build(board: Board, layout: BoardLayout): void {
    this.clearHint();
    this.setSelected(null);
    for (const sprite of this.byId.values()) this.destroyImage(sprite.image);
    this.byId.clear();
    for (const o of this.obstacleSprites.values()) {
      o.image.destroy();
      o.badge?.destroy();
    }
    this.obstacleSprites.clear();

    this.rows = board.rows;
    this.cols = board.cols;
    this.playable = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) this.playable.push(board.isPlayable({ row, col }));
    }
    this.enclosedHoles = findEnclosedHoles(board.shape);
    this.grid = new Array<TileSprite | null>(this.rows * this.cols).fill(null);

    this.applyLayout(layout);
    for (const p of board.playablePositions()) {
      const tile = board.getTile(p);
      if (tile) this.place(this.createSprite(tile, this.cellCenter(p)), p);
    }
    for (const { pos, layer, obstacle } of board.listObstacles()) {
      const image = this.scene.add.image(0, 0, obstacleTexture(obstacle.kind, obstacle.layers));
      const badge = BADGED.has(obstacle.kind)
        ? this.scene.add
            .text(0, 0, String(obstacle.layers), {
              fontFamily: FONT_FAMILY,
              fontSize: '34px',
              fontStyle: '700',
              color: '#ffffff',
              stroke: '#4a2a0c',
              strokeThickness: 7,
            })
            .setOrigin(0.5)
        : undefined;
      this.layerFor(layer).add(image);
      if (badge) this.layerFor(layer).add(badge);
      this.obstacleSprites.set(obstacle.id, { kind: obstacle.kind, layer, pos, image, badge });
    }
    this.positionObstacles();
  }

  private layerFor(layer: ObstacleLayer): Phaser.GameObjects.Container {
    return layer === 'floor' ? this.floorLayer : layer === 'cover' ? this.coverLayer : this.blockLayer;
  }

  private positionObstacles(): void {
    const cell = this.layout.cellSize;
    for (const o of this.obstacleSprites.values()) {
      const c = this.cellCenter(o.pos);
      const size = o.layer === 'floor' ? cell - 2 * LAYOUT.cellInset : o.layer === 'cover' ? cell * 0.98 : cell * 0.96;
      o.image.setPosition(c.x, c.y).setDisplaySize(size, size);
      o.badge?.setPosition(c.x + cell * 0.3, c.y + cell * 0.3).setScale(cell / 120);
    }
  }

  /** Ekran boyutu değişince çağrılır (yalnızca animasyon yokken). */
  applyLayout(layout: BoardLayout): void {
    this.layout = layout;
    this.tileScale =
      (layout.cellSize * LAYOUT.tileScale) / this.scene.textures.getFrame(tileTexture('fish')).width;
    for (const layer of [this.root, this.floorLayer, this.tileLayer, this.blockLayer, this.coverLayer, this.fxLayer]) {
      layer.setPosition(layout.x, layout.y);
    }
    this.positionObstacles();
    this.drawFrameAndCells();
    this.drawMask();
    for (const sprite of this.byId.values()) {
      const c = this.cellCenter(sprite.pos);
      sprite.image.setPosition(c.x, c.y).setScale(this.tileScale).setAlpha(1);
    }
    if (this.selectedSprite) this.setSelected(this.selectedSprite.pos);
  }

  /**
   * Çerçeve ve kareleri bir kez RenderTexture'a çizer. (Graphics'teki yuvarlak köşeler
   * WebGL'de her karede yeniden üçgenlenir; 64 karelik tahtada FPS'i yarıya düşürüyordu.)
   */
  private drawFrameAndCells(): void {
    const { cellSize, width, height } = this.layout;
    if (width <= 0 || height <= 0) return;
    const pad = LAYOUT.framePadding;
    const border = LAYOUT.frameBorder;
    const margin = pad + border;

    const g = this.scene.make.graphics({}, false);
    // Her karenin etrafına büyütülmüş yuvarlak dikdörtgenler: birleşimleri
    // boşluklu şekillerde bile tahtanın dış hattını oluşturur.
    g.fillStyle(UI_COLORS.frameBorder, 1);
    this.forEachPlayable((x, y) =>
      g.fillRoundedRect(x, y, cellSize + 2 * margin, cellSize + 2 * margin, LAYOUT.frameRadius),
    );
    g.fillStyle(UI_COLORS.frameFill, 1);
    this.forEachPlayable((x, y) =>
      g.fillRoundedRect(x + border, y + border, cellSize + 2 * pad, cellSize + 2 * pad, LAYOUT.frameRadius - border),
    );
    // Tahtanın içinde kalan boşluklar çerçeveyle doldurulur (kenara açılanlar şeffaf kalır).
    for (const hole of this.enclosedHoles) {
      g.fillRect(margin + hole.col * cellSize, margin + hole.row * cellSize, cellSize, cellSize);
    }

    this.boardTexture?.destroy();
    const rt = this.scene.add.renderTexture(-margin, -margin, width + 2 * margin, height + 2 * margin).setOrigin(0, 0);
    rt.draw(g, 0, 0);
    g.destroy();

    const size = cellSize - 2 * LAYOUT.cellInset;
    this.forEachPlayable((x, y, row, col) => {
      const key = (row + col) % 2 === 0 ? TEXTURES.cellLight : TEXTURES.cellDark;
      const scale = size / this.scene.textures.getFrame(key).width;
      rt.stamp(key, undefined, margin + x + cellSize / 2, margin + y + cellSize / 2, { scale });
    });
    this.root.add(rt);
    this.boardTexture = rt;
  }

  private drawMask(): void {
    const { cellSize, x, y } = this.layout;
    this.maskShape.clear();
    this.maskShape.fillStyle(0xffffff, 1);
    // Komşu kareler arasında piksel boşluğu kalmasın diye 1px taşırılır.
    this.forEachPlayable((cx, cy) => this.maskShape.fillRect(x + cx - 1, y + cy - 1, cellSize + 2, cellSize + 2));
  }

  private forEachPlayable(fn: (x: number, y: number, row: number, col: number) => void): void {
    const { cellSize } = this.layout;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.playable[row * this.cols + col]) fn(col * cellSize, row * cellSize, row, col);
      }
    }
  }

  // ───────────────────────── koordinatlar ─────────────────────────

  /** Karenin merkezi (tahta yerel koordinatı). */
  cellCenter(p: { row: number; col: number }): Point {
    const s = this.layout.cellSize;
    return { x: (p.col + 0.5) * s, y: (p.row + 0.5) * s };
  }

  toWorld(local: Point): Point {
    return { x: local.x + this.layout.x, y: local.y + this.layout.y };
  }

  /** Ekran noktasının denk geldiği oynanabilir kare (yoksa null). */
  pointToCell(worldX: number, worldY: number): Pos | null {
    const s = this.layout.cellSize;
    const col = Math.floor((worldX - this.layout.x) / s);
    const row = Math.floor((worldY - this.layout.y) / s);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return this.playable[row * this.cols + col] ? { row, col } : null;
  }

  hasTile(p: Pos): boolean {
    return this.at(p) !== null;
  }

  isSpecial(p: Pos): boolean {
    return this.at(p)?.special !== undefined;
  }

  private index(p: Pos): number {
    return p.row * this.cols + p.col;
  }

  private at(p: Pos): TileSprite | null {
    if (p.row < 0 || p.row >= this.rows || p.col < 0 || p.col >= this.cols) return null;
    return this.grid[this.index(p)];
  }

  private place(sprite: TileSprite, p: Pos): void {
    this.grid[this.index(p)] = sprite;
    sprite.pos = p;
  }

  /** Sprite'ı tahtadan ayırır (görüntüsü animasyon bitene kadar kalır). */
  private detach(sprite: TileSprite): void {
    this.byId.delete(sprite.id);
    if (this.grid[this.index(sprite.pos)] === sprite) this.grid[this.index(sprite.pos)] = null;
  }

  private createSprite(tile: Pick<Tile, 'id' | 'color' | 'special'>, local: Point): TileSprite {
    const image = this.scene.add.image(local.x, local.y, tileTexture(tile.color, tile.special)).setScale(this.tileScale);
    this.tileLayer.add(image);
    const sprite: TileSprite = { id: tile.id, color: tile.color, special: tile.special, pos: { row: -1, col: -1 }, image };
    this.byId.set(tile.id, sprite);
    if (tile.special) this.startIdle(image, tile.special);
    return sprite;
  }

  /**
   * Güçlendiriciler tahtada hafifçe sallanır (dikkat çeker). Yalnızca açı değişir;
   * ölçek ve konum animasyonlarıyla (düşme, kırılma, ipucu) çakışmaz.
   */
  private startIdle(image: Phaser.GameObjects.Image, special: SpecialKind): void {
    const swing = special === 'whirlpool' ? ANIM.idleSwirlAngle : ANIM.idleSwingAngle;
    image.setAngle(-swing);
    this.scene.tweens.add({
      targets: image,
      angle: swing,
      duration: ANIM.idleSwingMs + Phaser.Math.Between(-120, 120),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Görüntüyü ve üzerindeki sürekli animasyonları (sallanma) yok eder. */
  private destroyImage(image: Phaser.GameObjects.Image): void {
    this.scene.tweens.killTweensOf(image);
    image.destroy();
  }

  /** Parçacık patlaması (tahta yerel koordinatında). Yavaş cihazda sayı azalır. */
  burst(local: Point, color: TileColor | null, count: number = ANIM.particlesPerTile): void {
    const world = this.toWorld(local);
    if (color) this.emitters.get(color)?.explode(quality.count(count), world.x, world.y);
    if (!quality.low) this.sparkEmitter.explode(Math.max(2, Math.round(count / 4)), world.x, world.y);
  }

  // ───────────────────────── bölüm girişi ─────────────────────────

  /** Taşları tahtanın üstüne alır (maske gizler) ve engelleri saydamlaştırır; playIntro ile iner. */
  prepareIntro(): void {
    const lift = (this.rows + 1) * this.layout.cellSize;
    for (const sprite of this.byId.values()) sprite.image.setY(this.cellCenter(sprite.pos).y - lift);
    for (const o of this.obstacleSprites.values()) {
      o.image.setAlpha(0);
      o.badge?.setAlpha(0);
    }
  }

  /** Bölüm başı: taşlar sütun sütun yağmur gibi yerine düşer, engeller belirir. */
  async playIntro(): Promise<void> {
    const drops = [...this.byId.values()].map((sprite) =>
      tweenAsync(this.scene, {
        targets: sprite.image,
        y: this.cellCenter(sprite.pos).y,
        duration: ANIM.introDropMs,
        delay: sprite.pos.col * ANIM.introColStaggerMs + (this.rows - 1 - sprite.pos.row) * ANIM.introRowStaggerMs,
        ease: 'Back.easeOut',
      }),
    );
    const obstacles = [...this.obstacleSprites.values()].map((o, i) => {
      const scale = o.image.scale;
      o.image.setScale(scale * 0.4);
      return tweenAsync(this.scene, {
        targets: o.image,
        alpha: 1,
        scale,
        duration: 320,
        delay: 200 + i * 15,
        ease: 'Back.easeOut',
        onStart: () => o.badge?.setAlpha(1),
      });
    });
    await Promise.all([...drops, ...obstacles]);
    audio.play('land');
  }

  // ───────────────────────── animasyonlar ─────────────────────────

  /** Yer değiştirme; bounceBack=true ise eşleşme olmadığı için taşlar geri döner. */
  async animateSwap(a: Pos, b: Pos, bounceBack: boolean): Promise<void> {
    const sa = this.at(a);
    const sb = this.at(b);
    if (!sa || !sb) return;
    const pa = this.cellCenter(a);
    const pb = this.cellCenter(b);
    this.tileLayer.bringToTop(sa.image);

    const move = (s: TileSprite, to: Point) =>
      tweenAsync(this.scene, { targets: s.image, x: to.x, y: to.y, duration: ANIM.swapMs, ease: ANIM.swapEase });

    audio.play('swap');
    await Promise.all([move(sa, pb), move(sb, pa)]);
    if (bounceBack) {
      audio.play('invalid');
      await Promise.all([move(sa, pa), move(sb, pb)]);
    } else {
      this.place(sa, b);
      this.place(sb, a);
    }
  }

  /** Geçersiz yöne (duvar/boşluk) kaydırmada taş hafifçe itilip geri gelir. */
  async animateNudge(a: Pos, toward: Pos): Promise<void> {
    const s = this.at(a);
    if (!s) return;
    const c = this.cellCenter(a);
    const d = this.layout.cellSize * ANIM.nudgeDistance;
    await tweenAsync(this.scene, {
      targets: s.image,
      x: c.x + Math.sign(toward.col - a.col) * d,
      y: c.y + Math.sign(toward.row - a.row) * d,
      duration: ANIM.nudgeMs,
      ease: 'Quad.easeOut',
      yoyo: true,
    });
  }

  /**
   * Taşları kırar: şişip küçülerek kaybolur, renkli parçacıklar saçılır.
   * `delayOf` ile her taş ayrı zamanda kırılabilir (ör. zıpkın geçerken).
   * Sprite'lar hemen tahtadan ayrılır; yalnızca görüntü gecikir.
   */
  async popTiles(cleared: readonly ClearedTile[], delayOf: (c: ClearedTile) => number = () => 0): Promise<void> {
    const base = this.tileScale;
    const jobs = cleared.map(async (c) => {
      const sprite = this.byId.get(c.tileId);
      if (!sprite) return;
      this.detach(sprite);
      const delay = delayOf(c);
      if (delay > 0) await waitMs(this.scene, delay);

      this.burst(this.cellCenter(sprite.pos), sprite.special === 'whirlpool' ? null : c.color);
      this.tileLayer.bringToTop(sprite.image);
      await tweenAsync(this.scene, {
        targets: sprite.image,
        scale: base * ANIM.clearPeakScale,
        duration: ANIM.clearMs * 0.35,
        ease: 'Quad.easeOut',
      });
      await tweenAsync(this.scene, {
        targets: sprite.image,
        scale: 0,
        alpha: 0,
        duration: ANIM.clearMs * 0.65,
        ease: 'Back.easeIn',
      });
      this.destroyImage(sprite.image);
    });
    await Promise.all(jobs);
  }

  /** Eşleşen taşlar güçlendiricinin doğacağı karede toplanır, ardından güçlendirici belirir. */
  async mergeInto(created: CreatedSpecial): Promise<void> {
    const target = this.cellCenter(created.pos);
    const base = this.tileScale;
    await Promise.all(
      created.mergedTileIds.map(async (id) => {
        const sprite = this.byId.get(id);
        if (!sprite) return;
        this.detach(sprite);
        await tweenAsync(this.scene, {
          targets: sprite.image,
          x: target.x,
          y: target.y,
          scale: base * 0.7,
          duration: ANIM.mergeMs,
          ease: 'Quad.easeIn',
        });
        this.destroyImage(sprite.image);
      }),
    );

    const sprite = this.createSprite(created.tile, target);
    this.place(sprite, created.pos);
    sprite.image.setScale(0);
    this.burst(target, created.tile.special === 'whirlpool' ? null : created.tile.color, 14);
    audio.play('create');
    // Doğuş anında genişleyen parlak halka.
    const ring = this.scene.add
      .image(target.x, target.y, TEXTURES.ring)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.3)
      .setAlpha(0.9);
    this.fxLayer.add(ring);
    void tweenAsync(this.scene, {
      targets: ring,
      scale: (this.layout.cellSize * 1.8) / 128,
      alpha: 0,
      duration: ANIM.createRingMs,
      ease: 'Cubic.easeOut',
    }).then(() => ring.destroy());
    await tweenAsync(this.scene, {
      targets: sprite.image,
      scale: base,
      duration: ANIM.createPopMs,
      ease: 'Back.easeOut',
    });
  }

  /** Taşın güçlendiriciye dönüşmesi (Girdap kombosu, geliştirici paneli). */
  async convertTile(tileId: number, special: SpecialKind | undefined): Promise<void> {
    const sprite = this.byId.get(tileId);
    if (!sprite) return;
    sprite.special = special;
    sprite.image.setTexture(tileTexture(sprite.color, special));
    this.scene.tweens.killTweensOf(sprite.image);
    sprite.image.setAngle(0).setScale(this.tileScale);
    if (special) this.startIdle(sprite.image, special);
    this.burst(this.cellCenter(sprite.pos), null, 6);
    await tweenAsync(this.scene, {
      targets: sprite.image,
      scale: this.tileScale * 1.25,
      duration: ANIM.convertPopMs / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /**
   * Engellere vuruş: katman azalırsa sarsılır ve görünüm değişir, biterse dağılıp kaybolur.
   * delayOf ile her vuruş, etkinin o kareye ulaştığı ana denk getirilir.
   */
  async hitObstacles(hits: readonly ObstacleHit[], delayOf: (h: ObstacleHit) => number = () => 0): Promise<void> {
    await Promise.all(
      hits.map(async (hit) => {
        const sprite = this.obstacleSprites.get(hit.obstacleId);
        if (!sprite) return;
        if (hit.destroyed) this.obstacleSprites.delete(hit.obstacleId);
        const delay = delayOf(hit);
        if (delay > 0) await waitMs(this.scene, delay);

        const center = this.cellCenter(hit.pos);
        audio.play(hit.kind);
        this.debris(center, OBSTACLE_TINTS[hit.kind], hit.destroyed ? 16 : 7);
        if (hit.destroyed) {
          sprite.badge?.destroy();
          await tweenAsync(this.scene, {
            targets: sprite.image,
            scale: sprite.image.scale * 1.25,
            alpha: 0,
            duration: 240,
            ease: 'Quad.easeOut',
          });
          sprite.image.destroy();
          return;
        }
        sprite.image.setTexture(obstacleTexture(hit.kind, hit.layersLeft));
        sprite.badge?.setText(String(hit.layersLeft));
        await tweenAsync(this.scene, {
          targets: sprite.image,
          x: center.x + this.layout.cellSize * 0.06,
          duration: 45,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.easeInOut',
        });
        sprite.image.setX(center.x);
      }),
    );
  }

  /** Engel kırıntısı (kum, yaprak, tahta, altın…). */
  debris(local: Point, tint: number, count: number): void {
    const world = this.toWorld(local);
    this.debrisEmitter.setParticleTint(tint);
    this.debrisEmitter.explode(quality.count(count), world.x, world.y);
  }

  /** Taşlar aşağı düşer, yenileri tahtanın üstünden gelir; inişte hafifçe zıplar. */
  async animateFalls(falls: readonly FallMove[], spawns: readonly SpawnMove[]): Promise<void> {
    const drops: { sprite: TileSprite; path: readonly PathStep[] }[] = [];

    const moving = falls.map((f) => ({ f, sprite: this.byId.get(f.tileId) }));
    for (const { f, sprite } of moving) {
      if (sprite && this.grid[this.index(f.from)] === sprite) this.grid[this.index(f.from)] = null;
    }
    for (const { f, sprite } of moving) {
      if (!sprite) continue;
      this.place(sprite, f.to);
      drops.push({ sprite, path: f.path });
    }
    for (const s of spawns) {
      const sprite = this.createSprite(s.tile, this.cellCenter(s.path[0].pos));
      this.place(sprite, s.to);
      drops.push({ sprite, path: s.path });
    }

    await Promise.all(drops.map(({ sprite, path }) => this.followPath(sprite, path)));
    if (drops.length > 0) audio.play('land', { volume: 0.7 });
  }

  /**
   * Taşı yerçekimi simülasyonunun yolu boyunca yürütür. Adım zamanları tüm taşlar için ortaktır
   * (çakışma olmaz); adımlar giderek kısalır, böylece düşüş hızlanır. Sonda hafif zıplama.
   */
  private async followPath(sprite: TileSprite, path: readonly PathStep[]): Promise<void> {
    const base = this.tileScale;
    const tickTime = (tick: number) => (tick <= 0 ? 0 : ANIM.fallTickMs * Math.pow(tick, ANIM.fallTickExponent));
    const segments: Phaser.Types.Tweens.TweenBuilderConfig[] = [];
    let clock = tickTime(path[0].tick);
    for (let i = 1; i < path.length; i++) {
      const start = tickTime(path[i].tick - 1);
      const end = tickTime(path[i].tick);
      const point = this.cellCenter(path[i].pos);
      segments.push({
        targets: sprite.image,
        x: point.x,
        y: point.y,
        duration: Math.max(1, end - start),
        delay: Math.max(0, start - clock),
        ease: 'Linear',
      });
      clock = end;
    }
    const startDelay = tickTime(path[0].tick);
    if (startDelay > 0) await waitMs(this.scene, startDelay);
    await chainAsync(this.scene, segments);
    const target = this.cellCenter(sprite.pos);
    await tweenAsync(this.scene, {
      targets: sprite.image,
      y: target.y - this.layout.cellSize * ANIM.landBounceHeight,
      scaleX: base * (1 - ANIM.landSquash / 2),
      scaleY: base * (1 + ANIM.landSquash / 2),
      duration: ANIM.landBounceMs,
      ease: 'Quad.easeOut',
      yoyo: true,
    });
  }

  /** Karıştırma: taşlar merkezde toplanıp yeni yerlerine saçılır. */
  async animateShuffle(moves: readonly ShuffleMove[]): Promise<void> {
    this.clearHint();
    audio.play('shuffle');
    // Taşlar merkezde toplanırken boşlukların üzerinden geçebilir; maskeyi geçici kaldır.
    this.tileLayer.clearMask();
    const base = this.tileScale;
    const center = { x: this.layout.width / 2, y: this.layout.height / 2 };
    const radius = this.layout.cellSize * 1.4;
    const sprites = moves.map((m) => ({ m, sprite: this.byId.get(m.tileId) }));

    await Promise.all(
      sprites.map(({ sprite }) => {
        if (!sprite) return Promise.resolve();
        const angle = Math.random() * Math.PI * 2;
        const distance = radius * Math.sqrt(Math.random());
        return tweenAsync(this.scene, {
          targets: sprite.image,
          x: center.x + Math.cos(angle) * distance,
          y: center.y + Math.sin(angle) * distance,
          scale: base * 0.6,
          duration: ANIM.shuffleGatherMs,
          ease: 'Cubic.easeIn',
        });
      }),
    );

    for (const { m, sprite } of sprites) {
      if (sprite && this.grid[this.index(m.from)] === sprite) this.grid[this.index(m.from)] = null;
    }
    for (const { m, sprite } of sprites) {
      if (!sprite) continue;
      this.place(sprite, m.to);
      if (sprite.color !== m.color) {
        sprite.color = m.color;
        sprite.image.setTexture(tileTexture(m.color, sprite.special));
      }
    }

    await Promise.all(
      sprites.map(({ m, sprite }, i) => {
        if (!sprite) return Promise.resolve();
        const target = this.cellCenter(m.to);
        return tweenAsync(this.scene, {
          targets: sprite.image,
          x: target.x,
          y: target.y,
          scale: base,
          duration: ANIM.shuffleSpreadMs,
          delay: i * 4,
          ease: 'Back.easeOut',
        });
      }),
    );
    this.tileLayer.setMask(this.tileMask);
  }

  // ───────────────────────── seçim ve ipucu ─────────────────────────

  setSelected(p: Pos | null): void {
    for (const tween of this.selectionTweens) tween.stop();
    this.selectionTweens = [];
    if (this.selectedSprite?.image.active) this.selectedSprite.image.setScale(this.tileScale);
    this.selectedSprite = null;

    const sprite = p ? this.at(p) : null;
    if (!p || !sprite) {
      this.selection.setVisible(false);
      return;
    }
    const c = this.cellCenter(p);
    const size = this.layout.cellSize;
    this.selection.setPosition(c.x, c.y).setDisplaySize(size, size).setVisible(true).setAlpha(1);
    this.selectedSprite = sprite;
    this.selectionTweens.push(
      this.scene.tweens.add({
        targets: sprite.image,
        scale: this.tileScale * ANIM.selectPulseScale,
        duration: 260,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
      this.scene.tweens.add({
        targets: this.selection,
        alpha: 0.55,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );
  }

  /**
   * İpucu: hareket edecek taş hedefine doğru dürtülür, eşleşecek diğer taşlar nabız gibi atar.
   * a = b ise (yalnızca güçlendirici kaldıysa) o güçlendirici nabız gibi atar.
   */
  showHint(move: PossibleMove): void {
    this.clearHint();
    const base = this.tileScale;
    const pulse = (sprite: TileSprite, scale: number) => {
      this.hinted.push(sprite);
      this.hintTweens.push(
        this.scene.tweens.add({
          targets: sprite.image,
          scale: base * scale,
          duration: ANIM.hintMs,
          yoyo: true,
          repeat: -1,
          repeatDelay: ANIM.hintRepeatDelayMs,
          ease: 'Sine.easeInOut',
        }),
      );
    };

    if (samePos(move.a, move.b)) {
      const sprite = this.at(move.a);
      if (sprite) pulse(sprite, ANIM.hintPulseScale * 1.08);
      return;
    }

    const inMatch = (p: Pos) => move.matchCells.some((c) => samePos(c, p));
    const nudge = this.layout.cellSize * ANIM.hintNudge;
    const movers: [Pos, Pos][] = [];
    if (inMatch(move.b)) movers.push([move.a, move.b]);
    if (inMatch(move.a)) movers.push([move.b, move.a]);

    for (const [from, to] of movers) {
      const sprite = this.at(from);
      if (!sprite) continue;
      const c = this.cellCenter(from);
      this.hinted.push(sprite);
      this.hintTweens.push(
        this.scene.tweens.add({
          targets: sprite.image,
          x: c.x + (to.col - from.col) * nudge,
          y: c.y + (to.row - from.row) * nudge,
          duration: ANIM.hintMs,
          yoyo: true,
          repeat: -1,
          repeatDelay: ANIM.hintRepeatDelayMs,
          ease: 'Sine.easeInOut',
        }),
      );
    }

    for (const p of move.matchCells) {
      if (samePos(p, move.a) || samePos(p, move.b)) continue;
      const sprite = this.at(p);
      if (sprite) pulse(sprite, ANIM.hintPulseScale);
    }
  }

  clearHint(): void {
    for (const tween of this.hintTweens) tween.stop();
    this.hintTweens = [];
    const base = this.tileScale;
    for (const sprite of this.hinted) {
      if (!sprite.image.active) continue;
      const c = this.cellCenter(sprite.pos);
      sprite.image.setPosition(c.x, c.y).setScale(base);
    }
    this.hinted = [];
  }

  // ───────────────────────── hata ayıklama ─────────────────────────

  /** Geliştirme modunda: görünüm, mantıktaki tahtayla birebir aynı mı? */
  findDesync(board: Board): string | null {
    for (const p of board.playablePositions()) {
      const tile = board.getTile(p);
      const sprite = this.at(p);
      if ((tile?.id ?? null) !== (sprite?.id ?? null)) {
        return `(${p.row},${p.col}) mantık=${tile?.id ?? '-'} görünüm=${sprite?.id ?? '-'}`;
      }
      if (tile && sprite && (tile.color !== sprite.color || tile.special !== sprite.special)) {
        return `(${p.row},${p.col}) taş farklı: ${tile.color}/${tile.special ?? '-'} ≠ ${sprite.color}/${sprite.special ?? '-'}`;
      }
    }
    if (this.byId.size !== board.playablePositions().filter((p) => board.getTile(p)).length) {
      return `sprite sayısı farklı: ${this.byId.size}`;
    }
    const obstacles = board.listObstacles();
    if (obstacles.length !== this.obstacleSprites.size || obstacles.some((o) => !this.obstacleSprites.has(o.obstacle.id))) {
      return `engel sayısı farklı: mantık ${obstacles.length}, görünüm ${this.obstacleSprites.size}`;
    }
    return null;
  }
}
