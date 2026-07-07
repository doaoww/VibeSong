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

alter table public.polar_fulfillments enable row level security;
