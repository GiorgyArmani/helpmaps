import { NextResponse } from "next/server";
import { currentEmergencyId } from "@/server/emergency";
import { fetchDirectory } from "../../organizaciones/directory";

/**
 * El directorio de organizaciones, para buscar la tuya al crear la cuenta (`/registro`).
 *
 * Es lo mismo que `/organizaciones` ya pinta en su página —nombre, tipo y municipio de
 * lugares publicados—, sin coordenadas ni contacto. Va aparte y no dentro de `/registro`
 * porque sólo lo necesita quien dice que representa una organización: quien busca ayuda
 * no tiene por qué descargar cientos de nombres con una barra de señal.
 *
 * `fetchDirectory` ya está en caché; además se deja cachear en el borde unos minutos.
 */
export async function GET() {
  const directory = await fetchDirectory(await currentEmergencyId());
  const rows = directory.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    municipality: d.municipality,
    region: d.region,
  }));
  return NextResponse.json(rows, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
