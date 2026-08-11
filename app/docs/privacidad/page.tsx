import type { Metadata } from "next";
import { DocShell, DocSection } from "../DocShell";
import { BRAND, COUNTRY } from "@/config";

export const metadata: Metadata = {
  title: "Privacidad",
  description: `Qué datos trata ${BRAND.platform}, para qué, y cómo ejercer tus derechos.`,
};

/**
 * Privacy policy, written against the country config: the controller, the law and the
 * contact address all come from `config/presets/<pais>.ts`, so a clone does not inherit
 * another country's legal text — which would be both wrong and useless to its readers.
 */
export default function PrivacyPage() {
  return (
    <DocShell base="/docs/privacidad" title="Privacidad" lead={`Qué datos trata este despliegue, para qué, y cómo ejercer tus derechos.`}>

      <DocSection heading={`Qué publicamos`}>
        <p>
          {BRAND.platform} publica <strong>lugares</strong>, no personas: refugios, comedores, puntos de
          acopio e iniciativas ciudadanas, con su ubicación, su contacto público y lo que reciben o
          necesitan. Toda esa información está pensada para circular: para eso existe el mapa.
        </p>
      </DocSection>

      <DocSection heading={`Qué recogemos y nunca se publica`}>
        <ul>
          <li>
            <strong>Sugerencias del público:</strong> el texto que envías y, si lo dejas, tu nombre y
            tu contacto. El contacto se usa solo para confirmar el dato y no aparece en el mapa ni en
            la API.
          </li>
          <li>
            <strong>Solicitudes de voluntariado:</strong> nombre, correo, teléfono y perfil. Solo las
            ve el equipo que aprueba accesos.
          </li>
          <li>
            <strong>Bitácora interna:</strong> qué cambió, cuándo y quién lo hizo. Es lo que permite
            revocar un acceso y revisar un error; solo la ve el equipo.
          </li>
        </ul>
        <p>
          Ni las sugerencias ni las solicitudes se pueden leer de vuelta desde el navegador de otra
          persona: la base de datos permite crearlas y no permite listarlas sin ser del equipo.
        </p>
      </DocSection>

      <DocSection heading={`Búsquedas`}>
        <p>
          Lo que escribes en el buscador no sale de tu teléfono: el filtrado ocurre en tu propio
          navegador y no lo enviamos a ningún servidor ni lo guardamos. Tampoco usamos rastreadores
          publicitarios.
        </p>
      </DocSection>

      <DocSection heading={`Dónde vive la información`}>
        <p>
          Cada país tiene su propia base de datos, separada de la de los demás despliegues de
          {BRAND.platform}. La información de {COUNTRY.name} no se mezcla con la de otro país.
        </p>
      </DocSection>

      <DocSection heading={`Cuánto tiempo`}>
        <p>
          Los puntos permanecen mientras la emergencia siga activa. Al cerrarse la respuesta,
          retiramos la publicación y conservamos solo cifras agregadas, que no identifican a nadie.
          Las sugerencias y solicitudes ya revisadas se eliminan cuando dejan de ser necesarias.
        </p>
      </DocSection>

      <DocSection heading={`Tus derechos`}>
        <p>
          Puedes pedir acceso, corrección o eliminación de tus datos, y que retiremos un punto que
          hayas reportado, escribiendo a{" "}
          <a href={`mailto:${COUNTRY.legal.privacyEmail}`}>{COUNTRY.legal.privacyEmail}</a>.
          Respondemos por el mismo medio. Este tratamiento se rige por {COUNTRY.legal.dataLaw}.
        </p>
      </DocSection>

      <DocSection heading={`Si algo está mal`}>
        <p>
          Si ves un punto equivocado, desactualizado o que no debería estar publicado, escríbenos:
          corregirlo es más urgente que cualquier otra cosa en esta página.
        </p>
      </DocSection>
    </DocShell>
  );
}
