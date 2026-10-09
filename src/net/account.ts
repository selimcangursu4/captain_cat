import { levelCount, registerLevels } from '../data/levels';
import { LocalStorageSaveStorage, MemorySaveStorage, saveService, userSaveKey } from '../services/SaveService';
import { api } from './api';
import { loadSession, storeSession, type Session, type SessionUser } from './session';
import { sync } from './sync';

let current: Session | null = null;

/** Giriş yapmış hesap (yoksa null). */
export function currentUser(): SessionUser | null {
  return current?.user ?? null;
}

/** Misafir hesapla mı oynanıyor? */
export function isGuest(): boolean {
  return current?.user.guest === true;
}

/** Oturumun belirteci (sunucu istekleri için; yoksa null). */
export function currentToken(): string | null {
  return current?.token ?? null;
}

/** Hesabın telefondaki kaydına ve komut günlüğüne geçer. */
function activate(session: Session): void {
  current = session;
  saveService.useStorage(new LocalStorageSaveStorage(userSaveKey(session.user.id)));
  sync.attach(session);
}

/**
 * Açılışta: kayıtlı oturum varsa onu etkinleştirir (internet gerekmez; eşitleme arkada denenir).
 * Oturum yoksa null: giriş ekranı açılır.
 */
export function restoreSession(): Session | null {
  const session = loadSession();
  if (session) activate(session);
  return session;
}

interface AuthResponse {
  readonly token: string;
  readonly user: SessionUser;
}

async function begin(response: AuthResponse): Promise<SessionUser> {
  const session: Session = { token: response.token, user: response.user };
  storeSession(session);
  activate(session);
  // Sunucudaki kaydı al (bu hesapla bu telefonda daha önce internetsiz oynandıysa günlük de gider).
  await sync.syncNow();
  void refreshLevels();
  return session.user;
}

export async function register(email: string, password: string, displayName: string): Promise<SessionUser> {
  return begin(await api<AuthResponse>('/auth/register', { body: { email, password, displayName } }));
}

export async function login(email: string, password: string): Promise<SessionUser> {
  return begin(await api<AuthResponse>('/auth/login', { body: { email, password } }));
}

/** Misafir olarak oyna: e-posta ve şifre istenmez; sunucu misafir hesap açar. */
export async function playAsGuest(): Promise<SessionUser> {
  return begin(await api<AuthResponse>('/auth/guest', { body: {} }));
}

/** Misafir hesabı e-posta ve şifreyle kaydeder; ilerleme aynı hesapta kalır. */
export async function upgradeAccount(email: string, password: string, displayName: string): Promise<SessionUser> {
  if (!current) throw new Error('Giriş yapılmamış');
  const { token } = current;
  const res = await api<{ user: SessionUser }>('/auth/upgrade', { body: { email, password, displayName }, token });
  current = { token, user: res.user };
  storeSession(current);
  return res.user;
}

/**
 * Hesabı kalıcı olarak siler (sunucudaki hesap, ilerleme, işlem günlüğü ve satın alma kayıtları).
 * İnternet gerekir; başarılıysa telefondaki kayıt, günlük ve oturum da silinir.
 */
export async function deleteAccount(): Promise<void> {
  if (!current) return;
  const { token, user } = current;
  await api('/account/delete', { body: {}, token });
  sync.detach();
  for (const key of [userSaveKey(user.id), `kaptan-pati/journal/${user.id}`, `kaptan-pati/sync/${user.id}`, `kaptan-pati/purchases/${user.id}`]) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Depolama kapalıysa yapacak bir şey yok; oturum yine de silinir.
    }
  }
  storeSession(null);
  current = null;
  saveService.useStorage(new MemorySaveStorage());
}

/**
 * Çıkış. Sunucuya gitmemiş ilerleme varsa önce eşitlemeyi dener; internet yoksa çıkış yapılmaz
 * ('pending': ilerleme kaybolmasın).
 */
export async function logout(): Promise<'ok' | 'pending'> {
  if (sync.pending > 0) await sync.syncNow();
  if (sync.pending > 0) return 'pending';
  const token = current?.token;
  try {
    await api('/auth/logout', { body: {}, token, timeoutMs: 4000 });
  } catch {
    // Sunucuya ulaşılamasa da telefondaki oturum silinir.
  }
  storeSession(null);
  sync.detach();
  current = null;
  saveService.useStorage(new MemorySaveStorage());
  return 'ok';
}

/**
 * Sunucu oturumu reddetti (süresi doldu ya da başka yerden çıkış yapıldı): telefondaki oturum
 * silinir ama hesabın kaydı ve gönderilmemiş komutları telefonda kalır; aynı hesapla tekrar
 * girilince kaldığı yerden eşitlenir.
 */
export function expireSession(): void {
  storeSession(null);
  sync.detach();
  current = null;
  saveService.useStorage(new MemorySaveStorage());
}

// ───────────────────────── sunucudan gelen yeni seviyeler ─────────────────────────

const levelCache = new LocalStorageSaveStorage('kaptan-pati/levels-extra');

/** Daha önce sunucudan indirilen seviyeleri ekler (internetsiz açılışta da oynanabilsinler). */
export function loadCachedLevels(): void {
  try {
    registerLevels(JSON.parse(levelCache.read() ?? '[]') as unknown[]);
  } catch {
    // Bozuk önbellek: yok sayılır, bir sonraki bağlantıda yeniden indirilir.
  }
}

/** Pakette olmayan yeni seviyeleri sunucudan indirir. Eklenen sayıyı döndürür. */
export async function refreshLevels(): Promise<number> {
  try {
    const res = await api<{ levels: unknown[] }>(`/levels?after=${levelCount()}`);
    const added = registerLevels(res.levels);
    if (added > 0) {
      const cached = JSON.parse(levelCache.read() ?? '[]') as unknown[];
      levelCache.write(JSON.stringify([...cached, ...res.levels.slice(0, added)]));
    }
    return added;
  } catch {
    return 0;
  }
}
