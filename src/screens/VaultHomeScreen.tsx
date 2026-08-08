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

  const [folderUri, setFolderUri] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState('');

  async function refresh(uri: string) {
    setFiles(await VaultFolderManager.listFiles(uri));
  }

  async function choosePress() {
    const uri = await VaultFolderManager.pickFolder();
    if (uri) {
      setFolderUri(uri);
      await refresh(uri);
    }
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
        <TouchableOpacity onPress={openSettings}>
          <Text style={{ color: colors.goldPrimary, fontSize: 15 }}>Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {!folderUri ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={[shared.sectionTitle, { textAlign: 'center' }]}>
              Select a folder on your USB drive to guard
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
                marginBottom: 12
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
                {files.length} files
              </Text>
              <TouchableOpacity onPress={choosePress}>
                <Text style={{ color: colors.goldPrimary }}>Change folder</Text>
              </TouchableOpacity>
            </View>

            {busy && (
              <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
                {progressText}
              </Text>
            )}

            <FlatList
              data={files}
              keyExtractor={(item) => item.uri}
              renderItem={({ item }) => (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#1E2E42'
                  }}
                >
                  <Text
                    style={{
                      color: item.isLocked ? colors.goldPrimary : colors.textSecondary,
                      marginRight: 10,
                      fontSize: 16
                    }}
                  >
                    {item.isLocked ? '🔒' : '🔓'}
                  </Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 15 }}>
                    {item.displayName}
                  </Text>
                </View>
              )}
            />

            <View style={{ flexDirection: 'row', gap: 12, marginVertical: 16 }}>
              <TouchableOpacity
                style={[shared.primaryButton, { flex: 1, marginTop: 0 }]}
                disabled={busy}
                onPress={() => runOp(VaultFolderManager.lockFolder)}
              >
                <Text style={shared.primaryButtonText}>🔒 Lock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[shared.secondaryButton, { flex: 1, marginTop: 0 }]}
                disabled={busy}
                onPress={() => runOp(VaultFolderManager.unlockFolder)}
              >
                <Text style={shared.secondaryButtonText}>🔓 Unlock</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
