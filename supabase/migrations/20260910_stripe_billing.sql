-- Stripe billing fields on profiles.
--
-- `plan` stays the source of truth for quota (`record_scan`). Only the Stripe
-- webhook (service role) may write these columns; there is still no UPDATE
-- policy for authenticated clients.

alter table public.profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists stripe_price_id text,
  add column if not exists plan_status text not null default 'none'
    check (plan_status in ('none', 'active', 'past_due', 'canceled', 'trialing'));

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Processed webhook events, so Stripe retries do not double-apply the same update.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- No policies: only the service role (webhook) reads or writes this table.
