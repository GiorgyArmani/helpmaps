-- ===========================================================================
-- db/seed/co_030_digitales.sql — iniciativas digitales de muestra para Colombia
-- ---------------------------------------------------------------------------
-- Tres filas de EJEMPLO para ver la pestaña "Digitales" con datos: una de una sola
-- región, una de varias y una nacional (cobertura vacía). No son organizaciones reales;
-- bórralas o reemplázalas cuando el equipo local publique las suyas.
--
-- ORDEN: después de db/01_esquema.sql (con la sección 011_digitales, o bien
-- db/04_digitales.sql aplicado encima) y de db/02_emergencia.co.sql, porque
-- `emergency_id` se resuelve por el slug de esa fila.
--
-- `on conflict do nothing`: re-correrlo no pisa nada.
-- ===========================================================================

do $$
begin
  if to_regclass('public.audit_log') is not null then
    execute 'alter table public.locations disable trigger user';
    execute 'alter table public.center_info disable trigger user';
  end if;
end $$;

insert into public.locations
  (id, name, type, region, municipality, lat, lng, address, phone, whatsapp, aliases, active,
   emergency_id, coverage_regions, coverage_municipalities)
values
  ('dig_red_apoyo_choco', 'Red de Apoyo Chocó (ejemplo)', 'digital', null, null, null, null, null,
   null, '573000000001', '{}'::text[], true,
   (select id from public.emergencies where slug = 'co-terremoto-2026'),
   array['choco']::text[], array['Quibdó', 'San José del Palmar']::text[]),
  ('dig_voluntarios_remotos_co', 'Voluntarios Remotos Colombia (ejemplo)', 'digital', null, null, null, null, null,
   null, null, '{}'::text[], true,
   (select id from public.emergencies where slug = 'co-terremoto-2026'),
   array['antioquia', 'valle_del_cauca', 'risaralda']::text[], '{}'::text[]),
  ('dig_linea_nacional', 'Línea de Escucha Nacional (ejemplo)', 'digital', null, null, null, null, null,
   '+57 601 0000000', null, '{}'::text[], true,
   (select id from public.emergencies where slug = 'co-terremoto-2026'),
   '{}'::text[], '{}'::text[])
on conflict (id) do nothing;

insert into public.center_info
  (location_id, status, receives, needs, help, category, description, schedule, contact_name,
   social_url, website, instagram, is_animal, last_confirmed_at, source)
values
  ('dig_red_apoyo_choco', 'abierto', '{}'::text[],
   'Voluntarios con moto para llevar kits a veredas de San José del Palmar.',
   array['voluntariado', 'difusion']::text[], 'Red de voluntarios',
   'Coordinan por WhatsApp la entrega de kits de aseo y agua en las veredas afectadas. No tienen sede: reciben en casa de voluntarios y salen en ruta.',
   null, null, null, null, 'redapoyochoco', false, now(), 'equipo'),
  ('dig_voluntarios_remotos_co', 'abierto', '{}'::text[],
   'Personas que hablen con familias por teléfono y registren necesidades.',
   array['voluntariado', 'oficios']::text[], 'Apoyo remoto',
   'Grupo de voluntarios que llama a albergues de Antioquia, Valle y Risaralda para actualizar sus necesidades y las publica aquí.',
   'Lun–Dom 8:00–20:00', null, null, 'https://example.org/voluntarios-remotos', 'voluntariosremotos', false, now(), 'equipo'),
  ('dig_linea_nacional', 'abierto', '{}'::text[], null,
   array['difusion', 'economico']::text[], 'Línea de apoyo',
   'Acompañamiento psicológico por teléfono para personas afectadas en todo el país.',
   '24 horas', null, null, 'https://example.org/linea', null, false, now(), 'equipo')
on conflict (location_id) do nothing;

do $$
begin
  if to_regclass('public.audit_log') is not null then
    execute 'alter table public.locations enable trigger user';
    execute 'alter table public.center_info enable trigger user';
  end if;
end $$;
