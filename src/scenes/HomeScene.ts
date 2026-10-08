import Phaser from 'phaser';
import { TEXTURES, obstacleTexture, townPartTexture } from '../assets/AssetManifest';
import { ensureTextures } from '../assets/loadAssets';
import { HOME } from '../config/layout';
import { FONT_FAMILY, UI_COLORS } from '../config/theme';
import { t, type I18nKey } from '../i18n';
import { dailyReward, levelProgress, lives, townProgress } from '../meta/progress';
import { getTask, type TownRegion, type TownTask } from '../meta/town';
import { audio } from '../services/Audio';
import { saveService } from '../services/SaveService';
import { CAPTAIN_BUBBLE_HEIGHT, createCaptainBubble } from '../ui/components/CaptainBubble';
import { CounterPill, LivesPill, formatCountdown } from '../ui/components/CounterPill';
import { IconButton } from '../ui/components/IconButton';
import { TextButton } from '../ui/components/TextButton';
import { flyIcons } from '../ui/effects/celebrate';
import { OceanBackground } from '../ui/effects/OceanBackground';
import { RegionView } from '../ui/home/RegionView';
import { showDesignPicker, showRegionChest, showTaskList } from '../ui/home/townPopups';
import { showDailyReward, showLevelChest, showLives, showSettings, showShop } from '../ui/popups/economyPopups';
import { LEVEL_REWARDS } from '../config/levels';
import { levelReward, nextChestLevel } from '../meta/levelRewards';
import { prepareLevelStart } from '../ui/popups/levelStart';
import { showToast } from '../ui/components/toast';
import { logout } from '../net/account';
import { dispatch } from '../net/sync';
import type { BuildResult } from '../meta/TownProgress';
import { waitMs } from '../ui/tweens';
import { SCENES, fadeInScene, goToScene, type GameSceneData, type HomeSceneData } from './keys';

const DEPTH = { ui: 20, bubble: 60 } as const;
const GIFT_BAR = { width: 380, height: 40 } as const;

/**
 * Ana ekran (kasaba): can, yıldız ve altın; bölge görünümü, sıradaki görev, "Oyna" butonu,
 * mağaza ve ayarlar. Yıldızlarla görev yapılır, her görevde 3 tasarımdan biri seçilir.
 */
export class HomeScene extends Phaser.Scene {
  private background!: OceanBackground;
  private region!: RegionView;
  private lives!: LivesPill;
  private stars!: CounterPill;
  private coins!: CounterPill;
  private shopButton!: IconButton;
  private settingsButton!: IconButton;
  private title!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private taskCard!: Phaser.GameObjects.Container;
  private tasksButton!: TextButton;
  private tasksBadge!: Phaser.GameObjects.Container;
  private playButton!: TextButton;
  private arrows: TextButton[] = [];
  private devButtons: TextButton[] = [];
  /** Görüntülenen bölge (geçmiş bölgelere bakılabilir). */
  private viewIndex = 0;
  private busy = false;
  private starsEarned = 0;
  /** Sayaca uçmakta olan (henüz gösterilmeyen) yıldızlar. */
  private starsInFlight = 0;
  /** Bölümden dönülürken açılacak seviye sandığı. */
  private chestLevel: number | null = null;
  private giftRow!: Phaser.GameObjects.Container;
  private giftFill!: Phaser.GameObjects.Graphics;
  private giftText!: Phaser.GameObjects.Text;
  /** Altınlar sayaca uçarken gösterilen değer (null: kayıttaki gerçek değer). */
  private coinDisplay: number | null = null;

  constructor() {
    super(SCENES.home);
  }

  init(data: HomeSceneData): void {
    this.starsEarned = data?.starsEarned ?? 0;
    this.chestLevel = data?.chestLevel ?? null;
    this.starsInFlight = 0;
    this.coinDisplay = null;
    this.busy = false;
    this.arrows = [];
    this.devButtons = [];
  }

  create(): void {
    fadeInScene(this);
    this.background = new OceanBackground(this);
    this.region = new RegionView(this, DEPTH.ui, (taskId) => {
      const task = getTask(taskId);
      if (task && !this.busy) void this.changeDesign(task);
    });
    this.lives = new LivesPill(this, DEPTH.ui, () => void this.runPopup(() => showLives(this)));
    this.stars = new CounterPill(this, TEXTURES.star, DEPTH.ui);
    this.coins = new CounterPill(this, TEXTURES.coin, DEPTH.ui, { plus: true, onTap: () => void this.runPopup(() => showShop(this)) });
    const iconOptions = { size: HOME.iconButtonSize };
    this.shopButton = new IconButton(this, 0, 0, TEXTURES.shop, () => void this.runPopup(() => showShop(this)), {
      ...iconOptions,
      label: t('home.shop'),
    }).setDepth(DEPTH.ui);
    this.settingsButton = new IconButton(this, 0, 0, TEXTURES.gear, () => void this.openSettings(), {
      ...iconOptions,
      label: t('home.settings'),
    }).setDepth(DEPTH.ui);
    this.title = this.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '64px',
        fontStyle: '700',
        color: UI_COLORS.titleText,
        stroke: UI_COLORS.titleStroke,
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui);
    this.progressText = this.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '40px',
        fontStyle: '700',
        color: UI_COLORS.bannerText,
        stroke: UI_COLORS.titleStroke,
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui);
    this.taskCard = this.add.container(0, 0).setDepth(DEPTH.ui);
    this.tasksButton = new TextButton(this, 0, 0, t('home.tasks'), () => void this.openTasks(), {
      width: 420,
      height: 110,
      fontSize: 46,
    }).setDepth(DEPTH.ui);
    this.tasksBadge = this.createBadge();
    this.playButton = new TextButton(this, 0, 0, '', () => void this.play(), {
      width: 640,
      height: 160,
      fontSize: 60,
      variant: 'green',
    }).setDepth(DEPTH.ui);
    this.arrows = [
      new TextButton(this, 0, 0, '◀', () => void this.browse(-1), { width: 110, height: 110, fontSize: 48 }),
      new TextButton(this, 0, 0, '▶', () => void this.browse(1), { width: 110, height: 110, fontSize: 48 }),
    ];
    for (const a of this.arrows) a.setDepth(DEPTH.ui + 1);
    if (import.meta.env.DEV) this.createDevPanel();

    const stopListening = saveService.onChange(() => this.refreshCounters(true));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopListening();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);

    // Can zamanlayıcısı her saniye güncellenir (can dolunca sayaç da artar).
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshLives() });
    audio.playMusic('home');

    this.viewIndex = townProgress.unlockedRegions.length - 1;
    // Bölümde kazanılan yıldız ve seviye sandığının altını sayaçlara uçarak eklenecek;
    // o zamana kadar eski değerler görünür.
    this.starsInFlight = this.starsEarned;
    if (this.chestLevel !== null) this.coinDisplay = saveService.data.coins - levelReward(this.chestLevel).coins;
    this.createGiftRow();
    this.layout();
    this.refreshCounters(false);
    void this.showRegion().then(() => this.welcome());
  }

  // ───────────────────────── yerleşim ─────────────────────────

  private layout(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    this.background.layout(width, height);
    // Uzun ekranlarda fazladan boşluk sahnenin üstüne ve altına paylaştırılır.
    const extra = Math.max(0, height - HOME.referenceHeight);
    const top = HOME.topBarY + extra * 0.15;
    // Sayaçların simgesi solda olduğu için grup hafifçe sola kaydırılır.
    const counters = cx - 20;
    this.lives.setPosition(counters - HOME.counterGap, top);
    this.stars.setPosition(counters, top);
    this.coins.setPosition(counters + HOME.counterGap, top);
    this.title.setPosition(cx, top + HOME.titleGap);
    this.progressText.setPosition(cx, top + HOME.titleGap + 62);

    const stageWidth = Math.min(HOME.stageMaxWidth, width - HOME.stageMargin * 2);
    const stageTop = top + HOME.stageGap;
    this.region.layout(cx - stageWidth / 2, stageTop, stageWidth);
    const stage = this.region.bounds;
    this.arrows[0].setPosition(stage.x + 70, stage.y + stage.height / 2);
    this.arrows[1].setPosition(stage.x + stage.width - 70, stage.y + stage.height / 2);

    const below = stage.y + stage.height;
    const bottomSpace = height - below;
    this.taskCard.setPosition(cx, below + bottomSpace * 0.16);
    const tasksY = below + bottomSpace * 0.38;
    this.tasksButton.setPosition(cx, tasksY);
    this.tasksBadge.setPosition(cx + 190, tasksY - 48);
    this.shopButton.setPosition(cx - 350, tasksY - 16);
    this.settingsButton.setPosition(cx + 350, tasksY - 16);
    this.playButton.setPosition(cx, below + bottomSpace * 0.64);
    this.giftRow.setPosition(cx, this.playButton.y + 128);
    this.devButtons.forEach((b, i) => b.setPosition(cx + (i - 0.5) * 340, height - 70));
  }

  private createBadge(): Phaser.GameObjects.Container {
    const circle = this.add.circle(0, 0, 30, 0xe74c3c).setStrokeStyle(5, 0xffffff);
    const mark = this.add
      .text(0, -2, '!', { fontFamily: FONT_FAMILY, fontSize: '44px', fontStyle: '700', color: '#ffffff' })
      .setOrigin(0.5);
    const badge = this.add.container(0, 0, [circle, mark]).setDepth(DEPTH.ui + 2);
    this.tweens.add({ targets: badge, scale: 1.15, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return badge;
  }

  // ───────────────────────── durum ─────────────────────────

  private get viewedRegion(): TownRegion {
    return townProgress.unlockedRegions[this.viewIndex];
  }

  /** "Sıradaki hediye" çubuğu: sandık simgesi, 10 seviyelik ilerleme, hangi seviyede olduğu. */
  private createGiftRow(): void {
    const width = GIFT_BAR.width;
    const chest = this.add.image(-width / 2 - 50, 0, obstacleTexture('chest', 1)).setDisplaySize(84, 84);
    const track = this.add
      .graphics()
      .fillStyle(0x06263d, 0.6)
      .fillRoundedRect(-width / 2, -GIFT_BAR.height / 2, width, GIFT_BAR.height, GIFT_BAR.height / 2)
      .lineStyle(4, 0x7fd6f5)
      .strokeRoundedRect(-width / 2, -GIFT_BAR.height / 2, width, GIFT_BAR.height, GIFT_BAR.height / 2);
    this.giftFill = this.add.graphics();
    this.giftText = this.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        fontStyle: '700',
        color: UI_COLORS.titleText,
        stroke: UI_COLORS.titleStroke,
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.giftRow = this.add.container(0, 0, [track, this.giftFill, this.giftText, chest]).setDepth(DEPTH.ui);
    this.tweens.add({ targets: chest, angle: { from: -6, to: 6 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private refreshGiftRow(): void {
    const level = levelProgress.currentLevel;
    this.giftRow.setVisible(level !== null);
    if (level === null) return;
    const target = nextChestLevel(level);
    // Son sandıktan bu yana geçilen seviye (sandık seviyesini geçince dolar).
    const done = LEVEL_REWARDS.chestEvery - (target - level) - 1;
    const fraction = Math.max(0, done) / LEVEL_REWARDS.chestEvery;
    const width = GIFT_BAR.width;
    this.giftFill.clear();
    if (fraction > 0) {
      this.giftFill
        .fillStyle(0xffd23f, 1)
        .fillRoundedRect(-width / 2, -GIFT_BAR.height / 2, Math.max(GIFT_BAR.height, width * fraction), GIFT_BAR.height, GIFT_BAR.height / 2);
    }
    this.giftText.setText(t('home.nextGift', { n: target }));
  }

  private refreshLives(): void {
    const ms = lives.msUntilNext;
    this.lives.setLives(lives.count, ms === null ? t('lives.full') : formatCountdown(ms));
  }

  private refreshCounters(animate: boolean): void {
    this.refreshLives();
    this.stars.setValue(saveService.data.stars - this.starsInFlight, animate);
    this.coins.setValue(this.coinDisplay ?? saveService.data.coins, animate);
    this.tasksBadge.setVisible(townProgress.canBuildNext());
    const level = levelProgress.currentLevel;
    this.playButton.setLabel(level ? `${t('home.play')} · ${t('home.level', { n: level })}` : t('home.allLevelsDone'));
    this.playButton.setEnabled(level !== null);
    this.refreshGiftRow();
  }

  private async showRegion(): Promise<void> {
    const region = this.viewedRegion;
    await this.region.show(region, saveService.data.town.built);
    this.updateRegionLabels();
  }

  private updateRegionLabels(): void {
    const region = this.viewedRegion;
    const { built, total } = townProgress.regionProgress(region);
    this.title.setText(t(`region.${region.id}` as I18nKey));
    this.progressText.setText(
      townProgress.townComplete ? t('home.townDone') : t('home.progress', { built, total }),
    );
    const unlocked = townProgress.unlockedRegions.length;
    this.arrows[0].setVisible(this.viewIndex > 0);
    this.arrows[1].setVisible(this.viewIndex < unlocked - 1);
    void this.updateTaskCard();
  }

  /** Sıradaki görev kartı: simge + ad + yıldız bedeli; dokununca doğrudan tasarım seçimi. */
  private async updateTaskCard(): Promise<void> {
    this.taskCard.removeAll(true);
    const region = this.viewedRegion;
    const task = region === townProgress.currentRegion ? townProgress.nextTask() : null;
    if (!task) return;
    const icon = townPartTexture(task.id, 0);
    await ensureTextures(this, [icon]);
    if (!this.scene.isActive()) return;
    const panel = this.add.nineslice(0, 0, TEXTURES.popupPanel, undefined, 720, 120, 44, 44, 44, 44);
    const image = this.add.image(-290, 0, icon);
    image.setScale(Math.min(84 / image.width, 84 / image.height));
    const name = this.add
      .text(-230, 0, t(`task.${task.id}` as I18nKey), { fontFamily: FONT_FAMILY, fontSize: '36px', fontStyle: '600', color: '#5a2d06' })
      .setOrigin(0, 0.5);
    const star = this.add.image(250, 0, TEXTURES.star).setDisplaySize(56, 56);
    const cost = this.add
      .text(296, 2, String(task.cost), { fontFamily: FONT_FAMILY, fontSize: '42px', fontStyle: '700', color: '#5a2d06' })
      .setOrigin(0.5);
    const hit = this.add.zone(0, 0, 720, 120).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => void this.startBuild(task));
    this.taskCard.add([panel, image, name, star, cost, hit]);
  }

  // ───────────────────────── eylemler ─────────────────────────

  /** "Oyna": yeni eşya tanıtımı → (can yoksa can penceresi) → hedefler ve güçlendirici seçimi → bölüm. */
  private async play(): Promise<void> {
    const level = levelProgress.currentLevel;
    if (this.busy || level === null) return;
    this.busy = true;
    const boosters = await prepareLevelStart(this, level);
    if (!boosters) {
      this.busy = false;
      return;
    }
    const data: GameSceneData = { levelId: level, boosters };
    goToScene(this, SCENES.game, data);
  }

  /** Bir pencereyi açar; açıkken ana ekranın diğer düğmeleri tepki vermez. */
  private async runPopup(open: () => Promise<unknown>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await open();
    this.busy = false;
  }

  private async openSettings(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const choice = await showSettings(this);
    // Dil değişince tüm metinler yeni dille yeniden çizilsin.
    if (choice === 'language') {
      this.scene.restart();
      return;
    }
    if (choice === 'logout') {
      // Kaydedilmemiş ilerleme varken internetsiz çıkış yapılmaz (ilerleme kaybolmasın).
      if ((await logout()) === 'ok') {
        goToScene(this, SCENES.auth);
        return;
      }
      showToast(this, t('account.logoutPending'));
    }
    this.busy = false;
  }

  private async browse(delta: number): Promise<void> {
    if (this.busy) return;
    const next = Phaser.Math.Clamp(this.viewIndex + delta, 0, townProgress.unlockedRegions.length - 1);
    if (next === this.viewIndex) return;
    this.busy = true;
    this.viewIndex = next;
    await this.showRegion();
    this.busy = false;
  }

  private async openTasks(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    // Görevler her zaman inşa edilen bölgeye aittir; eski bir bölgeye bakılıyorsa oraya dön.
    const current = townProgress.unlockedRegions.length - 1;
    if (this.viewIndex !== current) {
      this.viewIndex = current;
      await this.showRegion();
    }
    const choice = await showTaskList(this, this.viewedRegion, townProgress);
    this.busy = false;
    if (!choice) return;
    if (choice.action === 'build') await this.startBuild(choice.task);
    else await this.changeDesign(choice.task);
  }

  private async startBuild(task: TownTask): Promise<void> {
    if (this.busy) return;
    if (townProgress.stars < task.cost) {
      await this.say(t('tasks.needStars'));
      return;
    }
    this.busy = true;
    const design = await showDesignPicker(this, task, 'build');
    if (design === null) {
      this.busy = false;
      return;
    }
    // Bölge biterse sandık altını kayda hemen eklenir; sayaca sandık açıldıktan sonra uçarak gelsin.
    const coinsBefore = saveService.data.coins;
    this.coinDisplay = coinsBefore;
    const command = dispatch({ type: 'build', task: task.id, design });
    const result = command.ok ? (command.value as BuildResult) : ({ ok: false, reason: 'unknown' } as const);
    if (!result.ok) {
      this.coinDisplay = null;
      this.busy = false;
      return;
    }
    if (!result.regionCompleted) this.coinDisplay = null;
    // Harcanan yıldızlar sayaçtan inşa edilen parçaya uçar.
    await flyIcons(this, TEXTURES.star, this.stars.iconPoint, this.region.partPoint(task.id), {
      count: Math.min(task.cost, 5),
      size: 90,
    });
    audio.play('build');
    await this.region.build(task.id, design);
    this.updateRegionLabels();
    await this.say(t(`quip.task.${task.id}` as I18nKey));

    if (result.regionCompleted) {
      const { region, chestCoins, next } = result.regionCompleted;
      await showRegionChest(this, region, chestCoins, next);
      await this.collectCoins(coinsBefore);
      if (next) {
        this.viewIndex = townProgress.unlockedRegions.length - 1;
        await this.showRegion();
      }
    }
    this.busy = false;
  }

  private async changeDesign(task: TownTask): Promise<void> {
    this.busy = true;
    const design = await showDesignPicker(this, task, 'change', townProgress.designOf(task.id) ?? 0);
    if (design !== null && dispatch({ type: 'changeDesign', task: task.id, design }).ok) await this.region.changeDesign(task.id, design);
    this.busy = false;
  }

  /** Kaptan Pati'nin balonu (sahnenin altında, yeni parçayı örtmez): dokununca ya da birkaç saniye sonra kapanır. */
  private async say(text: string): Promise<void> {
    const stage = this.region.bounds;
    const y = stage.y + stage.height + 30 + CAPTAIN_BUBBLE_HEIGHT / 2;
    const bubble = createCaptainBubble(this, this.scale.width / 2, y, text, {
      depth: DEPTH.bubble,
      tapHint: true,
    });
    const catcher = this.add.zone(0, 0, this.scale.width, this.scale.height).setOrigin(0).setDepth(DEPTH.bubble + 1);
    catcher.setInteractive();
    await Promise.race([
      new Promise<void>((resolve) => catcher.once('pointerup', () => resolve())),
      waitMs(this, 4500),
    ]);
    catcher.destroy();
    this.tweens.killTweensOf(bubble);
    bubble.destroy();
  }

  /**
   * Ana ekrana gelince: bölümde kazanılan yıldız sayaca uçar, günün ilk girişinde günlük ödül
   * açılır (altınlar sayaca akar), görev yapılabiliyorsa görev kartı dikkat çeker.
   */
  private async welcome(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    if (this.starsInFlight > 0) {
      const center = { x: this.scale.width / 2, y: this.scale.height * 0.45 };
      await flyIcons(this, TEXTURES.star, center, this.stars.iconPoint, {
        count: this.starsInFlight,
        size: 150,
        onArrive: () => {
          this.starsInFlight = Math.max(0, this.starsInFlight - 1);
          audio.play('star');
          this.refreshCounters(false);
          this.stars.bump();
        },
      });
    }
    if (this.chestLevel !== null) {
      const reward = levelReward(this.chestLevel);
      const coinsBefore = saveService.data.coins - reward.coins;
      await showLevelChest(this, this.chestLevel, reward);
      this.chestLevel = null;
      await this.collectCoins(coinsBefore);
    }
    if (dailyReward.available) {
      const coinsBefore = saveService.data.coins;
      this.coinDisplay = coinsBefore;
      await showDailyReward(this, dailyReward);
      await this.collectCoins(coinsBefore);
    }
    this.busy = false;
    if (this.starsEarned > 0 && townProgress.canBuildNext()) {
      this.tweens.add({ targets: this.taskCard, scale: 1.06, duration: 300, yoyo: true, repeat: 3 });
    }
  }

  /** Kazanılan altınlar ekranın ortasından sayaca uçar; sayaç her varışta biraz artar. */
  private async collectCoins(coinsBefore: number): Promise<void> {
    const gained = saveService.data.coins - coinsBefore;
    if (gained <= 0) {
      this.coinDisplay = null;
      this.refreshCounters(false);
      return;
    }
    const count = Phaser.Math.Clamp(Math.ceil(gained / 25), 3, 8);
    const center = { x: this.scale.width / 2, y: this.scale.height * 0.45 };
    await flyIcons(this, TEXTURES.coin, center, this.coins.iconPoint, {
      count,
      size: 84,
      onArrive: (i) => {
        this.coinDisplay = i === count - 1 ? null : coinsBefore + Math.round((gained * (i + 1)) / count);
        audio.play('coin');
        this.refreshCounters(false);
        this.coins.bump();
      },
    });
    this.coinDisplay = null;
    this.refreshCounters(false);
  }

  // ───────────────────────── geliştirici paneli ─────────────────────────

  private createDevPanel(): void {
    const options = { width: 300, height: 80, fontSize: 32 };
    this.devButtons = [
      new TextButton(this, 0, 0, t('dev.addStars'), () => {
        dispatch({ type: 'devAddStars', amount: 5 });
        void this.updateTaskCard();
      }, options),
      new TextButton(this, 0, 0, t('dev.reset'), () => {
        dispatch({ type: 'devReset' });
        this.scene.restart();
      }, options),
    ];
    for (const b of this.devButtons) b.setDepth(DEPTH.ui);
  }
}
