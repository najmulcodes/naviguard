# NaviGuard (Expo)
*by NAVICORE — "Guard what matters."*

**v2** — adds the Hidden Gallery: browse locked photos without ever writing
plaintext back to disk.

Locks files on an OTG USB drive behind a password, with real recovery via
a master password you hold. No ads, non-commercial, built for you and a
few friends via your existing Expo project (`najmulcodes/naviguard`,
`42ac7d21-2b09-4bda-b32f-74d2ee300190`).

This is the Expo/React Native rewrite of the original native-Android
version. See "Why the design changed" below before assuming parity with
that version's exact guarantees.

---

## What's new in v2.1

- **Fixed: Android hardware/gesture back button was exiting the app** from
  sub-screens (Settings, Hidden Gallery) instead of navigating back. Never
  intercepted before — this app doesn't use React Navigation, so there was
  nothing catching the default OS back behavior. Now handled centrally in
  `App.tsx`.
- **Fixed: no client-side guard against submitting an empty password** on
  the Unlock screen. The button is now disabled until something's typed —
  defense in depth regardless of what triggered the original report.
- **New: per-file selection for Lock/Unlock**, not just whole-folder bulk
  actions. Tap a file row to select it; Lock/Unlock then act only on the
  selection. Leave nothing selected and they act on everything, same as
  before — existing bulk workflow isn't lost, just no longer the only
  option. (`vaultFolderManager.ts`'s `lockFolder`/`unlockFolder` are now
  thin wrappers around new `lockFiles`/`unlockFiles`, which take an
  explicit file list.)

---

## What's new in v2

- **Hidden Gallery** (`src/screens/HiddenGalleryScreen.tsx`) — a photo grid
  that decrypts locked images entirely IN MEMORY for viewing. The `.nvg`
  file on disk is never touched, never rewritten to plaintext, so photos
  stay invisible to Gallery/Photos the whole time you're browsing them in
  NaviGuard. Previously, viewing a locked photo meant fully unlocking it
  (writing plaintext back), which made it visible to every other app
  again — defeating the point for casual browsing.
- **Saved folder shortcuts** (`src/vault/folderShortcuts.ts`) — name and
  remember folders (e.g., "Hidden Photos") instead of re-picking the same
  folder via the system picker every session.
- **Known limitation:** gallery thumbnails decrypt the FULL-resolution
  image, not a downscaled preview. Fine for a personal collection in the
  tens/low hundreds of photos; will get slow and memory-heavy well beyond
  that — a real thumbnail cache is the natural next step if this becomes
  the most-used feature.
- **iOS: deliberately not started.** Android's Storage Access Framework
  (the mechanism this whole app is built on) has no iOS equivalent — Apple
  doesn't allow third-party apps to browse/write arbitrary external
  storage. An iOS version would need a genuinely different approach
  (iOS's Files app / document picker instead of USB drives) and is
  intentionally deferred until the Android version is validated with
  real users.

---

## Why the design changed from the native version

| Piece | Native (Kotlin) | Expo (this project) | Why |
|---|---|---|---|
| KDF | Argon2id | **scrypt** | No mature Expo-compatible Argon2id binding exists; scrypt is the standard alternative (same memory-hard property — it's what Bitcoin Core/most crypto wallets use to protect a key with a password) |
| File encryption | Streaming AEAD (Tink), handles files of any size | **Whole-file AES-256-GCM** — file must fit in memory | RN has no clean file-streaming API. Fine for documents/photos; not for multi-GB video. See `src/crypto/fileCipher.ts` |
| Secure storage | EncryptedSharedPreferences (Keystore) | `expo-secure-store` (same Keystore underneath) | Direct equivalent |
| Biometric-gated key | Hand-rolled Keystore Cipher + BiometricPrompt | `expo-secure-store` `requireAuthentication: true` | Expo SDK 51+ does this natively |
| Master password | `local.properties` → BuildConfig | **EAS Secret** → `app.config.ts extra` | The Expo-native equivalent — never in git, injected only at build time |
| Screenshot blocking | `FLAG_SECURE` | `expo-screen-capture` | Same effect, standard Expo module |

Everything else — the dual-slot envelope encryption, the forced
password-reset-after-recovery flow, the "email captured but recovery
stays manual" design — carries over exactly as before. Read
`src/crypto/guardKeyManager.ts` and `src/crypto/guardController.ts` if
you want the full reasoning; the comments explain each decision.

---

## One-time setup

```bash
cd naviguard-expo
npm install
```

You need an EAS account logged in locally (same `najmulcodes` account that
owns this project):

```bash
npm install -g eas-cli
eas login
```

### Set your master password (do this before your first build)

**For cloud builds (the normal path — recommended):**

```bash
eas secret:create --scope project --name NAVIGUARD_MASTER_PASSWORD --value "your-actual-master-password" --type string
```

This stores it on Expo's servers, tied to your project, and it gets
injected as an environment variable only during the build — never touches
your repo.

**For local builds** (`expo run:android`, testing on a dev client):

```bash
cp .env.example .env
# edit .env, set NAVIGUARD_MASTER_PASSWORD to the same value
```

`.env` is gitignored — never commit it.

---

## Building the APK via EAS (matches the project details you gave)

```bash
eas build --platform android --profile preview
```

This uses the `preview` profile in `eas.json` (already configured — builds
a plain installable `.apk`, not an app bundle, so you and your friends can
sideload it directly). EAS builds happen on Expo's servers — you'll get a
link to download the `.apk` once it finishes (usually 10–20 minutes).

For the eventual Play Store submission, use the `production` profile
instead (builds an `.aab` app bundle, which is what Play Store requires):

```bash
eas build --platform android --profile production
eas submit --platform android
```

### First build will also need a keystore

EAS handles Android signing for you automatically on first build if you
don't already have a keystore — it'll prompt:

```
? Generate a new Android Keystore? (Y/n)
```

Say yes. EAS stores it securely on their servers and reuses it for every
future build of this project automatically — you don't manage a `.jks`
file by hand the way you would with Android Studio.

---

## Installing on your friends' phones

Once you run `eas build`, you get a shareable link (and QR code) straight
from the EAS dashboard — send that link directly, no need to move the APK
file around manually. Once you publish to Play Store, this step goes away
entirely — everyone just installs from the listing.

---

## Testing locally before you burn a cloud build

```bash
npx expo prebuild --clean
npx expo run:android
```

This needs Android Studio's SDK installed locally (same requirement as
before) but skips Gradle/Kotlin entirely — Expo's CLI handles the native
build step for you. Requires a physical device or emulator connected.

Note: **this project cannot run in Expo Go** — it uses `expo-secure-store`
with hardware-backed biometric gating and `react-native-quick-crypto`
(native crypto module), both of which require a custom dev client
(`expo run:android` above) or a full EAS build, not the generic Expo Go
app from the Play Store.

---

## One thing to verify on first install

`react-native-quick-crypto`'s exact scrypt callback signature has shifted
slightly across versions historically. If TypeScript or the Metro bundler
flags an error in `src/crypto/guardKeyManager.ts` on the `crypto.scrypt(...)`
call, check https://github.com/margelo/react-native-quick-crypto for the
current signature — it's a contained, mechanical fix; the wrap/unwrap
design around it doesn't change.

---

## Play Store submission checklist

- Privacy policy required (email collected for recovery only, no ads, no
  third-party tracking) — host at something like `navicore.co/privacy/naviguard`.
- Data safety form: declare "email address — account management, not shared."
- Category: Tools or Productivity (avoid "Security" — invites more
  scrutiny during review for permission usage you don't actually need).

## Testing against a real USB drive

Plug a USB drive in via OTG, tap **Choose Folder**, Android's picker shows
it under "USB storage" natively (FAT32/exFAT — reformat if the drive
doesn't appear and it's NTFS).
