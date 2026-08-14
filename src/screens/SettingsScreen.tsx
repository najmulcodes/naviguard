import React, { useEffect, useState } from 'react';
import { Linking, Switch, Text, TouchableOpacity, View } from 'react-native';
import { shared } from '../theme/styles';
import { colors } from '../theme/colors';
import { useGuardStore } from '../store/useGuardStore';
import * as BiometricGate from '../crypto/biometricGate';
import * as GuardController from '../crypto/guardController';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1E2E42' }}>
      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const backToVaultHome = useGuardStore((s) => s.backToVaultHome);
  const vaultKey = useGuardStore((s) => s.vaultKey);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setBiometricAvailable(await BiometricGate.isAvailable());
      setBiometricEnabled(await BiometricGate.isEnrolled());
      setEmail(await GuardController.recoveryEmail());
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.navyBase, paddingTop: 56 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          marginBottom: 20
        }}
      >
        <TouchableOpacity onPress={backToVaultHome} style={{ marginRight: 16 }}>
          <Text style={{ color: colors.goldPrimary, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700' }}>
          Settings
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: '#1E2E42'
          }}
        >
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>
              Biometric unlock
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {biometricEnabled ? 'Enabled' : 'Off'}
            </Text>
          </View>
          <Switch
            value={biometricEnabled}
            disabled={!biometricAvailable}
            onValueChange={async (checked) => {
              if (checked) {
                if (!vaultKey) return;
                await BiometricGate.enroll(vaultKey);
                setBiometricEnabled(true);
              } else {
                await BiometricGate.disable();
                setBiometricEnabled(false);
              }
            }}
          />
        </View>

        <Row label="Recovery email" value={email ?? 'Not set'} />
        <Row label="Ads" value="None — this app is free and non-commercial" />
        <Row label="NaviGuard" value="An app by NAVICORE — navicore.co" />

        <TouchableOpacity
          style={shared.secondaryButton}
          onPress={() => {
            const body = `My account email: ${email ?? ''}\n(Sent from NaviGuard settings.)`;
            Linking.openURL(
              `mailto:support@navicore.co?subject=${encodeURIComponent('NaviGuard recovery request')}&body=${encodeURIComponent(body)}`
            );
          }}
        >
          <Text style={shared.secondaryButtonText}>Request password recovery</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
