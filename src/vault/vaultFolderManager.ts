import * as FileSystem from 'expo-file-system';
import { encryptFile, decryptFile } from '../crypto/fileCipher';

const { StorageAccessFramework } = FileSystem;

/** Suffix marking a file as vault-encrypted — visible on purpose, so a
 *  friend browsing the drive on a PC understands they need NaviGuard. */
const LOCKED_SUFFIX = '.nvg';

export interface VaultFile {
  uri: string;
  displayName: string;
  isLocked: boolean;
  isImage: boolean;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic']);

function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'heic':
      return 'image/heic';
    default:
      return 'application/octet-stream';
  }
}

export { guessMimeType };

export type VaultProgress =
  | { type: 'progress'; current: number; total: number; fileName: string }
  | { type: 'failed'; fileName: string; error: unknown }
  | { type: 'done'; filesProcessed: number };

/**
 * Prompts the system folder picker — for a USB OTG drive, Android surfaces
 * it under "USB storage" in this picker natively (FAT32/exFAT; NTFS drives
 * may not appear — reformat if so). Returns the persisted directory URI,
 * or null if the user cancelled.
 */
export async function pickFolder(): Promise<string | null> {
  const result = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  return result.granted ? result.directoryUri : null;
}

function nameFromUri(uri: string): string {
  const decoded = decodeURIComponent(uri);
  const parts = decoded.split('/');
  return parts[parts.length - 1] ?? decoded;
}

/** Flat listing only (no subfolder recursion) — see README for why. */
export async function listFiles(folderUri: string): Promise<VaultFile[]> {
  const childUris = await StorageAccessFramework.readDirectoryAsync(folderUri);
  return childUris.map((uri) => {
    const name = nameFromUri(uri);
    const isLocked = name.endsWith(LOCKED_SUFFIX);
    const displayName = isLocked ? name.slice(0, -LOCKED_SUFFIX.length) : name;
    const ext = displayName.split('.').pop()?.toLowerCase() ?? '';
    return {
      uri,
      displayName,
      isLocked,
      isImage: IMAGE_EXTENSIONS.has(ext)
    };
  });
}

/** Encrypts every currently-unlocked file, deletes the plaintext original after each success. */
export async function* lockFolder(
  folderUri: string,
  vaultKey: Buffer
): AsyncGenerator<VaultProgress> {
  const files = await listFiles(folderUri);
  const targets = files.filter((f) => !f.isLocked);

  for (let i = 0; i < targets.length; i++) {
    const file = targets[i];
    yield { type: 'progress', current: i + 1, total: targets.length, fileName: file.displayName };
    try {
      const destUri = await StorageAccessFramework.createFileAsync(
        folderUri,
        `${file.displayName}${LOCKED_SUFFIX}`,
        'application/octet-stream'
      );
      await encryptFile(file.uri, destUri, vaultKey);
      await StorageAccessFramework.deleteAsync(file.uri); // only after a successful encrypt
    } catch (error) {
      yield { type: 'failed', fileName: file.displayName, error };
    }
  }
  yield { type: 'done', filesProcessed: targets.length };
}

/** Decrypts every locked (.nvg) file back to plaintext, deletes the ciphertext after each success. */
export async function* unlockFolder(
  folderUri: string,
  vaultKey: Buffer
): AsyncGenerator<VaultProgress> {
  const files = await listFiles(folderUri);
  const targets = files.filter((f) => f.isLocked);

  for (let i = 0; i < targets.length; i++) {
    const file = targets[i];
    yield { type: 'progress', current: i + 1, total: targets.length, fileName: file.displayName };
    try {
      const destUri = await StorageAccessFramework.createFileAsync(
        folderUri,
        file.displayName,
        'application/octet-stream'
      );
      await decryptFile(file.uri, destUri, vaultKey); // throws on wrong key / tampered file
      await StorageAccessFramework.deleteAsync(file.uri); // only after a successful decrypt
    } catch (error) {
      yield { type: 'failed', fileName: file.displayName, error };
    }
  }
  yield { type: 'done', filesProcessed: targets.length };
}
