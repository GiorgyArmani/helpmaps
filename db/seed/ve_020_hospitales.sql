-- ===========================================================================
-- db/seed/ve_020_hospitales.sql — OPCIONAL: los hospitales del despliegue viejo
-- ---------------------------------------------------------------------------
-- 23 hospitales, en un archivo aparte porque son una decisión aparte.
--
-- En la app vieja existían como anclaje de la búsqueda de personas ingresadas —una
-- función que el repo base no tiene y cuyos datos de pacientes ya se purgaron—. El
-- esquema base admite el tipo 'hospital', así que si los siembras salen como pines
-- en el mapa, sin nada que buscar detrás.
--
-- Siémbralos solo si quieres que el mapa muestre dónde están los hospitales.
-- Requiere db/01_esquema.sql § 001_core y, si vas a sembrarlos, hazlo tú con criterio.
-- ===========================================================================

-- Los triggers de auditoría de 004 registran fila por fila. Sembrar con ellos
-- activos llena `audit_log` con cientos de entradas que no son el trabajo de
-- nadie y entierran el historial real. Se apagan solo si existen — este archivo
-- también corre bien justo después de 001, antes de que 004 los cree.
do $$
begin
  if to_regclass('public.audit_log') is not null then
    execute 'alter table public.locations disable trigger user';
    execute 'alter table public.center_info disable trigger user';
  end if;
end $$;

insert into public.locations (id, name, type, region, municipality, lat, lng, address, phone, whatsapp, aliases, active, created_at, updated_at) values
  ('hosp_luciani', 'Hospital Dr. Domingo Luciani', 'hospital', 'distrito_capital', 'Sucre (El Llanito)', 10.4726273534332, -66.8097906026199, null, null, null, array['HOSPITAL DR DOMINGO LUCIANI','HOSPITAL DOMINGO LUCIANI (EL LLANITO)','HOSPITAL DR. DOMINGO LUCIANI']::text[], true, '2026-06-27T22:03:16.164017+00:00', '2026-06-27T22:03:16.164017+00:00'),
  ('hosp_perez_carreno', 'Hospital Dr. Miguel Pérez Carreño', 'hospital', 'distrito_capital', 'Libertador (Caricuao/Montalbán)', 10.4803062839106, -66.9542365204307, null, null, null, array['HOSPITAL PEREZ CARREÑO']::text[], true, '2026-06-27T22:03:16.164017+00:00', '2026-06-27T22:03:16.164017+00:00'),
  ('hosp_vargas_caracas', 'Hospital Vargas de Caracas', 'hospital', 'distrito_capital', 'Libertador (San José)', 10.5163953986661, -66.9112963076941, null, null, null, array['HOSPITAL VARGAS DE CARACAS','HOSPITAL VARGAS, CARACAS']::text[], true, '2026-06-27T22:03:16.164017+00:00', '2026-06-27T22:03:16.164017+00:00'),
  ('hosp_jm_vargas_guaira', 'Hospital Dr. José María Vargas (La Guaira)', 'hospital', 'la_guaira', 'Vargas (Macuto)', 10.6033557703992, -66.9215272972981, null, null, null, array['HOSPITAL DR JOSE MARIA VARGAS LA GUAIRA']::text[], true, '2026-06-27T22:03:16.164017+00:00', '2026-06-27T22:03:16.164017+00:00'),
  ('hosp_huc', 'Hospital Universitario de Caracas', 'hospital', 'distrito_capital', 'Libertador (Ciudad Universitaria)', 10.4905214829543, -66.8937397890439, null, null, null, array['HOSPITAL UNIVERSITARIO DE CARACAS']::text[], true, '2026-06-27T22:03:16.164017+00:00', '2026-06-27T22:03:16.164017+00:00'),
  ('hosp_catia', 'Hospital del Oeste Dr. José Gregorio Hernández', 'hospital', 'distrito_capital', 'Libertador (Catia)', 10.5165872055721, -66.9535412433887, null, null, null, array['HOSPITAL DE CATIA']::text[], true, '2026-06-27T22:03:16.164017+00:00', '2026-06-27T22:03:16.164017+00:00'),
  ('hosp_jm_de_los_rios', 'Hospital de Niños J.M. de los Ríos', 'hospital', 'distrito_capital', 'Libertador (San Bernardino)', 10.5069989138047, -66.8994049775165, null, null, null, array['HOSPITAL JM DE LOS RIOS','JM DE LOS RIOS (HOSP DE NIÑOS)']::text[], true, '2026-06-27T22:03:16.164017+00:00', '2026-06-27T22:03:16.164017+00:00'),
  ('hosp_baquero_gonzalez', 'Hospital Dr. Ricardo Baquero González (Periférico de Catia)', 'hospital', 'distrito_capital', 'Libertador (Catia)', 10.5135642374908, -66.9422165701739, null, null, null, array['HOPITAL RICARDO BAQUERO GONZALEZ']::text[], true, '2026-06-27T22:03:16.164017+00:00', '2026-06-27T22:03:16.164017+00:00'),
  ('hosp_victorino_santaella', 'Hospital Victorino Santaella', 'hospital', 'miranda', 'Guaicaipuro (Los Teques)', 10.353992670226, -67.0363176238338, null, null, null, array['HOSPITAL VICTORINO SANTAELLA LOS TEQUES']::text[], true, '2026-06-27T22:03:16.164017+00:00', '2026-06-27T22:03:16.164017+00:00'),
  ('hosp_ciudad_caribia', 'Hospital Ciudad Caribia', 'hospital', 'la_guaira', 'Ciudad Caribia', 10.5418222351645, -67.0216107617732, null, null, null, array['HOSPITAL CIUDAD CARIBIA']::text[], true, '2026-06-27T22:03:16.164017+00:00', '2026-06-27T22:03:16.164017+00:00'),
  ('loc_1782677104031', 'IVSS Hospital Dr. Plácido Daniel Rodríguez Rivero', 'hospital', 'yaracuy', 'Parroquia San Felipe', 10.355114, -68.751711, null, null, null, '{}'::text[], true, '2026-06-28T20:05:05.416162+00:00', '2026-06-28T20:05:05.416162+00:00'),
  ('loc_1782684283777', 'Centro Médico Docente La Trinidad', 'hospital', 'miranda', 'Parroquia Nuestra Señora del Rosario', 10.431268, -66.855903, null, null, null, '{}'::text[], true, '2026-06-28T22:04:45.456601+00:00', '2026-06-28T22:04:45.456601+00:00'),
  ('loc_1782774119110', 'Hospital José Ignacio Baldó', 'hospital', 'distrito_capital', 'Libertador', 10.483779, -66.971859, null, null, null, '{}'::text[], true, '2026-06-29T23:01:59.805179+00:00', '2026-06-29T23:01:59.805179+00:00'),
  ('loc_1782836173236', 'Cruz Roja Venezolana', 'hospital', 'distrito_capital', 'Parroquia La Candelaria', 10.504294, -66.899359, null, null, null, '{}'::text[], true, '2026-06-30T16:16:15.513158+00:00', '2026-06-30T16:16:15.513158+00:00'),
  ('loc_1782838216579', 'Hospital de Clínicas Caracas', 'hospital', 'distrito_capital', 'Parroquia San Bernardino', 10.510182, -66.899292, null, null, null, '{}'::text[], true, '2026-06-30T16:50:19.115271+00:00', '2026-06-30T16:50:19.115271+00:00'),
  ('loc_1782853227014', 'Clínica El Ávila', 'hospital', 'miranda', 'Chacao', 10.504057, -66.850013, null, null, null, '{}'::text[], true, '2026-06-30T21:00:27.79664+00:00', '2026-06-30T21:00:27.79664+00:00'),
  ('loc_1782875112253', 'Centro Medico Santa Marta', 'hospital', 'aragua', 'Parroquia María de San José', 10.244293, -67.590577, null, null, null, '{}'::text[], true, '2026-07-01T03:05:13.331436+00:00', '2026-07-01T03:05:13.331436+00:00'),
  ('loc_1782928704491', 'Hospital Jesús Yerena', 'hospital', 'distrito_capital', 'Parroquia La Pastora', 10.524082, -66.929926, null, null, null, '{}'::text[], true, '2026-07-01T17:58:24.549697+00:00', '2026-07-01T17:58:24.549697+00:00'),
  ('loc_1783456047595', 'Hospital Pérez de León II', 'hospital', 'miranda', 'Parroquia Petare', 10.477756, -66.81001, null, null, null, '{}'::text[], true, '2026-07-07T20:27:28.104378+00:00', '2026-07-07T20:27:28.104378+00:00'),
  ('loc_1783714154071', 'Alfa', 'hospital', 'la_guaira', 'Parroquia Maiquetía', 10.59618, -66.949138, null, null, null, '{}'::text[], true, '2026-07-10T20:09:14.173582+00:00', '2026-07-10T20:09:14.173582+00:00'),
  ('loc_1783714898622', 'Hospital Dr. Rafael Medina Jiménez Periférico de Pariata', 'hospital', 'la_guaira', 'Parroquia Maiquetía', 10.597092, -66.961061, null, null, null, '{}'::text[], true, '2026-07-10T20:21:38.660723+00:00', '2026-07-10T20:21:38.660723+00:00'),
  ('loc_1783715031344', 'Centro Clínico Fénix Salud', 'hospital', 'distrito_capital', 'Parroquia San Bernardino', 10.51067, -66.896907, null, null, null, '{}'::text[], true, '2026-07-10T20:23:51.43814+00:00', '2026-07-10T20:23:51.43814+00:00'),
  ('loc_1783716594057', 'Hospital de Campaña Alí Primera', 'hospital', 'distrito_capital', 'Parroquia Sucre', 10.514207, -66.939768, null, null, null, '{}'::text[], true, '2026-07-10T20:49:54.14597+00:00', '2026-07-10T20:49:54.14597+00:00')
on conflict (id) do nothing;

-- Ninguno tiene fila en center_info.

do $$
begin
  if to_regclass('public.audit_log') is not null then
    execute 'alter table public.locations enable trigger user';
    execute 'alter table public.center_info enable trigger user';
  end if;
end $$;
