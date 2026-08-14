import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { colors } from '../theme/colors';
import { shared } from '../theme/styles';
import { useGuardStore } from '../store/useGuardStore';
import * as VaultFolderManager from '../vault/vaultFolderManager';
import type { VaultFile, VaultProgress } from '../vault/vaultFolderManager';
import * as FolderShortcuts from '../vault/folderShortcuts';
import type { FolderShortcut } from '../vault/folderShortcuts';
import { decryptToDataUri } from '../crypto/fileCipher';

/**
 * v2.2 REDESIGN: this screen used to only show ALREADY-locked photos —
 * "Add Folder" just bookmarked a folder, it never actually hid anything.
 * That's confusing: the natural expectation of "Hidden Gallery -> Add
 * Folder" is "these photos become hidden," not "remember this folder for
 * later." Fixed by showing BOTH locked and unlocked photos in one grid,
 * with a selection + "Hide Selected" action right here — no more needing
 * to know the main Vault screen exists to actually hide something.
 *
 * Locked photos: decrypted IN MEMORY ONLY for viewing (see
 * decryptToDataUri) — the .nvg file on disk is never touched.
 * Unlocked photos: shown as a plain placeholder (not previewed — no
 * reason to decrypt something that isn't encrypted yet just to show a
 * thumbnail), tap to select, then Hide.
 */

function GalleryThumbnail({
  file,
  vaultKey,
  selected,
  onPressLocked,
  onToggleSelect
}: {
  file: VaultFile;
  vaultKey: Buffer;
  selected: boolean;
  onPressLocked: (dataUri: string) => void;
  onToggleSelect: (uri: string) => void;
}) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!file.isLocked) return; // only decrypt locked photos — nothing to decrypt otherwise
    let cancelled = false;
    const mime = VaultFolderManager.guessMimeType(file.displayName);
    decryptToDataUri(file.uri, vaultKey, mime)
      .then((uri) => {
        if (!cancelled) setDataUri(uri);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [file.uri, file.isLocked]);

  if (!file.isLocked) {
    // Unlocked photo — plain selectable placeholder, no decrypt needed.
    return (
      <TouchableOpacity
        style={{ width: '33.333%', aspectRatio: 1, padding: 2 }}
        onPress={() => onToggleSelect(file.uri)}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 6,
            backgroundColor: colors.navyElevated,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: selected ? 2 : 0,
            borderColor: colors.goldPrimary
          }}
        >
          <Text style={{ fontSize: 22 }}>🔓</Text>
          <Text
            numberOfLines={1}
            style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4, maxWidth: '90%' }}
          >
            {file.displayName}
          </Text>
          {selected && (
            <View
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 18,
                height: 18,
                borderRadius: 4,
                backgroundColor: colors.goldPrimary,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Text style={{ color: colors.navyDeep, fontSize: 11, fontWeight: '700' }}>✓</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Locked photo — decrypted-in-memory thumbnail, tap to view full screen.
  return (
    <TouchableOpacity
      style={{ width: '33.333%', aspectRatio: 1, padding: 2 }}
      disabled={!dataUri}
      onPress={() => dataUri && onPressLocked(dataUri)}
    >
      {dataUri ? (
        <Image source={{ uri: dataUri }} style={{ flex: 1, borderRadius: 6 }} resizeMode="cover" />
      ) : (
        <View
          style={{
            flex: 1,
            borderRadius: 6,
            backgroundColor: colors.navyElevated,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {failed ? (
            <Text style={{ color: colors.danger, fontSize: 11 }}>Failed</Text>
          ) : (
            <ActivityIndicator color={colors.goldPrimary} size="small" />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HiddenGalleryScreen() {
  const vaultKey = useGuardStore((s) => s.vaultKey);
  const backToVaultHome = useGuardStore((s) => s.backToVaultHome);

  const [shortcuts, setShortcuts] = useState<FolderShortcut[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [images, setImages] = useState<VaultFile[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState('');

  const loadShortcuts = useCallback(async () => {
    setShortcuts(await FolderShortcuts.getShortcuts());
  }, []);

  useEffect(() => {
    loadShortcuts();
  }, [loadShortcuts]);

  async function openFolder(uri: string) {
    setActiveFolder(uri);
    setSelected(new Set());
    setLoadingList(true);
    const files = await VaultFolderManager.listFiles(uri);
    setImages(files.filter((f) => f.isImage)); // BOTH locked and unlocked now
    setLoadingList(false);
  }

  async function addNewFolder() {
    const uri = await VaultFolderManager.pickFolder();
    if (!uri) return;
    const label = uri.split('/').pop() || 'Folder';
    const updated = await FolderShortcuts.saveShortcut(decodeURIComponent(label), uri);
    setShortcuts(updated);
    await openFolder(uri);
  }

  async function removeShortcut(id: string) {
    const updated = await FolderShortcuts.removeShortcut(id);
    setShortcuts(updated);
  }

  function toggleSelect(uri: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  }

  async function hideSelected() {
    if (!activeFolder || !vaultKey || selected.size === 0) return;
    const targets = images.filter((f) => selected.has(f.uri) && !f.isLocked);
    setBusy(true);
    const gen: AsyncGenerator<VaultProgress> = VaultFolderManager.lockFiles(
      activeFolder,
      targets,
      vaultKey
    );
    for await (const result of gen) {
      if (result.type === 'progress') {
        setProgressText(`Hiding ${result.current}/${result.total} — ${result.fileName}`);
      }
    }
    setBusy(false);
    setSelected(new Set());
    await openFolder(activeFolder); // refresh — hidden photos now show as locked thumbnails
  }

  if (!vaultKey) {
    return (
      <View style={shared.screen}>
        <Text style={shared.body}>Session expired — please unlock again.</Text>
      </View>
    );
  }

  const unlockedCount = images.filter((f) => !f.isLocked).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.navyBase, paddingTop: 56 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          marginBottom: 16
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => (activeFolder ? setActiveFolder(null) : backToVaultHome())}
            style={{ marginRight: 16 }}
          >
            <Text style={{ color: colors.goldPrimary, fontSize: 22 }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700' }}>
            Hidden Gallery
          </Text>
        </View>
        {activeFolder && (
          <TouchableOpacity onPress={() => openFolder(activeFolder)}>
            <Text style={{ color: colors.goldPrimary }}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>

      {!activeFolder ? (
        // --- Shortcut list ---
        <View style={{ paddingHorizontal: 20, flex: 1 }}>
          <Text style={[shared.body, { textAlign: 'left', marginBottom: 16 }]}>
            Pick a folder below, then select photos in it to hide. Hidden photos never show in
            your regular Gallery app or file manager, and viewing them here never writes them
            back to plain storage — decrypted only in memory, only while you're looking.
          </Text>
          <FlatList
            data={shortcuts}
            keyExtractor={(s) => s.id}
            ListEmptyComponent={
              <Text style={shared.body}>No folders added yet. Add one below.</Text>
            }
            renderItem={({ item }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: '#1E2E42'
                }}
              >
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openFolder(item.uri)}>
                  <Text style={{ color: colors.textPrimary, fontSize: 15 }}>📁 {item.label}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeShortcut(item.id)}>
                  <Text style={{ color: colors.danger, fontSize: 13 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          />
          <TouchableOpacity style={shared.primaryButton} onPress={addNewFolder}>
            <Text style={shared.primaryButtonText}>+ Add Folder</Text>
          </TouchableOpacity>
        </View>
      ) : loadingList ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.goldPrimary} />
        </View>
      ) : images.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Text style={[shared.body, { textAlign: 'center' }]}>
            No photos found in this folder.
          </Text>
        </View>
      ) : (
        <>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginHorizontal: 20, marginBottom: 8 }}>
            🔒 already hidden · 🔓 tap to select, then Hide
          </Text>

          {busy && (
            <Text style={{ color: colors.textSecondary, marginHorizontal: 20, marginBottom: 8 }}>
              {progressText}
            </Text>
          )}

          <FlatList
            data={images}
            keyExtractor={(f) => f.uri}
            numColumns={3}
            contentContainerStyle={{ paddingHorizontal: 4 }}
            renderItem={({ item }) => (
              <GalleryThumbnail
                file={item}
                vaultKey={vaultKey}
                selected={selected.has(item.uri)}
                onPressLocked={setViewerUri}
                onToggleSelect={toggleSelect}
              />
            )}
          />

          {unlockedCount > 0 && (
            <TouchableOpacity
              style={[shared.primaryButton, { marginHorizontal: 20, marginVertical: 12 }, (busy || selected.size === 0) && { opacity: 0.6 }]}
              disabled={busy || selected.size === 0}
              onPress={hideSelected}
            >
              <Text style={shared.primaryButtonText}>
                🔒 Hide{selected.size > 0 ? ` (${selected.size})` : ''}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Full-screen viewer for already-hidden photos */}
      <Modal visible={!!viewerUri} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setViewerUri(null)}
        >
          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}
