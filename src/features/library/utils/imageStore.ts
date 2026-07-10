import * as FileSystem from 'expo-file-system/legacy';

// expo-image-picker returns URIs in the app cache, which iOS may purge. Copy
// picked photos into the document directory so exercise reference images
// survive across launches.
const IMAGE_DIR = `${FileSystem.documentDirectory}exercise-images/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

/** True for anything that already resolves on its own (local file, remote URL) —
 *  as opposed to a bundled catalog image filename that needs CDN resolution. */
export function isResolvableUri(path: string): boolean {
  return path.includes('://');
}

/** Copies a picked image into persistent storage, returning the new file:// URI.
 *  Already-persisted images (inside IMAGE_DIR) are returned unchanged. */
export async function persistImage(uri: string): Promise<string> {
  if (uri.startsWith(IMAGE_DIR)) return uri;
  await ensureDir();
  const match = /\.(\w+)(?:\?.*)?$/.exec(uri);
  const ext = match ? match[1] : 'jpg';
  const dest = `${IMAGE_DIR}${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}
