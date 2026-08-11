import crypto from 'react-native-quick-crypto';
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
// Why this exists: AES-GCM's auth tag is supposed to make decryption
// with the wrong key throw, not return garbage. During testing, ANY
// password (including deliberately wrong ones) was successfully
// "unlocking" the app — meaning react-native-quick-crypto's GCM
// decryption was not reliably rejecting bad keys via the tag check
// alone. Rather than trust that check (from a library that's already
// been missing documented functions — see deriveKek below), this canary
// makes wrong-password rejection independent of whatever quick-crypto's
// GCM implementation does or doesn't verify internally. Decrypting
// garbage ciphertext with a wrong key produces effectively random bytes;
// the odds of 12 random bytes matching this exact constant are 1 in
// 2^96 — not a real risk to worry about.
//
// IMPORTANT: this changes the wrapped-slot payload format. Any vault
// created before this fix will fail to unlock afterward (canary won't be
// present in old ciphertext) — expected, not a new bug. Uninstall and
// re-run Setup on any device that was using a pre-canary build.
const CANARY = Buffer.from('NVGRD-VALID!', 'utf8'); // exactly 12 bytes

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
  // @noble/hashes is pure JS/TS, audited, no native module — sidesteps
  // the whole category of native-linking bugs this project has hit.
  const passwordBytes = Buffer.from(secret, 'utf8');
  const derived = await scryptAsync(passwordBytes, salt, {
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: VAULT_KEY_LENGTH_BYTES
  });
  return Buffer.from(derived);
}

function aesGcmEncrypt(key: Buffer, nonce: Buffer, plaintext: Buffer): Buffer {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Append the 16-byte auth tag — kept together with ciphertext so
  // unwrap only needs to store/pass one blob.
  return Buffer.concat([encrypted, authTag]);
}

function aesGcmDecrypt(key: Buffer, nonce: Buffer, ciphertextAndTag: Buffer): Buffer {
  const authTag = ciphertextAndTag.subarray(ciphertextAndTag.length - 16);
  const ciphertext = ciphertextAndTag.subarray(0, ciphertextAndTag.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  // NOTE: this throwing on a bad tag is what SHOULD detect a wrong
  // password. Testing showed it isn't reliable on its own with this
  // library — see the CANARY check in tryUnlock, which is the real
  // safety net now. This function/comment is left as-is deliberately;
  // whatever quick-crypto does here, right or wrong, no longer matters
  // on its own.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function createSlot(
  secret: string,
  vaultKey: Buffer,
  params: ScryptParams
): Promise<WrappedKeySlot> {
  const salt = randomBytes(SCRYPT_SALT_LENGTH_BYTES);
  const kek = await deriveKek(secret, salt, params);
  const nonce = randomBytes(GCM_NONCE_LENGTH_BYTES);
  const payload = Buffer.concat([CANARY, vaultKey]); // canary FIRST, then the real key
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
 * password/master-password. The real check is the CANARY comparison
 * below, not just whichever exception GCM decryption may or may not
 * throw — see the comment on CANARY above for why.
 */
export async function tryUnlock(secret: string, slot: WrappedKeySlot): Promise<Buffer | null> {
  try {
    const salt = Buffer.from(slot.kdfSalt, 'base64');
    const nonce = Buffer.from(slot.gcmNonce, 'base64');
    const wrapped = Buffer.from(slot.wrappedVaultKey, 'base64');
    const kek = await deriveKek(secret, salt, slot.kdfParams);
    const decrypted = aesGcmDecrypt(kek, nonce, wrapped);

    if (decrypted.length !== CANARY.length + VAULT_KEY_LENGTH_BYTES) {
      return null; // wrong length — definitely not a real unwrap
    }
    const canaryPart = decrypted.subarray(0, CANARY.length);
    if (!canaryPart.equals(CANARY)) {
      return null; // wrong password — canary mismatch, the real check
    }
    return decrypted.subarray(CANARY.length);
  } catch {
    return null; // wrong credential, corrupt data, or a native-layer throw
  }
}

export function rotateUserSlot(
  newPassword: string,
  vaultKey: Buffer,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS
): Promise<WrappedKeySlot> {
  return createSlot(newPassword, vaultKey, params);
}
