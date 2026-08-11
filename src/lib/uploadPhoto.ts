// Client-side image compression.
//
// Ported from the original app, where it was tuned against real uploads on real phones:
// it bakes EXIF orientation (photos stop arriving sideways), never upscales, flattens
// transparency onto white (PNGs stop going black and compress far better as JPEG), and
// steps quality down only as far as needed to stay under a byte budget, shrinking
// dimensions only as a last resort. The result is a predictable upload size on flaky 3G
// without trashing the detail that made the photo worth sending.
//
// This base has no photo upload yet — it is here so a clone that adds one (a photo of a
// shelter, a handwritten list) does not have to rediscover any of the above. The upload
// half of the original module was left out deliberately: it wrote to Supabase Storage
// buckets that this schema does not provision.

// Tuning. Defaults target reunification PHOTOS (faces): 1024px longest side is plenty
// for a recognizable face, and we trim JPEG quality only as far as needed to stay under
// a predictable byte budget — so a good photo stays sharp and a huge one still rides a
// flaky 3G upload. `subir listas` (handwritten patient lists for OCR) overrides these
// with higher resolution/quality, where detail matters more than bytes.
export interface CompressOpts {
  maxDim?: number; // cap on the longest side (never upscales past the source)
  targetBytes?: number; // soft ceiling for the encoded image
  startQuality?: number; // initial JPEG quality
  minQuality?: number; // floor before we shrink dimensions instead
}
const DEFAULTS: Required<CompressOpts> = {
  maxDim: 1024,
  targetBytes: 280 * 1024, // ~280 KB — good face quality, light on data
  startQuality: 0.82,
  minQuality: 0.5,
};
// Bigger budget for OCR list photos: text needs resolution to stay legible.
export const LIST_OPTS: CompressOpts = { maxDim: 2200, targetBytes: 1100 * 1024, startQuality: 0.85, minQuality: 0.6 };

// Estimate the decoded byte size of a base64 data URL without allocating a Blob.
function estBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  return Math.floor(((dataUrl.length - comma - 1) * 3) / 4);
}

// Decode a File to something drawable, baking EXIF orientation so phone photos aren't
// sideways. Prefers createImageBitmap (applies orientation + off-main-thread decode);
// falls back to an <img> for older browsers.
async function decodeImage(file: File): Promise<{ w: number; h: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { w: bmp.width, h: bmp.height, draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h) };
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("decode_failed"));
      i.src = url;
    });
    return { w: img.naturalWidth, h: img.naturalHeight, draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Resize + compress a selected File into a JPEG data URL. Rejects on read error.
export async function compressImage(file: File, opts?: CompressOpts): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not_an_image");
  const { maxDim, targetBytes, startQuality, minQuality } = { ...DEFAULTS, ...opts };

  const src = await decodeImage(file);
  let scale = Math.min(1, maxDim / Math.max(src.w, src.h)); // never upscale

  let out = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const w = Math.max(1, Math.round(src.w * scale));
    const h = Math.max(1, Math.round(src.h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no_canvas");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Flatten any transparency onto white so PNGs don't turn black as JPEG and compress
    // smaller (alpha bytes are wasted on a face).
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    src.draw(ctx, w, h);

    // Drop quality step by step until under the byte budget.
    let q = startQuality;
    out = canvas.toDataURL("image/jpeg", q);
    while (estBytes(out) > targetBytes && q > minQuality) {
      q = Math.max(minQuality, q - 0.08);
      out = canvas.toDataURL("image/jpeg", q);
    }
    // Good enough, or we can't shrink dimensions meaningfully anymore.
    if (estBytes(out) <= targetBytes || scale <= 0.35) break;
    // Still too heavy even at min quality → shrink the canvas and retry.
    scale *= 0.8;
  }
  return out;
}

// Uploads a JPEG data URL to the intake bucket and returns the public URL of the
// object (this is what the DB column `foto_url` stores and n8n writes to the
// spreadsheet). Throws on failure so the queue can decide to retry.
// NOTE: the URL is only openable if the bucket is public-read.
