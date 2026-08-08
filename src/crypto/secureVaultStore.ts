import * as SecureStore from 'expo-secure-store';
import { deserializeSlot, serializeSlot, WrappedKeySlot } from './wrappedKeySlot';
import { generateInstallSalt } from './passwordMaterial';

const KEY_INSTALL_SALT = 'naviguard_install_salt';
const KEY_USER_SLOT = 'naviguard_user_slot';
const KEY_MASTER_SLOT = 'naviguard_master_slot';
const KEY_SETUP_COMPLETE = 'naviguard_setup_complete';
const KEY_RECOVERY_EMAIL = 'naviguard_recovery_email';
const KEY_FORCE_PW_CHANGE = 'naviguard_force_pw_change';

// expo-secure-store values are individually Keystore-encrypted on Android
// (backed by the same hardware-backed mechanism as the native version's
// EncryptedSharedPreferences) — no plaintext ever hits disk.

export async function getOrCreateInstallSalt(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_INSTALL_SALT);
  if (existing) return existing;
  const fresh = generateInstallSalt();
  await SecureStore.setItemAsync(KEY_INSTALL_SALT, fresh);
  return fresh;
}

export async function saveUserSlot(slot: WrappedKeySlot): Promise<void> {
  await SecureStore.setItemAsync(KEY_USER_SLOT, serializeSlot(slot));
}

export async function loadUserSlot(): Promise<WrappedKeySlot | null> {
  const raw = await SecureStore.getItemAsync(KEY_USER_SLOT);
  return raw ? deserializeSlot(raw) : null;
}

export async function saveMasterSlot(slot: WrappedKeySlot): Promise<void> {
  await SecureStore.setItemAsync(KEY_MASTER_SLOT, serializeSlot(slot));
}

export async function loadMasterSlot(): Promise<WrappedKeySlot | null> {
  const raw = await SecureStore.getItemAsync(KEY_MASTER_SLOT);
  return raw ? deserializeSlot(raw) : null;
}

export async function isSetupComplete(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY_SETUP_COMPLETE)) === 'true';
}

export async function markSetupComplete(): Promise<void> {
  await SecureStore.setItemAsync(KEY_SETUP_COMPLETE, 'true');
}

export async function saveRecoveryEmail(email: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_RECOVERY_EMAIL, email);
}

export async function getRecoveryEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_RECOVERY_EMAIL);
}

export async function setForcePasswordChange(value: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY_FORCE_PW_CHANGE, value ? 'true' : 'false');
}

export async function isPasswordChangeForced(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY_FORCE_PW_CHANGE)) === 'true';
}
