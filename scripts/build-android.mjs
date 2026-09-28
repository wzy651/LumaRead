import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const versionName = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version
if (process.platform !== 'win32') throw new Error('This project-local build wrapper currently targets the configured Windows toolchain.')
const debug = process.argv.includes('--debug')
const env = { ...process.env }
const dirs = { gradle: join(root, '.local-cache/gradle'), android: join(root, '.local-cache/android-user'), tmp: join(root, '.local-cache/tmp'), cargo: join(root, '.local-cache/cargo'), signing: join(root, '.local-backups/android-signing'), output: join(root, '.qa-artifacts/android') }
for (const dir of Object.values(dirs)) await mkdir(dir, { recursive: true })
env.GRADLE_USER_HOME = dirs.gradle; env.ANDROID_USER_HOME = dirs.android
env.CARGO_HOME = dirs.cargo; env.CARGO_TARGET_DIR = join(root, 'src-tauri/target'); env.CARGO_BUILD_JOBS = '4'
env.TEMP = dirs.tmp; env.TMP = dirs.tmp; env.TMPDIR = dirs.tmp
env.npm_config_cache = join(root, '.local-cache/npm')
env.JAVA_HOME = process.env.LUMAREAD_JAVA_HOME ?? 'C:\\Program Files\\Java\\jdk-17.0.5'
env.ANDROID_HOME ??= 'D:\\DevTools\\Android\\Sdk'
env.NDK_HOME ??= join(env.ANDROID_HOME, 'ndk/29.0.14206865')
env.GRADLE_OPTS = `-Djava.io.tmpdir=${dirs.tmp} -Dorg.gradle.daemon=false -Dandroid.builder.sdkDownload=false`
for (const path of [join(env.JAVA_HOME, 'bin/java.exe'), join(env.ANDROID_HOME, 'platforms/android-36/android.jar'), join(env.NDK_HOME, 'source.properties')]) if (!existsSync(path)) throw new Error(`Required installed build tool missing: ${path}. This script does not install or modify system tools.`)
const version = spawnSync(join(env.JAVA_HOME, 'bin/java.exe'), ['-version'], { encoding: 'utf8', windowsHide: true }).stderr
if (!/version "(?:17|21)[.]/.test(version)) throw new Error('Set LUMAREAD_JAVA_HOME to an installed JDK 17 or 21. No global Java setting is changed.')
let password = ''
if (!debug) {
  const configFile = join(dirs.signing, 'signing.json'), keystore = join(dirs.signing, 'lumaread.p12')
  if (existsSync(keystore) !== existsSync(configFile)) throw new Error('Signing backup is incomplete; refusing to replace the existing signing identity.')
  if (!existsSync(configFile)) {
    password = randomBytes(32).toString('hex')
    env.LUMAREAD_ANDROID_STORE_PASSWORD = password
    const keytool = spawnSync(join(env.JAVA_HOME, 'bin/keytool.exe'), ['-genkeypair', '-keystore', keystore, '-storetype', 'PKCS12', '-storepass:env', 'LUMAREAD_ANDROID_STORE_PASSWORD', '-keypass:env', 'LUMAREAD_ANDROID_STORE_PASSWORD', '-alias', 'lumaread', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=LumaRead Local Distribution', '-noprompt'], { env, encoding: 'utf8', windowsHide: true })
    if (keytool.status !== 0) throw new Error('Could not create the project-local signing identity.')
    await writeFile(configFile, JSON.stringify({ password, alias: 'lumaread', warning: 'Private signing backup. Never share with APK recipients or commit to Git. Keep to sign future updates.' }, null, 2), { flag: 'wx' })
  } else password = JSON.parse(await readFile(configFile, 'utf8')).password
  env.LUMAREAD_ANDROID_KEYSTORE = keystore; env.LUMAREAD_ANDROID_STORE_PASSWORD = password
}
const log = []
const args = ['node_modules/@tauri-apps/cli/tauri.js', 'android', 'build', ...(debug ? ['--debug'] : []), '--target', 'aarch64', '--apk', 'true', '--aab', 'false', '--ci']
const status = await new Promise((done, reject) => {
  const child = spawn(process.execPath, args, { cwd: root, env, windowsHide: true })
  const print = (bytes) => { const text = password ? String(bytes).replaceAll(password, '[REDACTED]') : String(bytes); log.push(text); process.stdout.write(text) }
  child.stdout.on('data', print); child.stderr.on('data', print); child.on('error', reject); child.on('exit', done)
})
await writeFile(join(dirs.output, 'build.log'), log.join(''))
if (status !== 0) process.exit(status ?? 1)
const mode = debug ? 'debug' : 'release'
const source = join(root, `src-tauri/gen/android/app/build/outputs/apk/universal/${mode}/app-universal-${mode}.apk`)
if (!existsSync(source)) throw new Error('Build returned success but the expected signed APK is absent; inspect the build log.')
const apksigner = join(env.ANDROID_HOME, 'build-tools/35.0.0/lib/apksigner.jar')
const verification = spawnSync(join(env.JAVA_HOME, 'bin/java.exe'), ['-jar', apksigner, 'verify', '--verbose', '--print-certs', source], { env, encoding: 'utf8', windowsHide: true })
await writeFile(join(dirs.output, 'signature-verification.txt'), verification.stdout + verification.stderr)
if (verification.status !== 0) throw new Error('APK signature verification failed; no distribution copy created.')
const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim()
const dirty = Boolean(spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim())
const dest = resolve(root, 'dist-android', `LumaRead-${versionName}-${commit}${dirty ? '-dirty' : ''}-arm64${debug ? '-debug' : ''}.apk`)
await mkdir(join(root, 'dist-android'), { recursive: true }); await copyFile(source, dest)
const metadata = { apk: dest, commit, dirty, version: versionName, mode, architecture: 'arm64-v8a', bytes: (await stat(dest)).size, sha256: createHash('sha256').update(await readFile(dest)).digest('hex'), builtAt: new Date().toISOString(), nativeDeviceTested: false }
await writeFile(join(dirs.output, 'build-result.json'), JSON.stringify(metadata, null, 2))
console.log(JSON.stringify(metadata, null, 2))
