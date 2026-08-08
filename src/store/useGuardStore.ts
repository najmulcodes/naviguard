import { create } from 'zustand';
import * as GuardController from '../crypto/guardController';

export type AppScreen =
  | 'loading'
  | 'setup'
  | 'locked'
  | 'masterRecovery'
  | 'forceChangePassword'
  | 'vaultHome'
  | 'settings';

interface GuardState {
  screen: AppScreen;
  errorMessage: string | null;
  /** Held ONLY while unlocked. Wiped on lock/background — never persisted. */
  vaultKey: Buffer | null;

  init: () => Promise<void>;
  completeSetup: (password: string, confirm: string, email: string) => Promise<boolean>;
  unlock: (password: string) => Promise<void>;
  unlockWithVaultKey: (vaultKey: Buffer) => void;
  goToMasterRecovery: () => void;
  unlockWithMasterPassword: (masterPassword: string) => Promise<void>;
  completeForcedPasswordChange: (newPassword: string, confirm: string) => Promise<boolean>;
  openSettings: () => void;
  backToVaultHome: () => void;
  cancelRecovery: () => void;
  lockAndClearSession: () => void;
  clearError: () => void;
}

export const useGuardStore = create<GuardState>((set, get) => ({
  screen: 'loading',
  errorMessage: null,
  vaultKey: null,

  init: async () => {
    const setUp = await GuardController.isSetUp();
    set({ screen: setUp ? 'locked' : 'setup' });
  },

  completeSetup: async (password, confirm, email) => {
    if (password !== confirm) {
      set({ errorMessage: "Passwords don't match" });
      return false;
    }
    if (password.length < 8) {
      set({ errorMessage: 'Use at least 8 characters' });
      return false;
    }
    if (!email.includes('@')) {
      set({ errorMessage: 'Enter a valid email for recovery' });
      return false;
    }
    await GuardController.setupVault(password, email.trim());
    set({ errorMessage: null, screen: 'locked' });
    return true;
  },

  unlock: async (password) => {
    const result = await GuardController.unlockWithPassword(password);
    if (result.type === 'success') {
      set({
        vaultKey: result.vaultKey,
        errorMessage: null,
        screen: result.mustChangePassword ? 'forceChangePassword' : 'vaultHome'
      });
    } else if (result.type === 'wrongCredential') {
      set({ errorMessage: 'Incorrect password' });
    } else {
      set({ screen: 'setup' });
    }
  },

  unlockWithVaultKey: (vaultKey) => {
    set({ vaultKey, screen: 'vaultHome' });
  },

  goToMasterRecovery: () => set({ errorMessage: null, screen: 'masterRecovery' }),

  unlockWithMasterPassword: async (masterPassword) => {
    const result = await GuardController.unlockWithMasterPassword(masterPassword);
    if (result.type === 'success') {
      set({ vaultKey: result.vaultKey, errorMessage: null, screen: 'forceChangePassword' });
    } else if (result.type === 'wrongCredential') {
      set({ errorMessage: 'That master password is incorrect' });
    } else {
      set({ screen: 'setup' });
    }
  },

  completeForcedPasswordChange: async (newPassword, confirm) => {
    if (newPassword !== confirm) {
      set({ errorMessage: "Passwords don't match" });
      return false;
    }
    if (newPassword.length < 8) {
      set({ errorMessage: 'Use at least 8 characters' });
      return false;
    }
    const vk = get().vaultKey;
    if (!vk) {
      set({ errorMessage: 'Session expired — please unlock again', screen: 'locked' });
      return false;
    }
    await GuardController.rotatePassword(vk, newPassword);
    set({ errorMessage: null, screen: 'vaultHome' });
    return true;
  },

  openSettings: () => set({ screen: 'settings' }),
  backToVaultHome: () => set({ screen: 'vaultHome' }),
  cancelRecovery: () => set({ errorMessage: null, screen: 'locked' }),

  lockAndClearSession: () => {
    const { screen, vaultKey } = get();
    vaultKey?.fill(0);
    const wasUnlockedArea =
      screen === 'vaultHome' || screen === 'settings' || screen === 'forceChangePassword';
    set({
      vaultKey: null,
      screen: wasUnlockedArea ? 'locked' : screen
    });
  },

  clearError: () => set({ errorMessage: null })
}));
