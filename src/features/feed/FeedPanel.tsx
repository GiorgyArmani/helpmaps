"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { FeedItem, FeedMode } from "@/domain/feed";
import { formatKm } from "@/domain/nearby";
import { Icon } from "@/ui/icons";
import { formatAmount } from "@/features/centers/InitiativeSections";
import { useI18n, useTimeAgo } from "@/i18n/context";
import type { DictKey } from "@/i18n";
import { FeedSkeleton } from "@/ui/Skeleton";

/**
 * El feed: lo que está pasando cerca, en scroll.
 *
 * ── POR QUÉ TIENE ESPACIO PROPIO ────────────────────────────────────────────
 *
 * «Cerca» contesta «¿a qué puerta voy?» y es una lista de sitios. Esto contesta «¿qué
 * está pasando?» y es una lista de hechos: una iniciativa que cuenta lo que entregó, una
 * campaña que abre, un punto que dice qué le falta hoy. Mezclarlo con la lista de puntos
 * habría hecho que ninguna de las dos preguntas se contestara bien.
 *
 * ── LAS DOS CARAS ───────────────────────────────────────────────────────────
 *
 * La misma pregunta que hace `/inicio` en su portada desde el principio: ¿necesitas ayuda
 * o quieres ayudar? Son búsquedas opuestas sobre el mismo material, y el conmutador de
 * arriba reordena el feed entero. Quien necesita algo ve primero puntos abiertos y lo que
 * ofrecen; quien quiere ayudar ve necesidades y campañas.
 *
 * ── UNA TARJETA ES UN ENLACE, NO UN BOTÓN ───────────────────────────────────
 *
 * Tocar una publicación lleva al PERFIL de esa iniciativa, a esa misma publicación
 * (`/c/<punto>?post=<id>#p-<id>`), como en cualquier red social. Antes abría el panel del
 * mapa, que es otra cosa: enseña dónde queda, no lo que esa gente está contando.
 *
 * Y es un enlace de verdad —`<Link>`, con `href`— y no un botón que navega: así se puede
 * abrir en otra pestaña, copiar la dirección, compartirla, y un buscador la sigue. Una
 * publicación que no se puede enlazar no está publicada, está expuesta.
 *
 * ── EL SCROLL NO PIDE DATOS ─────────────────────────────────────────────────
 *
 * Lo que hay se descarga una vez y se pagina EN MEMORIA. Un scroll infinito que dispara
 * una consulta por página es una función de escritorio con fibra: aquí cada página nueva
 * sería otra espera con una barra de cobertura, justo mientras alguien lee. Se traen unos
 * cientos de elementos de golpe —que pesan poco— y el scroll sólo revela más.
 */
/**
 * A dónde lleva cada tarjeta.
 *
 * Al perfil siempre, pero a la parte que la tarjeta estaba enseñando: una publicación
 * abre en esa publicación, una campaña en la pestaña de campañas. Llevar las tres a la
 * cabecera obligaría a buscar otra vez, con el pulgar, lo que se acababa de ver.
 */
function hrefFor(item: FeedItem): string {
  if (item.kind === "post" && item.post) {
    return `/c/${item.center.id}?post=${item.post.id}#p-${item.post.id}`;
  }
  if (item.kind === "campaign") return `/c/${item.center.id}?tab=campaigns`;
  return `/c/${item.center.id}`;
}

export default function FeedPanel({
  items,
  mode,
  onMode,
  loading,
}: {
  items: FeedItem[];
  mode: FeedMode;
  onMode: (next: FeedMode) => void;
  loading: boolean;
}) {
  const { t, lang } = useI18n();
  const ago = useTimeAgo();
  // Cuántos se ven, GUARDADO JUNTO A LA CARA para la que se contaron.
  //
  // Cambiar de cara vuelve a empezar —seguir en la página siete de una lista que acaba de
  // cambiar entera deja a alguien mirando el fondo de otra cosa— y eso se DERIVA en vez
  // de corregirse desde un efecto, que encadena un render de más.
  const [page, setPage] = useState<{ mode: FeedMode; n: number }>({ mode, n: 20 });
  const visible = page.mode === mode ? page.n : 20;
  const centinela = useRef<HTMLDivElement | null>(null);

  // El centinela: cuando entra en pantalla, se revelan veinte más. `IntersectionObserver`
  // y no un manejador de scroll porque no despierta en cada píxel — importa en un
  // teléfono modesto, que es el aparato de referencia de este proyecto.
  useEffect(() => {
    const nodo = centinela.current;
    if (!nodo) return;
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setPage((p) => ({ mode, n: (p.mode === mode ? p.n : 20) + 20 }));
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(nodo);
    return () => io.disconnect();
  }, [mode]);

  const shown = useMemo(() => items.slice(0, visible), [items, visible]);

  return (
    <div className="feed">
      <div className="feed-modes" role="group" aria-label={t("feed.title")}>
        <button
          type="button"
          className={`feed-mode${mode === "help" ? " feed-mode-on" : ""}`}
          aria-pressed={mode === "help"}
          onClick={() => onMode("help")}
        >
          {t("feed.needHelp")}
        </button>
        <button
          type="button"
          className={`feed-mode${mode === "give" ? " feed-mode-on" : ""}`}
          aria-pressed={mode === "give"}
          onClick={() => onMode("give")}
        >
          {t("feed.wantHelp")}
        </button>
      </div>

      {/* Mientras llega, el hueco que va a ocupar. Antes esto era la nada: el conmutador
          de arriba y debajo blanco, que en una conexión lenta se lee como «no hay nada
          cerca de ti» — la conclusión contraria a la verdadera. */}
      {loading && items.length === 0 ? <FeedSkeleton /> : null}

      {!loading && items.length === 0 ? (
        <p className="empty">
          <b>{t("feed.empty")}</b>
          <br />
          {t("feed.emptyHint")}
        </p>
      ) : null}

      {shown.map((item) => (
        <article key={item.id} className="fitem">
          <Link className="fitem-head" href={hrefFor(item)}>
            <span className="fitem-name">{item.center.name}</span>
            <span className="fitem-meta">
              {item.saved ? (
                <span className="fitem-saved">
                  <Icon.heart />
                  {t("feed.saved")}
                </span>
              ) : null}
              {item.km !== null ? <span>{formatKm(item.km, lang)}</span> : null}
              {/* Sin fecha no se pinta nada. Ver `FeedItem.at`: inventarle una a un
                  punto que nunca se confirmó decía «hace 20704 días». */}
              {item.at ? <span>{ago(item.at)}</span> : null}
            </span>
          </Link>

          {item.kind === "post" && item.post ? (
            <>
              {item.post.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- bucket por país
                <img className="fitem-img" src={item.post.photo_url} alt="" loading="lazy" decoding="async" />
              ) : null}
              <p className="fitem-body">{item.post.body}</p>
            </>
          ) : null}

          {/* El AVANCE, no sólo la meta.
              Esto pintaba «de 200 cobijas» —sin el número de delante, que es medio frase
              en castellano— y con ello se perdía lo único que hace útil una campaña de
              un vistazo: cuánto llevan. La barra y la cifra son las mismas de la ficha,
              con el mismo formato, para que no parezcan dos datos distintos.
              La advertencia de que la cifra es DECLARADA vive en la ficha, a un toque:
              repetirla en cada tarjeta de un scroll infinito la convierte en ruido que
              se deja de leer, que es la forma más segura de que deje de avisar. */}
          {item.kind === "campaign" && item.campaign ? (
            <div className="fitem-camp">
              <b>{item.campaign.title}</b>
              <div className="icamp-bar">
                <span
                  className="icamp-fill"
                  style={{
                    width: `${Math.min(100, Math.round((item.campaign.raised_amount / item.campaign.goal_amount) * 100))}%`,
                  }}
                />
              </div>
              <span className="fitem-goal">
                <b>{formatAmount(item.campaign.raised_amount, lang)}</b>{" "}
                {t("campaign.of", {
                  goal: formatAmount(item.campaign.goal_amount, lang),
                  unit: item.campaign.goal_unit,
                })}
              </span>
            </div>
          ) : null}

          {item.kind === "need" ? (
            <p className="fitem-need">
              <span className="fitem-tag">{t("center.needsTitle")}</span>
              {item.center.info?.needs}
            </p>
          ) : null}

          {/* Lo que este punto OFRECE, para quien viene buscando ayuda: el tipo, si está
              abierto, y qué recibe. Nada de lo que pide — eso es la otra cara. */}
          {item.kind === "open" ? (
            <p className="fitem-open">
              <span className="fitem-tag fitem-tag-open">{t("status.abierto")}</span>
              {t(`type.${item.center.type}` as DictKey)}
              {item.center.info && item.center.info.receives.length > 0
                ? ` · ${item.center.info.receives.slice(0, 4).join(", ")}`
                : ""}
            </p>
          ) : null}
        </article>
      ))}

      {/* El centinela va SIEMPRE, incluso con la lista corta: si no, al llegar más
          material no habría nada que disparara la siguiente página. */}
      <div ref={centinela} aria-hidden="true" />

      {visible < items.length ? <p className="feed-more">{t("common.loading")}</p> : null}
    </div>
  );
}
