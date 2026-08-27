import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { getSite } from "@/server/emergency";

const RegistryConsole = dynamic(() => import("@/features/registry/RegistryConsole"));

/**
 * The registry console.
 *
 * Kept out of the search index and out of the sitemap: it is a staff tool, and the gate is
 * RLS rather than obscurity, but there is no reason for it to be crawled either.
 */
export const metadata: Metadata = {
  title: "Registro de emergencias",
  robots: { index: false, follow: false },
};

export default async function EmergenciasPage() {
  const site = await getSite();
  return (
    <main className="regpage">
      <header className="regpage-h">
        <h1>Registro de emergencias</h1>
        <p>
          La configuración de cada despliegue de {site.brand.platform}: dónde está, cómo se
          llama, qué regiones cubre y qué módulos ofrece. Los datos de cada país viven en su
          propia base y no se administran desde acá.
        </p>
      </header>
      <RegistryConsole />
    </main>
  );
}
