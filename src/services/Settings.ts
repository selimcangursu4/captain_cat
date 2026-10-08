import { getLanguage, setLanguage, type Language } from '../i18n';
import { LocalStorageSaveStorage, type SaveStorage } from './SaveService';

type Toggle = 'sound' | 'music' | 'vibration';

/** Cihaza özgü oyuncu ayarları (hesaba değil telefona aittir; sunucuya gitmez). */
export interface SettingsData {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  /** null: cihaz dili (Türkçe değilse İngilizce). */
  language: Language | null;
}

const DEFAULTS: SettingsData = { sound: true, music: true, vibration: true, language: null };

/** Cihaz dili Türkçeyse Türkçe, değilse İngilizce. */
export function detectLanguage(locale: string | undefined): Language {
  return locale?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

/** Okunan ayarları doğrular; bozuk alanlar varsayılana döner. */
export function parseSettings(text: string | null): SettingsData {
  try {
    const raw = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
    return {
      sound: bool(raw.sound, DEFAULTS.sound),
      music: bool(raw.music, DEFAULTS.music),
      vibration: bool(raw.vibration, DEFAULTS.vibration),
      language: raw.language === 'tr' || raw.language === 'en' ? raw.language : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Ses, müzik, titreşim, dil. */
export class Settings {
  private state: SettingsData;
  private readonly listeners = new Set<(values: Readonly<SettingsData>) => void>();

  constructor(
    private readonly storage: SaveStorage,
    private readonly deviceLocale: () => string | undefined = () => globalThis.navigator?.language,
  ) {
    this.state = parseSettings(storage.read());
  }

  get values(): Readonly<SettingsData> {
    return this.state;
  }

  get sound(): boolean {
    return this.state.sound;
  }

  get music(): boolean {
    return this.state.music;
  }

  get vibration(): boolean {
    return this.state.vibration;
  }

  /** Seçilen dil; seçilmediyse cihaz dili. */
  get language(): Language {
    return this.state.language ?? detectLanguage(this.deviceLocale());
  }

  setToggle(key: Toggle, value: boolean): void {
    this.set({ [key]: value });
  }

  /** Dili kaydeder ve metinleri hemen o dile çevirir (ekranlar yeniden çizilmeli). */
  setLanguage(language: Language): void {
    this.set({ language });
    this.applyLanguage();
  }

  /** Kayıttaki (ya da cihazın) dilini i18n'e uygular; açılışta çağrılır. */
  applyLanguage(): void {
    if (getLanguage() !== this.language) setLanguage(this.language);
  }

  onChange(listener: (values: Readonly<SettingsData>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<SettingsData>): void {
    this.state = { ...this.state, ...patch };
    this.storage.write(JSON.stringify(this.state));
    for (const listener of this.listeners) listener(this.state);
  }
}

export const settings = new Settings(new LocalStorageSaveStorage('kaptan-pati/settings'));
