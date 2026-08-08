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
  newArchEnabled: true,
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
  plugins: [
    'expo-secure-store',
    'expo-local-authentication',
    'expo-screen-capture',
    [
      'react-native-quick-crypto',
      {
        // Enables the native crypto module — requires the New Architecture,
        // set above via newArchEnabled.
      }
    ]
  ],
  extra: {
    masterPassword,
    eas: {
      projectId: '42ac7d21-2b09-4bda-b32f-74d2ee300190'
    }
  }
});
