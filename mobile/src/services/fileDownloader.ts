import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { notificationService } from './notificationService';

export interface DownloadResult {
  success: boolean;
  uri: string | null;
  filename: string;
  error?: string;
  userCancelled?: boolean;
}

export function sanitizeDownloadFilename(name: string, fallback: string): string {
  if (!name || typeof name !== 'string') return fallback;
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Downloads a remote file (PDF, Excel, etc.) to the local device storage,
 * verifies its physical integrity, and makes it available via SAF or Native Sharing.
 */
export async function downloadAndSaveFile(options: {
  url: string;
  rawFilename: string;
  extension: 'pdf' | 'xlsx' | 'csv';
  mimeType: string;
  headers?: Record<string, string>;
  dialogTitle?: string;
  showShareFallbackOnAndroid?: boolean;
  forceRefresh?: boolean;
}): Promise<DownloadResult> {
  const { url, rawFilename, extension, mimeType, headers, dialogTitle, showShareFallbackOnAndroid, forceRefresh = false } = options;
  const cleanName = sanitizeDownloadFilename(rawFilename, `ECDIAL_Export_${Date.now()}`);
  const targetFilename = cleanName.endsWith(`.${extension}`) ? cleanName : `${cleanName}.${extension}`;

  try {
    // 1. Download or reuse local cache sandbox
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    const exportsDir = `${cacheDir}exports/`;
    const dirInfo = await FileSystem.getInfoAsync(exportsDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(exportsDir, { intermediates: true }).catch(() => {});
    }
    const tempUri = `${exportsDir}${targetFilename}`;

    // Check if valid local cached file already exists
    const existingFile = await FileSystem.getInfoAsync(tempUri);
    const hasValidCache = existingFile.exists && typeof (existingFile as any).size === 'number' && (existingFile as any).size > 100;

    let targetUri = tempUri;
    if (!hasValidCache || forceRefresh) {
      if (forceRefresh) {
        await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
      }
      const downloadResult = await FileSystem.downloadAsync(url, tempUri, { headers: headers || {} });

      if (!downloadResult || downloadResult.status !== 200) {
        return {
          success: false,
          uri: null,
          filename: targetFilename,
          error: `Server responded with HTTP ${downloadResult?.status || 'Error'}.`,
        };
      }
      targetUri = downloadResult.uri;
    }

    // 2. Physical File Integrity Verification
    const fileInfo = await FileSystem.getInfoAsync(targetUri);
    if (!fileInfo.exists || typeof (fileInfo as any).size !== 'number' || (fileInfo as any).size < 100) {
      return {
        success: false,
        uri: null,
        filename: targetFilename,
        error: 'Downloaded file is empty or corrupted.',
      };
    }

    // 3. Android Scoped Storage / SAF vs iOS Share Sheet
    if (Platform.OS === 'android') {
      try {
        // Try StorageAccessFramework to save directly to public folder (e.g. Downloads)
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64Data = await FileSystem.readAsStringAsync(targetUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            targetFilename,
            mimeType
          );

          await FileSystem.writeAsStringAsync(createdFileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Trigger local download completion notification
          await notificationService.sendLocalNotification(
            'Download Complete',
            `${targetFilename} has been saved to your selected folder.`
          );

          return {
            success: true,
            uri: createdFileUri,
            filename: targetFilename,
          };
        }
      } catch (safErr) {
        console.warn('[SAF Save Note]', safErr);
      }

      // If user cancelled SAF or SAF is unavailable, use native Share/Save dialog
      if (showShareFallbackOnAndroid && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(targetUri, {
          mimeType,
          dialogTitle: dialogTitle || `Save ${targetFilename}`,
          UTI: extension === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
        });

        return {
          success: true,
          uri: targetUri,
          filename: targetFilename,
        };
      }
    } else {
      // iOS: Trigger native share / quick-look save sheet
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetUri, {
          mimeType,
          dialogTitle: dialogTitle || `Save ${targetFilename}`,
          UTI: extension === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
        });
      }
    }

    // Trigger local notification
    await notificationService.sendLocalNotification(
      'File Ready',
      `${targetFilename} is downloaded and ready.`
    );

    return {
      success: true,
      uri: targetUri,
      filename: targetFilename,
    };
  } catch (err: any) {
    console.error('[Download Service Error]', err);
    return {
      success: false,
      uri: null,
      filename: targetFilename,
      error: err.message || 'File download failed.',
    };
  }
}

/**
 * Native Sharing of local or remote PDF / Excel document
 */
export async function shareDocument(options: {
  url?: string;
  localUri?: string;
  rawFilename: string;
  extension: 'pdf' | 'xlsx';
  mimeType: string;
  headers?: Record<string, string>;
}): Promise<{ success: boolean; error?: string }> {
  const { url, localUri, rawFilename, extension, mimeType, headers } = options;

  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: 'Sharing is not supported on this device.' };
    }

    let fileToShare = localUri;

    // If only URL provided, download to cache first
    if (!fileToShare && url) {
      const cleanName = sanitizeDownloadFilename(rawFilename, `ECDIAL_Share_${Date.now()}`);
      const targetFilename = cleanName.endsWith(`.${extension}`) ? cleanName : `${cleanName}.${extension}`;
      const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const exportsDir = `${cacheDir}exports/`;
      const dirInfo = await FileSystem.getInfoAsync(exportsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(exportsDir, { intermediates: true }).catch(() => {});
      }
      const tempPath = `${exportsDir}${targetFilename}`;
      const existingInfo = await FileSystem.getInfoAsync(tempPath);
      if (existingInfo.exists && typeof (existingInfo as any).size === 'number' && (existingInfo as any).size > 100) {
        fileToShare = tempPath;
      } else {
        const res = await FileSystem.downloadAsync(url, tempPath, { headers: headers || {} });
        if (res && res.status === 200 && res.uri) {
          fileToShare = res.uri;
        }
      }
    }

    if (!fileToShare) {
      return { success: false, error: 'Could not prepare document for sharing.' };
    }

    // Verify file exists
    const info = await FileSystem.getInfoAsync(fileToShare);
    if (!info.exists) {
      return { success: false, error: 'File does not exist on device.' };
    }

    await Sharing.shareAsync(fileToShare, {
      mimeType,
      dialogTitle: `Share ${rawFilename}`,
      UTI: extension === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
    });

    return { success: true };
  } catch (err: any) {
    console.error('[Share Document Error]', err);
    return { success: false, error: err.message || 'Sharing failed.' };
  }
}
