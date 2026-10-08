import { LocalStorageSaveStorage } from '../services/SaveService';

/** Giriş yapmış hesap (kayıt ve giriş yanıtındaki kullanıcı). */
export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

/**
 * Oturum: sunucunun verdiği belirteç + hesap bilgisi. Telefonda saklanır; böylece giriş bir kez
 * yapılır ve oyun sonra internetsiz de açılır. Belirteç sunucuda iptal edilirse (çıkış, süre)
 * bir sonraki eşitlemede yeniden giriş istenir.
 */
export interface Session {
  readonly token: string;
  readonly user: SessionUser;
}

const storage = new LocalStorageSaveStorage('kaptan-pati/session');

export function loadSession(): Session | null {
  try {
    const raw = JSON.parse(storage.read() ?? 'null') as Session | null;
    return raw && typeof raw.token === 'string' && typeof raw.user?.id === 'string' ? raw : null;
  } catch {
    return null;
  }
}

export function storeSession(session: Session | null): void {
  storage.write(session ? JSON.stringify(session) : 'null');
}
