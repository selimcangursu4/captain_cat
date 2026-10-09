/**
 * Mağazaların istediği herkese açık sayfalar: gizlilik politikası, kullanım koşulları, destek ve
 * hesap silme (Google Play "hesap silme bağlantısı"). Sunucu bunları /privacy, /terms, /support,
 * /delete-account adreslerinde ?lang=tr|en ile sunar; oyun içindeki bağlantılar da buraya gider.
 */
export type LegalPageId = 'privacy' | 'terms' | 'support' | 'delete-account';
type Lang = 'tr' | 'en';

export interface LegalInfo {
  /** Destek / gizlilik iletişim e-postası (yayında zorunlu: SUPPORT_EMAIL). */
  readonly contactEmail: string | null;
  /** Uygulamayı yayınlayan kişi ya da şirket (OPERATOR_NAME). */
  readonly operator: string | null;
}

const UPDATED = '2026-10-09';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function contact(info: LegalInfo, lang: Lang): string {
  const email = info.contactEmail
    ? `<a href="mailto:${escape(info.contactEmail)}">${escape(info.contactEmail)}</a>`
    : lang === 'tr'
      ? '(iletişim e-postası henüz ayarlanmadı)'
      : '(contact email not configured yet)';
  return email;
}

const operatorName = (info: LegalInfo, lang: Lang) => escape(info.operator ?? (lang === 'tr' ? 'Kaptan Pati geliştiricisi' : 'the Kaptan Pati developer'));

const PRIVACY: Record<Lang, (info: LegalInfo) => string> = {
  tr: (info) => `
<h1>Gizlilik Politikası</h1>
<p class="muted">Son güncelleme: ${UPDATED}</p>
<p>Bu politika, ${operatorName(info, 'tr')} tarafından yayınlanan <b>Kaptan Pati</b> oyununun hangi verileri
neden topladığını ve nasıl koruduğunu açıklar.</p>

<h2>Topladığımız veriler</h2>
<ul>
  <li><b>Hesap bilgileri:</b> misafir hesapta yalnızca rastgele bir kaptan adı. Hesabını kaydedersen
    e-posta adresin, seçtiğin kaptan adı ve şifren (yalnızca tek yönlü, tuzlanmış özeti saklanır; şifrenin kendisi saklanmaz).</li>
  <li><b>Oyun ilerlemesi:</b> seviye, yıldız, altın, malzemeler, kasaba, eşyalar, canlar ve oyun içi işlemlerin
    kaydı (hile önleme ve iki cihaz arasında eşitleme için).</li>
  <li><b>Satın almalar:</b> gerçek parayla yaptığın satın almaların ürün kimliği ve mağaza işlem kimliği.
    Ödeme ve kart bilgilerin bize hiç gelmez; ödemeyi Google Play ya da App Store alır.</li>
  <li><b>Teknik bilgiler:</b> oturumun açıldığı cihazın tarayıcı/uygulama tanımı (user-agent) ve kötüye kullanımı
    önlemek için kısa süreli bellekte tutulan IP adresi.</li>
</ul>
<p>Reklam göstermiyoruz, reklam kimliği toplamıyoruz, seni uygulamalar ve siteler arasında izlemiyoruz,
konum, kişiler, kamera, mikrofon ya da fotoğraflarına erişmiyoruz. Verilerini satmıyoruz.</p>

<h2>Verileri ne için kullanıyoruz</h2>
<ul>
  <li>Oyunu çalıştırmak, ilerlemeni buluta kaydetmek ve cihazlar arasında eşitlemek,</li>
  <li>Satın almaları doğrulayıp hesabına eklemek,</li>
  <li>Hileyi ve kötüye kullanımı önlemek, destek taleplerini yanıtlamak.</li>
</ul>

<h2>Paylaştığımız taraflar</h2>
<ul>
  <li><b>RevenueCat</b> (satın alma doğrulama): hesap kimliğin ve satın alma işlemlerin.</li>
  <li><b>Google Play / Apple App Store:</b> ödemeyi onlar alır; kendi gizlilik politikaları geçerlidir.</li>
  <li><b>Sunucu barındırma sağlayıcısı:</b> verilerin onların altyapısında şifreli bağlantıyla saklanır.</li>
</ul>

<h2>Saklama ve silme</h2>
<p>Verilerini hesabın açık kaldığı sürece saklarız. Hesabını istediğin zaman silebilirsin:</p>
<ul>
  <li>Oyun içinde: <b>Ayarlar → Hesap → Hesabımı Sil</b>,</li>
  <li>Web'den: <a href="/delete-account?lang=tr">hesap silme sayfası</a>.</li>
</ul>
<p>Silme işlemi hesabını, ilerlemeni, işlem günlüğünü ve satın alma kayıtlarını sunucumuzdan hemen ve kalıcı
olarak kaldırır. Mağazaların kendi tuttuğu ödeme kayıtları için Google/Apple'ın politikaları geçerlidir.</p>

<h2>Çocuklar</h2>
<p>Oyun 13 yaş altındaki çocuklara yönelik değildir ve bilerek 13 yaş altı çocuklardan kişisel veri toplamayız.</p>

<h2>Güvenlik</h2>
<p>Bağlantılar HTTPS ile şifrelenir; şifreler scrypt ile tuzlanıp özetlenir; oturum anahtarlarının yalnızca özeti saklanır.</p>

<h2>Hakların ve iletişim</h2>
<p>Verilerine erişme, düzeltme ve silme hakkın vardır (KVKK, GDPR). Sorular için: ${contact(info, 'tr')}</p>`,
  en: (info) => `
<h1>Privacy Policy</h1>
<p class="muted">Last updated: ${UPDATED}</p>
<p>This policy explains what data <b>Kaptan Pati</b>, published by ${operatorName(info, 'en')}, collects, why, and how it is protected.</p>

<h2>Data we collect</h2>
<ul>
  <li><b>Account data:</b> for guest accounts only a random captain name. If you register your account: your email
    address, chosen captain name and password (only a salted one-way hash is stored, never the password itself).</li>
  <li><b>Game progress:</b> level, stars, coins, materials, town, items, lives and a log of in-game actions
    (for cheat prevention and syncing between devices).</li>
  <li><b>Purchases:</b> product ID and store transaction ID of real-money purchases. We never receive your payment
    or card details; payments are handled by Google Play or the App Store.</li>
  <li><b>Technical data:</b> the user-agent of the device a session was opened on, and your IP address kept briefly
    in memory to prevent abuse.</li>
</ul>
<p>We show no ads, collect no advertising ID, do not track you across apps or websites, and do not access your
location, contacts, camera, microphone or photos. We do not sell your data.</p>

<h2>How we use it</h2>
<ul>
  <li>To run the game, save your progress to the cloud and sync it across devices,</li>
  <li>To verify purchases and credit them to your account,</li>
  <li>To prevent cheating and abuse and to answer support requests.</li>
</ul>

<h2>Who we share it with</h2>
<ul>
  <li><b>RevenueCat</b> (purchase verification): your account ID and purchase transactions.</li>
  <li><b>Google Play / Apple App Store:</b> they process payments under their own privacy policies.</li>
  <li><b>Our hosting provider:</b> data is stored on their infrastructure over encrypted connections.</li>
</ul>

<h2>Retention and deletion</h2>
<p>We keep your data while your account exists. You can delete your account at any time:</p>
<ul>
  <li>In the game: <b>Settings → Account → Delete Account</b>,</li>
  <li>On the web: <a href="/delete-account?lang=en">account deletion page</a>.</li>
</ul>
<p>Deletion immediately and permanently removes your account, progress, action log and purchase records from our
servers. Payment records kept by the stores are governed by Google's/Apple's policies.</p>

<h2>Children</h2>
<p>The game is not directed at children under 13 and we do not knowingly collect personal data from them.</p>

<h2>Security</h2>
<p>Connections are encrypted with HTTPS; passwords are salted and hashed with scrypt; only hashes of session tokens are stored.</p>

<h2>Your rights and contact</h2>
<p>You have the right to access, correct and delete your data (GDPR). Questions: ${contact(info, 'en')}</p>`,
};

const TERMS: Record<Lang, (info: LegalInfo) => string> = {
  tr: (info) => `
<h1>Kullanım Koşulları</h1>
<p class="muted">Son güncelleme: ${UPDATED}</p>
<p><b>Kaptan Pati</b>'yi kullanarak bu koşulları kabul etmiş olursun. Oyun ${operatorName(info, 'tr')} tarafından sunulur.</p>
<h2>Hesap</h2>
<p>Misafir olarak oynayabilir ya da hesabını e-postayla kaydedebilirsin. Hesabının güvenliğinden sen sorumlusun.
Hile, otomasyon ya da açıkları kötüye kullanma hesabın kapatılmasına yol açabilir.</p>
<h2>Sanal para ve eşyalar</h2>
<p>Altın, yıldız, malzeme ve eşyalar yalnızca oyun içinde kullanılan, gerçek para değeri olmayan sanal öğelerdir;
devredilemez ve paraya çevrilemez. Gerçek parayla yapılan satın almalar Google Play / App Store koşullarına tabidir
ve yürürlükteki tüketici mevzuatı saklı kalmak kaydıyla iade edilmez. Sandıkların içeriği rastgeledir; her ödül
türünün olasılığı satın almadan önce oyunda gösterilir.</p>
<h2>Hizmet</h2>
<p>Oyunu geliştirmek için içerik ve dengeyi değiştirebiliriz. Hizmeti kesintisiz sunmak için çalışırız ancak
kesintisizliği garanti etmeyiz.</p>
<h2>İletişim</h2>
<p>${contact(info, 'tr')}</p>`,
  en: (info) => `
<h1>Terms of Use</h1>
<p class="muted">Last updated: ${UPDATED}</p>
<p>By using <b>Kaptan Pati</b> you agree to these terms. The game is provided by ${operatorName(info, 'en')}.</p>
<h2>Account</h2>
<p>You may play as a guest or register your account with an email. You are responsible for keeping your account
secure. Cheating, automation or exploiting bugs may lead to account termination.</p>
<h2>Virtual currency and items</h2>
<p>Coins, stars, materials and items are virtual items for in-game use only with no real-world monetary value;
they cannot be transferred or exchanged for money. Real-money purchases are subject to Google Play / App Store
terms and are non-refundable except where required by applicable consumer law. Chest contents are random; the odds
of each reward type are shown in the game before purchase.</p>
<h2>Service</h2>
<p>We may change content and balance to improve the game. We work to keep the service available but cannot
guarantee uninterrupted availability.</p>
<h2>Contact</h2>
<p>${contact(info, 'en')}</p>`,
};

const SUPPORT: Record<Lang, (info: LegalInfo) => string> = {
  tr: (info) => `
<h1>Destek</h1>
<p>Kaptan Pati ile ilgili her soru, hata bildirimi ya da satın alma sorunu için bize yaz: ${contact(info, 'tr')}</p>
<p>Satın alma sorunlarında mağaza makbuzundaki sipariş numarasını ve oyundaki kaptan adını eklersen daha hızlı yardımcı oluruz.</p>
<ul>
  <li><a href="/privacy?lang=tr">Gizlilik Politikası</a></li>
  <li><a href="/terms?lang=tr">Kullanım Koşulları</a></li>
  <li><a href="/delete-account?lang=tr">Hesabımı Sil</a></li>
</ul>`,
  en: (info) => `
<h1>Support</h1>
<p>For any question, bug report or purchase issue about Kaptan Pati, write to us: ${contact(info, 'en')}</p>
<p>For purchase issues, include the order number from your store receipt and your captain name for faster help.</p>
<ul>
  <li><a href="/privacy?lang=en">Privacy Policy</a></li>
  <li><a href="/terms?lang=en">Terms of Use</a></li>
  <li><a href="/delete-account?lang=en">Delete my account</a></li>
</ul>`,
};

const DELETE: Record<Lang, (info: LegalInfo) => string> = {
  tr: (info) => `
<h1>Hesabımı Sil</h1>
<p><b>Kaptan Pati</b> hesabını ve ona bağlı bütün verileri (ilerleme, altın, eşyalar, işlem günlüğü, satın alma kayıtları)
kalıcı olarak silebilirsin. Bu işlem geri alınamaz.</p>
<h2>Oyun içinden</h2>
<p>Ayarlar → Hesap → <b>Hesabımı Sil</b> (misafir hesaplar da buradan silinir).</p>
<h2>Bu sayfadan</h2>
<p>Kayıtlı hesabının e-posta ve şifresini gir:</p>
${deleteForm('tr')}
<p class="muted">Şifreni hatırlamıyorsan ya da misafir hesabına ulaşamıyorsan ${contact(info, 'tr')} adresine kaptan adınla yaz; hesabını 30 gün içinde sileriz.</p>`,
  en: (info) => `
<h1>Delete My Account</h1>
<p>You can permanently delete your <b>Kaptan Pati</b> account and all associated data (progress, coins, items,
action log, purchase records). This cannot be undone.</p>
<h2>In the game</h2>
<p>Settings → Account → <b>Delete Account</b> (guest accounts are deleted there too).</p>
<h2>On this page</h2>
<p>Enter the email and password of your registered account:</p>
${deleteForm('en')}
<p class="muted">If you forgot your password or cannot reach a guest account, write to ${contact(info, 'en')} with your captain name and we will delete it within 30 days.</p>`,
};

function deleteForm(lang: Lang): string {
  const tx =
    lang === 'tr'
      ? { email: 'E-posta', password: 'Şifre', button: 'Hesabımı kalıcı olarak sil', confirm: 'Hesabın ve bütün verilerin kalıcı olarak silinecek. Emin misin?', ok: 'Hesabın silindi.', bad: 'E-posta ya da şifre yanlış.', many: 'Çok fazla deneme. Biraz sonra tekrar dene.', err: 'Bir şeyler ters gitti. Tekrar dene.' }
      : { email: 'Email', password: 'Password', button: 'Permanently delete my account', confirm: 'Your account and all data will be permanently deleted. Are you sure?', ok: 'Your account has been deleted.', bad: 'Wrong email or password.', many: 'Too many attempts. Try again later.', err: 'Something went wrong. Please try again.' };
  return `
<form id="del">
  <input name="email" type="email" autocomplete="email" placeholder="${tx.email}" required>
  <input name="password" type="password" autocomplete="current-password" placeholder="${tx.password}" required minlength="8">
  <button type="submit">${tx.button}</button>
  <p id="msg" role="status"></p>
</form>
<script>
document.getElementById('del').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msg');
  if (!confirm(${JSON.stringify(tx.confirm)})) return;
  const f = new FormData(e.target);
  try {
    const res = await fetch('/account/delete-with-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
    });
    msg.textContent = res.status === 204 ? ${JSON.stringify(tx.ok)} : res.status === 401 ? ${JSON.stringify(tx.bad)} : res.status === 429 ? ${JSON.stringify(tx.many)} : ${JSON.stringify(tx.err)};
    if (res.status === 204) e.target.reset();
  } catch { msg.textContent = ${JSON.stringify(tx.err)}; }
});
</script>`;
}

const TITLES: Record<LegalPageId, Record<Lang, string>> = {
  privacy: { tr: 'Gizlilik Politikası', en: 'Privacy Policy' },
  terms: { tr: 'Kullanım Koşulları', en: 'Terms of Use' },
  support: { tr: 'Destek', en: 'Support' },
  'delete-account': { tr: 'Hesabımı Sil', en: 'Delete My Account' },
};

const BODIES: Record<LegalPageId, Record<Lang, (info: LegalInfo) => string>> = {
  privacy: PRIVACY,
  terms: TERMS,
  support: SUPPORT,
  'delete-account': DELETE,
};

export function legalPage(page: LegalPageId, lang: Lang, info: LegalInfo): string {
  const other = lang === 'tr' ? 'en' : 'tr';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kaptan Pati · ${TITLES[page][lang]}</title>
<style>
  :root { color-scheme: light dark; --bg: #f5fbff; --fg: #12324a; --muted: #5b7488; --accent: #0b6fa8; --card: #ffffff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b1f2d; --fg: #e3f1fa; --muted: #93aec2; --accent: #6cc3ff; --card: #12324a; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 28px; margin: 8px 0 4px; } h2 { font-size: 20px; margin-top: 28px; }
  a { color: var(--accent); } .muted { color: var(--muted); font-size: 14px; }
  nav { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 14px; }
  form { display: grid; gap: 10px; max-width: 420px; background: var(--card); padding: 16px; border-radius: 12px; }
  input, button { font: inherit; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--muted); }
  button { background: #c0392b; color: #fff; border: 0; cursor: pointer; font-weight: 600; }
</style>
</head>
<body><main>
<nav><b>Kaptan Pati</b><a href="?lang=${other}">${other === 'en' ? 'English' : 'Türkçe'}</a></nav>
${BODIES[page][lang](info)}
</main></body>
</html>`;
}
