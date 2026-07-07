-- Legacy Auth.js schema, currently unused in main branch.
-- Runtime auth uses native Supabase Auth via auth.users.
-- Kept temporarily for migration/history safety.
-- Auth.js Supabase adapter schema
-- Source: https://authjs.dev/getting-started/adapters/supabase
create extension if not exists "uuid-ossp";

CREATE SCHEMA next_auth;
GRANT USAGE ON SCHEMA next_auth TO service_role;
GRANT ALL ON SCHEMA next_auth TO postgres;

CREATE TABLE IF NOT EXISTS next_auth.users
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text,
    email text,
    "emailVerified" timestamp with time zone,
    image text,
    -- Added for the email+password Credentials provider. Not part of the
    -- official Auth.js Supabase adapter schema; null for OAuth-only users.
    password_hash text,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT email_unique UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS next_auth.sessions
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    expires timestamp with time zone NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" uuid,
    CONSTRAINT sessions_pkey PRIMARY KEY (id),
    CONSTRAINT sessionToken_unique UNIQUE ("sessionToken"),
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS next_auth.accounts
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    oauth_token_secret text,
    oauth_token text,
    "userId" uuid,
    CONSTRAINT accounts_pkey PRIMARY KEY (id),
    CONSTRAINT provider_unique UNIQUE (provider, "providerAccountId"),
    CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId")
        REFERENCES next_auth.users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS next_auth.verification_tokens
(
    identifier text,
    token text,
    expires timestamp with time zone NOT NULL,
    CONSTRAINT verification_tokens_pkey PRIMARY KEY (token),
    CONSTRAINT token_unique UNIQUE (token),
    CONSTRAINT token_identifier_unique UNIQUE (token, identifier)
);

CREATE FUNCTION next_auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
      select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      )::uuid
    $$;

GRANT ALL ON TABLE next_auth.users TO postgres;
GRANT ALL ON TABLE next_auth.users TO service_role;
GRANT ALL ON TABLE next_auth.sessions TO postgres;
GRANT ALL ON TABLE next_auth.sessions TO service_role;
GRANT ALL ON TABLE next_auth.accounts TO postgres;
GRANT ALL ON TABLE next_auth.accounts TO service_role;
GRANT ALL ON TABLE next_auth.verification_tokens TO postgres;
GRANT ALL ON TABLE next_auth.verification_tokens TO service_role;

-- App tables

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits int not null default 3,
  migrated_local_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_taste (
  user_id uuid primary key references auth.users(id) on delete cascade,
  genres text[] not null default '{}',
  favorite_artists text[] not null default '{}',
  default_mood text not null default '',
  discovery_style text not null default 'balanced',
  dislikes text[] not null default '{}',
  language_preference text not null default 'No preference',
  energy_preference text not null default 'depends',
  aesthetic_tags text[] not null default '{}',
  setup_complete boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Migration (run in Supabase SQL editor if table already exists):
-- ALTER TABLE public.user_taste ADD COLUMN IF NOT EXISTS aesthetic_tags text[] NOT NULL DEFAULT '{}';

create table public.track_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('saved', 'skipped')),
  title text not null,
  artist text not null,
  reason text,
  match_score int,
  genres text[] not null default '{}',
  artwork text,
  thumbnail text,
  apple_music_url text,
  youtube_url text,
  youtube_id text,
  preview_url text,
  preview_provider text check (preview_provider is null or preview_provider in ('itunes', 'youtube')),
  source_image text,
  created_at timestamptz not null default now()
);

create index track_feedback_user_action_idx
  on public.track_feedback (user_id, action, created_at desc);

create table if not exists public.polar_fulfillments (
  idempotency_key text primary key,
  polar_order_id text,
  polar_checkout_id text,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  credits int not null,
  is_subscription boolean not null default false,
  source text not null,
  event_type text,
  created_at timestamptz not null default now()
);

create index if not exists polar_fulfillments_user_created_idx
  on public.polar_fulfillments (user_id, created_at desc);

create index if not exists polar_fulfillments_order_idx
  on public.polar_fulfillments (polar_order_id)
  where polar_order_id is not null;

create index if not exists polar_fulfillments_checkout_idx
  on public.polar_fulfillments (polar_checkout_id)
  where polar_checkout_id is not null;

alter table public.profiles enable row level security;
alter table public.user_taste enable row level security;
alter table public.track_feedback enable row level security;
alter table public.polar_fulfillments enable row level security;
