import * as GuardKeyManager from './guardKeyManager';
import * as SecureVaultStore from './secureVaultStore';
import { combineWithInstallSalt } from './passwordMaterial';
import { getMasterPassword } from './masterPasswordProvider';

export type UnlockResult =
  | { type: 'success'; vaultKey: Buffer; mustChangePassword: boolean }
  | { type: 'wrongCredential' }
  | { type: 'notSetUp' };

export async function isSetUp(): Promise<boolean> {
  return SecureVaultStore.isSetupComplete();
}

export async function recoveryEmail(): Promise<string | null> {
  return SecureVaultStore.getRecoveryEmail();
}

/** Called once, on first launch. */
export async function setupVault(userPassword: string, recoveryEmail: string): Promise<void> {
  const alreadySetUp = await SecureVaultStore.isSetupComplete();
  if (alreadySetUp) throw new Error('Vault already set up on this device');

  const vaultKey = GuardKeyManager.generateVaultKey();
  const installSalt = await SecureVaultStore.getOrCreateInstallSalt();

  const userSlot = await GuardKeyManager.createUserSlot(userPassword, vaultKey);
  const masterCombined = combineWithInstallSalt(getMasterPassword(), installSalt);
  const masterSlot = await GuardKeyManager.createMasterSlot(masterCombined, vaultKey);

  await SecureVaultStore.saveUserSlot(userSlot);
  await SecureVaultStore.saveMasterSlot(masterSlot);
  await SecureVaultStore.saveRecoveryEmail(recoveryEmail);
  await SecureVaultStore.markSetupComplete();
}

export async function unlockWithPassword(password: string): Promise<UnlockResult> {
  const slot = await SecureVaultStore.loadUserSlot();
  if (!slot) return { type: 'notSetUp' };

  const vk = await GuardKeyManager.tryUnlock(password, slot);
  if (!vk) return { type: 'wrongCredential' };

  const mustChangePassword = await SecureVaultStore.isPasswordChangeForced();
  return { type: 'success', vaultKey: vk, mustChangePassword };
}

export async function unlockWithMasterPassword(masterPasswordInput: string): Promise<UnlockResult> {
  const slot = await SecureVaultStore.loadMasterSlot();
  if (!slot) return { type: 'notSetUp' };

  const installSalt = await SecureVaultStore.getOrCreateInstallSalt();
  const combined = combineWithInstallSalt(masterPasswordInput, installSalt);
  const vk = await GuardKeyManager.tryUnlock(combined, slot);
  if (!vk) return { type: 'wrongCredential' };

  // Flip the flag immediately — if the app dies before the user finishes
  // setting a new password, they're forced through it again next launch
  // rather than getting free access on the (now-handed-out) master password.
  await SecureVaultStore.setForcePasswordChange(true);
  return { type: 'success', vaultKey: vk, mustChangePassword: true };
}

/** MUST be called right after a master-password unlock, before anything else is reachable. */
export async function rotatePassword(vaultKey: Buffer, newPassword: string): Promise<void> {
  const newSlot = await GuardKeyManager.rotateUserSlot(newPassword, vaultKey);
  await SecureVaultStore.saveUserSlot(newSlot);
  await SecureVaultStore.setForcePasswordChange(false);
}
