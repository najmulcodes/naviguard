/**
 * Same envelope-encryption unit as the native version: one "slot" holds
 * the Vault Key encrypted ("wrapped") under a key derived from something
 * the holder knows — the user's password, or the master password.
 *
 * Two slots exist per vault (user + master), independently wrapping the
 * SAME Vault Key, so rotating one never touches the other.
 */

export interface ScryptParams {
  /** CPU/memory cost — must be a power of 2. */
  N: number;
  /** Block size parameter — 8 is the standard default. */
  r: number;
  /** Parallelization parameter — 1 is standard for mobile (higher values
   *  mainly help defenders with many CPU cores, which a phone doesn't have). */
  p: number;
}

// N=16384 (OWASP's server-side baseline) is genuinely slow in pure JS on a
// phone — @noble/hashes has no native acceleration, and Hermes (RN's JS
// engine) has no JIT, so scrypt's memory-hard cost function runs as
// interpreted bytecode the whole way through. N=16384 measured 10+ seconds
// on mid-range Android hardware during testing — long enough to look like
// the app had frozen with no loading indicator.
//
// N=4096 (2^12) trades some brute-force resistance for a sub-second-to-
// low-seconds derivation time, which is the right call for THIS app: the
// realistic attacker model is someone with your phone in hand trying
// passwords by typing them into the UI (rate-limited by human typing speed
// and by re-running this same slow KDF each attempt), not an offline GPU
// farm with the wrapped key slot exfiltrated. If that threat model changes
// later, raise this back toward 16384 and accept the UX cost.
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 4096, r: 8, p: 1 };

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
