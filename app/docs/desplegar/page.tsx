import type { Metadata } from "next";
import { DocShell, DocSection, repoLabel } from "../DocShell";
import { BRAND } from "@/config";

export const metadata: Metadata = {
  title: `Desplegar ${BRAND.platform} en tu país`,
  description: `Qué hace falta para poner ${BRAND.platform} en marcha en un país nuevo.`,
};

/**
 * "How to bring HelpMaps to your country" — the public face of the clone checklist that
 * lives in the repo's README. Written for the person deciding, not only for the person
 * who will run the commands: the honest part is the last section.
 */
export default function DeployPage() {
  return (
    <DocShell base="/docs/desplegar" title={`Desplegar ${BRAND.platform} en tu país`} lead={`Qué hace falta para poner ${BRAND.platform} en marcha en un país nuevo.`}>

      {/* El enlace al código, arriba del todo. Quien llega a esta página ya decidió mirar:
          antes solo lo encontraba enterrado en una frase de los términos, y desde aquí no
          había forma de llegar al repositorio sin buscarlo por fuera. */}
      {BRAND.contact.repo ? (
        <a
          className="doc-tile doc-tile-feature doc-repo-tile"
          href={BRAND.contact.repo}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="doc-tile-chev" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </span>
          <span className="doc-tile-ic">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.73.5.7 5.53.7 11.8c0 4.96 3.22 9.16 7.69 10.65.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.32-3.79-1.32-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.94.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.44.11-3 0 0 .95-.3 3.1 1.16a10.7 10.7 0 0 1 5.65 0c2.15-1.46 3.1-1.16 3.1-1.16.61 1.56.23 2.71.11 3 .72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.28-5.15 5.56.4.35.76 1.04.76 2.1v3.11c0 .3.2.65.78.54a11.32 11.32 0 0 0 7.68-10.65C23.3 5.53 18.27.5 12 .5Z" />
            </svg>
          </span>
          <span className="doc-tile-title">El código, en GitHub</span>
          <p className="doc-tile-desc">
            {repoLabel(BRAND.contact.repo)} — clónalo, audítalo y despliégalo. Licencia MIT.
          </p>
        </a>
      ) : null}

      <DocSection heading={`1. Configurar el país`}>
        <p>
          Todo lo que cambia entre países vive en la carpeta <code>config/</code>. Se copia la
          plantilla de país, se completa con las divisiones administrativas, el encuadre del mapa y
          la ley que aplica, y se ajustan la marca, el idioma y las funciones activas.
        </p>
        <code className="code">{`git clone ${BRAND.contact.repo || ""}

config/
  presets/<pais>.ts   identidad, regiones, encuadre, marco legal
  brand.ts            nombre, colores, logo, contacto
  language.ts         idioma principal y vocabulario local
  features.ts         qué módulos se encienden
  map.ts              tipos de punto, colores, agrupación
  integrations.ts     correo, analítica, fuentes externas
  network.ts          la red de países`}</code>
      </DocSection>

      <DocSection heading={`2. Su propia base de datos`}>
        <p>
          Cada país tiene un proyecto de base de datos separado. Nada de un país se puede leer desde
          otro, y eso no depende de una regla que alguien pueda configurar mal: son bases distintas.
          También permite que un equipo local administre su despliegue sin acceso al resto.
        </p>
        <p>
          El esquema está en <code>db/</code> y son cuatro archivos que se corren en orden. Crean las
          tablas, las reglas de acceso y la bitácora.
        </p>
      </DocSection>

      <DocSection heading={`3. Un subdominio`}>
        <p>
          El despliegue queda en <code>&lt;pais&gt;.helpmaps.net</code>. Se añade a la red para que
          aparezca en el mapa de la portada.
        </p>
      </DocSection>

      <DocSection heading={`4. Lo que de verdad hace falta`}>
        <p>
          La parte técnica se resuelve en una tarde. Lo que decide si el mapa sirve es lo otro:
        </p>
        <ul>
          <li>
            <strong>Un equipo local</strong> que verifique los puntos. Un mapa sin nadie confirmando
            envejece en días y empieza a mandar gente a lugares que ya cerraron.
          </li>
          <li>
            <strong>Datos con los que empezar.</strong> Un mapa con cinco puntos se lee como que aquí
            no pasó nada. Conviene arrancar con una zona bien cubierta antes que con el país entero
            a medias.
          </li>
          <li>
            <strong>Quién responde legalmente</strong> por los datos en ese país, con un correo que
            alguien lea.
          </li>
        </ul>
      </DocSection>

      <DocSection heading={`Escríbenos`}>
        <p>
          <a href={`mailto:${BRAND.contact.email}`}>{BRAND.contact.email}</a>
        </p>
      </DocSection>
    </DocShell>
  );
}
