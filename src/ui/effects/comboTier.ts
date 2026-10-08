import { FEEDBACK } from '../../config/feedback';

/**
 * Zincirin o anki kombo seviyesi: 0 yok, 1 "Güzel!" … 4 "İnanılmaz!".
 * stepIndex: zincir adımı (0 = oyuncunun eşleşmesi), cleared: bu hamlede şimdiye kadar kırılan taş.
 */
export function comboTier(stepIndex: number, cleared: number): number {
  let tier = 0;
  FEEDBACK.comboTiers.forEach((t, i) => {
    if (stepIndex >= t.step || cleared >= t.cleared) tier = i + 1;
  });
  return tier;
}
