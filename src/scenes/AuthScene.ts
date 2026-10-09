import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManifest';
import { FONT_FAMILY, UI_COLORS } from '../config/theme';
import { t, type I18nKey } from '../i18n';
import { isValidEmail, isValidName, isValidPassword, normalizeEmail, normalizeName } from '../meta/accountRules';
import { login, playAsGuest, register, upgradeAccount } from '../net/account';
import { ApiError, NetworkError } from '../net/api';
import { legalUrl, openExternal } from '../net/links';
import { TextButton } from '../ui/components/TextButton';
import { OceanBackground } from '../ui/effects/OceanBackground';
import { SCENES, fadeInScene, goToScene, type AuthSceneData } from './keys';

type Mode = 'login' | 'register' | 'upgrade';

const INPUT_STYLE = [
  'width:100%',
  'box-sizing:border-box',
  'padding:22px 30px',
  'border-radius:30px',
  'border:5px solid #d9a066',
  'background:#fff8e6',
  'color:#5a2d06',
  "font:600 42px 'Fredoka', sans-serif",
  'outline:none',
].join(';');

/** Giriş ekranının HTML formu (Phaser DOM öğesi: gerçek metin kutuları, telefon klavyesi çalışır). */
function formHtml(): string {
  const input = (name: string, type: string, autocomplete: string, extra = '') =>
    `<input name="${name}" type="${type}" autocomplete="${autocomplete}" style="${INPUT_STYLE}" ${extra}>`;
  return `<form style="display:flex;flex-direction:column;gap:26px;width:780px" novalidate>
    ${input('displayName', 'text', 'nickname', 'maxlength="16" enterkeyhint="next"')}
    ${input('email', 'email', 'email', 'inputmode="email" autocapitalize="none" enterkeyhint="next"')}
    ${input('password', 'password', 'current-password', 'enterkeyhint="go"')}
  </form>`;
}

/**
 * Giriş ekranı: misafir olarak oyna (kişisel bilgi istenmez), giriş yap ya da kayıt ol. Misafir
 * oyuncu ayarlardan buraya 'upgrade' kipinde gelip hesabını e-postayla kaydeder; ilerleme korunur.
 * Giriş bir kez yapılır; oturum telefonda saklanır ve oyun sonra internetsiz de açılır.
 */
export class AuthScene extends Phaser.Scene {
  private mode: Mode = 'login';
  private busy = false;
  private notice: string | null = null;
  private background!: OceanBackground;
  private captain!: Phaser.GameObjects.Image;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private form!: Phaser.GameObjects.DOMElement;
  private submitButton!: TextButton;
  private toggle!: Phaser.GameObjects.Text;
  private guestButton!: TextButton;
  private guestHint!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private legal!: Phaser.GameObjects.Container;

  constructor() {
    super(SCENES.auth);
  }

  init(data: AuthSceneData): void {
    this.mode = data?.mode ?? 'login';
    this.busy = false;
    this.notice = data?.message ?? null;
  }

  create(): void {
    fadeInScene(this);
    this.background = new OceanBackground(this);
    this.captain = this.add.image(0, 0, TEXTURES.captain).setDisplaySize(260, 260);
    this.tweens.add({ targets: this.captain, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.title = this.add.text(0, 0, '', textStyle(76)).setOrigin(0.5);
    this.subtitle = this.add.text(0, 0, '', { ...textStyle(38, UI_COLORS.bannerText), wordWrap: { width: 900 } }).setOrigin(0.5);
    this.form = this.add.dom(0, 0).createFromHTML(formHtml());
    this.submitButton = new TextButton(this, 0, 0, '', () => void this.submit(), {
      width: 640,
      height: 130,
      fontSize: 54,
      variant: 'green',
    });
    this.toggle = this.add
      .text(0, 0, '', textStyle(38, '#ffe066'))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.toggle.on('pointerup', () => this.onToggle());
    this.guestButton = new TextButton(this, 0, 0, t('auth.guest'), () => void this.guest(), {
      width: 640,
      height: 120,
      fontSize: 46,
    });
    this.guestHint = this.add.text(0, 0, t('auth.guestHint'), { ...textStyle(28, '#ffffff'), wordWrap: { width: 860 } }).setOrigin(0.5);
    this.message = this.add
      .text(0, 0, this.notice ?? '', { ...textStyle(36, '#ffd0d0'), wordWrap: { width: 860 } })
      .setOrigin(0.5);
    this.legal = this.createLegalLinks();

    // Enter: sıradaki kutuya geç ya da gönder.
    this.form.addListener('keydown');
    this.form.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.submit();
      }
    });

    this.setMode(this.mode);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  /** Alt kısımdaki "Gizlilik Politikası · Kullanım Koşulları" bağlantıları ve onay notu. */
  private createLegalLinks(): Phaser.GameObjects.Container {
    const note = this.add.text(0, 0, t('auth.legal'), { ...textStyle(26, '#ffffff'), wordWrap: { width: 900 } }).setOrigin(0.5);
    const link = (label: string, url: string) => {
      const text = this.add.text(0, 62, label, textStyle(32, '#ffe066')).setOrigin(0.5).setInteractive({ useHandCursor: true });
      text.on('pointerup', () => openExternal(url));
      return text;
    };
    const privacy = link(t('auth.privacy'), legalUrl('privacy'));
    const terms = link(t('auth.terms'), legalUrl('terms'));
    // [Gizlilik] · [Koşullar] ortalanmış tek satır.
    const gap = 60;
    const total = privacy.width + gap + terms.width;
    privacy.setX(-total / 2 + privacy.width / 2);
    terms.setX(total / 2 - terms.width / 2);
    const dot = this.add.text(-total / 2 + privacy.width + gap / 2, 62, '·', textStyle(32)).setOrigin(0.5);
    return this.add.container(0, 0, [note, privacy, dot, terms]);
  }

  private field(name: 'displayName' | 'email' | 'password'): HTMLInputElement {
    return this.form.getChildByName(name) as HTMLInputElement;
  }

  private onToggle(): void {
    if (this.busy) return;
    if (this.mode === 'upgrade') goToScene(this, SCENES.home);
    else this.setMode(this.mode === 'login' ? 'register' : 'login');
  }

  private setMode(mode: Mode): void {
    if (this.busy) return;
    this.mode = mode;
    const withName = mode !== 'login';
    const upgrade = mode === 'upgrade';
    this.field('displayName').style.display = withName ? 'block' : 'none';
    this.field('displayName').placeholder = t('auth.displayName');
    this.field('email').placeholder = t('auth.email');
    this.field('password').placeholder = t('auth.password');
    this.field('password').autocomplete = withName ? 'new-password' : 'current-password';
    this.title.setText(t(upgrade ? 'auth.upgradeTitle' : 'auth.welcome'));
    this.subtitle.setText(t(upgrade ? 'auth.upgradeSubtitle' : 'auth.subtitle'));
    this.submitButton.setLabel(t(upgrade ? 'auth.upgrade' : mode === 'register' ? 'auth.register' : 'auth.login'));
    this.toggle.setText(t(upgrade ? 'auth.cancel' : mode === 'register' ? 'auth.toLogin' : 'auth.toRegister'));
    this.guestButton.setVisible(!upgrade);
    this.guestHint.setVisible(!upgrade);
    if (!this.notice) this.message.setText('');
    this.notice = null;
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const extra = Math.max(0, height - 1920);
    const top = 70 + extra * 0.3;
    this.background.layout(width, height);
    this.captain.setPosition(cx, top + 140);
    this.title.setPosition(cx, top + 320);
    this.subtitle.setPosition(cx, top + 400);
    const formHeight = this.mode === 'login' ? 300 : 420;
    this.form.setPosition(cx, top + 470 + formHeight / 2);
    const below = top + 470 + formHeight;
    this.submitButton.setPosition(cx, below + 105);
    this.toggle.setPosition(cx, below + 215);
    this.guestButton.setPosition(cx, below + 345);
    this.guestHint.setPosition(cx, below + 445);
    this.message.setPosition(cx, below + (this.mode === 'upgrade' ? 320 : 530));
    this.legal.setPosition(cx, height - 150 - extra * 0.2);
  }

  private showError(key: I18nKey): void {
    this.message.setColor('#ffd0d0').setText(t(key));
    this.tweens.add({ targets: this.message, x: this.message.x + 12, duration: 50, yoyo: true, repeat: 3 });
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.busy = true;
    this.submitButton.setEnabled(false);
    this.guestButton.setEnabled(false);
    this.message.setColor(UI_COLORS.bannerText).setText(t('auth.connecting'));
    try {
      await action();
      goToScene(this, SCENES.home);
    } catch (error) {
      this.busy = false;
      this.submitButton.setEnabled(true);
      this.guestButton.setEnabled(true);
      this.showError(errorKey(error));
    }
  }

  private async guest(): Promise<void> {
    if (this.busy) return;
    await this.run(() => playAsGuest());
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    const withName = this.mode !== 'login';
    const email = normalizeEmail(this.field('email').value);
    const password = this.field('password').value;
    const name = normalizeName(this.field('displayName').value);
    if (withName && !isValidName(name)) return this.showError('auth.error.name');
    if (!isValidEmail(email)) return this.showError('auth.error.email');
    if (!isValidPassword(password)) return this.showError('auth.error.password');
    await this.run(() =>
      this.mode === 'upgrade' ? upgradeAccount(email, password, name) : this.mode === 'register' ? register(email, password, name) : login(email, password),
    );
  }
}

function textStyle(size: number, color: string = UI_COLORS.titleText): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    fontStyle: '700',
    color,
    stroke: UI_COLORS.titleStroke,
    strokeThickness: Math.round(size / 6),
    align: 'center',
  };
}

function errorKey(error: unknown): I18nKey {
  if (error instanceof NetworkError) return 'auth.error.offline';
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'email_taken':
        return 'auth.error.taken';
      case 'invalid_credentials':
        return 'auth.error.credentials';
      case 'too_many_requests':
        return 'auth.error.tooMany';
      case 'already_registered':
        return 'auth.error.registered';
      case 'invalid_input':
        return 'auth.error.email';
    }
  }
  return 'auth.error.generic';
}
