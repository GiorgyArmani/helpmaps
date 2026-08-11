# HelpMaps

Mapa cívico de emergencia, replicable por país. Muestra dónde hay ayuda disponible
(refugios, comedores, puntos de acopio, iniciativas ciudadanas) y qué necesita cada punto
ahora mismo.

**Este repositorio es la base que se mantiene y se clona.** Cada país es una clonación con
su propia carpeta `config/`, su propia base de datos y su propio subdominio. Las mejoras
que entran aquí bajan a todos los despliegues.

```
helpmaps.net          hub: la red, la documentación de la API, los términos
co.helpmaps.net      Colombia
ve.helpmaps.net       Venezuela
```

---

## Clonar para un país nuevo

Cuatro pasos. El primero es el único que toca código.

### 1. Configurar el país

Todo lo que cambia entre países vive en `config/`. Nada bajo `src/` sabe en qué país
corre; si te encuentras escribiendo el nombre de un país, una coordenada, un color o una
frase fuera de `config/`, va en el lugar equivocado.

| Archivo | Qué decide |
| --- | --- |
| `config/presets/<pais>.ts` | Identidad, regiones, encuadre del mapa, marco legal |
| `config/country.ts` | Cuál de esos presets sirve esta clonación |
| `config/brand.ts` | Nombre, colores, logo, radios, tipografía, contacto |
| `config/language.ts` | Idioma principal, idiomas disponibles, vocabulario local |
| `config/features.ts` | Qué módulos están encendidos |
| `config/map.ts` | Teselas, tipos de punto, colores, agrupación, caducidad |
| `config/integrations.ts` | Correo, analítica, fuentes externas, PWA |
| `config/network.ts` | La red de países (alimenta el mapa del hub) |
| `config/deployment.ts` | Si esta clonación es `country` o `hub` |

Para un país que ya tiene preset basta con `NEXT_PUBLIC_COUNTRY=co`. Para uno nuevo, copia
`config/presets/_template.ts`, complétalo e impórtalo en `config/country.ts`.

**Localización sin conflictos de merge:** no edites `src/i18n/dictionaries/`. Cambia
palabras desde `config/language.ts`, que pisa el diccionario clave por clave y sobrevive
intacto cuando esta clonación traiga cambios del repo base.

```ts
// config/language.ts
overrides: {
  es: { "type.shelter": "Albergue", "type.shelter.plural": "Albergues" },
}
```

### 2. Su propia base de datos

Un proyecto de Supabase **por país**. Corre los archivos de `db/` en orden en el editor
SQL. Son idempotentes.

```
db/001_core.sql          locations + center_info + app_settings + lectura pública
db/002_staff.sql         roles, is_staff()/is_admin(), escritura de staff
db/003_submissions.sql   sugerencias del público y solicitudes de voluntariado
db/004_audit_log.sql     bitácora append-only por trigger
db/005_donations.sql     directorio de donaciones (+ su bitácora)
```

El primer administrador no se puede crear desde la app (haría falta ser administrador).
Crea el usuario en *Authentication → Users* y luego, con su UUID:

```sql
insert into public.staff_users (user_id, role, email)
values ('<uuid>', 'admin', 'tu@correo.net')
on conflict (user_id) do update set role = 'admin';
```

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

Luego apunta `<pais>.helpmaps.net` al despliegue y añádelo a `config/network.ts` para que
aparezca en el mapa de la portada.

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

Código abierto. Los datos publicados se ofrecen bajo CC BY 4.0; la cartografía base es de
OpenStreetMap (ODbL).
