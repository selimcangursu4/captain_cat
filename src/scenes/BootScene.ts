import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManifest';
import { buildSvgTextures, ensureTextures, queueFileAssets } from '../assets/loadAssets';
import { FONT_FAMILY, UI_COLORS } from '../config/theme';
import { t } from '../i18n';
import { currentUser } from '../net/account';
import { tweenAsync, waitMs } from '../ui/tweens';
import { SCENES, goToScene, type GameSceneData } from './keys';

/** Açılış ekranının en kısa görünme süresi (dokular daha erken biterse). */
const SPLASH_MIN_MS = 1800;
const BAR = { width: 520, height: 26 } as const;

/**
 * Açılış: önce yalnızca arka plan ve Kaptan Pati çizilir, açılış ekranı hemen başlar;
 * geri kalan dokular bu sırada üretilir (ilerleme çubuğu). Sonra kasabaya (ya da ?level= ile bölüme).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    queueFileAssets(this);
  }

  create(): void {
    const started = performance.now();
    ensureTextures(this, [TEXTURES.background, TEXTURES.captain])
      .then(async () => {
        const progress = this.showSplash();
        hideNativeSplash();
        await Promise.all([
          buildSvgTextures(this, progress),
          waitMs(this, SPLASH_MIN_MS),
        ]);
        if (import.meta.env.DEV) console.info(`[Kaptan Pati] dokular hazır: ${Math.round(performance.now() - started)} ms`);
        this.next();
      })
      .catch((error: unknown) => {
        console.error(error);
        hideNativeSplash();
        const { width, height } = this.scale;
        this.add
          .text(width / 2, height / 2, t('app.loadError'), { fontFamily: FONT_FAMILY, fontSize: '56px', color: UI_COLORS.titleText })
          .setOrigin(0.5);
      });
  }

  /** Açılış animasyonunu başlatır; ilerleme çubuğunu güncelleyen fonksiyonu döndürür. */
  private showSplash(): (fraction: number) => void {
    const { width, height } = this.scale;
    this.add.image(0, 0, TEXTURES.background).setOrigin(0).setDisplaySize(width, height);
    const captain = this.add.image(width / 2, height * 0.42, TEXTURES.captain).setDisplaySize(420, 420);
    const base = captain.scale;
    captain.setScale(0);
    const title = this.add
      .text(width / 2, height * 0.42 + 290, t('app.title'), {
        fontFamily: FONT_FAMILY,
        fontSize: '120px',
        fontStyle: '700',
        color: UI_COLORS.titleText,
        stroke: UI_COLORS.titleStroke,
        strokeThickness: 18,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    title.setShadow(0, 8, 'rgba(0,0,0,0.3)', 0, true, true);
    const tagline = this.add
      .text(width / 2, title.y + 110, t('splash.tagline'), {
        fontFamily: FONT_FAMILY,
        fontSize: '46px',
        fontStyle: '600',
        color: UI_COLORS.bannerText,
        stroke: UI_COLORS.titleStroke,
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // İlerleme çubuğu (yuvarlak köşeli, altın dolgulu).
    const barY = tagline.y + 130;
    const barX = width / 2 - BAR.width / 2;
    const bar = this.add.graphics();
    const drawBar = (fraction: number) => {
      bar.clear();
      bar.fillStyle(0x06263d, 0.55).fillRoundedRect(barX, barY, BAR.width, BAR.height, BAR.height / 2);
      const fill = Math.max(BAR.height, BAR.width * fraction);
      bar.fillStyle(0xffd23f, 1).fillRoundedRect(barX, barY, fill, BAR.height, BAR.height / 2);
      bar.lineStyle(4, 0xffffff, 0.8).strokeRoundedRect(barX, barY, BAR.width, BAR.height, BAR.height / 2);
    };
    drawBar(0);

    void (async () => {
      await tweenAsync(this, { targets: captain, scale: base, angle: { from: -20, to: 0 }, duration: 520, ease: 'Back.easeOut' });
      this.tweens.add({ targets: captain, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      await tweenAsync(this, { targets: title, alpha: 1, y: title.y - 20, duration: 300 });
      await tweenAsync(this, { targets: tagline, alpha: 1, duration: 300 });
    })();
    return drawBar;
  }

  private next(): void {
    // Hesap zorunlu: oturum yoksa önce giriş / kayıt.
    if (!currentUser()) {
      goToScene(this, SCENES.auth);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const level = Number.parseInt(params.get('level') ?? '', 10);
    if (Number.isFinite(level)) {
      const seed = Number.parseInt(params.get('seed') ?? '', 10);
      const data: GameSceneData = { levelId: level, seed: Number.isFinite(seed) ? seed : undefined };
      goToScene(this, SCENES.game, data);
    } else {
      goToScene(this, SCENES.home);
    }
  }
}

/**
 * Telefonda (Capacitor) uygulamanın yerel açılış ekranı kendiliğinden kapanmaz (capacitor.config.ts
 * launchAutoHide: false): oyunun kendi açılış ekranı çizilince burada kapatılır, arada boş ekran görünmez.
 */
function hideNativeSplash(): void {
  if (!Capacitor.isNativePlatform()) return;
  SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
}
