-- Accounts, per-tenant scan storage, quota enforcement and public badges.
--
-- Design notes:
--   * `scans` has no INSERT policy. Rows are only created through
--     `record_scan()`, which is where the quota is enforced, so a client
--     holding the publishable key cannot write around the limit.
--   * Quota checks and the insert happen in one transaction behind an advisory
--     lock, so two concurrent scans cannot both pass the same check.
--   * Badges must be readable without a session (they are embedded on customer
--     sites), so they are exposed through a token-scoped function instead of a
--     public SELECT policy, which would let anyone enumerate hosts and scores.

-- ---------------------------------------------------------------- profiles --

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'agency')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- No INSERT/UPDATE policy: profiles are created by the trigger below and the
-- plan is only changed by a privileged process (billing).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill for accounts that already exist.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ------------------------------------------------------------------- scans --

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  host text not null,
  score int not null,
  violations_count int not null default 0,
  elements_affected int not null default 0,
  critical_count int not null default 0,
  serious_count int not null default 0,
  moderate_count int not null default 0,
  minor_count int not null default 0,
  violations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scans_user_created_idx
  on public.scans (user_id, created_at desc);

create index if not exists scans_user_host_created_idx
  on public.scans (user_id, host, created_at desc);

alter table public.scans enable row level security;

drop policy if exists "Users read own scans" on public.scans;
create policy "Users read own scans"
  on public.scans
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users delete own scans" on public.scans;
create policy "Users delete own scans"
  on public.scans
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------------ badges --

create table if not exists public.badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  host text not null,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  score int not null,
  scanned_at timestamptz not null default now(),
  primary key (user_id, host)
);

alter table public.badges enable row level security;

drop policy if exists "Users read own badges" on public.badges;
create policy "Users read own badges"
  on public.badges
  for select
  to authenticated
  using (user_id = auth.uid());

-- --------------------------------------------------------- quota + insert --

create or replace function public.record_scan(
  p_url text,
  p_host text,
  p_score int,
  p_violations_count int,
  p_elements_affected int,
  p_critical int,
  p_serious int,
  p_moderate int,
  p_minor int,
  p_violations jsonb
)
returns table (
  scan_id uuid,
  badge_token text,
  scans_used int,
  scans_limit int,
  sites_limit int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_plan text;
  v_scan_limit int;
  v_site_limit int;
  v_used int;
  v_other_hosts int;
  v_scan_id uuid;
  v_token text;
  v_period_start timestamptz := date_trunc('month', now());
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select plan into v_plan from public.profiles where id = v_user;
  v_plan := coalesce(v_plan, 'free');

  select l.scan_limit, l.site_limit
    into v_scan_limit, v_site_limit
  from (values
    ('free', 5, 1),
    ('pro', 1000, 3),
    ('agency', 5000, 1000)
  ) as l(plan, scan_limit, site_limit)
  where l.plan = v_plan;

  -- Serialise concurrent scans for this account so the count below cannot be
  -- read by two transactions before either inserts.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select count(*) into v_used
  from public.scans
  where user_id = v_user
    and created_at >= v_period_start;

  if v_used >= v_scan_limit then
    raise exception 'QUOTA_EXCEEDED:%/%', v_used, v_scan_limit;
  end if;

  select count(distinct host) into v_other_hosts
  from public.scans
  where user_id = v_user
    and created_at >= v_period_start
    and host <> p_host;

  if v_other_hosts >= v_site_limit then
    raise exception 'SITE_LIMIT_EXCEEDED:%', v_site_limit;
  end if;

  insert into public.scans (
    user_id, url, host, score, violations_count, elements_affected,
    critical_count, serious_count, moderate_count, minor_count, violations
  )
  values (
    v_user, p_url, p_host, p_score, p_violations_count, p_elements_affected,
    p_critical, p_serious, p_moderate, p_minor, p_violations
  )
  returning id into v_scan_id;

  insert into public.badges as b (user_id, host, score, scanned_at)
  values (v_user, p_host, p_score, now())
  on conflict (user_id, host) do update
    set score = excluded.score,
        scanned_at = excluded.scanned_at
  returning b.token into v_token;

  return query select v_scan_id, v_token, v_used + 1, v_scan_limit, v_site_limit;
end;
$$;

-- PostgreSQL grants EXECUTE to PUBLIC by default, which would let the
-- anonymous role insert scans.
revoke execute on function public.record_scan(
  text, text, int, int, int, int, int, int, int, jsonb
) from public;

grant execute on function public.record_scan(
  text, text, int, int, int, int, int, int, int, jsonb
) to authenticated;

-- -------------------------------------------------------------- badge read --

create or replace function public.badge_by_token(badge_token text)
returns table (host text, score int, scanned_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select b.host, b.score, b.scanned_at
  from public.badges b
  where b.token = badge_token;
$$;

revoke execute on function public.badge_by_token(text) from public;
grant execute on function public.badge_by_token(text) to anon, authenticated;
