import * as SecureStore from 'expo-secure-store';

/**
 * Folder shortcuts are just labeled SAF URIs — not sensitive on their own
 * (a URI doesn't reveal file contents), but stored via SecureStore anyway
 * for consistency with the rest of the app's persistence and because
 * SecureStore is already a dependency — no reason to add a second storage
 * mechanism for one small JSON blob.
 */

const STORAGE_KEY = 'naviguard_folder_shortcuts';

export interface FolderShortcut {
  id: string;
  label: string;
  uri: string;
}

export async function getShortcuts(): Promise<FolderShortcut[]> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FolderShortcut[];
  } catch {
    return []; // corrupt data shouldn't crash the app — just start fresh
  }
}

export async function saveShortcut(label: string, uri: string): Promise<FolderShortcut[]> {
  const existing = await getShortcuts();
  // Replace if a shortcut for this exact folder already exists, rather
  // than accumulating duplicates every time someone re-picks the same folder.
  const withoutDuplicate = existing.filter((s) => s.uri !== uri);
  const updated: FolderShortcut[] = [
    ...withoutDuplicate,
    { id: `${Date.now()}`, label, uri }
  ];
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function removeShortcut(id: string): Promise<FolderShortcut[]> {
  const existing = await getShortcuts();
  const updated = existing.filter((s) => s.id !== id);
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
