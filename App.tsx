import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, StatusBar, View } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { useGuardStore } from './src/store/useGuardStore';
import { colors } from './src/theme/colors';

import SetupScreen from './src/screens/SetupScreen';
import UnlockScreen from './src/screens/UnlockScreen';
import MasterRecoveryScreen from './src/screens/MasterRecoveryScreen';
import ForceChangePasswordScreen from './src/screens/ForceChangePasswordScreen';
import VaultHomeScreen from './src/screens/VaultHomeScreen';
import HiddenGalleryScreen from './src/screens/HiddenGalleryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

export default function App() {
  const screen = useGuardStore((s) => s.screen);
  const init = useGuardStore((s) => s.init);
  const lockAndClearSession = useGuardStore((s) => s.lockAndClearSession);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // This is a security app — block screenshots/screen recording and hide
  // content from the recent-apps thumbnail preview (Android: sets
  // FLAG_SECURE under the hood; iOS: blurs the view when backgrounded).
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync();
    return () => {
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  // Backgrounding the app always requires re-auth — wipe the in-memory
  // VaultKey the moment the app leaves the foreground, not just on an
  // explicit "lock" tap.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current === 'active' && nextState.match(/inactive|background/)) {
        lockAndClearSession();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [lockAndClearSession]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.navyBase }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navyBase} />
      {screen === 'setup' && <SetupScreen />}
      {screen === 'locked' && <UnlockScreen />}
      {screen === 'masterRecovery' && <MasterRecoveryScreen />}
      {screen === 'forceChangePassword' && <ForceChangePasswordScreen />}
      {screen === 'vaultHome' && <VaultHomeScreen />}
      {screen === 'hiddenGallery' && <HiddenGalleryScreen />}
      {screen === 'settings' && <SettingsScreen />}
      {/* 'loading' renders nothing while init() resolves setup-state check */}
    </View>
  );
}
