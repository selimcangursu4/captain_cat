import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-ext-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/fredoka/latin-ext-700.css';
import Phaser from 'phaser';
import { DISPLAY } from './config/display';
import { t } from './i18n';
import { expireSession, loadCachedLevels, refreshLevels, restoreSession } from './net/account';
import { dispatch, sync } from './net/sync';
import { AuthScene } from './scenes/AuthScene';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { HomeScene } from './scenes/HomeScene';
import { SCENES, goToScene, type AuthSceneData } from './scenes/keys';
import { audio } from './services/Audio';
import { monitorQuality, quality } from './services/Quality';
import { saveService } from './services/SaveService';
import { settings } from './services/Settings';

/** Yazı tipi tuvale çizilmeden önce yüklenmeli; yoksa Phaser yedek fontla çizer. */
async function waitForFonts(timeoutMs = 3000): Promise<void> {
  if (!('fonts' in document)) return;
  // Türkçe karakterler latin-ext alt kümesinde; o dosyanın da yüklenmesini istiyoruz.
  const sample = 'Kaptan Pati ğüşıöç ĞÜŞİÖÇ';
  const loads = ['600', '700'].map((weight) => document.fonts.load(`${weight} 48px Fredoka`, sample));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([Promise.all(loads).then(() => undefined), timeout]);
}

function startGame(): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: DISPLAY.backgroundColor,
    scale: {
      // EXPAND: referans alan (1080x1920) her zaman görünür; uzun/geniş ekranlarda
      // oyun alanı siyah bant bırakmadan genişler.
      mode: Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: DISPLAY.width,
      height: DISPLAY.height,
    },
    // Giriş ekranındaki metin kutuları gerçek HTML öğeleridir (telefon klavyesi için).
    dom: { createContainer: true },
    fps: { target: DISPLAY.targetFps },
    render: { antialias: true, powerPreference: 'high-performance' },
    scene: [BootScene, AuthScene, HomeScene, GameScene],
  });
}

// Kayıtlı dil (ya da cihaz dili) ilk metin çizilmeden uygulanır.
settings.applyLanguage();
// Daha önce indirilen seviyeler ve kayıtlı oturum (varsa) internet gerekmeden yüklenir.
loadCachedLevels();
const session = restoreSession();

/** Geliştirme: ?fps ile sol üstte anlık FPS (telefonda performans denemek için). */
function showFpsMeter(game: Phaser.Game): void {
  const meter = document.createElement('div');
  meter.style.cssText =
    'position:fixed;left:6px;top:6px;z-index:10;padding:2px 8px;border-radius:8px;' +
    'background:rgba(0,0,0,.55);color:#7CFC9A;font:600 14px monospace;pointer-events:none';
  document.body.appendChild(meter);
  setInterval(() => {
    const fps = Math.round(game.loop.actualFps);
    meter.textContent = `${fps} FPS${quality.low ? ' · düşük kalite' : ''}`;
    meter.style.color = fps >= 55 ? '#7CFC9A' : fps >= 40 ? '#FFD23F' : '#FF6B81';
  }, 500);
}

waitForFonts()
  .catch(() => undefined)
  .finally(() => {
    const game = startGame();
    monitorQuality(game);

    // Sunucu oturumu reddederse (çıkış yapılmış, süresi dolmuş): giriş ekranına. Telefondaki
    // kaydedilmemiş ilerleme silinmez; aynı hesapla tekrar girilince eşitlenir.
    sync.onStatus((status) => {
      if (status !== 'unauthorized') return;
      expireSession();
      const active = game.scene.getScenes(true)[0];
      const data: AuthSceneData = { message: t('auth.expired') };
      if (active && active.scene.key !== SCENES.auth && active.scene.key !== SCENES.boot) goToScene(active, SCENES.auth, data);
    });
    if (session) {
      void sync.syncNow();
      void refreshLevels();
    }

    // Yalnızca geliştirme: tarayıcı konsolundan / otomasyon testlerinden oyuna ve kayda erişim.
    if (import.meta.env.DEV) {
      Object.assign(window, { __kaptan: game, __kaptanSave: saveService, __kaptanAudio: audio, __kaptanSync: sync, __kaptanDispatch: dispatch });
      if (new URLSearchParams(window.location.search).has('fps')) showFpsMeter(game);
    }
  });
