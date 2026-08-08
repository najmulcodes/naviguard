import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { shared } from '../theme/styles';
import { useGuardStore } from '../store/useGuardStore';

/**
 * Reachable ONLY via a successful master-password unlock. No back button,
 * no skip — per the product requirement, using the master password
 * always forces a fresh password before anything else is reachable.
 */
export default function ForceChangePasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const errorMessage = useGuardStore((s) => s.errorMessage);
  const completeForcedPasswordChange = useGuardStore((s) => s.completeForcedPasswordChange);

  return (
    <View style={shared.screen}>
      <Text style={shared.title}>Set a new password</Text>
      <Text style={shared.body}>
        You unlocked with the master password. Set a password only you know before continuing.
      </Text>

      <TextInput
        style={shared.input}
        placeholder="New password"
        placeholderTextColor="#4E6480"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <TextInput
        style={shared.input}
        placeholder="Confirm new password"
        placeholderTextColor="#4E6480"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />
      {errorMessage && <Text style={shared.errorText}>{errorMessage}</Text>}

      <TouchableOpacity
        style={shared.primaryButton}
        onPress={() => completeForcedPasswordChange(newPassword, confirm)}
      >
        <Text style={shared.primaryButtonText}>Save Password</Text>
      </TouchableOpacity>
    </View>
  );
}
