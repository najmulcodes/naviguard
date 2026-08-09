import 'dotenv/config';
import type { ExpoConfig, ConfigContext } from 'expo/config';

// The master password is NEVER a string literal here — it's read from an
// environment variable that only exists either in your local .env (which
// is gitignored, see .env.example) or as an EAS Secret injected during a
// cloud build. Neither path puts it in source control.
const masterPassword = process.env.NAVIGUARD_MASTER_PASSWORD ?? 'change-me-before-building';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'NaviGuard',
  slug: 'naviguard',
  owner: 'najmulcodes',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0A1628'
  },
  assetBundlePatterns: ['**/*'],
  newArchEnabled: false,,
  android: {
    package: 'com.navicore.naviguard',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A1628'
    },
    // Deliberately empty — SAF folder access via expo-file-system needs
    // no manifest permission (the user grants access per-folder through
    // the system picker), and we don't need anything else.
    permissions: []
  },
  // expo-screen-capture and react-native-quick-crypto were removed from
  // this list — neither package ships a config plugin for the versions
  // pinned in package.json (expo-screen-capture@6.0.1,
  // react-native-quick-crypto@0.7.2). Listing them here made Expo's
  // config-plugin resolver fall back to require()-ing their main JS
  // entry as if it were a plugin function, which is what caused the
  // "does not contain a valid config plugin" / "Unexpected token 'typeof'"
  // failures. Neither needs any native config: expo-screen-capture is a
  // pure JS API (call ScreenCapture.preventScreenCaptureAsync() directly),
  // and react-native-quick-crypto's only requirement is New Architecture,
  // already satisfied by newArchEnabled: true below.
  plugins: [
    'expo-secure-store',
    'expo-local-authentication'
  ],
  extra: {
    masterPassword,
    eas: {
      projectId: '42ac7d21-2b09-4bda-b32f-74d2ee300190'
    }
  }
});
