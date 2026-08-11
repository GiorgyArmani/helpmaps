// Social image formats for the shareable banners (/p/[id]/story, /c/[id]/story).
//
// The banner started as an Instagram STORY only (1080×1920, 9:16). The team also
// posts these to the FEED, where a 9:16 image gets cropped/letterboxed and reads
// badly — so the same layout is rendered at feed ratios too:
//
//   story  1080×1920 (9:16) — stories / status / reels cover
//   post   1080×1350 (4:5)  — feed post, the tallest ratio IG shows uncropped
//   square 1080×1080 (1:1)  — feed post that keeps the profile grid uniform
//
// One layout, three canvases: `ts` scales TYPE (font sizes, paddings, icon boxes)
// and `gs` scales the VERTICAL rhythm (gaps between blocks), because a shorter
// canvas needs the air squeezed much harder than the text. `maxNeed`/`maxRecibe`
// trim the variable-length content so a busy record still fits the shorter frames.
export type OgFormat = "story" | "post" | "square";

export type OgFormatSpec = {
  w: number;
  h: number;
  pad: number;
  /** type scale — font sizes, paddings, fixed boxes */
  ts: number;
  /** gap scale — vertical rhythm between blocks */
  gs: number;
  /** height of the bleed photo in the patient "with photo" composition */
  photoH: number;
  /** scrim over that photo — the fade must land on ink BEFORE the photo ends, so the
   *  shorter the photo, the earlier it starts (a late fade leaves a hard cut). */
  scrim: string;
  maxNeed: number;
  maxRecibe: number;
};

const scrim = (clearTo: number, fadeFrom: number) =>
  `linear-gradient(180deg, rgba(11,14,19,0.55) 0%, rgba(11,14,19,0) 24%, rgba(11,14,19,0) ${clearTo}%, rgba(11,14,19,0.7) ${fadeFrom}%, #0B0E13 100%)`;

export const OG_FORMAT: Record<OgFormat, OgFormatSpec> = {
  story: { w: 1080, h: 1920, pad: 72, ts: 1, gs: 1, photoH: 1260, scrim: scrim(50, 80), maxNeed: 220, maxRecibe: 6 },
  post: { w: 1080, h: 1350, pad: 64, ts: 0.86, gs: 0.6, photoH: 880, scrim: scrim(44, 74), maxNeed: 170, maxRecibe: 5 },
  square: { w: 1080, h: 1080, pad: 56, ts: 0.76, gs: 0.45, photoH: 700, scrim: scrim(34, 64), maxNeed: 120, maxRecibe: 4 },
};

// Trim variable-length copy to the canvas budget on a WORD boundary — a hard
// slice leaves stumps like "…autismo) (" on the shorter frames.
export function trimText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:(–-]+$/, "") + "…";
}

// `?f=post` (aliases: `format=`, and `feed` → post). Anything unknown falls back
// to the story banner, so existing links keep working unchanged.
export function parseOgFormat(url: string): OgFormat {
  const v = (new URL(url).searchParams.get("f") || new URL(url).searchParams.get("format") || "").toLowerCase();
  if (v === "post" || v === "feed") return "post";
  if (v === "square" || v === "1x1") return "square";
  return "story";
}
