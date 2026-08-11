import type { Metadata } from "next";
import { DocShell, DocSection } from "../DocShell";
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

      <DocSection heading={`1. Configurar el país`}>
        <p>
          Todo lo que cambia entre países vive en la carpeta <code>config/</code>. Se copia la
          plantilla de país, se completa con las divisiones administrativas, el encuadre del mapa y
          la ley que aplica, y se ajustan la marca, el idioma y las funciones activas.
        </p>
        <code className="code">{`config/
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
