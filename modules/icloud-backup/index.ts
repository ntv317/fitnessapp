import { requireOptionalNativeModule } from 'expo-modules-core';

export interface BackupInfo {
  fileName: string;
  size: number;
  modifiedAt: number; // epoch ms
  isDownloaded: boolean;
}

export interface ICloudBackupNativeModule {
  isICloudAvailable(): boolean;
  uploadBackup(localPath: string, fileName: string): Promise<BackupInfo>;
  listBackups(): Promise<BackupInfo[]>;
  downloadBackup(fileName: string, destinationPath: string): Promise<void>;
  deleteBackup(fileName: string): Promise<void>;
  replaceDatabaseFile(sourcePath: string, destPath: string): Promise<void>;
  removeLocalFile(path: string): Promise<void>;
}

// Optional: null on Android, in jest, or before the native build includes it.
const ICloudBackup = requireOptionalNativeModule<ICloudBackupNativeModule>('ICloudBackup');

export default ICloudBackup;
