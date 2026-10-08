import type Phaser from 'phaser';
import { ECONOMY, ITEM_IDS, type BoosterId, type ItemId } from '../../config/economy';
import { inventory, lives } from '../../meta/progress';
import { dispatch } from '../../net/sync';
import { showItemUnlock, showLevelStart, showLives } from './economyPopups';

/**
 * Bir seviyeye başlama akışı (kasabadan "Oyna", oyun içinden "Tekrar Dene"):
 *  1) bu seviyeyle açılan yeni eşyaların tanıtımı (hediyeleriyle),
 *  2) can yoksa can penceresi (bekle ya da altınla doldur),
 *  3) hedefler + güçlendirici seçimi → "Oyna": 1 can ve seçilen güçlendiriciler harcanır.
 * Başlandıysa seçilen güçlendiricileri, vazgeçildiyse null döndürür.
 */
export async function prepareLevelStart(scene: Phaser.Scene, levelId: number): Promise<BoosterId[] | null> {
  const hasUnlocks = ITEM_IDS.some((id) => ECONOMY.items[id].unlockLevel <= levelId && !inventory.isUnlocked(id));
  if (hasUnlocks) {
    const result = dispatch({ type: 'claimUnlocks', level: levelId });
    for (const id of result.ok ? (result.value as ItemId[]) : []) await showItemUnlock(scene, id);
  }
  for (;;) {
    if (lives.count <= 0 && (await showLives(scene)) !== 'refilled') return null;
    const boosters = await showLevelStart(scene, levelId);
    if (!boosters) return null;
    const result = dispatch({ type: 'startLevel', level: levelId, boosters });
    if (result.ok) return boosters;
    // Pencere açıkken can bitmiş olabilir (ör. başka cihazda oynandı ve eşitlendi): başa dön.
    if (result.reason === 'no-lives') continue;
    // Geliştirme: ?level= ile henüz açılmamış bir seviye denenebilsin (can harcanmaz).
    if (import.meta.env.DEV && result.reason === 'level-locked' && dispatch({ type: 'devStartLevel', level: levelId }).ok) return [];
    return null;
  }
}
