import { currentEmergency } from "@/server/emergency";
import { supabasePublic } from "@/lib/supabase/server";
import { fetchBulletins } from "@/data/news";
import { newsEnabled } from "@/domain/news";
import BulletinBody from "@/features/news/BulletinBody";

/**
 * The press bulletin on the entry page.
 *
 * A server component that reads the published bulletin and renders it: no client
 * JavaScript, no fetch after paint. This is the page someone opens from a printed QR on
 * one bar of signal, and a section that arrives second is a section they scroll past.
 *
 * Renders NOTHING when the emergency has no feeds configured or nothing has been generated
 * yet. An empty "latest news" panel on a disaster map reads as "nothing is being
 * reported", which is worse than not offering it at all.
 */
export default async function NewsSection() {
  const emergency = await currentEmergency();
  if (!emergency || !newsEnabled(emergency.news)) return null;

  const sb = supabasePublic();
  if (!sb) return null;

  const bulletins = await fetchBulletins(sb, emergency.id, 1);
  const latest = bulletins[0];
  if (!latest) return null;

  const when = new Date(latest.generated_at);
  const failed = latest.sources.filter((s) => s.error);

  return (
    <section className="entry-news" aria-labelledby="entry-news-h">
      <div className="entry-news-head">
        <h2 id="entry-news-h" className="entry-news-h">
          Qué se está reportando
        </h2>
        <time dateTime={latest.generated_at} className="entry-news-when">
          {when.toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </time>
      </div>

      <BulletinBody text={latest.summary} />

      <p className="entry-news-src">
        {latest.model
          ? "Resumen generado automáticamente a partir de "
          : "Titulares recogidos de "}
        {latest.sources.filter((s) => !s.error).map((s) => s.name).join(", ")}.
        {latest.model ? " Puede contener errores: seguí el enlace al medio antes de darlo por cierto." : null}
      </p>

      {/* Un medio caído se dice. Si no, un boletín corto se lee como "no pasó nada" cuando
          en realidad la mitad de las fuentes no contestó. */}
      {failed.length > 0 ? (
        <p className="entry-news-src">
          Sin respuesta en esta corrida: {failed.map((s) => s.name).join(", ")}.
        </p>
      ) : null}
    </section>
  );
}
