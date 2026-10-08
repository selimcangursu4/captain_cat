import { getLanguage, t } from '../i18n';

/** İnşaat süresi gibi uzun süreler: "2 sa 15 dk", "12 dk 05 sn", "40 sn". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total >= 3600) {
    // Kalan süre yukarı yuvarlanır: "1 sa 59 dk 30 sn" → "2 sa".
    const minutesTotal = Math.ceil(total / 60);
    const hours = Math.floor(minutesTotal / 60);
    const minutes = minutesTotal % 60;
    return minutes > 0 ? `${t('time.h', { n: hours })} ${t('time.m', { n: minutes })}` : t('time.h', { n: hours });
  }
  if (total >= 600) return t('time.m', { n: Math.ceil(total / 60) });
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return t('time.s', { n: seconds });
  return seconds > 0 ? `${t('time.m', { n: minutes })} ${t('time.s', { n: String(seconds).padStart(2, '0') })}` : t('time.m', { n: minutes });
}

/** Geri sayım (her saniye güncellenen): "1:02:03" ya da "12:34". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Binlik ayraçlı sayı (dile göre: 12.000 / 12,000). */
export function formatNumber(n: number): string {
  return n.toLocaleString(getLanguage() === 'tr' ? 'tr-TR' : 'en-US');
}
