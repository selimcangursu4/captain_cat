import { MATERIAL_IDS, type MaterialId, type Materials } from '../config/economy';
import type { ConstructionSave, SaveService } from '../services/SaveService';
import type { Wallet } from '../services/Wallet';
import type { Clock } from './Lives';
import { goldCostOf, isEmpty, missingMaterials, speedUpCost, starCostOf } from './pricing';
import { DESIGN_THEMES, TOWN, getTask, type TownRegion, type TownTask } from './town';

export type BuildResult =
  | { readonly ok: false; readonly reason: 'unknown' | 'locked' | 'built' | 'busy' | 'materials' }
  | { readonly ok: true; readonly task: TownTask; readonly endsAt: number };

export interface RegionCompletion {
  readonly region: TownRegion;
  readonly chestCoins: number;
  /** Açılan sıradaki bölge (son bölgede yok). */
  readonly next?: TownRegion;
}

export type FinishResult =
  | { readonly ok: false; readonly reason: 'none' | 'not-ready' | 'coins' }
  | {
      readonly ok: true;
      readonly task: TownTask;
      readonly design: number;
      /** Hızlandırmaya ödenen altın (süre dolduysa 0). */
      readonly paid: number;
      /** Bu inşaatla bölge bittiyse: sandık altını ve açılan bölge. */
      readonly regionCompleted?: RegionCompletion;
    };

export type FillResult = { readonly ok: true; readonly paid: number } | { readonly ok: false; readonly reason: 'unknown' | 'nothing' | 'stars' | 'coins' };

/**
 * Kasaba ilerlemesi. Görev yapmak: malzemeler harcanır, inşaat başlar ve tarifteki süre kadar sürer
 * (aynı anda tek inşaat). Süre dolunca inşaat bitirilir (ya da altınla hemen bitirilir). Bölgenin
 * bütün inşaatları bitince sandık açılır ve sıradaki bölge açılır; bitmeden ilerlenemez.
 * Durum kayıt servisinde tutulur; bu sınıf yalnızca kuralları uygular (Phaser'dan bağımsız).
 */
export class TownProgress {
  constructor(
    private readonly save: SaveService,
    private readonly wallet: Wallet,
    private readonly now: Clock = Date.now,
  ) {}

  get materials(): Readonly<Record<MaterialId, number>> {
    return this.save.data.materials;
  }

  /** Şu an inşa edilen bölge (tüm kasaba bittiyse son bölge). */
  get currentRegion(): TownRegion {
    return TOWN[Math.min(this.save.data.town.region, TOWN.length - 1)];
  }

  /** Görüntülenebilen bölgeler: bitmişler + şu anki. */
  get unlockedRegions(): readonly TownRegion[] {
    return TOWN.slice(0, Math.min(this.save.data.town.region, TOWN.length - 1) + 1);
  }

  get townComplete(): boolean {
    return TOWN.every((r) => this.isRegionComplete(r));
  }

  /** Görev bitti mi (inşaatı tamamlandı mı)? */
  isBuilt(taskId: string): boolean {
    return taskId in this.save.data.town.built;
  }

  designOf(taskId: string): number | undefined {
    return this.save.data.town.built[taskId];
  }

  isRegionComplete(region: TownRegion): boolean {
    return region.tasks.every((t) => this.isBuilt(t.id));
  }

  /** Süren inşaat (yoksa null). */
  get construction(): Readonly<ConstructionSave> | null {
    return this.save.data.town.construction;
  }

  isUnderConstruction(taskId: string): boolean {
    return this.construction?.task === taskId;
  }

  /** Süren inşaatın bitmesine kalan süre (ms; inşaat yoksa null, süre dolduysa 0). */
  get msLeft(): number | null {
    const c = this.construction;
    return c ? Math.max(0, c.endsAt - this.now()) : null;
  }

  /** Süren inşaatın ilerlemesi (0..1). */
  get constructionProgress(): number | null {
    const c = this.construction;
    if (!c) return null;
    const total = c.endsAt - c.startedAt;
    return total <= 0 ? 1 : Math.min(1, Math.max(0, (this.now() - c.startedAt) / total));
  }

  /** Süren inşaatı hemen bitirmenin altın bedeli (inşaat yoksa null). */
  get speedUpCost(): number | null {
    const ms = this.msLeft;
    return ms === null ? null : speedUpCost(ms);
  }

  /** Bölgedeki sıradaki bitmemiş görev (inşaatı süren görev de olabilir). */
  nextTask(region: TownRegion = this.currentRegion): TownTask | null {
    return region.tasks.find((t) => !this.isBuilt(t.id)) ?? null;
  }

  /** Tarif için eksik malzemeler. */
  missingFor(task: TownTask): Materials {
    return missingMaterials(task.recipe, this.materials);
  }

  /** Sıradaki görev şimdi başlatılabilir mi? (Ana ekrandaki "!" rozeti.) */
  canBuildNext(): boolean {
    const task = this.nextTask();
    return task !== null && this.construction === null && isEmpty(this.missingFor(task));
  }

  /**
   * Yeni seviyede verilecek malzeme: sıradaki görevde en çok eksik olan, yoksa bölgenin kalan
   * görevlerinde en çok eksik olan; kasaba bittiyse seviyeye göre sırayla. Kayda bağlı ve
   * belirlenimci (istemci ve sunucu aynı malzemeyi verir).
   */
  mostNeededMaterial(levelId: number): MaterialId {
    const pick = (need: Materials): MaterialId | null => {
      let best: MaterialId | null = null;
      let bestValue = 0;
      for (const id of MATERIAL_IDS) {
        const value = need[id] ?? 0;
        if (value > bestValue) {
          best = id;
          bestValue = value;
        }
      }
      return best;
    };
    const pending = this.currentRegion.tasks.filter((t) => !this.isBuilt(t.id) && !this.isUnderConstruction(t.id));
    if (pending.length > 0) {
      const first = pick(missingMaterials(pending[0].recipe, this.materials));
      if (first) return first;
      const total: Materials = {};
      for (const task of pending) for (const id of MATERIAL_IDS) total[id] = (total[id] ?? 0) + (task.recipe[id] ?? 0);
      const region = pick(missingMaterials(total, this.materials));
      if (region) return region;
    }
    return MATERIAL_IDS[levelId % MATERIAL_IDS.length];
  }

  /** İnşaatı başlatır: malzemeler harcanır, süre işlemeye başlar. */
  build(taskId: string, design: number): BuildResult {
    const task = getTask(taskId);
    if (!task || !DESIGN_THEMES[design]) return { ok: false, reason: 'unknown' };
    if (this.isBuilt(taskId)) return { ok: false, reason: 'built' };
    if (this.construction) return { ok: false, reason: 'busy' };
    if (task.region !== this.currentRegion.id || this.nextTask()?.id !== taskId) return { ok: false, reason: 'locked' };
    if (!isEmpty(this.missingFor(task))) return { ok: false, reason: 'materials' };

    // Kayda işlenmiş en geç komuttan geriye başlatılamaz: saat geri alınarak süre kısaltılamasın.
    const startedAt = Math.max(this.now(), this.save.data.clock);
    const endsAt = startedAt + task.minutes * 60_000;
    this.save.update((d) => {
      for (const id of MATERIAL_IDS) d.materials[id] -= task.recipe[id] ?? 0;
      d.town.construction = { task: taskId, design, startedAt, endsAt };
    });
    return { ok: true, task, endsAt };
  }

  /** Süresi dolan inşaatı bitirir. */
  finish(): FinishResult {
    const c = this.construction;
    if (!c) return { ok: false, reason: 'none' };
    if (this.now() < c.endsAt) return { ok: false, reason: 'not-ready' };
    return this.complete(c, 0);
  }

  /** İnşaatı altınla hemen bitirir (zaman atlama). */
  speedUp(): FinishResult {
    const c = this.construction;
    const cost = this.speedUpCost;
    if (!c || cost === null) return { ok: false, reason: 'none' };
    if (!this.wallet.trySpendCoins(cost)) return { ok: false, reason: 'coins' };
    return this.complete(c, cost);
  }

  /** Görevin eksik malzemelerini yıldızla ya da doğrudan altınla tamamlar. */
  fillMissing(taskId: string, currency: 'stars' | 'coins'): FillResult {
    const task = getTask(taskId);
    if (!task || this.isBuilt(taskId) || this.isUnderConstruction(taskId)) return { ok: false, reason: 'unknown' };
    const missing = this.missingFor(task);
    if (isEmpty(missing)) return { ok: false, reason: 'nothing' };
    const paid = currency === 'stars' ? starCostOf(missing) : goldCostOf(missing);
    const spent = currency === 'stars' ? this.wallet.trySpendStars(paid) : this.wallet.trySpendCoins(paid);
    if (!spent) return { ok: false, reason: currency };
    this.save.update((d) => {
      for (const id of MATERIAL_IDS) d.materials[id] += missing[id] ?? 0;
    });
    return { ok: true, paid };
  }

  /** Bitmiş bir görevin tasarımını ücretsiz değiştirir. */
  changeDesign(taskId: string, design: number): boolean {
    if (!this.isBuilt(taskId) || !DESIGN_THEMES[design]) return false;
    this.save.update((d) => {
      d.town.built[taskId] = design;
    });
    return true;
  }

  regionProgress(region: TownRegion): { built: number; total: number } {
    return { built: region.tasks.filter((t) => this.isBuilt(t.id)).length, total: region.tasks.length };
  }

  private complete(c: Readonly<ConstructionSave>, paid: number): FinishResult {
    const task = getTask(c.task)!;
    const region = TOWN.find((r) => r.id === task.region)!;
    const index = TOWN.indexOf(region);
    const completes = region.tasks.every((t) => t.id === task.id || this.isBuilt(t.id));
    this.save.update((d) => {
      d.town.built[task.id] = c.design;
      d.town.construction = null;
      if (completes) {
        d.town.chests.push(region.id);
        d.coins += region.chestCoins;
        if (index < TOWN.length - 1) d.town.region = index + 1;
      }
    });
    return {
      ok: true,
      task,
      design: c.design,
      paid,
      regionCompleted: completes ? { region, chestCoins: region.chestCoins, next: TOWN[index + 1] } : undefined,
    };
  }
}
