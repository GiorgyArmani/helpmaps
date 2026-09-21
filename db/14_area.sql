-- ===========================================================================
-- HelpMaps · LA ZONA AFECTADA. Corre esto después de 01_esquema.sql.
-- ===========================================================================
--
-- Una emergencia pasa a tener zonas: los polígonos que dicen DÓNDE pegó.
--
-- ---------------------------------------------------------------------------
-- POR QUÉ UNA COLUMNA Y NO UNA CAPA MÁS DE `layers`
--
-- `layers` son fuentes de TERCEROS: una URL a un GeoJSON o a un servidor de teselas que
-- alguien más publica y mantiene. La aplicación las dibuja y no las entiende.
--
-- Esto es lo contrario. La zona la dibuja quien opera la emergencia, se guarda acá, y la
-- aplicación la LEE para contestar una pregunta concreta en el teléfono de quien mira:
-- «¿estoy dentro?». Eso no se puede hacer con una URL ajena, y meterlo en `layers` habría
-- obligado a publicar un archivo aparte cada vez que se corrige un vértice.
--
-- ---------------------------------------------------------------------------
-- PARA QUÉ SIRVE, ADEMÁS DE VERSE
--
-- Para los terremotos ya existe la huella real de sacudida: los contornos de intensidad
-- (MMI) que publica USGS, que `useQuakes` baja solos. Esta columna NO los reemplaza ni
-- compite con ellos — son una medición modelada y ganan siempre que existan.
--
-- Existe para todo lo demás. Una inundación, un incendio, un derrumbe, un conflicto: ahí
-- no hay ningún servicio mundial publicando la huella, y hasta hoy el mapa no tenía forma
-- de decir hasta dónde llegó. Y sirve para lo que el usuario pidió: varias zonas activas
-- en puntos distintos del país, cada una con su nombre y su gravedad, sin necesidad de
-- inventar varias emergencias sobre el mismo dominio (la resolución de
-- `src/server/emergency.ts` es de UNA emergencia por host, a propósito).
--
-- ---------------------------------------------------------------------------
-- LA FORMA
--
--   [
--     {
--       "id": "zulia-norte",            -- estable: es la identidad, sobrevive al renombre
--       "label": "Norte de Zulia",
--       "severity": 2,                  -- 1 aviso · 2 afectada · 3 grave
--       "ring": [[10.1,-71.9], … ],     -- [lat, lng], el orden de Leaflet. Mínimo 3.
--       "note": "Sin agua desde el martes"   -- opcional, una línea
--     }
--   ]
--
-- ⚠️ `ring` va en [lat, lng] y NO en el [lng, lat] de GeoJSON. Es deliberado: lo escribe y
-- lo lee el editor del mapa, que es Leaflet de punta a punta, y una sola convención dentro
-- de la columna evita el clásico de dibujar Venezuela en el Índico. Si algún día hay que
-- exportarlo como GeoJSON, se invierte AL SALIR, en un solo sitio.
--
-- El anillo se guarda ABIERTO (el último vértice no repite el primero). Lo cierra quien
-- dibuja, que es lo que hacen tanto Leaflet como el algoritmo de punto-en-polígono.
--
-- Vacío —`[]`, que es el valor por defecto— es el caso normal: una emergencia sin zonas
-- marcadas se comporta exactamente como antes de existir esta columna.
-- ===========================================================================

alter table public.emergencies
  add column if not exists area jsonb not null default '[]'::jsonb;

comment on column public.emergencies.area is
  'Zonas afectadas: [{id,label,severity:1..3,ring:[[lat,lng],…],note?}]. '
  'Anillo en orden Leaflet [lat,lng] y abierto. La dibuja el equipo desde el mapa.';


-- ---------------------------------------------------------------------------
-- QUIÉN LA ESCRIBE
--
-- Nadie nuevo: las políticas de `01_esquema.sql` ya cubren esta columna, porque RLS es por
-- FILA y no por columna. `emergencies_super_write` deja a un superadmin cambiar la fila
-- entera, y `emergencies_admin_notice` deja a un admin cambiar LA SUYA.
--
-- Eso último es intencional acá y conviene decirlo en voz alta, porque el comentario de
-- aquella política dice que un admin «no puede cambiar nada más de la fila» y eso lo
-- sostiene la interfaz, no la base. Para la zona afectada está bien que pueda: quien opera
-- la emergencia sobre el terreno es quien sabe hasta dónde llegó el agua, y hacerle pedir
-- un superadmin para mover un vértice es como se consigue que la zona esté desactualizada.
--
-- `src/data/emergencies.ts → saveEmergencyArea` escribe SÓLO esta columna, en vez de
-- reenviar la fila entera como hace el formulario del registro. Así un admin guarda su
-- zona sin poder llevarse por delante el encuadre o el marco legal en el mismo UPDATE.
-- ---------------------------------------------------------------------------


-- ===========================================================================
-- Verificación
--
--   select slug, status,
--          jsonb_array_length(area)                             as zonas,
--          (select string_agg(z->>'label', ', ')
--             from jsonb_array_elements(area) z)                as nombres
--     from public.emergencies
--    order by status, slug;
--
-- Una zona con menos de 3 vértices o con `severity` fuera de 1..3 la DESCARTA el lector
-- (`src/domain/area.ts → parseZones`) sin tumbar el mapa, igual que hace `parseLayers` con
-- una capa mal escrita. Si una zona no aparece, esa es la primera sospecha.
-- ===========================================================================
