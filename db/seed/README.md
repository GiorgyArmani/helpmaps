# db/seed — datos de Venezuela para un proyecto Supabase nuevo

Los datos reales del despliegue de `helpmapvzla.net`, traducidos al esquema base.
No es una copia del volcado viejo: cada columna está renombrada al esquema que
consulta este repo (`locations.id`, `center_info`), y las restricciones del
esquema base ya están verificadas contra estos datos.

| archivo | qué siembra | filas |
| --- | --- | --- |
| `ve_010_puntos.sql` | refugios, puntos de acopio y comedores + sus necesidades | 497 puntos · 476 con necesidades |
| `ve_020_hospitales.sql` | los hospitales del despliegue viejo — **opcional** | 23 puntos |

## Orden en un proyecto nuevo

En el editor SQL de Supabase, un archivo a la vez:

```
db/01_esquema.sql             el esquema entero
db/02_emergencia.sql          qué emergencia sirve este despliegue
db/seed/ve_010_puntos.sql     ← aquí el mapa deja de estar vacío
db/seed/ve_020_hospitales.sql opcional
db/03_verificacion.sql        verificación, no cambia nada
```

Los puntos van DESPUÉS de `02_emergencia.sql` y no antes: `locations.emergency_id`
referencia a `emergencies`, así que sembrar primero deja 520 filas huérfanas que luego
hay que adoptar a mano.

`ve_010_puntos.sql` va pegado al esquema: es lo que separa un mapa vacío de uno
útil. Si prefieres sembrar más
tarde también funciona — el archivo apaga los triggers de auditoría mientras
inserta, para no enterrar el historial real bajo mil filas de siembra.

Después: pon la URL y la anon key del proyecto nuevo en `.env`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) y deja
`NEXT_PUBLIC_COUNTRY=ve`.

## Lo que estos archivos conservan

- **Las fechas originales.** `created_at`, `updated_at` y `last_confirmed_at`
  son los del dato real, no la hora de la siembra. Poner `now()` en todo diría
  «actualizado hace un minuto» en cientos de puntos que nadie ha confirmado, y esa
  fecha es justo la que una familia usa para decidir si vale la pena el viaje.
- **`external_id`** (467 de 476 filas): es la llave con la que se casan las
  fuentes de origen — AcopioVE, RefugioVE, las hojas de las brigadas. Sin ella una
  resincronización crea duplicados en vez de actualizar.
- **`source`**: de dónde salió cada punto. Es lo que permite volver a preguntar.
- **Las direcciones**, movidas de `refugios` a `locations`, que es donde el
  esquema base las pone. 430 filas las tienen.

`on conflict do nothing` en todos: re-correrlos no pisa nada. Si un punto ya
existe, lo que el equipo haya editado después es más reciente que esto.

## Los hospitales van aparte a propósito

En la app vieja eran el anclaje de la búsqueda de personas ingresadas — una
función que este repo no tiene y cuyos datos de pacientes ya se purgaron. El
esquema base admite el tipo `hospital`, así que si los siembras salen como pines
en el mapa, sin nada detrás. Siémbralos solo si quieres que el mapa muestre dónde
están los hospitales.

## No confundir con `db/900_migrate_ve_legacy.sql`

Ese archivo es **el otro camino**: renombra en sitio la base vieja de Venezuela en
lugar de poblar una nueva, y al terminar la app vieja deja de funcionar. Los dos
caminos llegan al mismo esquema; **no corras los dos**. Si siembras un proyecto
nuevo con esta carpeta, `900` no se toca.
