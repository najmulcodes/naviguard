# NaviGuard (Expo)
*by NAVICORE — "Guard what matters."*

Locks files on an OTG USB drive behind a password, with real recovery via
a master password you hold. No ads, non-commercial, built for you and a
few friends via your existing Expo project (`najmulcodes/naviguard`,
`42ac7d21-2b09-4bda-b32f-74d2ee300190`).

This is the Expo/React Native rewrite of the original native-Android
version. See "Why the design changed" below before assuming parity with
that version's exact guarantees.

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
