import type { SaveService } from '../services/SaveService';
import { DESIGN_THEMES, TOWN, getTask, type TownRegion, type TownTask } from './town';

export type BuildResult =
  | { readonly ok: false; readonly reason: 'unknown' | 'locked' | 'built' | 'stars' }
  | {
      readonly ok: true;
      readonly task: TownTask;
      /** Bu görevle bölge bittiyse: sandıktan çıkan altın ve açılan sıradaki bölge (son bölgede yok). */
      readonly regionCompleted?: { readonly region: TownRegion; readonly chestCoins: number; readonly next?: TownRegion };
    };

/**
 * Kasaba ilerlemesi: yıldızla görev yapma, tasarım seçme/değiştirme, bölge açma ve sandık.
 * Durum kayıt servisinde tutulur; bu sınıf yalnızca kuralları uygular (Phaser'dan bağımsız).
 */
export class TownProgress {
  constructor(private readonly save: SaveService) {}

  get stars(): number {
    return this.save.data.stars;
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

  isBuilt(taskId: string): boolean {
    return taskId in this.save.data.town.built;
  }

  designOf(taskId: string): number | undefined {
    return this.save.data.town.built[taskId];
  }

  isRegionComplete(region: TownRegion): boolean {
    return region.tasks.every((t) => this.isBuilt(t.id));
  }

  /** Bölgedeki sıradaki yapılmamış görev (görevler sırayla açılır). */
  nextTask(region: TownRegion = this.currentRegion): TownTask | null {
    return region.tasks.find((t) => !this.isBuilt(t.id)) ?? null;
  }

  /** Sıradaki görevi yapmaya yetecek yıldız var mı? (Ana ekrandaki "!" rozeti.) */
  canBuildNext(): boolean {
    const task = this.nextTask();
    return task !== null && this.stars >= task.cost;
  }

  build(taskId: string, design: number): BuildResult {
    const task = getTask(taskId);
    if (!task || !DESIGN_THEMES[design]) return { ok: false, reason: 'unknown' };
    if (this.isBuilt(taskId)) return { ok: false, reason: 'built' };
    if (task.region !== this.currentRegion.id || this.nextTask()?.id !== taskId) return { ok: false, reason: 'locked' };
    if (this.stars < task.cost) return { ok: false, reason: 'stars' };

    const region = this.currentRegion;
    const index = TOWN.indexOf(region);
    const completes = region.tasks.every((t) => t.id === taskId || this.isBuilt(t.id));
    this.save.update((d) => {
      d.stars -= task.cost;
      d.town.built[taskId] = design;
      if (completes) {
        d.town.chests.push(region.id);
        d.coins += region.chestCoins;
        if (index < TOWN.length - 1) d.town.region = index + 1;
      }
    });
    return {
      ok: true,
      task,
      regionCompleted: completes ? { region, chestCoins: region.chestCoins, next: TOWN[index + 1] } : undefined,
    };
  }

  /** Yapılmış bir görevin tasarımını ücretsiz değiştirir. */
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
}
