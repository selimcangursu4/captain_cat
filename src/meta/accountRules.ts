/** Hesap alanlarının kuralları: istemci (giriş ekranı) ve sunucu aynı kuralları kullanır. */
export const ACCOUNT_RULES = {
  emailMax: 254,
  passwordMin: 8,
  passwordMax: 128,
  nameMin: 3,
  nameMax: 16,
} as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= ACCOUNT_RULES.emailMax && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= ACCOUNT_RULES.passwordMin && password.length <= ACCOUNT_RULES.passwordMax;
}

/** Baştaki/sondaki boşluklar silinir, aradaki çoklu boşluk teke iner. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Harf (Türkçe dahil), rakam, boşluk, alt çizgi, nokta, tire. */
export function isValidName(name: string): boolean {
  return name.length >= ACCOUNT_RULES.nameMin && name.length <= ACCOUNT_RULES.nameMax && /^[\p{L}\p{N} _.-]+$/u.test(name);
}
