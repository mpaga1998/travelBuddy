/**
 * Supabase Storage image transformation helper.
 *
 * Supabase's public object URLs look like:
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *
 * To get a resized variant we rewrite `/object/public/` to
 * `/render/image/public/` and append query params (width, height, resize,
 * quality). The `/render/image/` endpoint is only available on paid plans;
 * on the free tier it 404s. To keep the app working in any environment we
 * gate the rewrite on a build-time env flag — when disabled, the original
 * URL is returned unchanged and the browser downloads the full-res asset
 * (same behavior as before 3.5).
 *
 * To enable transforms, set in `.env`:
 *   VITE_SUPABASE_IMG_TRANSFORMS=true
 *
 * If the URL is falsy or not a Supabase storage URL (e.g. an external CDN),
 * it is returned unchanged regardless of the flag.
 */

const TRANSFORMS_ENABLED =
  import.meta.env?.VITE_SUPABASE_IMG_TRANSFORMS === 'true';

export type ImageTransformOpts = {
  width?: number;
  height?: number;
  /** 'cover' crops to fit, 'contain' fits whole image inside the box */
  resize?: 'cover' | 'contain' | 'fill';
  /** JPEG/WebP quality 20-100 */
  quality?: number;
};

export function transformImageUrl(
  url: string | null | undefined,
  opts: ImageTransformOpts = {},
): string {
  if (!url) return '';
  if (!TRANSFORMS_ENABLED) return url;
  if (!/\/storage\/v1\/(object|render\/image)\/public\//.test(url)) return url;

  const rendered = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/',
  );

  const params = new URLSearchParams();
  if (opts.width) params.set('width', String(opts.width));
  if (opts.height) params.set('height', String(opts.height));
  if (opts.resize) params.set('resize', opts.resize);
  if (opts.quality) params.set('quality', String(opts.quality));

  const qs = params.toString();
  if (!qs) return rendered;

  const sep = rendered.includes('?') ? '&' : '?';
  return `${rendered}${sep}${qs}`;
}

// Presets sized 1.5-2x the target render box so retina displays get crisp
// images without downloading multi-MB originals for 140px thumbnails.

export const imgAvatar = (url: string | null | undefined) =>
  transformImageUrl(url, { width: 220, height: 220, resize: 'cover', quality: 80 });

export const imgThumbnail = (url: string | null | undefined) =>
  transformImageUrl(url, { width: 320, height: 320, resize: 'cover', quality: 75 });

export const imgDetail = (url: string | null | undefined) =>
  transformImageUrl(url, { width: 800, height: 600, resize: 'cover', quality: 80 });

export const imgPopup = (url: string | null | undefined) =>
  transformImageUrl(url, { width: 480, height: 240, resize: 'cover', quality: 80 });

export const imgLightbox = (url: string | null | undefined) =>
  transformImageUrl(url, { width: 1600, height: 1200, resize: 'contain', quality: 85 });
