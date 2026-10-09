import { Capacitor } from '@capacitor/core';
import { getLanguage } from '../i18n';
import { API_URL } from './api';

export type LegalPage = 'privacy' | 'terms' | 'support' | 'delete-account';

/** Sunucunun sunduğu gizlilik politikası / koşullar / destek / hesap silme sayfası (oyunun dilinde). */
export function legalUrl(page: LegalPage): string {
  return `${API_URL}/${page}?lang=${getLanguage()}`;
}

/**
 * Bağlantıyı cihazın tarayıcısında açar. Telefonda (Capacitor) uygulama dışı bir adrese gitmek
 * sistem tarayıcısını açar, oyun yerinde kalır; tarayıcıda yeni sekme açılır.
 */
export function openExternal(url: string): void {
  if (Capacitor.isNativePlatform()) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}
