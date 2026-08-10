import { create } from 'zustand';
import * as GuardController from '../crypto/guardController';

export type AppScreen =
  | 'loading'
  | 'setup'
  | 'locked'
  | 'masterRecovery'
  | 'forceChangePassword'
  | 'vaultHome'
  | 'hiddenGallery'
  | 'settings';

interface GuardState {
  screen: AppScreen;
  errorMessage: string | null;
  /** True while a slow crypto operation (scrypt) is running — drives
   *  loading indicators so a multi-second wait doesn't look like a freeze. */
  busy: boolean;
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
  openHiddenGallery: () => void;
  backToVaultHome: () => void;
  cancelRecovery: () => void;
  lockAndClearSession: () => void;
  clearError: () => void;
}

/** Turns any thrown value into a readable string — never leaves the UI
 *  with a silent, unexplained failure. */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export const useGuardStore = create<GuardState>((set, get) => ({
  screen: 'loading',
  errorMessage: null,
  busy: false,
  vaultKey: null,

  init: async () => {
    try {
      const setUp = await GuardController.isSetUp();
      set({ screen: setUp ? 'locked' : 'setup' });
    } catch (err) {
      set({ screen: 'setup', errorMessage: describeError(err) });
    }
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
    set({ busy: true, errorMessage: null });
    try {
      await GuardController.setupVault(password, email.trim());
      set({ errorMessage: null, screen: 'locked', busy: false });
      return true;
    } catch (err) {
      // Previously this threw silently — the screen just never advanced
      // with no feedback at all. Every path below now surfaces something.
      set({ errorMessage: `Setup failed: ${describeError(err)}`, busy: false });
      return false;
    }
  },

  unlock: async (password) => {
    set({ busy: true, errorMessage: null });
    try {
      const result = await GuardController.unlockWithPassword(password);
      if (result.type === 'success') {
        set({
          vaultKey: result.vaultKey,
          errorMessage: null,
          busy: false,
          screen: result.mustChangePassword ? 'forceChangePassword' : 'vaultHome'
        });
      } else if (result.type === 'wrongCredential') {
        set({ errorMessage: 'Incorrect password', busy: false });
      } else {
        set({ screen: 'setup', busy: false });
      }
    } catch (err) {
      set({ errorMessage: describeError(err), busy: false });
    }
  },

  unlockWithVaultKey: (vaultKey) => {
    set({ vaultKey, screen: 'vaultHome' });
  },

  goToMasterRecovery: () => set({ errorMessage: null, screen: 'masterRecovery' }),

  unlockWithMasterPassword: async (masterPassword) => {
    set({ busy: true, errorMessage: null });
    try {
      const result = await GuardController.unlockWithMasterPassword(masterPassword);
      if (result.type === 'success') {
        set({ vaultKey: result.vaultKey, errorMessage: null, busy: false, screen: 'forceChangePassword' });
      } else if (result.type === 'wrongCredential') {
        set({ errorMessage: 'That master password is incorrect', busy: false });
      } else {
        set({ screen: 'setup', busy: false });
      }
    } catch (err) {
      set({ errorMessage: describeError(err), busy: false });
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
    set({ busy: true, errorMessage: null });
    try {
      await GuardController.rotatePassword(vk, newPassword);
      set({ errorMessage: null, screen: 'vaultHome', busy: false });
      return true;
    } catch (err) {
      set({ errorMessage: describeError(err), busy: false });
      return false;
    }
  },

  openSettings: () => set({ screen: 'settings' }),
  openHiddenGallery: () => set({ screen: 'hiddenGallery' }),
  backToVaultHome: () => set({ screen: 'vaultHome' }),
  cancelRecovery: () => set({ errorMessage: null, screen: 'locked' }),

  lockAndClearSession: () => {
    const { screen, vaultKey } = get();
    vaultKey?.fill(0);
    const wasUnlockedArea =
      screen === 'vaultHome' ||
      screen === 'settings' ||
      screen === 'hiddenGallery' ||
      screen === 'forceChangePassword';
    set({
      vaultKey: null,
      screen: wasUnlockedArea ? 'locked' : screen
    });
  },

  clearError: () => set({ errorMessage: null })
}));
