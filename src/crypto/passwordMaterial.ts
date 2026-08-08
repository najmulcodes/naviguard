import crypto from 'react-native-quick-crypto';

const INSTALL_SALT_LENGTH_BYTES = 16;

export function generateInstallSalt(): string {
  return crypto.randomBytes(INSTALL_SALT_LENGTH_BYTES).toString('base64');
}

/**
 * Combines the master password typed by the user with this device's
 * install salt (hex-encoded and appended) before it ever reaches scrypt.
 * The install salt lives only in expo-secure-store on that one device —
 * never in source, never transmitted — so knowing the master password
 * alone isn't enough to unlock a DIFFERENT install of the app.
 */
export function combineWithInstallSalt(masterPasswordInput: string, installSaltBase64: string): string {
  const saltHex = Buffer.from(installSaltBase64, 'base64').toString('hex');
  return masterPasswordInput + saltHex;
}
