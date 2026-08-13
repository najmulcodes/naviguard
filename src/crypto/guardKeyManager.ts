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
// BEFORE trusting the result as a real Vault Key. Cheap, harmless
// defense-in-depth regardless of cipher implementation.
//
// Kept as a plain string, converted to bytes lazily inside functions
// (not at module load) — see index.ts for why that ordering matters.
const CANARY_STRING = 'NVGRD-VALID!'; // exactly 12 bytes in utf8
const CANARY_LENGTH_BYTES = 12;

/**
 * Manual byte-for-byte comparison — deliberately NOT using Buffer's
 * .equals(). Confirmed via diagnostic testing that .subarray() on a
 * decrypted result doesn't reliably preserve the Buffer prototype in
 * this environment (Metro/Hermes bundling quirk, root cause not fully
 * pinned down, not worth the time to chase further) — the sliced result
 * is sometimes a plain Uint8Array missing .equals()/.toString(encoding).
 * Indexing and .length are universal TypedArray properties that work
 * identically either way, so this comparison is correct regardless of
 * which underlying type actually comes back.
 */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Same reasoning as bytesEqual — avoids relying on Buffer's toString('hex') override. */
function toHexSafe(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

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
  // (margelo/react-native-quick-crypto#737). @noble/hashes is pure JS/TS,
  // audited, no native module.
  const passwordBytes = Buffer.from(secret, 'utf8');
  const derived = await scryptAsync(passwordBytes, salt, {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: VAULT_KEY_LENGTH_BYTES
  });
  return Buffer.from(derived);
}

// AES-256-GCM via @noble/ciphers, NOT react-native-quick-crypto — that
// library's GCM implementation demonstrated real correctness failures
// during testing (wrong passwords accepted, then correct passwords
// rejected). @noble/ciphers' auth tag verification has since been
// confirmed correct in this exact codebase: a genuinely wrong password
// now throws "invalid ghash tag" as expected, and the correct password
// decrypts to the exact right bytes. This also covers fileCipher.ts
// (actual file lock/unlock), which used the same primitive.

function aesGcmEncrypt(key: Buffer, nonce: Buffer, plaintext: Buffer): Buffer {
  const cipher = gcm(key, nonce);
  return Buffer.from(cipher.encrypt(plaintext));
}

function aesGcmDecrypt(key: Buffer, nonce: Buffer, ciphertextAndTag: Buffer): Buffer {
  const cipher = gcm(key, nonce);
  // Throws on auth tag mismatch — confirmed correct behavior via testing.
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
 * password/master-password — protected by BOTH the GCM auth tag
 * (@noble/ciphers, confirmed correct) AND the canary check.
 */
export async function tryUnlock(secret: string, slot: WrappedKeySlot): Promise<Buffer | null> {
  try {
    const salt = Buffer.from(slot.kdfSalt, 'base64');
    const nonce = Buffer.from(slot.gcmNonce, 'base64');
    const wrapped = Buffer.from(slot.wrappedVaultKey, 'base64');
    const kek = await deriveKek(secret, salt, slot.kdfParams);

    let decrypted: Buffer;
    try {
      decrypted = aesGcmDecrypt(kek, nonce, wrapped);
    } catch {
      return null; // wrong password — auth tag mismatch, the expected path
    }

    if (decrypted.length !== CANARY_LENGTH_BYTES + VAULT_KEY_LENGTH_BYTES) {
      return null; // wrong length — definitely not a real unwrap
    }
    const canary = Buffer.from(CANARY_STRING, 'utf8');
    const canaryPart = decrypted.subarray(0, CANARY_LENGTH_BYTES);
    if (!bytesEqual(canaryPart, canary)) {
      return null; // wrong password — canary mismatch
    }
    return decrypted.subarray(CANARY_LENGTH_BYTES);
  } catch {
    return null; // wrong credential or corrupt data
  }
}

export function rotateUserSlot(
  newPassword: string,
  vaultKey: Buffer,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS
): Promise<WrappedKeySlot> {
  return createSlot(newPassword, vaultKey, params);
}
