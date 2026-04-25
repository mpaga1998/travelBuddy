/**
 * Client-side image resize + re-encode before upload.
 *
 * Why: users pick 12 MP iPhone photos (~5 MB) to attach to pins/avatars.
 * Uploading them full-size wastes bandwidth and storage when the max render
 * size is ~800px anyway. This shrinks to a sensible max dimension and
 * re-encodes to JPEG at 0.85 quality before upload.
 *
 * Fallback behavior: if anything goes wrong (decode fails, canvas missing,
 * result is bigger than source), the original File is returned unchanged —
 * upload still works, we just don't get the saving.
 */

const DEFAULT_MAX_DIM = 1920;
const DEFAULT_QUALITY = 0.85;
const TARGET_MAX_BYTES = 2 * 1024 * 1024; // 2 MB "good enough" ceiling

export type CompressOpts = {
  /** Longest-edge cap in pixels. Default 1920. */
  maxDimension?: number;
  /** JPEG quality 0-1. Default 0.85. */
  quality?: number;
  /** If source is already under this and under maxDimension, skip work. */
  targetMaxBytes?: number;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export async function compressImage(
  file: File,
  opts: CompressOpts = {},
): Promise<File> {
  const maxDim = opts.maxDimension ?? DEFAULT_MAX_DIM;
  const quality = opts.quality ?? DEFAULT_QUALITY;
  const targetMax = opts.targetMaxBytes ?? TARGET_MAX_BYTES;

  if (!file.type.startsWith('image/')) return file;
  // GIFs would lose animation on canvas re-encode, and SVGs are already tiny.
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

  try {
    const img = await loadImage(file);
    const { naturalWidth: w0, naturalHeight: h0 } = img;

    const longestEdge = Math.max(w0, h0);
    if (longestEdge <= maxDim && file.size <= targetMax) return file;

    const scale = longestEdge > maxDim ? maxDim / longestEdge : 1;
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob) return file;

    // If re-encoding somehow made it bigger (e.g. already-compressed source),
    // keep the original.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('Image compression failed, using original:', err);
    return file;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Returns a human-readable error string if the file is not a valid image
 * upload, or null if it's fine. Callers should compress AFTER this check
 * passes.
 */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Please select an image file.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);
    return `Image too large (max ${mb} MB).`;
  }
  return null;
}
