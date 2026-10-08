import Phaser from 'phaser';
import { TOWN, type TownRegion } from '../../meta/town';
import type { TownProgress } from '../../meta/TownProgress';
import { FONT_FAMILY } from '../../config/theme';
import { t, type I18nKey } from '../../i18n';
import { TEXTURES } from '../../assets/AssetManifest';
import { audio } from '../../services/Audio';

export class SagaMapView {
  private container: Phaser.GameObjects.Container;
  private backgroundGraphics: Phaser.GameObjects.Graphics;
  private cameraY: number = 0;
  private startY: number = 0;
  private isDragging: boolean = false;
  private maxScroll: number = 0;

  constructor(
    private scene: Phaser.Scene,
    depth: number,
    private townProgress: TownProgress,
    private onRegionClick: (region: TownRegion) => void
  ) {
    this.container = scene.add.container(0, 0).setDepth(depth);
    this.backgroundGraphics = scene.add.graphics();
    this.container.add(this.backgroundGraphics);
    
    // Create interactive zone for dragging
    const zone = scene.add.zone(0, 0, scene.scale.width, scene.scale.height * 2)
      .setOrigin(0)
      .setInteractive({ draggable: true });
    
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.startY = pointer.y;
    });

    zone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const delta = pointer.y - this.startY;
      this.cameraY += delta;
      this.startY = pointer.y;
      this.applyScroll();
    });

    zone.on('pointerup', () => { this.isDragging = false; });
    zone.on('pointerout', () => { this.isDragging = false; });
    
    this.container.add(zone);
    this.buildMap();
  }

  private buildMap() {
    this.backgroundGraphics.clear();
    this.backgroundGraphics.lineStyle(16, 0xffffff, 0.5);

    const nodeSpacing = 300;
    const startY = 800; // Bottom-up
    this.maxScroll = TOWN.length * nodeSpacing;
    
    let prevX = 0;
    let prevY = 0;

    TOWN.forEach((region, index) => {
      // Create a zigzag path
      const dir = (index % 2 === 0) ? 1 : -1;
      const x = this.scene.scale.width / 2 + (dir * 150);
      const y = startY - (index * nodeSpacing);

      if (index > 0) {
        this.backgroundGraphics.beginPath();
        this.backgroundGraphics.moveTo(prevX, prevY);
        this.backgroundGraphics.lineTo(x, y);
        this.backgroundGraphics.strokePath();
      }
      prevX = x;
      prevY = y;

      const isUnlocked = this.townProgress.unlockedRegions.some(r => r.id === region.id);
      const isComplete = this.townProgress.isRegionComplete(region);
      const isCurrent = isUnlocked && !isComplete && this.townProgress.currentRegion.id === region.id;
      
      const nodeColor = isComplete ? 0x2ecc71 : (isCurrent ? 0xf1c40f : (isUnlocked ? 0x3498db : 0x95a5a6));

      // Node background
      const circle = this.scene.add.circle(x, y, 60, nodeColor)
        .setStrokeStyle(6, 0xffffff)
        .setInteractive({ useHandCursor: isUnlocked });

      if (isUnlocked) {
        circle.on('pointerdown', () => {
          if (!this.isDragging) { // Simple check, might need better click/drag separation
            audio.play('popup');
            this.onRegionClick(region);
          }
        });
        
        // Bounce animation for current
        if (isCurrent) {
          this.scene.tweens.add({ targets: circle, scale: 1.1, duration: 600, yoyo: true, repeat: -1 });
        }
      } else {
        circle.setAlpha(0.6);
      }

      this.container.add(circle);

      // Label
      const label = this.scene.add.text(x, y + 80, t(`region.${region.id}` as I18nKey), {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);
      
      if (!isUnlocked) label.setAlpha(0.6);
      this.container.add(label);

      // Icon (Lock or Check)
      if (isComplete) {
        const check = this.scene.add.image(x, y, TEXTURES.check).setDisplaySize(50, 50);
        this.container.add(check);
      } else if (!isUnlocked) {
        const lock = this.scene.add.image(x, y, TEXTURES.lock).setDisplaySize(40, 40);
        this.container.add(lock);
      } else {
        const textNum = this.scene.add.text(x, y, `${index + 1}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '40px',
          fontStyle: 'bold',
          color: '#ffffff'
        }).setOrigin(0.5);
        this.container.add(textNum);
      }
    });

    this.applyScroll();
  }

  private applyScroll() {
    // Constrain camera
    if (this.cameraY > 0) this.cameraY = 0;
    if (this.cameraY < -this.maxScroll + this.scene.scale.height) this.cameraY = -this.maxScroll + this.scene.scale.height;
    
    // We scroll by moving the container
    this.container.y = this.cameraY;
  }

  public refresh() { this.buildMap(); }

  public layout(_width: number, _height: number) {
    // Not strictly needed since we re-build or just adjust bounds, but good to have
  }

  public destroy() {
    this.container.destroy();
  }
}
