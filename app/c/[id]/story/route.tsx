import { ImageResponse } from "next/og";
import { supabasePublic } from "@/lib/supabase/server";
import { fetchCenter } from "@/data/centers";
import { ogCenterData } from "@/features/share/ogData";
import { OG_FORMAT, parseOgFormat, trimText } from "@/lib/ogFormat";
import { BRAND, COUNTRY, LANGUAGE, MAPCFG } from "@/config";
import { daysSince, lastTouched } from "@/domain/center";
import { translator } from "@/i18n";
import { currentEmergencyId } from "@/server/emergency";

/**
 * Social banner for a help point: what it RECEIVES and what it NEEDS now, so the need
 * itself can be shared and acted on. Ported from the original app.
 *
 * Instagram has no share-URL intent, so the image IS the share. Three canvases via
 * `?f=`: story 1080×1920 (default), post 1080×1350 (4:5 feed) and square — see
 * `src/lib/ogFormat.ts` for why the type scale and the gap scale are separate knobs.
 *
 * The status pill and "actualizado hace N días" ride along with the need on purpose: a
 * shared image circulates for days, and one that says "necesita agua" for a point that
 * has closed is actively harmful.
 */

const INK = "#0B0E13";
const HAIRLINE = "rgba(255,255,255,0.12)";

async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const t = translator(LANGUAGE.default);

  const sb = supabasePublic();
  const center = sb ? await fetchCenter(sb, id, await currentEmergencyId()).catch(() => null) : null;
  if (!center) return new Response("Not found", { status: 404 });

  const d = ogCenterData(center);
  const fmt = parseOgFormat(req.url);
  const F = OG_FORMAT[fmt];
  // T scales type and boxes, G scales the vertical rhythm — a shorter canvas needs the
  // air squeezed much harder than the text.
  const T = (n: number) => Math.round(n * F.ts);
  const G = (n: number) => Math.round(n * F.gs);

  const accent = d.accent;
  const need = trimText(d.need, F.maxNeed);
  const receives = d.receives.slice(0, F.maxRecibe);
  const days = daysSince(lastTouched(center));
  const stale = days != null && days >= MAPCFG.staleAfterDays;

  const logo = BRAND.logo ? await loadImage(new URL(req.url).origin + BRAND.logo) : null;

  const eyebrow = (
    <div style={{ display: "flex", alignItems: "center", gap: T(18) }}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} width={T(54)} height={T(54)} alt="" style={{ borderRadius: T(15) }} />
      ) : (
        <div
          style={{
            width: T(54),
            height: T(54),
            borderRadius: T(15),
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: INK,
            fontSize: T(30),
            fontWeight: 800,
          }}
        >
          {COUNTRY.code}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: T(30), fontWeight: 700, letterSpacing: 1, color: "#FFFFFF" }}>
          {BRAND.name.toUpperCase()}
        </div>
        <div style={{ fontSize: T(19), letterSpacing: 4, color: "#9AA3AF" }}>{t("og.helpPoint")}</div>
      </div>
    </div>
  );

  const typePill = (
    <div style={{ display: "flex", alignItems: "center", gap: T(20) }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: T(16),
          padding: `${T(14)}px ${T(30)}px`,
          borderRadius: 999,
          background: "rgba(255,255,255,0.06)",
          border: `2px solid ${accent}`,
          fontSize: T(34),
          fontWeight: 700,
          letterSpacing: 1,
          color: "#FFFFFF",
        }}
      >
        <div style={{ width: T(20), height: T(20), borderRadius: T(10), background: accent, display: "flex" }} />
        {d.typeLabel}
      </div>
      {d.status ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: `${T(12)}px ${T(26)}px`,
            borderRadius: 999,
            background: d.status.bg,
            color: d.status.fg,
            fontSize: T(30),
            fontWeight: 800,
            letterSpacing: 1,
          }}
        >
          {d.status.label}
        </div>
      ) : null}
      {center.info?.is_animal ? (
        <div style={{ display: "flex", alignItems: "center", fontSize: T(28), fontWeight: 600, color: "#9AA3AF" }}>
          🐾 {t("center.animal")}
        </div>
      ) : null}
    </div>
  );

  const identity = (
    <div style={{ display: "flex", alignItems: "stretch", gap: T(26) }}>
      <div style={{ width: T(8), borderRadius: T(8), background: accent, display: "flex" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: G(12) }}>
        <div style={{ fontSize: T(78), fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, color: "#FFFFFF" }}>
          {d.name}
        </div>
        {d.place ? (
          <div style={{ fontSize: T(34), color: "#9AA3AF", display: "flex" }}>📍 {d.place}</div>
        ) : null}
      </div>
    </div>
  );

  const needBlock = need ? (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: G(14),
        padding: T(34),
        borderRadius: T(26),
        background: "rgba(245,158,11,0.10)",
        border: `1px solid ${accent}`,
      }}
    >
      <div style={{ fontSize: T(26), letterSpacing: 3, fontWeight: 700, color: accent, display: "flex" }}>
        {t("og.needs")}
      </div>
      <div style={{ fontSize: T(44), fontWeight: 600, lineHeight: 1.25, color: "#FFFFFF", display: "flex" }}>
        {need}
      </div>
    </div>
  ) : null;

  const receiveBlock = receives.length ? (
    <div style={{ display: "flex", flexDirection: "column", gap: G(16) }}>
      <div style={{ fontSize: T(24), letterSpacing: 3, fontWeight: 700, color: "#9AA3AF", display: "flex" }}>
        {t("og.receives")}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: T(14) }}>
        {receives.map((x, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              padding: `${T(12)}px ${T(24)}px`,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${HAIRLINE}`,
              fontSize: T(30),
              fontWeight: 600,
              color: "#E5E8EC",
            }}
          >
            {x.charAt(0).toUpperCase() + x.slice(1)}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const meta =
    center.info?.schedule || d.contact ? (
      <div style={{ display: "flex", flexDirection: "column", gap: G(10) }}>
        {center.info?.schedule ? (
          <div style={{ fontSize: T(28), color: "#C9D0D9", display: "flex" }}>🕒 {center.info.schedule}</div>
        ) : null}
        {d.contact ? (
          <div style={{ fontSize: T(28), color: "#C9D0D9", display: "flex" }}>📞 {d.contact}</div>
        ) : null}
      </div>
    ) : null;

  const footer = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ height: 1, background: HAIRLINE, marginBottom: G(26) }} />
      {/* When the data is from. A reader of a shared post has no other way to judge
          whether it still holds. */}
      {d.updatedLabel ? (
        <div
          style={{
            fontSize: T(24),
            color: stale ? "#F59E0B" : "#9AA3AF",
            display: "flex",
            marginBottom: G(14),
            fontWeight: 600,
          }}
        >
          {d.updatedLabel}
        </div>
      ) : null}
      {d.attribution ? (
        <div
          style={{
            fontSize: T(22),
            color: "#6B7280",
            display: "flex",
            marginBottom: G(24),
            maxWidth: 900,
            lineHeight: 1.3,
          }}
        >
          {d.attribution}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: G(8) }}>
          <div style={{ fontSize: T(24), letterSpacing: 3, color: "#9AA3AF" }}>
            {t("needs.listSubtitle").toUpperCase()}
          </div>
          <div style={{ fontSize: T(52), fontWeight: 800, color: "#FFFFFF", letterSpacing: -1 }}>
            {COUNTRY.host}
          </div>
        </div>
        {BRAND.contact.instagram ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ fontSize: T(24), fontWeight: 700, color: "#9AA3AF", display: "flex" }}>
              @{BRAND.contact.instagram}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: F.pad,
          background: "linear-gradient(160deg, #161C26 0%, #0B0E13 62%)",
          fontFamily: "sans-serif",
        }}
      >
        {eyebrow}
        <div style={{ display: "flex", flexDirection: "column", gap: G(40) }}>
          {typePill}
          {identity}
          {needBlock}
          {receiveBlock}
          {meta}
        </div>
        {footer}
      </div>
    ),
    { width: F.w, height: F.h },
  );
}
