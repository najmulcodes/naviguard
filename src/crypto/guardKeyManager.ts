import crypto from 'react-native-quick-crypto';
import {
  DEFAULT_SCRYPT_PARAMS,
  ScryptParams,
  WrappedKeySlot
} from './wrappedKeySlot';

const VAULT_KEY_LENGTH_BYTES = 32; // AES-256
const GCM_NONCE_LENGTH_BYTES = 12; // 96-bit, standard for GCM
const SCRYPT_SALT_LENGTH_BYTES = 16;

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
  return crypto.randomBytes(VAULT_KEY_LENGTH_BYTES);
}

function deriveKek(secret: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      secret,
      salt,
      VAULT_KEY_LENGTH_BYTES,
      { N: params.N, r: params.r, p: params.p },
      (err: Error | null, derivedKey: Buffer) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
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
  // Throws if the tag doesn't match — that's how we detect "wrong password"
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function createSlot(
  secret: string,
  vaultKey: Buffer,
  params: ScryptParams
): Promise<WrappedKeySlot> {
  const salt = crypto.randomBytes(SCRYPT_SALT_LENGTH_BYTES);
  const kek = await deriveKek(secret, salt, params);
  const nonce = crypto.randomBytes(GCM_NONCE_LENGTH_BYTES);
  const wrapped = aesGcmEncrypt(kek, nonce, vaultKey);

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
 * password/master-password (GCM auth tag mismatch) rather than throwing —
 * that's the expected, non-exceptional "try again" path.
 */
export async function tryUnlock(secret: string, slot: WrappedKeySlot): Promise<Buffer | null> {
  try {
    const salt = Buffer.from(slot.kdfSalt, 'base64');
    const nonce = Buffer.from(slot.gcmNonce, 'base64');
    const wrapped = Buffer.from(slot.wrappedVaultKey, 'base64');
    const kek = await deriveKek(secret, salt, slot.kdfParams);
    return aesGcmDecrypt(kek, nonce, wrapped);
  } catch {
    return null; // wrong credential — auth tag mismatch, not a crash
  }
}

export function rotateUserSlot(
  newPassword: string,
  vaultKey: Buffer,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS
): Promise<WrappedKeySlot> {
  return createSlot(newPassword, vaultKey, params);
}
