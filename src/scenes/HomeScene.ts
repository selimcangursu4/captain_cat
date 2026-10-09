import Phaser from 'phaser';
import { TEXTURES, materialTexture, obstacleTexture, townPartTexture } from '../assets/AssetManifest';
import { ensureTextures } from '../assets/loadAssets';
import { HOME } from '../config/layout';
import { LEVEL_REWARDS } from '../config/levels';
import { FONT_FAMILY, UI_COLORS } from '../config/theme';
import { t, type I18nKey } from '../i18n';
import { levelReward, nextChestLevel } from '../meta/levelRewards';
import { dailyReward, levelProgress, lives, townProgress } from '../meta/progress';
import { TOWN, getTask, recipeEntries, type TownRegion, type TownTask } from '../meta/town';
import type { FinishResult } from '../meta/TownProgress';
import { deleteAccount, logout } from '../net/account';
import { retryPendingPurchases } from '../net/purchases';
import { dispatch } from '../net/sync';
import { audio } from '../services/Audio';
import { saveService } from '../services/SaveService';
import { CAPTAIN_BUBBLE_HEIGHT, createCaptainBubble } from '../ui/components/CaptainBubble';
import { CounterPill, LivesPill, formatCountdown } from '../ui/components/CounterPill';
import { IconButton } from '../ui/components/IconButton';
import { TextButton } from '../ui/components/TextButton';
import { showToast } from '../ui/components/toast';
import { flyIcons } from '../ui/effects/celebrate';
import { OceanBackground } from '../ui/effects/OceanBackground';
import { formatClock, formatDuration, formatNumber } from '../ui/format';
import { RegionView } from '../ui/home/RegionView';
import { TownMapView, type RegionStatus } from '../ui/home/TownMapView';
import { showBuildPopup, showConstruction, showDesignPicker, showRegionChest, showTaskList, taskName } from '../ui/home/townPopups';
import { showConfirm, showDailyReward, showLevelChest, showLives, showSettings } from '../ui/popups/economyPopups';
import { prepareLevelStart } from '../ui/popups/levelStart';
import { showMarket, showShop, type MarketTab } from '../ui/popups/marketPopups';
import { waitMs } from '../ui/tweens';
import { SCENES, fadeInScene, goToScene, type AuthSceneData, type GameSceneData, type HomeSceneData } from './keys';

const DEPTH = { ui: 20, bubble: 60 } as const;
const GIFT_BAR = { width: 380, height: 40 } as const;
const CARD = { width: 880, height: 150 } as const;

/**
 * Ana ekran (kasaba): can, yıldız ve altın; liman haritası (bölgeler ve ilerleme) ya da seçilen
 * bölgenin sahnesi (yapılan parçalar ve süren inşaat; ◀ Harita ile geri dönülür),
 * sıradaki görev kartı, "Oyna", Mağaza (altın), Pazar (malzeme, yıldız, sandık, gemi) ve ayarlar.
 * Görev: malzemelerle inşaat başlar, süre dolunca biter (ya da altınla hızlandırılır); bölgenin bütün
 * inşaatları bitince sıradaki bölge açılır.
 */
export class HomeScene extends Phaser.Scene {
  private background!: OceanBackground;
  private region!: RegionView;
  private map!: TownMapView;
  /** Ana ekran haritayı mı, bir bölgenin sahnesini mi gösteriyor. */
  private mode: 'map' | 'region' = 'map';
  private mapButton!: TextButton;
  private lives!: LivesPill;
  private stars!: CounterPill;
  private coins!: CounterPill;
  private shopButton!: IconButton;
  private marketButton!: IconButton;
  private settingsButton!: IconButton;
  private title!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private taskCard!: Phaser.GameObjects.Container;
  /** Görev kartındaki canlı geri sayım ve hızlandırma bedeli (inşaat sürerken). */
  private cardTimer: { text: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics; cost: TextButton } | null = null;
  private cardKey = '';
  private tasksButton!: TextButton;
  private tasksBadge!: Phaser.GameObjects.Container;
  private playButton!: TextButton;
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
    this.mode = 'map';
    this.cardTimer = null;
    this.cardKey = '';
  }

  create(): void {
    fadeInScene(this);
    this.background = new OceanBackground(this);
    this.region = new RegionView(
      this,
      DEPTH.ui,
      (taskId) => {
        const task = getTask(taskId);
        if (task && !this.busy) void this.changeDesign(task);
      },
      () => void this.openConstruction(),
    );
    this.map = new TownMapView(this, DEPTH.ui, (region, status) => void this.onMapTap(region, status));
    this.lives = new LivesPill(this, DEPTH.ui, () => void this.runPopup(() => showLives(this)));
    this.stars = new CounterPill(this, TEXTURES.star, DEPTH.ui, { plus: true, onTap: () => void this.openMarket('stars') });
    this.coins = new CounterPill(this, TEXTURES.coin, DEPTH.ui, { plus: true, onTap: () => void this.runPopup(() => showShop(this)) });
    const iconOptions = { size: HOME.iconButtonSize };
    this.shopButton = new IconButton(this, 0, 0, TEXTURES.shop, () => void this.runPopup(() => showShop(this)), {
      ...iconOptions,
      label: t('home.shop'),
    }).setDepth(DEPTH.ui);
    this.marketButton = new IconButton(this, 0, 0, TEXTURES.market, () => void this.openMarket('materials'), {
      ...iconOptions,
      label: t('home.market'),
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
      width: 360,
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
    this.mapButton = new TextButton(this, 0, 0, t('map.back'), () => void this.backToMap(), {
      width: 250,
      height: 92,
      fontSize: 38,
    }).setDepth(DEPTH.ui + 1);

    const stopListening = saveService.onChange(() => this.refreshCounters(true));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopListening();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);

    // Can ve inşaat zamanlayıcıları her saniye güncellenir; inşaat süresi dolunca kendiliğinden biter.
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    audio.playMusic('home');

    this.viewIndex = townProgress.unlockedRegions.length - 1;
    // Bölümde kazanılan yıldız ve seviye sandığının altını sayaçlara uçarak eklenecek;
    // o zamana kadar eski değerler görünür.
    this.starsInFlight = this.starsEarned;
    if (this.chestLevel !== null) this.coinDisplay = saveService.data.coins - levelReward(this.chestLevel).coins;
    this.createGiftRow();
    this.layout();
    this.refreshCounters(false);
    void retryPendingPurchases();
    void this.showMap().then(() => this.welcome());
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
    this.map.layout(cx - stageWidth / 2, stageTop, stageWidth);
    const stage = this.region.bounds;
    this.mapButton.setPosition(stage.x + 150, stage.y + 66);

    const below = stage.y + stage.height;
    const bottomSpace = height - below;
    this.taskCard.setPosition(cx, below + bottomSpace * 0.15);
    const rowY = below + bottomSpace * 0.39;
    this.shopButton.setPosition(cx - 400, rowY - 16);
    this.marketButton.setPosition(cx - 240, rowY - 16);
    this.tasksButton.setPosition(cx + 70, rowY);
    this.tasksBadge.setPosition(cx + 70 + 165, rowY - 48);
    this.settingsButton.setPosition(cx + 400, rowY - 16);
    this.playButton.setPosition(cx, below + bottomSpace * 0.65);
    this.giftRow.setPosition(cx, this.playButton.y + 128);
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
    const done = townProgress.msLeft === 0;
    this.tasksBadge.setVisible(townProgress.canBuildNext() || done);
    const level = levelProgress.currentLevel;
    this.playButton.setLabel(level ? `${t('home.play')} · ${t('home.level', { n: level })}` : t('home.allLevelsDone'));
    this.playButton.setEnabled(level !== null);
    this.refreshGiftRow();
    if (this.mode === 'map') void this.map.refresh(townProgress);
    void this.updateTaskCard();
  }

  /** Saniyelik güncelleme: can sayacı, inşaat geri sayımı; süre dolunca inşaat biter. */
  private tick(): void {
    this.refreshLives();
    this.refreshConstruction();
    if (townProgress.msLeft === 0 && !this.busy) void this.completeBuild('finishBuild');
  }

  /** Sahnedeki iskele/geri sayım ve görev kartındaki sayaç. */
  private refreshConstruction(): void {
    const c = townProgress.construction;
    const ms = townProgress.msLeft;
    if (this.mode === 'region' && c && ms !== null && c.task.startsWith(`${this.viewedRegion.id}.`)) {
      void this.region.showConstruction(c.task, c.design);
      this.region.updateConstruction(ms > 0 ? formatClock(ms) : t('construction.done'), townProgress.constructionProgress ?? 1);
    } else {
      this.region.clearConstruction();
    }
    if (this.cardTimer && ms !== null) {
      const progress = townProgress.constructionProgress ?? 1;
      this.cardTimer.text.setText(ms > 0 ? t('home.building', { time: formatClock(ms) }) : t('construction.done'));
      this.cardTimer.bar.clear().fillStyle(0xffd23f, 1).fillRoundedRect(-200, 40, Math.max(24, 400 * progress), 24, 12);
      const cost = townProgress.speedUpCost ?? 0;
      this.cardTimer.cost.setLabel(cost === 0 ? t('construction.freeShort') : formatNumber(cost));
    }
  }

  private async showRegion(): Promise<void> {
    const region = this.viewedRegion;
    await this.region.show(region, saveService.data.town.built);
    this.updateRegionLabels();
    this.refreshConstruction();
  }

  private updateRegionLabels(): void {
    if (this.mode === 'map') {
      const done = TOWN.filter((r) => townProgress.isRegionComplete(r)).length;
      this.title.setText(t('map.title'));
      this.progressText.setText(townProgress.townComplete ? t('home.townDone') : t('map.progress', { n: done, total: TOWN.length }));
    } else {
      const region = this.viewedRegion;
      const { built, total } = townProgress.regionProgress(region);
      this.title.setText(t(`region.${region.id}` as I18nKey));
      this.progressText.setText(townProgress.isRegionComplete(region) ? t('map.regionDone') : t('home.progress', { built, total }));
    }
    this.mapButton.setVisible(this.mode === 'region');
    void this.updateTaskCard();
  }

  /** Liman haritasını gösterir (bölge sahnesi gizlenir). */
  private async showMap(): Promise<void> {
    this.mode = 'map';
    this.region.clearConstruction();
    this.region.setVisible(false);
    this.map.setVisible(true);
    await this.map.refresh(townProgress);
    this.updateRegionLabels();
  }

  /** Bir bölgenin sahnesini açar: bitmiş bölgede yapılanlar, şu anki bölgede süren inşaat da görünür. */
  private async enterRegion(index: number): Promise<void> {
    this.mode = 'region';
    this.viewIndex = index;
    this.map.setVisible(false);
    this.region.setVisible(true);
    await this.showRegion();
  }

  private async onMapTap(region: TownRegion, status: RegionStatus): Promise<void> {
    if (this.busy) return;
    if (status === 'locked') {
      const previous = TOWN[TOWN.indexOf(region) - 1];
      showToast(this, t('map.locked', { region: t(`region.${previous.id}` as I18nKey) }));
      return;
    }
    this.busy = true;
    await this.enterRegion(TOWN.indexOf(region));
    this.busy = false;
  }

  private async backToMap(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await this.showMap();
    this.busy = false;
  }

  /**
   * Sıradaki görev kartı. İnşaat sürüyorsa: geri sayım, ilerleme ve hızlandırma bedeli (dokununca
   * inşaat penceresi). Değilse: parça, ad, malzemeler (elde/gereken) ve süre (dokununca inşaat).
   */
  private async updateTaskCard(): Promise<void> {
    // Kart haritada ve şu anki bölgenin sahnesinde görünür (eski bölgelerde görev yok).
    const showCard = this.mode === 'map' || this.viewedRegion === townProgress.currentRegion;
    const task = showCard ? townProgress.nextTask() : null;
    const building = task !== null && townProgress.isUnderConstruction(task.id);
    const m = townProgress.materials;
    // Kart yalnızca içeriği değişince yeniden çizilir (sayaç her saniye ayrıca güncellenir).
    const key = task ? `${task.id}|${building}|${recipeEntries(task.recipe).map(([id]) => m[id]).join(',')}` : '';
    if (key === this.cardKey) return;
    this.cardKey = key;
    this.taskCard.removeAll(true);
    this.cardTimer = null;
    if (!task) return;
    const design = building ? (townProgress.construction?.design ?? 0) : 0;
    const icon = townPartTexture(task.id, design);
    await ensureTextures(this, [icon]);
    if (!this.scene.isActive() || this.cardKey !== key) return;

    const panel = this.add.nineslice(0, 0, TEXTURES.popupPanel, undefined, CARD.width, CARD.height, 44, 44, 44, 44);
    const image = this.add.image(-CARD.width / 2 + 80, 0, icon);
    image.setScale(Math.min(100 / image.width, 100 / image.height));
    const name = this.add
      .text(-CARD.width / 2 + 150, -30, taskName(task), { fontFamily: FONT_FAMILY, fontSize: '34px', fontStyle: '700', color: '#5a2d06' })
      .setOrigin(0, 0.5);
    const hit = this.add.zone(0, 0, CARD.width, CARD.height).setInteractive({ useHandCursor: true });
    this.taskCard.add([panel, image, name, hit]);

    if (building) {
      image.setAlpha(0.55);
      hit.on('pointerup', () => void this.openConstruction());
      const text = this.add
        .text(-CARD.width / 2 + 150, 18, '', { fontFamily: FONT_FAMILY, fontSize: '30px', fontStyle: '700', color: '#b07800' })
        .setOrigin(0, 0.5);
      const track = this.add.graphics().fillStyle(0x06263d, 0.2).fillRoundedRect(-200, 40, 400, 24, 12);
      const bar = this.add.graphics();
      track.setX(-CARD.width / 2 + 350);
      bar.setX(-CARD.width / 2 + 350);
      const cost = new TextButton(this, CARD.width / 2 - 130, 0, '', () => void this.openConstruction(), {
        width: 210,
        height: 90,
        fontSize: 34,
        variant: 'green',
        icon: TEXTURES.coin,
      });
      this.taskCard.add([text, track, bar, cost]);
      this.cardTimer = { text, bar, cost };
      this.refreshConstruction();
      return;
    }

    hit.on('pointerup', () => void this.startBuild(task));
    // Malzemeler: simge + elde/gereken (eksikse kırmızı).
    recipeEntries(task.recipe).forEach(([id, need], i) => {
      const x = -CARD.width / 2 + 170 + i * 150;
      const enough = m[id] >= need;
      this.taskCard.add(this.add.image(x, 30, materialTexture(id)).setDisplaySize(50, 50));
      this.taskCard.add(
        this.add
          .text(x + 32, 30, `${Math.min(m[id], need)}/${need}`, {
            fontFamily: FONT_FAMILY,
            fontSize: '28px',
            fontStyle: '700',
            color: enough ? '#2e8b3d' : '#c0392b',
          })
          .setOrigin(0, 0.5),
      );
    });
    const clock = this.add.image(CARD.width / 2 - 200, 0, TEXTURES.clock).setDisplaySize(52, 52);
    const time = this.add
      .text(CARD.width / 2 - 165, 0, formatDuration(task.minutes * 60_000), { fontFamily: FONT_FAMILY, fontSize: '32px', fontStyle: '700', color: '#5a2d06' })
      .setOrigin(0, 0.5);
    this.taskCard.add([clock, time]);
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

  /** Pazar; altın yetmezse oyuncu mağazaya yönlendirilir. */
  private async openMarket(tab: MarketTab): Promise<void> {
    await this.runPopup(async () => {
      if ((await showMarket(this, tab)) === 'shop') await showShop(this);
    });
    this.cardKey = '';
    void this.updateTaskCard();
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
    if (choice === 'createAccount') {
      const data: AuthSceneData = { mode: 'upgrade' };
      goToScene(this, SCENES.auth, data);
      return;
    }
    if (choice === 'deleteAccount') {
      const confirmed = await showConfirm(this, {
        title: t('deleteAccount.title'),
        message: t('deleteAccount.warning'),
        confirm: t('deleteAccount.confirm'),
      });
      if (confirmed) {
        try {
          await deleteAccount();
          const data: AuthSceneData = { message: t('deleteAccount.done') };
          goToScene(this, SCENES.auth, data);
          return;
        } catch {
          showToast(this, t('deleteAccount.offline'));
        }
      }
    }
    if (choice === 'reset') {
      const confirmed = await showConfirm(this, { title: t('reset.title'), message: t('reset.warning'), confirm: t('reset.confirm') });
      if (confirmed && dispatch({ type: 'resetProgress' }).ok) {
        showToast(this, t('reset.done'));
        this.scene.restart();
        return;
      }
    }
    this.busy = false;
  }

  /** Görevler her zaman inşa edilen bölgeye aittir; eski bir bölgeye bakılıyorsa oraya dönülür. */
  private async viewCurrentRegion(): Promise<void> {
    const current = townProgress.unlockedRegions.length - 1;
    if (this.mode === 'region' && this.viewIndex === current) return;
    await this.enterRegion(current);
  }

  private async openTasks(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await this.viewCurrentRegion();
    const choice = await showTaskList(this, this.viewedRegion, townProgress);
    this.busy = false;
    if (!choice) return;
    if (choice.action === 'build') await this.startBuild(choice.task);
    else if (choice.action === 'construction') await this.openConstruction();
    else await this.changeDesign(choice.task);
  }

  /** İnşaat penceresi (tasarım + malzeme) → malzemeler harcanır, süre başlar. */
  private async startBuild(task: TownTask): Promise<void> {
    if (this.busy) return;
    if (townProgress.construction) {
      await this.openConstruction();
      return;
    }
    this.busy = true;
    await this.viewCurrentRegion();
    const choice = await showBuildPopup(this, task, townProgress);
    this.busy = false;
    if (choice === 'market') {
      await this.openMarket('materials');
      return;
    }
    if (choice === null) {
      this.cardKey = '';
      void this.updateTaskCard();
      return;
    }
    const command = dispatch({ type: 'build', task: task.id, design: choice });
    if (!command.ok) return;
    this.busy = true;
    audio.play('build');
    this.cameras.main.shake(140, 0.003);
    this.refreshConstruction();
    await this.say(t('build.started', { time: formatDuration(task.minutes * 60_000) }));
    this.busy = false;
    this.tick();
  }

  /** Süren inşaat penceresi: geri sayım, altınla hemen bitirme. */
  private async openConstruction(): Promise<void> {
    if (this.busy || !townProgress.construction) return;
    this.busy = true;
    await this.viewCurrentRegion();
    const choice = await showConstruction(this, townProgress);
    this.busy = false;
    if (choice === 'speedUp') await this.completeBuild('speedUpBuild');
    else if (choice === 'ready') await this.completeBuild('finishBuild');
    else if (choice === 'shop') await this.runPopup(() => showShop(this));
  }

  /**
   * İnşaatı bitirir (süre dolduysa ücretsiz, değilse altınla): parça tozun içinden belirir, Kaptan
   * konuşur; bölge bittiyse sandık açılır ve sıradaki bölge gösterilir.
   */
  private async completeBuild(type: 'finishBuild' | 'speedUpBuild'): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const command = dispatch({ type });
    if (!command.ok) {
      if (command.reason === 'coins') showToast(this, t('error.coins'));
      this.busy = false;
      return;
    }
    const result = command.value as Extract<FinishResult, { ok: true }>;
    const chestCoins = result.regionCompleted?.chestCoins ?? 0;
    // Bölge sandığının altını sayaca, sandık açıldıktan sonra uçarak gelsin.
    const coinsBefore = saveService.data.coins - chestCoins;
    if (chestCoins > 0) this.coinDisplay = coinsBefore;
    this.cardKey = '';
    // Biten parça kendi bölgesinin sahnesinde belirir (harita açıksa o bölgeye geçilir).
    const regionIndex = TOWN.findIndex((r) => r.id === result.task.region);
    if (this.mode !== 'region' || this.viewIndex !== regionIndex) await this.enterRegion(regionIndex);
    else this.region.clearConstruction();
    audio.play('build');
    await this.region.build(result.task.id, result.design);
    this.updateRegionLabels();
    this.refreshCounters(false);
    await this.say(t(`quip.task.${result.task.id}` as I18nKey));

    if (result.regionCompleted) {
      const { region, next } = result.regionCompleted;
      await showRegionChest(this, region, chestCoins, next);
      await this.collectCoins(coinsBefore);
      if (next) {
        // Haritada yeni bölgeye giden rota açılır.
        this.viewIndex = townProgress.unlockedRegions.length - 1;
        await this.showMap();
        this.map.celebrate(next);
      }
    }
    this.busy = false;
  }

  private async changeDesign(task: TownTask): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const design = await showDesignPicker(this, task, townProgress.designOf(task.id) ?? 0);
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
    await Promise.race([new Promise<void>((resolve) => catcher.once('pointerup', () => resolve())), waitMs(this, 4500)]);
    catcher.destroy();
    this.tweens.killTweensOf(bubble);
    bubble.destroy();
  }

  /**
   * Ana ekrana gelince: bölümde kazanılan yıldız sayaca uçar, seviye sandığı ve günün ilk girişinde
   * günlük ödül açılır (altınlar sayaca akar), görev yapılabiliyorsa görev kartı dikkat çeker.
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
    if (townProgress.canBuildNext()) {
      this.tweens.add({ targets: this.taskCard, scale: 1.05, duration: 300, yoyo: true, repeat: 3 });
    }
    this.tick();
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
}
