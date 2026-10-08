import Phaser from 'phaser';
import { TEXTURES } from '../../assets/AssetManifest';
import { FEEDBACK } from '../../config/feedback';
import { FONT_FAMILY } from '../../config/theme';
import { t, type I18nKey } from '../../i18n';
import { audio } from '../../services/Audio';
import { vibrate } from '../../services/Haptics';
import { quality } from '../../services/Quality';

const DEPTH = 55;

/**
 * Zincirleme komboda beliren yazılar ("Güzel!", "Harika!", "Muhteşem!", "İnanılmaz!").
 * Yazılar sahne açılırken bir kez çizilir ve yeniden kullanılır: oyun sırasında yazı dokusu
 * üretmek (özellikle yavaş telefonlarda) kare atlatır.
 */
export class ComboWords {
  private readonly words: Phaser.GameObjects.Text[];
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private readonly scene: Phaser.Scene) {
    this.words = FEEDBACK.comboColors.map((color, i) => {
      const text = scene.add
        .text(0, 0, t(`combo.${i + 1}` as I18nKey), {
          fontFamily: FONT_FAMILY,
          fontSize: `${FEEDBACK.comboFontSize}px`,
          fontStyle: '700',
          color,
          stroke: FEEDBACK.comboStroke,
          strokeThickness: 18,
        })
        .setOrigin(0.5)
        .setDepth(DEPTH)
        .setVisible(false);
      text.setShadow(0, 8, 'rgba(0,0,0,0.35)', 0, true, true);
      return text;
    });
    this.sparks = scene.add
      .particles(0, 0, TEXTURES.particleSpark, {
        emitting: false,
        lifespan: 650,
        speed: { min: 200, max: 520 },
        scale: { start: 1.3, end: 0 },
        rotate: { min: 0, max: 360 },
        tint: [0xffe066, 0xffffff, 0xff9ad5, 0x8ef59b],
        blendMode: Phaser.BlendModes.ADD,
      })
      // Kıvılcımlar yazının arkasında kalsın (okunurluk).
      .setDepth(DEPTH - 1);
  }

  /** tier: 1-4. Önceki yazı hâlâ görünüyorsa yerini yenisi alır. */
  show(tier: number, x: number, y: number): void {
    const index = Phaser.Math.Clamp(tier, 1, this.words.length) - 1;
    for (const word of this.words) {
      this.scene.tweens.killTweensOf(word);
      word.setVisible(false);
    }
    const word = this.words[index];
    word.setPosition(x, y).setScale(0.2).setAlpha(1).setAngle(-8).setVisible(true);
    this.scene.tweens.chain({
      targets: word,
      tweens: [
        { scale: 1.12, angle: 0, duration: 220, ease: 'Back.easeOut' },
        { scale: 1, duration: 120 },
        { y: y - 80, alpha: 0, duration: 380, delay: 520, ease: 'Quad.easeIn' },
      ],
      onComplete: () => word.setVisible(false),
    });
    this.sparks.explode(quality.count(14 + index * 6), x, y);
    audio.play('combo', { pitch: index * 2 });
    if (index >= 2) vibrate('light');
  }
}
