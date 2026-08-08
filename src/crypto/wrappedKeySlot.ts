/**
 * Same envelope-encryption unit as the native version: one "slot" holds
 * the Vault Key encrypted ("wrapped") under a key derived from something
 * the holder knows — the user's password, or the master password.
 *
 * Two slots exist per vault (user + master), independently wrapping the
 * SAME Vault Key, so rotating one never touches the other.
 */

export interface ScryptParams {
  /** CPU/memory cost — must be a power of 2. 16384 (2^14) is the current
   *  OWASP-recommended minimum for interactive logins. */
  N: number;
  /** Block size parameter — 8 is the standard default. */
  r: number;
  /** Parallelization parameter — 1 is standard for mobile (higher values
   *  mainly help defenders with many CPU cores, which a phone doesn't have). */
  p: number;
}

export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 16384, r: 8, p: 1 };

export interface WrappedKeySlot {
  /** Base64, random salt fed into scrypt. 16 bytes, unique per slot. */
  kdfSalt: string;
  kdfParams: ScryptParams;
  /** Base64, GCM nonce (12 bytes) used when wrapping the Vault Key. */
  gcmNonce: string;
  /** Base64, AES-256-GCM(VK) under the derived KEK — includes the auth tag. */
  wrappedVaultKey: string;
}

export function serializeSlot(slot: WrappedKeySlot): string {
  return JSON.stringify(slot);
}

export function deserializeSlot(raw: string): WrappedKeySlot {
  const parsed = JSON.parse(raw);
  if (!parsed.kdfSalt || !parsed.kdfParams || !parsed.gcmNonce || !parsed.wrappedVaultKey) {
    throw new Error('Corrupt WrappedKeySlot payload');
  }
  return parsed as WrappedKeySlot;
}
