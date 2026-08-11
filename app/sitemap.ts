import type { MetadataRoute } from "next";
import { FEATURES, IS_HUB, siteUrl } from "@/config";
import { supabasePublic } from "@/lib/supabase/server";
import { fetchCenters } from "@/data/centers";

export const revalidate = 3600;

/**
 * Static pages plus one entry per published point, because those URLs are the ones that
 * travel through chat apps and are worth being findable. If the database is unreachable
 * the sitemap degrades to the static pages instead of failing the build.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, priority: 1 },
    // The entry page is what a printed QR points at, so it is worth being findable too.
    ...(!IS_HUB && FEATURES.entryPage
      ? [{ url: `${base}/inicio`, lastModified: now, priority: 0.8 }]
      : []),
    { url: `${base}/docs/privacidad`, lastModified: now, priority: 0.3 },
    { url: `${base}/docs/terminos`, lastModified: now, priority: 0.3 },
    { url: `${base}/docs/api`, lastModified: now, priority: 0.5 },
    { url: `${base}/docs/desplegar`, lastModified: now, priority: IS_HUB ? 0.8 : 0.3 },
  ];

  if (IS_HUB) return staticPages;

  const sb = supabasePublic();
  if (!sb) return staticPages;

  try {
    const centers = await fetchCenters(sb);
    return [
      ...staticPages,
      ...centers.map((c) => ({
        url: `${base}/c/${c.id}`,
        lastModified: c.updated_at ? new Date(c.updated_at) : now,
        priority: 0.6,
      })),
    ];
  } catch {
    return staticPages;
  }
}
