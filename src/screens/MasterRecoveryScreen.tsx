import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { shared } from '../theme/styles';
import { useGuardStore } from '../store/useGuardStore';

export default function MasterRecoveryScreen() {
  const [masterPassword, setMasterPassword] = useState('');
  const errorMessage = useGuardStore((s) => s.errorMessage);
  const unlockWithMasterPassword = useGuardStore((s) => s.unlockWithMasterPassword);
  const cancelRecovery = useGuardStore((s) => s.cancelRecovery);

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Recovery</Text>
      <Text style={shared.body}>
        Enter the master password you were given. You'll be asked to set a brand-new password
        immediately after.
      </Text>

      <TextInput
        style={shared.input}
        placeholder="Master password"
        placeholderTextColor="#4E6480"
        secureTextEntry
        value={masterPassword}
        onChangeText={setMasterPassword}
      />
      {errorMessage && <Text style={shared.errorText}>{errorMessage}</Text>}

      <TouchableOpacity
        style={shared.primaryButton}
        onPress={() => unlockWithMasterPassword(masterPassword)}
      >
        <Text style={shared.primaryButtonText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity style={shared.textButton} onPress={cancelRecovery}>
        <Text style={shared.textButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}
