import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { shared } from '../theme/styles';
import { useGuardStore } from '../store/useGuardStore';

export default function SetupScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const errorMessage = useGuardStore((s) => s.errorMessage);
  const completeSetup = useGuardStore((s) => s.completeSetup);

  return (
    <ScrollView contentContainerStyle={shared.scrollScreen}>
      <View style={{ height: 48 }} />
      <Text style={shared.title}>NaviGuard</Text>
      <Text style={shared.subtitle}>by NAVICORE</Text>
      <Text style={shared.body}>Guard what matters.</Text>

      <View style={{ height: 40 }} />
      <Text style={shared.sectionTitle}>Set up your vault password</Text>

      <TextInput
        style={shared.input}
        placeholder="Password"
        placeholderTextColor="#4E6480"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={shared.input}
        placeholder="Confirm password"
        placeholderTextColor="#4E6480"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />
      <TextInput
        style={shared.input}
        placeholder="Recovery email"
        placeholderTextColor="#4E6480"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={shared.body}>
        Used only so we know it's you if you ever need the master password. Never used for
        automatic reset.
      </Text>

      {errorMessage && <Text style={shared.errorText}>{errorMessage}</Text>}

      <TouchableOpacity
        style={shared.primaryButton}
        onPress={() => completeSetup(password, confirm, email)}
      >
        <Text style={shared.primaryButtonText}>Create Vault</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
