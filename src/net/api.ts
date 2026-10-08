/**
 * Sunucu adresi. VITE_API_URL verilmezse sayfanın açıldığı makinenin 8787 portu kullanılır
 * (bilgisayarda localhost, aynı ağdaki telefonda bilgisayarın IP'si). Android paketinde
 * (Aşama 10) VITE_API_URL ile sunucunun adresi verilir.
 */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  `${globalThis.location?.protocol ?? 'http:'}//${globalThis.location?.hostname ?? 'localhost'}:8787`;

/** Sunucuya ulaşılamadı (internet yok, sunucu kapalı, zaman aşımı). */
export class NetworkError extends Error {
  constructor(message = 'Sunucuya ulaşılamadı') {
    super(message);
    this.name = 'NetworkError';
  }
}

/** Sunucu isteği reddetti. code: invalid_input, email_taken, invalid_credentials, unauthorized, too_many_requests… */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  readonly method?: 'GET' | 'POST';
  readonly body?: unknown;
  readonly token?: string | null;
  readonly timeoutMs?: number;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    throw new ApiError(response.status, String(data.error ?? 'error'), String(data.message ?? response.statusText));
  }
  return data as T;
}
