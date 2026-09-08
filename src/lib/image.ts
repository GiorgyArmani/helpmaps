/**
 * Reducir una foto ANTES de subirla.
 *
 * ── POR QUÉ NO ES UN LUJO ───────────────────────────────────────────────────
 *
 * Una foto recién hecha con un teléfono ronda los 4000px de ancho y entre 3 y 8 MB. En la
 * publicación se ve a 360px. Subir el original significa tres cosas, todas malas:
 *
 *   1. **Muchas no subirían.** El bucket corta en 3 MB, así que la mitad de las fotos de un
 *      móvil moderno fallarían — y fallarían después de un minuto de espera.
 *   2. **La espera.** En la conexión desde la que se usa esto, 4 MB son minutos. Nadie
 *      publica dos veces después de eso.
 *   3. **El feed se arrastraría.** Cada tarjeta descargaría megabytes para pintar una
 *      miniatura, y el scroll infinito dejaría de ser fluido en el aparato de referencia de
 *      este proyecto, que es un teléfono modesto.
 *
 * A 1600px y calidad 0,82 la misma foto queda en torno a 150–250 KB. La diferencia no se ve
 * en pantalla y sí se nota en todo lo demás.
 *
 * ── WEBP CUANDO SE PUEDA ───────────────────────────────────────────────────
 *
 * Pesa un tercio menos que JPEG con la misma calidad aparente. `canvas.toBlob` devuelve
 * `null` o cambia de tipo si el navegador no lo soporta, y por eso el resultado se comprueba
 * en vez de darlo por hecho: un WebP servido como JPEG a un navegador viejo es una foto rota.
 *
 * ── SI ALGO FALLA, SE SUBE EL ORIGINAL ─────────────────────────────────────
 *
 * Un fallo aquí —un formato que el navegador no decodifica, memoria justa en un teléfono
 * viejo— no puede impedir publicar. Se devuelve el archivo tal cual y que decida el bucket.
 */

const LADO_MAX = 1600;
const CALIDAD = 0.82;

export async function shrinkImage(file: File): Promise<File> {
  // Un archivo ya pequeño no gana nada pasando por el lienzo, y sí pierde: recodificar
  // siempre degrada, aunque sea poco.
  if (file.size < 300_000) return file;
  if (typeof document === "undefined") return file;

  try {
    const bitmap = await crearBitmap(file);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    // Ya está por debajo del máximo: sólo se recomprime si además pesa de más.
    if (escala === 1 && file.size < 1_200_000) {
      cerrar(bitmap);
      return file;
    }

    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const lienzo = document.createElement("canvas");
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext("2d");
    if (!ctx) {
      cerrar(bitmap);
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    cerrar(bitmap);

    const blob = await aBlob(lienzo, "image/webp");
    if (!blob) return file;
    // Recodificar puede engordar una imagen ya optimizada. Si pasa, se queda la original.
    if (blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * `createImageBitmap` decodifica FUERA DEL HILO PRINCIPAL: la interfaz no se congela
 * mientras se abre una foto de ocho megapíxeles. `<img>` con un object URL decodifica en el
 * hilo principal y deja la pantalla clavada un segundo largo en un teléfono modesto. El
 * respaldo existe porque Safari tardó en traerlo.
 */
async function crearBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((ok, fallo) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = fallo;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cerrar(b: ImageBitmap | HTMLImageElement): void {
  if ("close" in b) b.close();
}

function aBlob(lienzo: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise((ok) => lienzo.toBlob(ok, tipo, CALIDAD));
}
