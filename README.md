# HelpMaps

Mapa cívico de emergencia, replicable por país. Muestra dónde hay ayuda disponible
(refugios, comedores, puntos de acopio, iniciativas ciudadanas) y qué necesita cada punto
ahora mismo.

**Un repositorio, muchos despliegues.** No se hace un fork por país: cada país es un
archivo de preset dentro de este repo, y un despliegue es ese repo con otra variable de
entorno y otra base de datos. Un `git push` actualiza todos los países a la vez.

```
helpmaps.net          hub: la red, la documentación de la API, los términos
co.helpmaps.net       Colombia      NEXT_PUBLIC_COUNTRY=co
es.helpmaps.net       España        NEXT_PUBLIC_COUNTRY=es
id.helpmaps.net       Indonesia     NEXT_PUBLIC_COUNTRY=id
pe.helpmaps.net       Perú          NEXT_PUBLIC_COUNTRY=pe
ve.helpmaps.net       Venezuela     NEXT_PUBLIC_COUNTRY=ve
```

Fork solo si un país necesita divergir de verdad (otro nombre de plataforma, funciones que
la base no tiene). Es una salida de emergencia, no el camino: un fork debe un merge en
cada arreglo que entre aquí, y los archivos que chocan son justo los que ese país editó.

---

## Añadir un país

Cuatro pasos. El primero es el único que toca código.

### 1. Configurar el país

Todo lo que cambia entre países vive en `config/`. Nada bajo `src/` sabe en qué país
corre; si te encuentras escribiendo el nombre de un país, una coordenada, un color o una
frase fuera de `config/`, va en el lugar equivocado.

Un país es **un archivo**: copia `config/presets/_template.ts` a
`config/presets/<pais>.ts`, complétalo e impórtalo en `config/country.ts`. Si el preset ya
existe, no hay nada que editar: basta con `NEXT_PUBLIC_COUNTRY=co`.

El preset lleva la geografía **y lo que ese país hace distinto** del resto de la red:

```ts
// config/presets/colombia.ts
brand:    { logo: "/colombia.png" },
features: { donations: false },
language: { overrides: { es: { "type.shelter": "Albergue" } } },
```

Lo que omites sigue al kit compartido, y lo sigue cuando la base mejore. Ese es el reparto:

| Archivo | Qué decide | De quién es |
| --- | --- | --- |
| `config/presets/<pais>.ts` | Identidad, regiones, encuadre, marco legal, **y sus overrides** | del país |
| `config/country.ts` | Qué presets existen y cuál sirve por defecto | de la red |
| `config/brand.ts` | Colores, radios, tipografía **compartidos** | de la red |
| `config/language.ts` | Idioma y vocabulario **compartidos** | de la red |
| `config/features.ts` | Qué módulos ofrece la red por defecto | de la red |
| `config/map.ts` | Teselas, tipos de punto, colores, agrupación, caducidad | de la red |
| `config/integrations.ts` | Correo, analítica, fuentes externas, PWA | de la red |
| `config/network.ts` | La red de países (alimenta el mapa del hub) | de la red |
| `config/deployment.ts` | Si este despliegue es `country` o `hub` | del entorno |

Un valor de un país dentro de un archivo compartido es un error, aunque compile: `logo`
vivió en `config/brand.ts` con el valor `"/colombia.png"` y eso hacía que desplegar
con `NEXT_PUBLIC_COUNTRY=ve` diera "HelpMaps Venezuela" con el logo de Colombia.

**Localización sin conflictos de merge:** no edites `src/i18n/dictionaries/`. El bloque
`language.overrides` del preset pisa el diccionario clave por clave y sobrevive intacto
cuando bajen cambios de la base. Colombia lo usa para decir "Albergue" donde el
diccionario dice "Refugio", que es la palabra que usan sus alcaldías y su prensa.

**La configuración se valida al construir.** `src/config/validate.ts` revienta el build si
el preset tiene `TODO` sin completar, regiones repetidas, límites invertidos, un centro de
mapa fuera de esos límites o un `NEXT_PUBLIC_COUNTRY` que no existe — antes eso último
servía el país por defecto en silencio bajo el dominio equivocado. Solo lanza en servidor:
un error de configuración nunca debe dejar en blanco la pantalla de quien busca ayuda.

### 2. Su propia base de datos

Un proyecto de Supabase **por país**. Tres archivos, en orden, en el editor SQL. Son
idempotentes.

```
db/01_esquema.sql        el esquema entero: 15 tablas, 45 políticas, 13 funciones,
                         14 triggers, los índices y RLS en todas. Agnóstico de país.
db/02_emergencia.sql     qué país es este despliegue: viewport, estados, marca, aviso
                         legal, umbrales sísmicos, medios de prensa. Es LA PLANTILLA.
db/03_verificacion.sql   simula el rol `anon` y comprueba que nada personal quede
                         expuesto. Sólo lectura; córrelo tras cada cambio de esquema.
```

⚠️ `db/schema.sql` **no sirve para esto**: es un volcado de contexto —lo dice en su
primera línea— y no lleva ni una política, ni RLS, ni funciones, ni triggers. Una base
levantada desde ahí deja `submissions`, `volunteer_requests`, `audit_log`, `staff_users`
y `profiles` al alcance de cualquiera con la anon key, que es pública por diseño.

El primer administrador no se puede crear desde la app (haría falta ser administrador).
Crea el usuario en *Authentication → Users* y luego, con su UUID:

```sql
insert into public.staff_users (user_id, role, email)
values ('<uuid>', 'admin', 'tu@correo.net')
on conflict (user_id) do update set role = 'admin';
```

#### Autenticación del proyecto (tres ajustes, y los tres importan)

Las cuentas de persona no las crea `supabase.auth.signUp()` sino la ruta
`/api/account/register`, para que el correo salga por el SMTP del despliegue y para que
el registro no se convierta en un oráculo de direcciones. Eso obliga a tres cosas en
*Authentication* del proyecto, y saltarse cualquiera deja el registro roto de una forma
distinta:

| ajuste | dónde | si falta |
| --- | --- | --- |
| **Allow new users to sign up: OFF** | Providers → Email | Queda abierta la API de auth de Supabase: registro sin límite de tasa nuestro y sin comprobar contraseñas filtradas |
| **Confirm email: ON** | Providers → Email | Cualquiera entra con el correo de otro |
| **`https://<host>/cuenta` en Redirect URLs** | URL Configuration | Supabase rechaza el `redirectTo` y el enlace del correo aterriza en otro sitio: la persona confirma y llega sin sesión |

Y `SUPABASE_SERVICE_ROLE_KEY` deja de ser opcional si quieres registro: sin ella
`/api/account/register` responde 503. El `host` de esas Redirect URLs tiene que ser el
que el navegador ve de verdad — si el apex redirige a `www`, va el `www`.

### 3. Variables de entorno

Copia `.env.example` a `.env.local` (o cárgalas en el proveedor de hosting). Lo mínimo
para arrancar: `NEXT_PUBLIC_COUNTRY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 4. Desplegar y apuntar el subdominio

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
```

**Un proyecto de Vercel por país, todos apuntando a ESTE repositorio.** Lo que los
distingue son sus variables de entorno, no su código:

| Proyecto | Variables | Dominio |
| --- | --- | --- |
| `helpmaps-hub` | `NEXT_PUBLIC_MODE=hub` | helpmaps.net |
| `helpmaps-co` | `NEXT_PUBLIC_COUNTRY=co` + Supabase de Colombia | co.helpmaps.net |
| `helpmaps-ve` | `NEXT_PUBLIC_COUNTRY=ve` + Supabase de Venezuela | ve.helpmaps.net |
| `helpmaps-pe` | `NEXT_PUBLIC_COUNTRY=pe` + Supabase de Perú | pe.helpmaps.net |
| `helpmaps-es` | `NEXT_PUBLIC_COUNTRY=es` + Supabase de España | es.helpmaps.net |
| `helpmaps-id` | `NEXT_PUBLIC_COUNTRY=id` + Supabase de Indonesia | id.helpmaps.net |

Así se mantiene: un `git push` a este repo los reconstruye todos. No hay merges entre
países ni versiones que se queden atrás, porque no hay más que una.

**El boletín de prensa se regenera por cron, no solo.** `vercel.json` programa
`GET /api/news/cron` cada cuatro horas en cada proyecto. Para que Vercel llegue con
credencial, cada proyecto necesita `CRON_SECRET` con el mismo valor que
`NEWS_CRON_SECRET` (y `OPENROUTER_API_KEY` si quieres la síntesis). Sin `CRON_SECRET` el
cron recibe 401 y el boletín se queda en la fecha del último generado a mano.

Luego añade el país a `config/network.ts` para que aparezca en el mapa de la portada.

---

## Cómo está organizado

```
config/            ← lo único que cambia entre países
db/                ← esquema SQL, idéntico en todos los despliegues
app/               ← rutas (delgadas: resuelven datos y componen features)
src/
  config/          ensambla y valida el kit de configuración → SITE
  domain/          tipos + reglas del negocio (estado, caducidad, filtros)
  data/            consultas a Supabase, una sola lista de columnas por tabla
  i18n/            diccionarios y contexto de idioma
  ui/              primitivas sin conocimiento del dominio
  features/        map · centers · share · suggest · volunteer · admin · hub · app
  lib/             supabase, rate limit, sanitización
```

Dos reglas que sostienen todo lo demás:

- **Nada bajo `src/` conoce el país.** Lee `SITE` y ya.
- **El componente no decide nada del dominio.** «¿Está caducado?», «¿pide ayuda?»,
  «¿coincide con la búsqueda?» viven en `src/domain/center.ts` y se prueban ahí. Fue así
  como el despliegue anterior terminó con un componente de 5.000 líneas: cada respuesta a
  una de esas preguntas se escribió tres veces, en tres sitios.

---

## Decisiones que conviene no revertir sin leer esto

**El color del pin es el TIPO de punto, nunca un estado.** En la versión anterior el pin
tomaba el color del peor estado que hubiera dentro y un hospital se pintaba del gris de
«fallecido»: el número al lado se leía como un conteo de muertos.

**`status: null` significa desconocido, y así se muestra.** Nada, en ninguna capa, asume
«abierto» por defecto: la API lo documenta, la ficha no pinta insignia y el aviso de
cerrado va *encima* de las necesidades. Mandar a una familia a una puerta cerrada es el
peor fallo posible de esta aplicación.

**Las regiones son texto, no un enum de Postgres.** El esquema anterior exigía
`ALTER TYPE` antes de poder insertar una sola fila en una región nueva, en plena
emergencia. Ahora las regiones válidas viven en el preset. El costo aceptado: un INSERT
manual puede escribir una región que la app no conoce; el panel las marca en amarillo.

**Los voluntarios publican en vivo.** No hay cola de revisión delante de ellos: lo que
sostiene la confianza es que el acceso es revocable y que cada escritura la registra un
trigger de base de datos que nadie puede olvidarse de llamar. Borrar sigue siendo solo de
administradores.

**El público nunca escribe el mapa.** Las sugerencias entran en una cola que cualquiera
puede llenar y nadie de fuera puede leer; una persona las publica.

**El aviso de privacidad es texto y un enlace, no una casilla obligatoria.** Quien reporta
que un refugio se quedó sin agua no debería tener que superar una barrera de consentimiento
primero.

---

## Estado

Funciona y está listo para desplegar el núcleo cívico:

- Portada de entrada `/inicio` (la del QR impreso): «¿necesitas ayuda o quieres ayudar?»,
  con lo publicado hoy leído de la base. Se muestra **una vez por navegador** (`proxy.ts`)
  y quien vuelve entra directo al mapa. Se apaga con `features.entryPage`
- Mapa con agrupación por zonas, filtros por región y por tipo, búsqueda sin acentos
- Ficha del punto: estado, frescura, qué necesita, qué recibe, cómo llegar, contacto
- Lista de «dónde hace falta ayuda» y compartir por WhatsApp/Telegram/enlace
- Página compartible por punto (`/c/<id>`) con vista previa de enlace
- Formularios públicos: sugerir un punto, sumarse al equipo (ambos con límite por IP)
- Correo: aviso al buzón del equipo por cada sugerencia y cada solicitud, y bienvenida al
  voluntariado. Las plantillas se arman con la marca (`config/brand.ts`) y con textos que
  `config/language.ts` puede pisar, así que un clon no toca HTML para tener las suyas
- Directorio de donaciones: organizaciones que reciben aportes, con sus datos para donar
  y el enlace para verificarlas, más el formulario con el que una organización pide
  aparecer (llega por correo al equipo; no escribe nada en la base)
- Panel del equipo: alta y edición de puntos con búsqueda de dirección, cola de
  sugerencias, solicitudes de voluntariado, donaciones, bitácora, modo mantenimiento
- Alta de voluntariado de punta a punta: aprobar una solicitud crea la cuenta, le da el
  rol y le manda por correo la clave temporal y el manual (`/api/staff/volunteers`). Si el
  correo no sale, el panel muestra la clave para pasarla a mano
- API pública `GET /api/v1/centers` + OpenAPI 3.1 generado desde la propia configuración
- Hub `helpmaps.net`: mapa de países desplegados, documentación de la API, términos
- Caché local: el mapa abre con los últimos datos aunque no haya señal, y lo avisa

**Sin implementar todavía** (los interruptores existen en `config/features.ts` y están
apagados; no los enciendas esperando que aparezca algo): listas de personas ingresadas
(`patients`), red de rescatados (`rescued`) y reporte de desaparecidos
(`missingReports`). Son los módulos que quedan por portar desde el despliegue de
Venezuela.

**No verificado en navegador.** El build y el chequeo de tipos pasan, pero nadie ha
abierto todavía el mapa con datos reales: hay que probar los pines, la agrupación al
alejar el zoom, la hoja inferior en un teléfono estrecho y el alta de un punto de punta a
punta antes de anunciar el despliegue.

---

## Licencia

**[MIT](./LICENSE).** Se puede usar, modificar, redistribuir y desplegar comercialmente,
conservando el aviso de copyright. Las contribuciones se aceptan bajo esa misma licencia
—*inbound equals outbound*— sin ningún acuerdo aparte que firmar: ver
[`CONTRIBUTING.md`](./CONTRIBUTING.md).

Los **datos publicados** por cada despliegue se ofrecen bajo
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); la **cartografía base** es de
OpenStreetMap (ODbL) con teselas de CARTO, y las capas sísmicas son de USGS. Esas tres
atribuciones son condición de licencia, no cortesía: van visibles en el mapa y no se quitan. El
inventario completo, con su evidencia, está en
[`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md).

## Comunidad y seguridad

| | |
| --- | --- |
| [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) · [español](./CODE_OF_CONDUCT.es.md) | Cómo se participa aquí |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Licencia de las contribuciones, DCO, y las reglas que no se negocian |
| [`SECURITY.md`](./SECURITY.md) | Cómo reportar una vulnerabilidad, qué es grave y las reglas de prueba |
| [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md) | Todo lo de terceros que el proyecto usa o muestra |
| `db/03_verificacion.sql` | Verifica que RLS protege lo que debe. Córrelo tras cada cambio de esquema |

Los problemas de seguridad o privacidad **no van en un issue público**: escribe a
info@helpmaps.net con `[SECURITY]` en el asunto.
