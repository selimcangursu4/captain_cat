/**
 * Android derleme yardımcıları (Windows / macOS / Linux):
 *   npm run android:dev       Geliştirme: bilgisayardaki sunucuya (http://localhost:8787) USB tüneliyle bağlanan
 *                             debug paketi derler, kablolu telefona yükler ve açar.
 *   npm run android:release   Mağaza: ayarları denetler, web'i derler ve imzalı .aab üretir (Google Play'e yüklenir).
 *   npm run android:keystore  Yükleme anahtarı (upload key) üretir: android/upload-keystore.jks + keystore.properties.
 * Capacitor 8 Java 21 ister: JAVA_HOME 21 değilse bilinen kurulum yerleri denenir.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const windows = process.platform === 'win32';
const command = process.argv[2];

function run(cmd, args, options = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { stdio: 'inherit', shell: windows, ...options });
}

/** JDK'nın ana sürümü (java -version çıktıyı stderr'e yazar); bulunamazsa 0. */
function javaVersion(home) {
  if (!home) return 0;
  const bin = join(home, 'bin', windows ? 'java.exe' : 'java');
  if (!existsSync(bin)) return 0;
  const result = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  const match = /version "(\d+)/.exec(`${result.stderr}${result.stdout}`);
  return match ? Number(match[1]) : 0;
}

/** Java 21+ kurulumu (Capacitor 8 için). */
function java21() {
  const candidates = [
    process.env.JAVA21_HOME,
    process.env.JAVA_HOME,
    'C:\\Android\\jdk21',
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
  ];
  for (const home of candidates) {
    if (javaVersion(home) >= 21) return home;
  }
  throw new Error('Java 21 bulunamadı. JDK 21 kurup JAVA21_HOME ya da JAVA_HOME ile gösterin.');
}

function gradle(task, env = {}) {
  const javaHome = java21();
  // Tam yol: Windows komut satırı bulunduğu klasörde aramayabilir (NoDefaultCurrentDirectoryInExePath).
  const wrapper = join(root, 'android', windows ? 'gradlew.bat' : 'gradlew');
  run(windows ? `"${wrapper}"` : wrapper, [task, '--console=plain'], {
    cwd: join(root, 'android'),
    env: { ...process.env, JAVA_HOME: javaHome, ...env },
  });
}

function dev() {
  const env = { ...process.env, VITE_API_URL: process.env.VITE_API_URL ?? 'http://localhost:8787', CAP_ALLOW_HTTP: '1' };
  run('npx', ['vite', 'build'], { env });
  run('npx', ['cap', 'sync', 'android'], { env });
  gradle('assembleDebug');
  run('adb', ['reverse', 'tcp:8787', 'tcp:8787']);
  run('adb', ['install', '-r', join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')]);
  run('adb', ['shell', 'monkey', '-p', 'com.kaptanpati.game', '-c', 'android.intent.category.LAUNCHER', '1']);
}

function release() {
  if (!existsSync(join(root, 'android', 'keystore.properties'))) {
    console.error('✖ android/keystore.properties yok. Önce: npm run android:keystore');
    process.exit(1);
  }
  run('node', ['tools/check-mobile-env.mjs']);
  run('npm', ['run', 'build']);
  // Yayın eşitlemesi: CAP_ALLOW_HTTP verilmez → yalnızca HTTPS.
  const env = { ...process.env };
  delete env.CAP_ALLOW_HTTP;
  run('npx', ['cap', 'sync', 'android'], { env });
  gradle('bundleRelease', env);
  console.log('\n✓ Google Play paketi: android/app/build/outputs/bundle/release/app-release.aab');
}

function keystore() {
  const dir = join(root, 'android');
  const file = join(dir, 'upload-keystore.jks');
  if (existsSync(file)) {
    console.error('✖ android/upload-keystore.jks zaten var; üzerine yazılmadı.');
    process.exit(1);
  }
  const password = randomBytes(18).toString('base64url');
  const keytool = join(java21(), 'bin', windows ? 'keytool.exe' : 'keytool');
  console.log('> keytool -genkeypair (upload anahtarı, RSA 4096)');
  // Kabuksuz çalıştırılır: "-dname" boşluk içerir ve şifre ekrana yazılmaz.
  execFileSync(
    keytool,
    [
      '-genkeypair', '-keystore', file, '-alias', 'upload', '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
      '-storepass', password, '-keypass', password, '-dname', 'CN=Kaptan Pati, O=Kaptan Pati, C=TR',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  writeFileSync(
    join(dir, 'keystore.properties'),
    `# Google Play yükleme anahtarı. GİZLİ: git'e girmez; bu dosyayı ve upload-keystore.jks'yi güvenli bir yere yedekleyin.\nstoreFile=upload-keystore.jks\nstorePassword=${password}\nkeyAlias=upload\nkeyPassword=${password}\n`,
  );
  console.log('\n✓ Yükleme anahtarı üretildi: android/upload-keystore.jks + android/keystore.properties');
  console.log('  İkisini de güvenli bir yere (ör. parola yöneticisi) YEDEKLEYİN. Kaybolursa Play Console\'dan anahtar sıfırlama gerekir.');
}

try {
  if (command === 'dev') dev();
  else if (command === 'release') release();
  else if (command === 'keystore') keystore();
  else {
    console.error('Kullanım: node tools/android.mjs dev | release | keystore');
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
