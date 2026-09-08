/**
 * Los esqueletos de carga.
 *
 * La regla del proyecto (ver `CLAUDE.md`): lo que tarda se dibuja como el hueco que va a
 * ocupar, nunca como una pantalla en blanco ni como una ruleta.
 *
 * Una ruleta no dice cuánto falta ni qué va a aparecer. Una pantalla en blanco, en una
 * conexión de barra y media, se lee como que la aplicación se rompió — y quien la abrió
 * la cierra. El esqueleto dice las dos cosas que hacen falta: está llegando, y va a tener
 * esta forma.
 *
 * Cada pieza copia las medidas de lo que sustituye. Un esqueleto que no mide lo mismo
 * provoca al llegar el contenido exactamente el salto que venía a evitar.
 *
 * `aria-hidden`: para un lector de pantalla esto no existe. Anunciar «línea, línea,
 * círculo» es peor que el silencio; quien avisa de que se está cargando es el texto de
 * estado de la vista, no el dibujo.
 */

/** Tarjetas del feed. */
export function FeedSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="feed" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skel-card">
          <div className="skel skel-title" />
          <div className="skel skel-line" />
          <div className="skel skel-line" />
          <div className="skel skel-line skel-line-short" />
        </div>
      ))}
    </div>
  );
}

/** Filas de la lista de puntos. */
export function ListSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skel-row">
          <div className="skel skel-av" />
          <div className="skel-rowtext">
            <div className="skel skel-title" />
            <div className="skel skel-line skel-line-short" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** El cuerpo de una ficha o un panel mientras carga. */
export function PanelSkeleton() {
  return (
    <div className="dbody" aria-hidden="true">
      <div className="skel skel-title" style={{ height: 22, width: "70%", marginTop: 18 }} />
      <div className="skel skel-line" style={{ width: "40%" }} />
      <div className="skel" style={{ height: 64, borderRadius: 12, margin: "18px 0" }} />
      <div className="skel skel-line" />
      <div className="skel skel-line" />
      <div className="skel skel-line skel-line-short" />
    </div>
  );
}
