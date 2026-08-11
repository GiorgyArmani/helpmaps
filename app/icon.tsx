import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { BRAND } from "@/config";

// The tab icon and the PWA icon (app/manifest.ts points both at this route), drawn from
// the brand config so a clone gets its own without anyone exporting a PNG.
//
// `BRAND.logo` wins and `BRAND.emoji` is the fallback — the order `config/brand.ts` has
// always documented ("se usa cuando no hay logo") but this route did not implement: it
// rendered the emoji unconditionally, so a deployment that set a logo and left the emoji
// empty (which is exactly what Colombia does) shipped a blank coloured square as its
// favicon while the header showed the real mark.

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/**
 * The logo as a data URI.
 *
 * Read off disk rather than fetched from our own origin: this route is prerendered at
 * build time, when there is no server of ours listening to fetch it from.
 */
async function logoDataUri(): Promise<string | null> {
  const logo = BRAND.logo;
  if (!logo) return null;
  const ext = path.extname(logo).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return null;
  try {
    // `logo` is a public-relative path from our own config, never user input; `basename`
    // is belt and braces so a stray "../" in a clone's config cannot read outside public.
    const file = path.join(process.cwd(), "public", path.basename(logo));
    const bytes = await readFile(file);
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    // Missing or unreadable file: fall through to the emoji rather than failing the
    // build over an icon.
    return null;
  }
}

export default async function Icon() {
  const src = await logoDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.colors.accent,
          color: "#ffffff",
          fontSize: 300,
          overflow: "hidden",
        }}
      >
        {/* Rendered by satori inside ImageResponse, not by a browser, so next/image
            does not apply here. */}
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" width={size.width} height={size.height} style={{ objectFit: "cover" }} />
        ) : (
          BRAND.emoji
        )}
      </div>
    ),
    size,
  );
}
