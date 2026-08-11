-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.locations (
  id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['shelter'::text, 'donation_centre'::text, 'comedor'::text, 'iniciativa'::text, 'hospital'::text, 'morgue'::text])),
  region text,
  municipality text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  address text,
  phone text,
  whatsapp text,
  aliases ARRAY NOT NULL DEFAULT '{}'::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT locations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.center_info (
  location_id text NOT NULL,
  status text CHECK (status = ANY (ARRAY['abierto'::text, 'lleno'::text, 'cerrado'::text])),
  receives ARRAY NOT NULL DEFAULT '{}'::text[],
  needs text,
  help ARRAY NOT NULL DEFAULT '{}'::text[] CHECK (help <@ ARRAY['voluntariado'::text, 'especie'::text, 'oficios'::text, 'difusion'::text, 'economico'::text]),
  category text,
  description text,
  schedule text,
  contact_name text,
  social_url text,
  is_animal boolean NOT NULL DEFAULT false,
  last_confirmed_at timestamp with time zone,
  source text,
  external_id text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT center_info_pkey PRIMARY KEY (location_id),
  CONSTRAINT center_info_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.app_settings (
  id boolean NOT NULL DEFAULT true CHECK (id),
  maintenance boolean NOT NULL DEFAULT false,
  notice text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.staff_users (
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'volunteer'::text])),
  email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_users_pkey PRIMARY KEY (user_id),
  CONSTRAINT staff_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'center'::text CHECK (kind = ANY (ARRAY['center'::text, 'initiative'::text, 'need'::text, 'other'::text])),
  message text NOT NULL,
  name text,
  contact text,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  CONSTRAINT submissions_pkey PRIMARY KEY (id),
  CONSTRAINT submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.volunteer_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  profile text,
  motivation text,
  region text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  CONSTRAINT volunteer_requests_pkey PRIMARY KEY (id),
  CONSTRAINT volunteer_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.audit_log (
  id bigint NOT NULL DEFAULT nextval('audit_log_id_seq'::regclass),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  summary text,
  actor_id uuid,
  actor_email text,
  actor_role text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);