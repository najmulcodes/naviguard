import { gcm } from '@noble/ciphers/aes.js';
import { randomBytes } from './randomBytes';
import * as FileSystem from 'expo-file-system';

const { StorageAccessFramework } = FileSystem;

const GCM_NONCE_LENGTH_BYTES = 12;

/**
 * Encrypts/decrypts individual files using the Vault Key.
 *
 * IMPORTANT TRADE-OFF vs the native version: this reads the ENTIRE file
 * into memory as base64, encrypts it in one shot, and writes it back out —
 * there's no true streaming here (RN doesn't expose a clean file-stream
 * API the way Kotlin does). That means a file's practical size limit is
 * "whatever fits in the app's available JS heap," roughly a few hundred
 * MB on a typical phone, not disk size. Fine for documents/photos/most
 * personal files; don't rely on this for multi-GB video vaulting.
 *
 * AES-256-GCM via @noble/ciphers, NOT react-native-quick-crypto — see
 * guardKeyManager.ts for the full explanation. Same underlying bug would
 * have affected file lock/unlock too (this is the exact same primitive),
 * so this needed the same fix, not just the key-wrapping code.
 */

function encryptBuffer(key: Buffer, plaintext: Buffer): Buffer {
  const nonce = randomBytes(GCM_NONCE_LENGTH_BYTES);
  const cipher = gcm(key, nonce);
  const ciphertext = Buffer.from(cipher.encrypt(plaintext)); // tag appended internally
  // Layout: [12-byte nonce][ciphertext+tag]
  return Buffer.concat([nonce, ciphertext]);
}

function decryptBuffer(key: Buffer, payload: Buffer): Buffer {
  const nonce = payload.subarray(0, GCM_NONCE_LENGTH_BYTES);
  const ciphertextAndTag = payload.subarray(GCM_NONCE_LENGTH_BYTES);
  const cipher = gcm(key, nonce);
  return Buffer.from(cipher.decrypt(ciphertextAndTag)); // throws if tampered/wrong key
}

/** [sourceUri] and [destUri] are SAF document URIs (from VaultFolderManager). */
export async function encryptFile(sourceUri: string, destUri: string, vaultKey: Buffer): Promise<void> {
  const base64 = await StorageAccessFramework.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64
  });
  const plaintext = Buffer.from(base64, 'base64');
  const encrypted = encryptBuffer(vaultKey, plaintext);
  await StorageAccessFramework.writeAsStringAsync(destUri, encrypted.toString('base64'), {
    encoding: FileSystem.EncodingType.Base64
  });
}

export async function decryptFile(sourceUri: string, destUri: string, vaultKey: Buffer): Promise<void> {
  const base64 = await StorageAccessFramework.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64
  });
  const payload = Buffer.from(base64, 'base64');
  const decrypted = decryptBuffer(vaultKey, payload); // throws on wrong key / tampered file
  await StorageAccessFramework.writeAsStringAsync(destUri, decrypted.toString('base64'), {
    encoding: FileSystem.EncodingType.Base64
  });
}

/**
 * Decrypts a locked file entirely IN MEMORY and returns it as a base64
 * data URI — suitable for direct use as an <Image source={{uri}}> or
 * similar. Unlike decryptFile, this never writes plaintext back to the
 * drive: the ciphertext file on disk is completely untouched, so the
 * photo stays invisible to Gallery/Photos/any other app the whole time
 * you're viewing it in NaviGuard. This is what makes the Hidden Gallery
 * feature actually private, not just "temporarily visible while browsing."
 *
 * [mimeType] is a best-effort guess for the data URI header — wrong MIME
 * type won't break decryption (that's still authenticated/verified by
 * GCM), it would only affect whether the OS renders it correctly as an
 * image. See vaultFolderManager.ts's guessMimeType for the lookup.
 */
export async function decryptToDataUri(
  sourceUri: string,
  vaultKey: Buffer,
  mimeType: string
): Promise<string> {
  const base64 = await StorageAccessFramework.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64
  });
  const payload = Buffer.from(base64, 'base64');
  const decrypted = decryptBuffer(vaultKey, payload); // throws on wrong key / tampered file
  return `data:${mimeType};base64,${decrypted.toString('base64')}`;
}
