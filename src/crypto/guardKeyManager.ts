import { gcm } from '@noble/ciphers/aes.js';
import { scryptAsync } from '@noble/hashes/scrypt';
import { randomBytes } from './randomBytes';
import {
  DEFAULT_SCRYPT_PARAMS,
  ScryptParams,
  WrappedKeySlot
} from './wrappedKeySlot';

const VAULT_KEY_LENGTH_BYTES = 32; // AES-256
const GCM_NONCE_LENGTH_BYTES = 12; // 96-bit, standard for GCM
const SCRYPT_SALT_LENGTH_BYTES = 16;

// Fixed 12-byte marker prepended to the Vault Key before encryption. After
// decrypting with a candidate password, we check this marker matches
// BEFORE trusting the result as a real Vault Key.
//
// Originally added because react-native-quick-crypto's AES-GCM was
// accepting wrong passwords (auth tag not reliably rejecting bad keys).
// Kept even after moving to @noble/ciphers below — it's cheap, harmless,
// and a genuine defense-in-depth layer regardless of which cipher
// implementation is doing the underlying work.
//
// Kept as a plain string here, NOT converted to Buffer at module level —
// calling Buffer at module-load time previously caused a real crash
// ("Property 'Buffer' doesn't exist") due to import-hoisting order.
// Buffer conversion happens lazily inside the functions below instead.
const CANARY_STRING = 'NVGRD-VALID!'; // exactly 12 bytes in utf8
const CANARY_LENGTH_BYTES = 12;

/**
 * Same lifecycle as the native GuardKeyManager:
 *   1. generateVaultKey()   — the one real secret, created once per vault
 *   2. createUserSlot(pw)   — wraps VK under the user's password
 *   3. createMasterSlot()   — wraps the SAME VK under the master password
 *   4. tryUnlock(...)       — unwraps VK given either credential
 *   5. rotateUserSlot(...)  — re-wraps VK under a new password
 *
 * Neither wrap path can derive the other's key material — compromising
 * one credential doesn't help compute the other.
 */

export function generateVaultKey(): Buffer {
  return randomBytes(VAULT_KEY_LENGTH_BYTES);
}

async function deriveKek(secret: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  // react-native-quick-crypto does NOT implement scrypt/scryptSync —
  // confirmed missing on the library's own GitHub
  // (margelo/react-native-quick-crypto#737), not a version/naming issue.
  const passwordBytes = Buffer.from(secret, 'utf8');
  const derived = await scryptAsync(passwordBytes, salt, {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: VAULT_KEY_LENGTH_BYTES
  });
  return Buffer.from(derived);
}

// AES-256-GCM via @noble/ciphers, NOT react-native-quick-crypto.
//
// Switched after react-native-quick-crypto's AES-GCM demonstrated TWO
// independent correctness failures during testing: (1) wrong passwords
// were being accepted as valid, and (2) the genuinely correct password
// was then failing the canary check added to fix (1) — meaning
// decrypt(encrypt(x)) wasn't reliably reproducing x even with the right
// key. Two failures on the same primitive from the same library, on top
// of the already-confirmed missing scrypt implementation, is a pattern,
// not a one-off. @noble/ciphers is pure JS/TS, audited, no native module —
// eliminates this entire class of bug the same way @noble/hashes did for
// the KDF. This also touches fileCipher.ts (actual file lock/unlock),
// which used the exact same broken primitive.
//
// @noble/ciphers' gcm(key, nonce).encrypt()/.decrypt() append/verify the
// 16-byte auth tag internally — no manual splitting needed, unlike the
// old createCipheriv/getAuthTag dance.

function aesGcmEncrypt(key: Buffer, nonce: Buffer, plaintext: Buffer): Buffer {
  const cipher = gcm(key, nonce);
  return Buffer.from(cipher.encrypt(plaintext));
}

function aesGcmDecrypt(key: Buffer, nonce: Buffer, ciphertextAndTag: Buffer): Buffer {
  const cipher = gcm(key, nonce);
  // Throws on auth tag mismatch — @noble/ciphers verifies this correctly,
  // confirmed against its own documented behavior, not assumed this time.
  return Buffer.from(cipher.decrypt(ciphertextAndTag));
}

async function createSlot(
  secret: string,
  vaultKey: Buffer,
  params: ScryptParams
): Promise<WrappedKeySlot> {
  const salt = randomBytes(SCRYPT_SALT_LENGTH_BYTES);
  const kek = await deriveKek(secret, salt, params);
  const nonce = randomBytes(GCM_NONCE_LENGTH_BYTES);
  const canary = Buffer.from(CANARY_STRING, 'utf8');
  const payload = Buffer.concat([canary, vaultKey]); // canary FIRST, then the real key
  const wrapped = aesGcmEncrypt(kek, nonce, payload);

  return {
    kdfSalt: salt.toString('base64'),
    kdfParams: params,
    gcmNonce: nonce.toString('base64'),
    wrappedVaultKey: wrapped.toString('base64')
  };
}

export function createUserSlot(
  password: string,
  vaultKey: Buffer,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS
): Promise<WrappedKeySlot> {
  return createSlot(password, vaultKey, params);
}

/**
 * [masterPasswordCombined] should already have the per-install salt mixed
 * in by the caller — see passwordMaterial.ts — before reaching here.
 */
export function createMasterSlot(
  masterPasswordCombined: string,
  vaultKey: Buffer,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS
): Promise<WrappedKeySlot> {
  return createSlot(masterPasswordCombined, vaultKey, params);
}

/**
 * Attempts to unwrap [slot] using [secret]. Returns null on wrong
 * password/master-password — both the GCM auth tag (now @noble/ciphers,
 * verified correct) AND the canary check protect this.
 */
export async function tryUnlock(secret: string, slot: WrappedKeySlot): Promise<Buffer | null> {
  try {
    const salt = Buffer.from(slot.kdfSalt, 'base64');
    const nonce = Buffer.from(slot.gcmNonce, 'base64');
    const wrapped = Buffer.from(slot.wrappedVaultKey, 'base64');
    const kek = await deriveKek(secret, salt, slot.kdfParams);
    const decrypted = aesGcmDecrypt(kek, nonce, wrapped);

    if (decrypted.length !== CANARY_LENGTH_BYTES + VAULT_KEY_LENGTH_BYTES) {
      return null; // wrong length — definitely not a real unwrap
    }
    const canary = Buffer.from(CANARY_STRING, 'utf8');
    const canaryPart = decrypted.subarray(0, CANARY_LENGTH_BYTES);
    if (!canaryPart.equals(canary)) {
      return null; // wrong password — canary mismatch
    }
    return decrypted.subarray(CANARY_LENGTH_BYTES);
  } catch {
    return null; // wrong credential, corrupt data, or an auth-tag failure
  }
}

export function rotateUserSlot(
  newPassword: string,
  vaultKey: Buffer,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS
): Promise<WrappedKeySlot> {
  return createSlot(newPassword, vaultKey, params);
}
