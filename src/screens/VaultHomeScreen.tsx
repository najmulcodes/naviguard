import React, { useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { shared } from '../theme/styles';
import { colors } from '../theme/colors';
import { useGuardStore } from '../store/useGuardStore';
import * as VaultFolderManager from '../vault/vaultFolderManager';
import type { VaultFile } from '../vault/vaultFolderManager';

export default function VaultHomeScreen() {
  const vaultKey = useGuardStore((s) => s.vaultKey);
  const openSettings = useGuardStore((s) => s.openSettings);
  const openHiddenGallery = useGuardStore((s) => s.openHiddenGallery);

  const [folderUri, setFolderUri] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState('');

  async function refresh(uri: string) {
    setFiles(await VaultFolderManager.listFiles(uri));
    setSelected(new Set()); // selection is per-listing; a fresh file list invalidates it
  }

  async function choosePress() {
    const uri = await VaultFolderManager.pickFolder();
    if (uri) {
      setFolderUri(uri);
      await refresh(uri);
    }
  }

  function toggleSelect(uri: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  }

  async function runOp(
    op: (uri: string, key: Buffer) => AsyncGenerator<VaultFolderManager.VaultProgress>
  ) {
    if (!folderUri || !vaultKey) return;
    setBusy(true);
    for await (const result of op(folderUri, vaultKey)) {
      if (result.type === 'progress') {
        setProgressText(`${result.current}/${result.total} — ${result.fileName}`);
      } else if (result.type === 'failed') {
        setProgressText(`Failed: ${result.fileName}`);
      }
    }
    setBusy(false);
    await refresh(folderUri);
  }

  async function runLock() {
    if (!folderUri) return;
    // Selection, if any, filters to just those files — but only the ones
    // that are actually lockable (unlocked). Selecting a mix of locked
    // and unlocked files and hitting "Lock" only acts on the unlocked ones.
    const targets =
      selected.size > 0
        ? files.filter((f) => selected.has(f.uri) && !f.isLocked)
        : files.filter((f) => !f.isLocked);
    await runOp((uri, key) => VaultFolderManager.lockFiles(uri, targets, key));
  }

  async function runUnlock() {
    if (!folderUri) return;
    const targets =
      selected.size > 0
        ? files.filter((f) => selected.has(f.uri) && f.isLocked)
        : files.filter((f) => f.isLocked);
    await runOp((uri, key) => VaultFolderManager.unlockFiles(uri, targets, key));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.navyBase }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 20,
          paddingTop: 56
        }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>
          NaviGuard
        </Text>
        <View style={{ flexDirection: 'row', gap: 20 }}>
          <TouchableOpacity onPress={openHiddenGallery}>
            <Text style={{ color: colors.goldPrimary, fontSize: 15 }}>🖼 Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openSettings}>
            <Text style={{ color: colors.goldPrimary, fontSize: 15 }}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {!folderUri ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={[shared.sectionTitle, { textAlign: 'center' }]}>
              Select a folder to guard — USB drive or phone storage
            </Text>
            <Text style={shared.body}>
              Only the top-level files in the folder you pick are guarded — subfolders aren't
              included yet.
            </Text>
            <TouchableOpacity style={shared.primaryButton} onPress={choosePress}>
              <Text style={shared.primaryButtonText}>Choose Folder</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
                {files.length} files
              </Text>
              <TouchableOpacity onPress={choosePress}>
                <Text style={{ color: colors.goldPrimary }}>Change folder</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 8 }}>
              {selected.size > 0
                ? `${selected.size} selected — Lock/Unlock will act on just these`
                : 'Tap a file to select just that one, or leave nothing selected to act on all'}
            </Text>

            {busy && (
              <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
                {progressText}
              </Text>
            )}

            <FlatList
              data={files}
              keyExtractor={(item) => item.uri}
              renderItem={({ item }) => {
                const isSelected = selected.has(item.uri);
                return (
                  <TouchableOpacity
                    onPress={() => toggleSelect(item.uri)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: '#1E2E42',
                      backgroundColor: isSelected ? colors.navyElevated : 'transparent',
                      paddingHorizontal: isSelected ? 8 : 0,
                      borderRadius: isSelected ? 8 : 0
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: isSelected ? colors.goldPrimary : colors.textSecondary,
                        backgroundColor: isSelected ? colors.goldPrimary : 'transparent',
                        marginRight: 12,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {isSelected && (
                        <Text style={{ color: colors.navyDeep, fontSize: 12, fontWeight: '700' }}>
                          ✓
                        </Text>
                      )}
                    </View>
                    <Text
                      style={{
                        color: item.isLocked ? colors.goldPrimary : colors.textSecondary,
                        marginRight: 10,
                        fontSize: 16
                      }}
                    >
                      {item.isLocked ? '🔒' : '🔓'}
                    </Text>
                    <Text style={{ color: colors.textPrimary, fontSize: 15, flex: 1 }}>
                      {item.displayName}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={{ flexDirection: 'row', gap: 12, marginVertical: 16 }}>
              <TouchableOpacity
                style={[shared.primaryButton, { flex: 1, marginTop: 0 }]}
                disabled={busy}
                onPress={runLock}
              >
                <Text style={shared.primaryButtonText}>
                  🔒 Lock{selected.size > 0 ? ` (${selected.size})` : ' All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[shared.secondaryButton, { flex: 1, marginTop: 0 }]}
                disabled={busy}
                onPress={runUnlock}
              >
                <Text style={shared.secondaryButtonText}>
                  🔓 Unlock{selected.size > 0 ? ` (${selected.size})` : ' All'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
