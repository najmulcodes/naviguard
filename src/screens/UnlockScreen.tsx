import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { shared } from '../theme/styles';
import { colors } from '../theme/colors';
import { useGuardStore } from '../store/useGuardStore';
import * as BiometricGate from '../crypto/biometricGate';

export default function UnlockScreen() {
  const [password, setPassword] = useState('');
  const [biometricReady, setBiometricReady] = useState(false);
  const errorMessage = useGuardStore((s) => s.errorMessage);
  const busy = useGuardStore((s) => s.busy);
  const unlock = useGuardStore((s) => s.unlock);
  const unlockWithVaultKey = useGuardStore((s) => s.unlockWithVaultKey);
  const goToMasterRecovery = useGuardStore((s) => s.goToMasterRecovery);

  useEffect(() => {
    (async () => {
      const available = await BiometricGate.isAvailable();
      const enrolled = await BiometricGate.isEnrolled();
      setBiometricReady(available && enrolled);
    })();
  }, []);

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>NaviGuard</Text>
      <Text style={shared.body}>Enter your password to continue</Text>

      <TextInput
        style={shared.input}
        placeholder="Password"
        placeholderTextColor="#4E6480"
        secureTextEntry
        editable={!busy}
        value={password}
        onChangeText={setPassword}
      />
      {errorMessage && <Text style={shared.errorText}>{errorMessage}</Text>}

      <TouchableOpacity
        style={[shared.primaryButton, (busy || password.length === 0) && { opacity: 0.6 }]}
        disabled={busy || password.length === 0}
        onPress={() => unlock(password)}
      >
        {busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ActivityIndicator color={colors.navyDeep} style={{ marginRight: 10 }} />
            <Text style={shared.primaryButtonText}>Unlocking…</Text>
          </View>
        ) : (
          <Text style={shared.primaryButtonText}>Unlock</Text>
        )}
      </TouchableOpacity>

      {biometricReady && !busy && (
        <TouchableOpacity
          style={shared.secondaryButton}
          onPress={async () => {
            const vk = await BiometricGate.unlockWithBiometric();
            if (vk) unlockWithVaultKey(vk);
          }}
        >
          <Text style={shared.secondaryButtonText}>Unlock with biometrics</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={shared.textButton} onPress={goToMasterRecovery} disabled={busy}>
        <Text style={shared.textButtonText}>Forgot password?</Text>
      </TouchableOpacity>
    </View>
  );
}
