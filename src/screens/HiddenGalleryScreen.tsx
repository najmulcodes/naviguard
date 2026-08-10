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
import type { VaultFile } from '../vault/vaultFolderManager';
import * as FolderShortcuts from '../vault/folderShortcuts';
import type { FolderShortcut } from '../vault/folderShortcuts';
import { decryptToDataUri } from '../crypto/fileCipher';

/**
 * Decrypts each locked image entirely IN MEMORY (via decryptToDataUri) —
 * the .nvg file on disk is never touched, never rewritten to plaintext.
 * This is what actually makes "hidden photos" hidden while you're
 * browsing them, not just hidden until you tap Unlock.
 *
 * KNOWN LIMITATION for v2: every thumbnail decrypts the FULL-resolution
 * image, not a downscaled preview — fine for a personal photo collection
 * in the tens/low hundreds, will get slow and memory-heavy well beyond
 * that. A real thumbnail cache is the natural v3 follow-up if this
 * becomes the most-used feature.
 */

function GalleryThumbnail({
  file,
  vaultKey,
  onPress
}: {
  file: VaultFile;
  vaultKey: Buffer;
  onPress: (dataUri: string) => void;
}) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
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
  }, [file.uri]);

  return (
    <TouchableOpacity
      style={{
        width: '33.333%',
        aspectRatio: 1,
        padding: 2
      }}
      disabled={!dataUri}
      onPress={() => dataUri && onPress(dataUri)}
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

  const loadShortcuts = useCallback(async () => {
    setShortcuts(await FolderShortcuts.getShortcuts());
  }, []);

  useEffect(() => {
    loadShortcuts();
  }, [loadShortcuts]);

  async function openFolder(uri: string) {
    setActiveFolder(uri);
    setLoadingList(true);
    const files = await VaultFolderManager.listFiles(uri);
    setImages(files.filter((f) => f.isLocked && f.isImage));
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

  if (!vaultKey) {
    return (
      <View style={shared.screen}>
        <Text style={shared.body}>Session expired — please unlock again.</Text>
      </View>
    );
  }

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
            Photos in these folders stay hidden from your regular Gallery app. Viewing them here
            never writes them back to plain storage — they're decrypted only in memory, only
            while you're looking.
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
            No locked photos in this folder yet. Lock some from the main Vault screen first, then
            they'll show up here.
          </Text>
        </View>
      ) : (
        // --- Photo grid ---
        <FlatList
          data={images}
          keyExtractor={(f) => f.uri}
          numColumns={3}
          contentContainerStyle={{ paddingHorizontal: 4 }}
          renderItem={({ item }) => (
            <GalleryThumbnail file={item} vaultKey={vaultKey} onPress={setViewerUri} />
          )}
        />
      )}

      {/* Full-screen viewer */}
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
