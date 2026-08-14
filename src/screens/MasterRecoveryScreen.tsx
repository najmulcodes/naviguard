import React, { useEffect, useState } from 'react';
import { Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { shared } from '../theme/styles';
import { useGuardStore } from '../store/useGuardStore';
import * as GuardController from '../crypto/guardController';

type Step = 'ask' | 'haveIt' | 'needIt';

export default function MasterRecoveryScreen() {
  const [step, setStep] = useState<Step>('ask');
  const [masterPassword, setMasterPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null);
  const errorMessage = useGuardStore((s) => s.errorMessage);
  const unlockWithMasterPassword = useGuardStore((s) => s.unlockWithMasterPassword);
  const cancelRecovery = useGuardStore((s) => s.cancelRecovery);

  useEffect(() => {
    GuardController.recoveryEmail().then(setRecoveryEmail);
  }, []);

  function sendRecoveryEmail() {
    const body = `My account email: ${recoveryEmail ?? '(not set)'}\n\nI've forgotten my NaviGuard password and need the master password to recover access.`;
    Linking.openURL(
      `mailto:support@navicore.co?subject=${encodeURIComponent('NaviGuard recovery request')}&body=${encodeURIComponent(body)}`
    );
  }

  // --- Step 1: ask whether they already have the master password ---
  if (step === 'ask') {
    return (
      <View style={shared.screen}>
        <Text style={shared.title}>Recovery</Text>
        <Text style={shared.body}>Do you already have the master password?</Text>

        <TouchableOpacity style={shared.primaryButton} onPress={() => setStep('haveIt')}>
          <Text style={shared.primaryButtonText}>Yes, I have it</Text>
        </TouchableOpacity>

        <TouchableOpacity style={shared.secondaryButton} onPress={() => setStep('needIt')}>
          <Text style={shared.secondaryButtonText}>No, I need to request it</Text>
        </TouchableOpacity>

        <TouchableOpacity style={shared.textButton} onPress={cancelRecovery}>
          <Text style={shared.textButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Step 2a: they need to request it — send an email, come back once they have it ---
  if (step === 'needIt') {
    return (
      <View style={shared.screen}>
        <Text style={shared.title}>Request Recovery</Text>
        <Text style={shared.body}>
          This will open your email app with a message ready to send. Once you receive the
          master password back, come back here and enter it.
        </Text>

        <TouchableOpacity style={shared.primaryButton} onPress={sendRecoveryEmail}>
          <Text style={shared.primaryButtonText}>Email for Recovery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={shared.secondaryButton} onPress={() => setStep('haveIt')}>
          <Text style={shared.secondaryButtonText}>I have it now</Text>
        </TouchableOpacity>

        <TouchableOpacity style={shared.textButton} onPress={() => setStep('ask')}>
          <Text style={shared.textButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Step 2b: they have the master password — enter it ---
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
        style={[shared.primaryButton, masterPassword.length === 0 && { opacity: 0.6 }]}
        disabled={masterPassword.length === 0}
        onPress={() => unlockWithMasterPassword(masterPassword)}
      >
        <Text style={shared.primaryButtonText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity style={shared.textButton} onPress={() => setStep('ask')}>
        <Text style={shared.textButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}
