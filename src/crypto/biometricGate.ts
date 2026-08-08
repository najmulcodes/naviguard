import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_VK_KEY = 'naviguard_biometric_vault_key';

/**
 * Simpler than the native version's hand-rolled Keystore Cipher +
 * BiometricPrompt.CryptoObject dance: expo-secure-store's
 * `requireAuthentication: true` option ties the Keystore entry to
 * biometric auth natively (Android) — SecureStore.getItemAsync with that
 * option set triggers the system biometric prompt itself and only
 * returns the value after a successful check.
 */

export async function isAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function isEnrolled(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(BIOMETRIC_VK_KEY, {
    requireAuthentication: false // just checking presence, not unlocking yet
  }).catch(() => null);
  return stored !== null;
}

/** Call after a successful password unlock, to opt into biometric shortcut next time. */
export async function enroll(vaultKey: Buffer): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_VK_KEY, vaultKey.toString('base64'), {
    requireAuthentication: true,
    authenticationPrompt: 'Enable biometric unlock for NaviGuard'
  });
}

/** Triggers the system biometric prompt; resolves with the VaultKey on success. */
export async function unlockWithBiometric(): Promise<Buffer | null> {
  try {
    const base64 = await SecureStore.getItemAsync(BIOMETRIC_VK_KEY, {
      requireAuthentication: true,
      authenticationPrompt: 'Unlock NaviGuard'
    });
    return base64 ? Buffer.from(base64, 'base64') : null;
  } catch {
    return null; // user cancelled or auth failed
  }
}

export async function disable(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_VK_KEY);
}
