import Phaser from 'phaser';
import { itemTexture } from '../assets/AssetManifest';
import { ANIM } from '../config/animation';
import { ECONOMY, type BoosterId, type HelperId } from '../config/economy';
import { INPUT } from '../config/input';
import { HUD, LAYOUT } from '../config/layout';
import { FONT_FAMILY, UI_COLORS } from '../config/theme';
import {
  LevelSession,
  resolveTutorialStep,
  samePos,
  tutorialAllows,
  type CascadeStep,
  type GoalDelta,
  type MoveResult,
  type Pos,
  type ResolvedTutorialStep,
  type ShuffleMove,
  type SpecialKind,
  type TurnResult,
} from '../core';
import { getLevel, levelCount } from '../data/levels';
import type { LevelRewardResult } from '../meta/LevelProgress';
import { inventory, levelProgress } from '../meta/progress';
import { dispatch } from '../net/sync';
import { t } from '../i18n';
import { audio } from '../services/Audio';
import { wallet } from '../services/Wallet';
import { saveService } from '../services/SaveService';
import { BoardEffects } from '../ui/board/BoardEffects';
import { BoardInput } from '../ui/board/BoardInput';
import { BoardView } from '../ui/board/BoardView';
import { computeBoardLayout } from '../ui/board/layout';
import { StepPlayer } from '../ui/board/StepPlayer';
import { TextButton } from '../ui/components/TextButton';
import { showToast } from '../ui/components/toast';
import { showBanner } from '../ui/effects/banner';
import { ComboWords } from '../ui/effects/ComboWords';
import { comboTier } from '../ui/effects/comboTier';
import { OceanBackground } from '../ui/effects/OceanBackground';
import { GameHud } from '../ui/hud/GameHud';
import { HelperBar } from '../ui/hud/HelperBar';
import { itemName, showBuyItem } from '../ui/popups/economyPopups';
import { prepareLevelStart } from '../ui/popups/levelStart';
import { showFail, showOutOfMoves, showPause, showWin } from '../ui/popups/levelPopups';
import { TutorialOverlay } from '../ui/tutorial/TutorialOverlay';
import { tweenAsync, waitMs } from '../ui/tweens';
import { SCENES, fadeInScene, goToScene, type GameSceneData, type HomeSceneData } from './keys';

/** Geliştirici panelindeki "Özel Taşlar" düzeni: komşu çiftler tüm kombinasyonları kapsar. */
const SPECIALS_TEST_LAYOUT: readonly (readonly SpecialKind[])[] = [
  ['harpoon-h', 'harpoon-v', 'cannon', 'cannon', 'whirlpool', 'whirlpool'],
  ['seagull', 'seagull', 'harpoon-h', 'cannon', 'seagull', 'harpoon-v'],
];

/** Bölüm öncesi güçlendiricinin tahtada dönüştüğü taş. */
const BOOSTER_SPECIALS: Record<BoosterId, readonly SpecialKind[]> = {
  harpoon: ['harpoon-h', 'harpoon-v'],
  cannon: ['cannon'],
  whirlpool: ['whirlpool'],
};

/**
 * Oyun ekranı: bir bölümün oynanışı.
 * Akış: girdi → LevelSession/Match3Engine (anında hesaplar) → StepPlayer/BoardView (olayları oynatır)
 * → GameHud (hamle ve hedefler) → kazanma/kaybetme pencereleri.
 */
export class GameScene extends Phaser.Scene {
  private session!: LevelSession;
  private view!: BoardView;
  private boardInput!: BoardInput;
  private fx!: BoardEffects;
  private stepPlayer!: StepPlayer;
  private background!: OceanBackground;
  private hud!: GameHud;
  private helperBar!: HelperBar;
  private tutorial!: TutorialOverlay;
  private comboWords!: ComboWords;
  /** Hedef kare bekleyen yardımcı (Kürek, Dümen). */
  private activeHelper: HelperId | null = null;
  /** Kasabada seçilip ödenmiş güçlendiriciler; undefined ise başlangıç penceresi burada açılır. */
  private startBoosters: readonly BoosterId[] | undefined;
  /** Sıradaki öğretici adımı ve şu an oyuncudan beklenen hamle (yoksa null). */
  private tutorialIndex = 0;
  private tutorialStep: ResolvedTutorialStep | null = null;
  private devInfo: Phaser.GameObjects.Text | null = null;
  private devButtons: TextButton[] = [];

  private levelId = 1;
  private seed = 0;
  private requestedSeed: number | undefined;
  /** Animasyon oynuyor ya da pencere açık: tahta girdisi kapalı. */
  private busy = false;
  private pendingRelayout = false;
  private hintTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super(SCENES.game);
  }

  /** Sahne her açılışta (Phaser alanları sıfırlamaz) durumunu baştan kurar. */
  init(data: GameSceneData): void {
    this.levelId = Phaser.Math.Clamp(data?.levelId ?? levelProgress.currentLevel ?? 1, 1, levelCount());
    this.requestedSeed = data?.seed;
    this.startBoosters = data?.boosters;
    this.activeHelper = null;
    this.busy = false;
    this.pendingRelayout = false;
    this.hintTimer = null;
    this.tutorialIndex = 0;
    this.tutorialStep = null;
    this.devButtons = [];
    this.devInfo = null;
  }

  create(): void {
    fadeInScene(this);
    this.background = new OceanBackground(this);
    this.view = new BoardView(this);
    this.fx = new BoardEffects(this, this.view);
    this.stepPlayer = new StepPlayer(this, this.view, this.fx);
    this.boardInput = new BoardInput(this, this.view, {
      canInteract: () => !this.busy && this.session.status === 'playing',
      onTouch: () => this.cancelHint(),
      onSwap: (a, b) => void this.playTurn(a, b, () => this.session.trySwap(a, b)),
      onActivate: (p) => void this.playTurn(p, p, () => this.session.activateAt(p)),
    });
    this.hud = new GameHud(this, () => void this.openPause());
    this.helperBar = new HelperBar(this, inventory, (id) => void this.onHelperTap(id));
    this.tutorial = new TutorialOverlay(this, this.view);
    this.comboWords = new ComboWords(this);
    if (import.meta.env.DEV) this.createDevPanel();
    audio.playMusic('game');

    void this.startLevel(this.levelId, this.requestedSeed, this.startBoosters);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });
  }

  // ───────────────────────── bölüm akışı ─────────────────────────

  /**
   * Bölümü kurar. boosters verilmezse önce başlangıç penceresi açılır (can ve güçlendirici
   * burada harcanır; vazgeçilirse kasabaya dönülür). Kasabadan gelindiyse bunlar zaten ödenmiştir.
   */
  private async startLevel(levelId: number, seed?: number, boosters?: readonly BoosterId[]): Promise<void> {
    this.busy = true;
    this.cancelHint();
    this.setActiveHelper(null);
    this.boardInput.clearSelection();
    this.tutorial.hide();
    this.tutorialIndex = 0;
    this.tutorialStep = null;
    this.levelId = levelId;
    const level = getLevel(levelId);
    this.seed = seed ?? level.seed ?? Math.floor(Math.random() * 1_000_000);
    this.session = new LevelSession(level, this.seed);

    this.view.build(this.session.engine.board, this.boardLayout());
    // Taşlar tahtanın üstünde bekler; bölüm başlayınca yağmur gibi yerlerine iner.
    this.view.prepareIntro();
    this.hud.setLevel(level.id, this.session.goals.states, this.session.movesLeft);
    this.helperBar.refresh();
    // Öğretici bölümlerde (yardımcılar henüz açılmamışken) alt alan Kaptan'ın balonuna kalır.
    this.helperBar.setVisible(level.tutorial.length === 0);
    this.background.layout(this.scale.width, this.scale.height);
    this.layoutScreen();
    this.devInfo?.setText(t('dev.info', { level: levelId, seed: this.seed }));

    const chosen = boosters ?? (await prepareLevelStart(this, levelId));
    if (chosen === null) {
      this.goHome();
      return;
    }
    this.helperBar.refresh();
    await this.view.playIntro();
    await this.applyBoosters(chosen);
    await this.advanceTutorial();
    this.busy = false;
    this.scheduleHint();
  }

  /** Seçilen güçlendiriciler ekranın ortasından tahtadaki rastgele bir taşa uçar ve onu dönüştürür. */
  private async applyBoosters(boosters: readonly BoosterId[]): Promise<void> {
    const itemsToPlace: Array<{ special: SpecialKind | readonly SpecialKind[], texture: string | null }> = boosters.map(id => ({
      special: BOOSTER_SPECIALS[id],
      texture: itemTexture(id)
    }));

    const engineLvl = saveService.data.ship.engine || 0;
    if (engineLvl > 0) {
       const engineConfig = (ECONOMY.shipUpgrades as any).engine.levels.find((l: any) => l.level === engineLvl);
       if (engineConfig && engineConfig.bonusValue > 0) {
         const randomSpecials: SpecialKind[] = ['cannon', 'harpoon-v', 'harpoon-h', 'whirlpool'];
         for (let i = 0; i < engineConfig.bonusValue; i++) {
           itemsToPlace.push({
             special: randomSpecials[Math.floor(Math.random() * randomSpecials.length)],
             texture: null // No flight animation for engine specials
           });
         }
       }
    }

    for (const item of itemsToPlace) {
      const specialArr = Array.isArray(item.special) ? item.special : [item.special];
      const placed = this.session.placeBooster(specialArr);
      if (!placed) continue;
      
      if (item.texture) {
        const target = this.view.toWorld(this.view.cellCenter(placed.pos));
        const icon = this.add
          .image(this.scale.width / 2, this.scale.height / 2, item.texture)
          .setDepth(45)
          .setDisplaySize(240, 240);
        await tweenAsync(this, { targets: icon, scale: icon.scale * 1.15, duration: 200, ease: 'Back.easeOut' });
        await tweenAsync(this, {
          targets: icon,
          x: target.x,
          y: target.y,
          scale: (this.view.cellSize / 128) * 0.9,
          duration: ANIM.boosterFlightMs,
          ease: 'Cubic.easeInOut',
        });
        icon.destroy();
        audio.play('booster');
      } else {
        // Engine perk: subtle sound or just silent placement
        audio.play('booster');
      }
      await this.view.convertTile(placed.tileId, placed.special);
    }
    this.checkSync();
  }

  /**
   * Sıradaki öğretici adımına geçer: mesajları oyuncu dokunana kadar gösterir,
   * hamle adımında durur (oyuncu o hamleyi yapınca playTurn tekrar çağırır).
   */
  private async advanceTutorial(): Promise<void> {
    const steps = this.session.level.tutorial;
    while (this.tutorialIndex < steps.length) {
      const step = resolveTutorialStep(steps[this.tutorialIndex++], this.session.engine.board);
      if (!step) continue; // beklenen hamle artık yok (ör. güçlendirici zincirde patladı)
      if (step.kind === 'message') {
        await this.tutorial.showMessage(step.text);
        continue;
      }
      this.tutorialStep = step;
      this.tutorial.showAction(step);
      return;
    }
  }

  /** Hamleyi oturuma uygular, sonucunu oynatır ve bölüm durumuna göre devam eder. */
  private async playTurn(a: Pos, b: Pos, apply: () => TurnResult): Promise<void> {
    if (this.busy || this.session.status !== 'playing') return;
    // Öğreticide yalnızca gösterilen hamle yapılabilir.
    if (this.tutorialStep && !tutorialAllows(this.tutorialStep, a, b)) return;
    this.busy = true;
    this.cancelHint();
    const movesBefore = this.session.movesLeft;
    let turn: TurnResult;
    try {
      turn = apply();
      await this.playMove(a, b, turn.move, turn.goalDeltas);
      this.hud.setMoves(turn.movesLeft, turn.movesLeft !== movesBefore);
    } catch (error) {
      console.error('[Kaptan Pati] Hamle oynatılamadı:', error);
      this.release();
      return;
    } finally {
      this.checkSync();
    }
    if (this.tutorialStep && turn.move.kind === 'resolved') {
      this.tutorialStep = null;
      this.tutorial.hide();
      if (turn.status === 'playing') await this.advanceTutorial();
    }
    if (turn.status === 'won') await this.finishWon();
    else if (turn.status === 'lost') await this.handleOutOfMoves();
    else this.release();
  }

  /** combos: zincir büyüdükçe "Güzel!", "Harika!"… yazıları (bölüm sonu kutlamasında kapalı). */
  private async playMove(
    a: Pos,
    b: Pos,
    move: MoveResult,
    goalDeltas: readonly (readonly GoalDelta[])[] = [],
    combos = true,
  ): Promise<void> {
    switch (move.kind) {
      case 'invalid':
        if (!samePos(a, b)) await this.view.animateNudge(a, b);
        return;
      case 'rejected':
        await this.view.animateSwap(a, b, true);
        return;
      case 'resolved': {
        if (!samePos(a, b)) await this.view.animateSwap(a, b, false);
        const collecting: Promise<void>[] = [];
        let cleared = 0;
        let shownTier = 0;
        for (const [i, step] of move.steps.entries()) {
          await this.stepPlayer.play(step);
          collecting.push(this.collect(goalDeltas[i] ?? []));
          this.showCoins(step);
          cleared += step.cleared.length;
          const tier = combos ? comboTier(step.index, cleared) : 0;
          if (tier > shownTier) {
            shownTier = tier;
            const board = this.view.bounds;
            this.comboWords.show(tier, board.x + board.width / 2, board.y + board.height * 0.38);
          }
          await waitMs(this, ANIM.stepPauseMs);
        }
        if (move.shuffle) await this.playShuffle(move.shuffle);
        await Promise.all(collecting);
      }
    }
  }

  private collect(deltas: readonly GoalDelta[]): Promise<void> {
    if (deltas.length === 0) return Promise.resolve();
    return this.hud.collect(deltas, (p) => this.view.toWorld(this.view.cellCenter(p)), this.view.cellSize * 0.8);
  }

  /** Sandıktan çıkan altın: karenin üstünde "+15" yazısı yükselir. */
  private showCoins(step: CascadeStep): void {
    const hits = [...step.obstacleHits, ...step.activations.flatMap((a) => a.obstacleHits)];
    for (const hit of hits) {
      if (!hit.reward?.coins) continue;
      audio.play('coin');
      const p = this.view.toWorld(this.view.cellCenter(hit.pos));
      const text = this.add
        .text(p.x, p.y, `+${hit.reward.coins}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '56px',
          fontStyle: '700',
          color: '#ffe066',
          stroke: '#8a5a00',
          strokeThickness: 10,
        })
        .setOrigin(0.5)
        .setDepth(45);
      this.tweens.add({ targets: text, y: p.y - 120, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
    }
  }

  /**
   * Kazanınca: can geri gelir, kalan hamleler birkaçar birkaçar güçlendiriciye dönüşüp birlikte
   * patlar (hızlandırılmış). Ekrana dokunulursa kalan kutlama animasyonsuz hesaplanır. Sonra ödül.
   */
  private async finishWon(): Promise<void> {
    this.setActiveHelper(null);
    const bonusMoves = await this.playCelebration();
    this.checkSync();
    
    const baseCoins = ECONOMY.levelWinCoins + bonusMoves * ECONOMY.coinsPerBonusMove + this.session.coinsCollected;
    
    let hullBonusPercent = 0;
    const hullLvl = saveService.data.ship.hull || 0;
    if (hullLvl > 0) {
      const hullConfig = (ECONOMY.shipUpgrades as any).hull.levels.find((l: any) => l.level === hullLvl);
      if (hullConfig) {
        hullBonusPercent = hullConfig.bonusValue;
      }
    }
    
    const coins = Math.floor(baseCoins * (1 + hullBonusPercent / 100));

    // Kazanç komutla kaydedilir: harcanan can geri gelir, seviye ödülü verilir (sunucu da doğrular).
    const win = dispatch({ type: 'winLevel', level: this.levelId, coins });
    const result: LevelRewardResult = win.ok ? (win.value as LevelRewardResult) : { materials: 0, coins, nextLevel: this.levelId, reward: null };
    await showWin(this, coins, result.materials, result.reward?.lives ?? 0);
    // Seviye sandığı (her 10 seviyede) kasabada açılır.
    const chestLevel = result.reward && result.reward.chest !== 'none' ? this.levelId : undefined;
    this.goHome(result.materials, chestLevel);
  }

  /** Bölüm sonu kutlaması; kaç hamlenin bonusa dönüştüğünü döndürür. */
  private async playCelebration(): Promise<number> {
    if (this.session.movesLeft <= 0) return 0;
    const board = this.view.bounds;
    let skip = false;
    const onTap = () => {
      skip = true;
      skipHint.setText('');
    };
    this.input.on('pointerdown', onTap);
    const skipHint = this.add
      .text(this.scale.width / 2, board.y + board.height + 90, t('celebrate.skip'), {
        fontFamily: FONT_FAMILY,
        fontSize: '38px',
        fontStyle: '700',
        color: UI_COLORS.bannerText,
        stroke: UI_COLORS.titleStroke,
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({ targets: skipHint, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    this.helperBar.setVisible(false);
    await showBanner(this, board.x + board.width / 2, board.y + board.height / 2, t('celebrate.banner'), 500);
    this.tweens.timeScale = ANIM.celebrationSpeed;
    this.time.timeScale = ANIM.celebrationSpeed;

    let bonusMoves = 0;
    for (;;) {
      // Geçilirse kalan hamlelerin hepsi tek seferde (animasyonsuz) hesaplanır.
      const turn = this.session.celebrationTurn(skip ? this.session.movesLeft : ANIM.celebrationBatch);
      if (!turn) break;
      bonusMoves += turn.converted.length;
      if (skip) continue;
      this.hud.setMoves(this.session.movesLeft);
      await Promise.all(turn.converted.map((c) => this.view.convertTile(c.tileId, c.special)));
      const origin = turn.converted[0].pos;
      await this.playMove(origin, origin, turn.move, [], false);
    }
    if (skip) {
      // Görünümü mantıktaki son tahtaya eşitle.
      this.view.build(this.session.engine.board, this.boardLayout());
      this.hud.setMoves(0, false);
    }

    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
    this.input.off('pointerdown', onTap);
    this.tweens.killTweensOf(skipHint);
    skipHint.destroy();
    return bonusMoves;
  }

  private goHome(starsEarned = 0, chestLevel?: number): void {
    this.tutorial.hide();
    const data: HomeSceneData = { starsEarned, chestLevel };
    goToScene(this, SCENES.home, data);
  }

  /** Hamleler bitti: "+5 hamle" teklifi; vazgeçilirse can gider, başarısız penceresi ve tekrar. */
  private async handleOutOfMoves(): Promise<void> {
    this.setActiveHelper(null);
    const { count, cost } = ECONOMY.extraMoves;
    const choice = await showOutOfMoves(this, {
      goals: this.session.goals.states,
      count,
      cost,
      balance: wallet.coins,
    });
    if (choice === 'buy' && dispatch({ type: 'buyExtraMoves' }).ok) {
      this.session.addMoves(count);
      this.hud.setMoves(this.session.movesLeft);
      this.release();
      return;
    }
    dispatch({ type: 'loseLevel', level: this.levelId });
    const next = await showFail(this);
    if (next === 'home') this.goHome();
    else await this.startLevel(this.levelId);
  }

  /** Duraklat: çıkmak ya da yeniden başlamak bölümü kaybetmek sayılır (başta harcanan can geri gelmez). */
  private async openPause(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.cancelHint();
    this.setActiveHelper(null);
    const choice = await showPause(this);
    if (choice === 'resume') {
      this.release();
      return;
    }
    dispatch({ type: 'loseLevel', level: this.levelId });
    if (choice === 'restart') await this.startLevel(this.levelId, this.seed);
    else this.goHome();
  }

  // ───────────────────────── yardımcılar ─────────────────────────

  private async onHelperTap(id: HelperId): Promise<void> {
    if (this.busy || this.session.status !== 'playing' || this.tutorialStep) return;
    if (!inventory.isUnlocked(id)) {
      showToast(this, t('item.lockedToast', { item: itemName(id), n: ECONOMY.items[id].unlockLevel }));
      return;
    }
    if (this.activeHelper === id) {
      this.setActiveHelper(null);
      return;
    }
    if (inventory.count(id) === 0) {
      this.setActiveHelper(null);
      this.busy = true;
      this.cancelHint();
      const bought = await showBuyItem(this, id, true);
      this.helperBar.refresh();
      this.release();
      if (!bought) return;
    }
    if (id === 'storm') {
      this.setActiveHelper(null);
      await this.useStorm();
    } else {
      this.setActiveHelper(id);
    }
  }

  /** Kürek / Dümen seçiliyken tahta dokunuşu hedef seçer; null ile normal oyuna dönülür. */
  private setActiveHelper(id: HelperId | null): void {
    this.activeHelper = id;
    this.helperBar.setActive(id);
    this.boardInput.setTargetMode(id ? (p) => this.useToolAt(p) : null);
    if (id) this.cancelHint();
  }

  private useToolAt(p: Pos): void {
    const tool = this.activeHelper;
    if (tool !== 'shovel' && tool !== 'helm') return;
    this.setActiveHelper(null);
    void this.playTurn(p, p, () => {
      const turn = this.session.useTool(tool, p);
      if (turn.move.kind === 'resolved') {
        dispatch({ type: 'useItem', item: tool });
        this.helperBar.refresh();
      }
      return turn;
    });
  }

  /** Fırtına: tahta karışır (hamle harcamaz). */
  private async useStorm(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.cancelHint();
    this.boardInput.clearSelection();
    const moves = this.session.useStorm();
    if (moves) {
      dispatch({ type: 'useItem', item: 'storm' });
      this.helperBar.refresh();
      audio.play('storm');
      this.fx.shake('small');
      const board = this.view.bounds;
      await Promise.all([
        showBanner(this, board.x + board.width / 2, board.y + board.height / 2, t('helper.storm.banner'), ANIM.shuffleBannerMs),
        this.view.animateShuffle(moves),
      ]);
      this.checkSync();
    }
    this.release();
  }

  private release(): void {
    this.busy = false;
    if (this.pendingRelayout) {
      this.pendingRelayout = false;
      this.onResize();
    }
    this.scheduleHint();
  }

  private async playShuffle(moves: readonly ShuffleMove[]): Promise<void> {
    const board = this.view.bounds;
    await Promise.all([
      showBanner(this, board.x + board.width / 2, board.y + board.height / 2, t('board.shuffling'), ANIM.shuffleBannerMs),
      this.view.animateShuffle(moves),
    ]);
  }

  /** Geliştirme modunda: görünüm mantıkla birebir aynı mı? */
  private checkSync(): void {
    if (!import.meta.env.DEV) return;
    const problem = this.view.findDesync(this.session.engine.board);
    if (problem) console.error('[Kaptan Pati] Görünüm/mantık uyuşmazlığı:', problem);
  }

  // ───────────────────────── yerleşim ─────────────────────────

  private boardLayout() {
    const { width, height } = this.scale;
    const board = this.session.engine.board;
    return computeBoardLayout(width, height, board.rows, board.cols);
  }

  private onResize(): void {
    if (this.busy) {
      this.pendingRelayout = true;
      return;
    }
    this.view.applyLayout(this.boardLayout());
    this.background.layout(this.scale.width, this.scale.height);
    this.layoutScreen();
    if (this.tutorialStep && this.tutorialStep.kind !== 'message') this.tutorial.showAction(this.tutorialStep);
  }

  private layoutScreen(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const board = this.view.bounds;
    const frameOuter = LAYOUT.framePadding + LAYOUT.frameBorder;
    // Uzun ekranlarda panel, tahtanın üstündeki boşluğun ortasına yerleşir.
    const hudY = Math.max(LAYOUT.hudHeight / 2, (board.y - frameOuter) / 2);
    this.hud.layout({ x: cx, y: hudY });
    this.helperBar.layout(cx, board.y + board.height + frameOuter + HUD.helperBarOffset);

    if (this.devButtons.length > 0) {
      const y = height - 110;
      this.devButtons.forEach((button, i) => button.setPosition(cx + (i - 1) * 320, y));
      this.devInfo?.setPosition(cx, y - 90);
    }
  }

  // ───────────────────────── ipucu ─────────────────────────

  private scheduleHint(): void {
    this.cancelHint();
    this.hintTimer = this.time.delayedCall(INPUT.hintDelayMs, () => this.showHint());
  }

  private cancelHint(): void {
    this.hintTimer?.remove();
    this.hintTimer = null;
    this.view.clearHint();
  }

  private showHint(): void {
    if (this.busy || this.session.status !== 'playing' || this.tutorialStep || this.activeHelper) return;
    const hint = this.session.engine.findHint();
    if (hint) this.view.showHint(hint);
  }

  // ───────────────────────── geliştirici paneli ─────────────────────────

  private createDevPanel(): void {
    const options = { width: 300, height: 90, fontSize: 34 };
    this.devButtons = [
      new TextButton(this, 0, 0, t('dev.prevLevel'), () => this.devJump(-1), options),
      new TextButton(this, 0, 0, t('dev.specials'), () => this.devPlaceSpecials(), options),
      new TextButton(this, 0, 0, t('dev.nextLevel'), () => this.devJump(1), options),
    ];
    for (const b of this.devButtons) b.setDepth(5);
    this.devInfo = this.add
      .text(0, 0, '', { fontFamily: FONT_FAMILY, fontSize: '30px', color: UI_COLORS.bodyText })
      .setOrigin(0.5)
      .setDepth(5);
  }

  private devJump(delta: number): void {
    if (this.busy) return;
    const next = ((this.levelId - 1 + delta + levelCount()) % levelCount()) + 1;
    // Geliştirici atlaması: başlangıç penceresi yok, can harcanmaz.
    dispatch({ type: 'devStartLevel', level: next });
    void this.startLevel(next, undefined, []);
  }

  /** Tahtanın ortasına her türden güçlendirici koyar; komşu çiftlerle tüm kombinasyonlar denenebilir. */
  private devPlaceSpecials(): void {
    if (this.busy) return;
    this.cancelHint();
    this.boardInput.clearSelection();
    const board = this.session.engine.board;
    const top = Math.floor(board.rows / 2) - 1;
    const left = Math.floor((board.cols - SPECIALS_TEST_LAYOUT[0].length) / 2);
    SPECIALS_TEST_LAYOUT.forEach((line, dRow) =>
      line.forEach((special, dCol) => {
        const p = { row: top + dRow, col: left + dCol };
        if (board.isCovered(p)) return;
        const tile = this.session.engine.debugSetSpecial(p, special);
        if (tile) void this.view.convertTile(tile.id, special);
      }),
    );
    this.scheduleHint();
  }
}
