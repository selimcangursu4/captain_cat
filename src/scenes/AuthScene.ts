import Phaser from 'phaser';
import { TEXTURES } from '../assets/AssetManifest';
import { FONT_FAMILY, UI_COLORS } from '../config/theme';
import { t, type I18nKey } from '../i18n';
import { isValidEmail, isValidName, isValidPassword, normalizeEmail, normalizeName } from '../meta/accountRules';
import { login, register } from '../net/account';
import { ApiError, NetworkError } from '../net/api';
import { TextButton } from '../ui/components/TextButton';
import { OceanBackground } from '../ui/effects/OceanBackground';
import { SCENES, fadeInScene, goToScene, type AuthSceneData } from './keys';

type Mode = 'login' | 'register';

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
 * Giriş / kayıt ekranı. Oyun hesapsız oynanmaz (misafir yok); giriş bir kez yapılır, sonra
 * oturum telefonda saklanır ve oyun internetsiz de açılır.
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
  private message!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.auth);
  }

  init(data: AuthSceneData): void {
    this.mode = 'login';
    this.busy = false;
    this.notice = data?.message ?? null;
  }

  create(): void {
    fadeInScene(this);
    this.background = new OceanBackground(this);
    this.captain = this.add.image(0, 0, TEXTURES.captain).setDisplaySize(300, 300);
    this.tweens.add({ targets: this.captain, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const textStyle = (size: number, color: string = UI_COLORS.titleText) => ({
      fontFamily: FONT_FAMILY,
      fontSize: `${size}px`,
      fontStyle: '700',
      color,
      stroke: UI_COLORS.titleStroke,
      strokeThickness: Math.round(size / 6),
      align: 'center',
    });
    this.title = this.add.text(0, 0, t('auth.welcome'), textStyle(76)).setOrigin(0.5);
    this.subtitle = this.add.text(0, 0, t('auth.subtitle'), textStyle(40, UI_COLORS.bannerText)).setOrigin(0.5);
    this.form = this.add.dom(0, 0).createFromHTML(formHtml());
    this.submitButton = new TextButton(this, 0, 0, '', () => void this.submit(), {
      width: 640,
      height: 140,
      fontSize: 56,
      variant: 'green',
    });
    this.toggle = this.add
      .text(0, 0, '', textStyle(38, '#ffe066'))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.toggle.on('pointerup', () => this.setMode(this.mode === 'login' ? 'register' : 'login'));
    this.message = this.add
      .text(0, 0, this.notice ?? '', { ...textStyle(36, '#ffd0d0'), wordWrap: { width: 860 } })
      .setOrigin(0.5);

    // Enter: sıradaki kutuya geç ya da gönder.
    this.form.addListener('keydown');
    this.form.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void this.submit();
      }
    });

    this.setMode('login');
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this));
  }

  private field(name: 'displayName' | 'email' | 'password'): HTMLInputElement {
    return this.form.getChildByName(name) as HTMLInputElement;
  }

  private setMode(mode: Mode): void {
    if (this.busy) return;
    this.mode = mode;
    const isRegister = mode === 'register';
    this.field('displayName').style.display = isRegister ? 'block' : 'none';
    this.field('displayName').placeholder = t('auth.displayName');
    this.field('email').placeholder = t('auth.email');
    this.field('password').placeholder = t('auth.password');
    this.field('password').autocomplete = isRegister ? 'new-password' : 'current-password';
    this.submitButton.setLabel(t(isRegister ? 'auth.register' : 'auth.login'));
    this.toggle.setText(t(isRegister ? 'auth.toLogin' : 'auth.toRegister'));
    if (!this.notice) this.message.setText('');
    this.notice = null;
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const extra = Math.max(0, height - 1920);
    const top = 120 + extra * 0.3;
    this.background.layout(width, height);
    this.captain.setPosition(cx, top + 170);
    this.title.setPosition(cx, top + 380);
    this.subtitle.setPosition(cx, top + 460);
    const formHeight = this.mode === 'register' ? 420 : 300;
    this.form.setPosition(cx, top + 540 + formHeight / 2);
    const below = top + 540 + formHeight;
    this.submitButton.setPosition(cx, below + 120);
    this.toggle.setPosition(cx, below + 250);
    this.message.setPosition(cx, below + 360);
  }

  private showError(key: I18nKey): void {
    this.message.setColor('#ffd0d0').setText(t(key));
    this.tweens.add({ targets: this.message, x: this.message.x + 12, duration: 50, yoyo: true, repeat: 3 });
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    const isRegister = this.mode === 'register';
    const email = normalizeEmail(this.field('email').value);
    const password = this.field('password').value;
    const name = normalizeName(this.field('displayName').value);
    if (isRegister && !isValidName(name)) return this.showError('auth.error.name');
    if (!isValidEmail(email)) return this.showError('auth.error.email');
    if (!isValidPassword(password)) return this.showError('auth.error.password');

    this.busy = true;
    this.submitButton.setEnabled(false);
    this.message.setColor(UI_COLORS.bannerText).setText(t('auth.connecting'));
    try {
      if (isRegister) await register(email, password, name);
      else await login(email, password);
      goToScene(this, SCENES.home);
    } catch (error) {
      this.busy = false;
      this.submitButton.setEnabled(true);
      this.showError(errorKey(error));
    }
  }
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
      case 'invalid_input':
        return 'auth.error.email';
    }
  }
  return 'auth.error.generic';
}
