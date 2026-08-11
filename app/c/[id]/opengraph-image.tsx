import { ImageResponse } from "next/og";
import { supabasePublic } from "@/lib/supabase/server";
import { fetchCenter } from "@/data/centers";
import { ogCenterData } from "@/features/share/ogData";
import { BRAND, COUNTRY, LANGUAGE } from "@/config";
import { translator } from "@/i18n";

/**
 * Link-preview card for a help point.
 *
 * This is what WhatsApp and Telegram render when someone pastes the link, and those two
 * apps are how this data actually travels. Ported from the original app; the need is on
 * the card because a preview that only says the place's name gives a reader no reason to
 * open it.
 */

export const alt = BRAND.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = translator(LANGUAGE.default);

  const sb = supabasePublic();
  const center = sb ? await fetchCenter(sb, id).catch(() => null) : null;
  const data = center ? ogCenterData(center) : null;

  const accent = data?.accent ?? "#F59E0B";
  const name = data?.name ?? BRAND.name;
  const typeLabel = data?.typeLabel ?? t("og.helpPoint");
  const place = data?.place || BRAND.tagline;
  const need = (data?.need ?? "").slice(0, 120);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#15181d",
          color: "#fff",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 24,
            color: "#cfd3d8",
            letterSpacing: 1,
          }}
        >
          <div style={{ width: 30, height: 30, borderRadius: 9, background: accent, display: "flex" }} />
          {typeLabel} · {BRAND.name.toUpperCase()}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.03, letterSpacing: -1 }}>{name}</div>
          <div style={{ fontSize: 30, color: "#a7adb6", display: "flex" }}>{place}</div>
          {need ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 32, color: "#fff" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: accent, display: "flex" }}>
                {t("og.needs")}:
              </div>
              {need}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data?.attribution ? (
            <div style={{ display: "flex", fontSize: 22, color: "#9aa3af", maxWidth: 1000, lineHeight: 1.3 }}>
              {data.attribution}
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: 26, color: "#7b818c" }}>
            {COUNTRY.host} · {BRAND.tagline}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
