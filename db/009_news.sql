-- HelpMaps · boletín de prensa (9 de 9) — corre esto DESPUÉS de 008_tenancy.sql.
--
-- Idempotente.
--
-- ---------------------------------------------------------------------------
-- Qué resuelve
--
-- AcopioVE publica un boletín: agrega titulares de una docena de medios, descarta lo que
-- no habla de la emergencia y sintetiza el resto. Es lo primero que abre mucha gente que
-- no está buscando un refugio sino entendiendo qué está pasando.
--
-- Al traerlo hay que cambiarle dos cosas, y las dos por el mismo motivo — que ahí estaba
-- escrito para un país concreto:
--
--   • Los MEDIOS eran una lista fija en el código. Ahora los declara cada emergencia:
--     los diarios que cubren una inundación en otro país no son los mismos.
--   • El FILTRO DE RELEVANCIA cruzaba dos listas de palabras, una de emergencia
--     ("sismo", "réplica", "epicentro") y otra de lugares venezolanos. También se declaran
--     por emergencia: sin eso, un despliegue nuevo filtra por los estados de Venezuela.
--
-- Y una tercera, que es de infraestructura: la caché vivía en DISCO. Eso funciona en un
-- servidor de larga vida y no funciona en el despliegue de HelpMaps, donde el disco es
-- efímero y cada instancia tendría su propio boletín. Va a la base.
-- ---------------------------------------------------------------------------

-- Configuración del boletín, por emergencia.
--
--   {
--     "feeds":    [{ "id": "efectococuyo", "name": "Efecto Cocuyo", "url": "https://..." }],
--     "keywords": { "emergency": ["sismo", "réplica"], "place": ["caracas", "la guaira"] },
--     "refreshHours": 4
--   }
--
-- Vacío significa apagado: sin medios declarados no hay boletín, y la portada no muestra
-- una sección vacía donde debería haber noticias.
alter table public.emergencies add column if not exists news jsonb not null default '{}'::jsonb;


-- ---------------------------------------------------------------------------
-- Boletines generados.
--
-- Histórico, no una sola fila que se pisa. Dos razones: la portada ofrece navegar los
-- anteriores —lo que pasó ayer sigue importando cuando llevás tres días sin señal— y
-- porque un boletín es lo que una IA dijo en un momento dado sobre una emergencia real:
-- si alguna vez hay que revisar qué se publicó y cuándo, tiene que estar.
-- ---------------------------------------------------------------------------
create table if not exists public.news_bulletins (
  id            uuid primary key default gen_random_uuid(),
  emergency_id  uuid not null references public.emergencies(id) on delete cascade,
  generated_at  timestamptz not null default now(),
  summary       text not null,
  -- Qué medios entraron en ESTA corrida: si uno se cayó, el boletín no lo dice solo.
  sources       jsonb not null default '[]'::jsonb,
  -- El modelo que lo escribió. Un cambio de modelo cambia el tono y conviene poder verlo.
  model         text,
  created_at    timestamptz not null default now()
);

create index if not exists news_bulletins_emergency_idx
  on public.news_bulletins (emergency_id, generated_at desc);

alter table public.news_bulletins enable row level security;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Lectura pública: el boletín es contenido publicado, igual que el mapa.
--
-- Escritura: NINGUNA política, para nadie. Generar un boletín cuesta dinero —es una
-- llamada a un modelo de pago— y no puede dispararla un navegador. La única escritura
-- posible es la ruta de generación, con la clave de servicio y detrás de un secreto de
-- cron, igual que en AcopioVE. Sin política, la anon key no puede insertar ni aunque
-- alguien encuentre el endpoint.
-- ---------------------------------------------------------------------------
drop policy if exists news_bulletins_public_read on public.news_bulletins;
create policy news_bulletins_public_read on public.news_bulletins
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Verificación: último boletín de cada emergencia.
--   select e.slug, b.generated_at, left(b.summary, 80)
--   from public.emergencies e
--   left join lateral (
--     select * from public.news_bulletins n
--     where n.emergency_id = e.id order by n.generated_at desc limit 1
--   ) b on true;
-- ---------------------------------------------------------------------------
