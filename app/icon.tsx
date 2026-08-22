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

  // Sin logo propio se dibuja el isotipo del manual de marca, no un emoji sobre un
  // cuadro de color: el isotipo ES la marca, y el emoji era un relleno de cuando no
  // había una.
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F172A",
          overflow: "hidden",
        }}
      >
        {src ? (
          // Rendered by satori inside ImageResponse, not by a browser, so next/image
          // does not apply here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} width={512} height={512} alt="" />
        ) : (
          // Monocromático Dark: estructura blanca sobre negro profundo, la versión con
          // la que abre el manual de marca.
          <svg viewBox="0 0 920 920" width={512} height={512}>
            <rect fill="#0F172A" width="920" height="920" rx="253.78" />
            <path
              fill="#1E293B"
              d="M460,190 L520,380 L730,460 L520,540 L460,730 L400,540 L190,460 L400,380 Z"
            />
            <rect x="442" y="190" width="36" height="540" rx="18" fill="#FFFFFF" />
            <rect x="190" y="442" width="540" height="36" rx="18" fill="#FFFFFF" />
            <circle cx="460" cy="460" r="115" fill="#FFFFFF" />
            <circle cx="460" cy="190" r="54" fill="#FFFFFF" />
            <circle cx="730" cy="460" r="54" fill="#FFFFFF" />
            <circle cx="460" cy="730" r="54" fill="#FFFFFF" />
            <circle cx="190" cy="460" r="54" fill="#FFFFFF" />
          </svg>
        )}
      </div>
    ),
    { ...size },
  );
}
