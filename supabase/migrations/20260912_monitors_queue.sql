-- Background page queue + recurring site monitors for churn-resistant SaaS.

-- ---------------------------------------------------------------- scan_queue --

create table if not exists public.scan_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  host text not null,
  run_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists scan_queue_pending_idx
  on public.scan_queue (status, created_at)
  where status = 'pending';

create index if not exists scan_queue_user_idx
  on public.scan_queue (user_id, created_at desc);

alter table public.scan_queue enable row level security;

drop policy if exists "Users read own queue" on public.scan_queue;
create policy "Users read own queue"
  on public.scan_queue
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users insert own queue" on public.scan_queue;
create policy "Users insert own queue"
  on public.scan_queue
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Inserts/updates for status transitions are performed by the service role (cron).

-- ------------------------------------------------------------- site_monitors --

create table if not exists public.site_monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  seed_url text not null,
  host text not null,
  cadence text not null default 'weekly'
    check (cadence in ('weekly', 'monthly')),
  alert_email text not null,
  slack_webhook_url text,
  enabled boolean not null default true,
  last_score int,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, host)
);

create index if not exists site_monitors_due_idx
  on public.site_monitors (enabled, last_run_at);

alter table public.site_monitors enable row level security;

drop policy if exists "Users manage own monitors" on public.site_monitors;
create policy "Users manage own monitors"
  on public.site_monitors
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------- privileged record for cron/queue --

create or replace function public.record_scan_for_user(
  p_user_id uuid,
  p_url text,
  p_host text,
  p_score int,
  p_violations_count int,
  p_elements_affected int,
  p_critical int,
  p_serious int,
  p_moderate int,
  p_minor int,
  p_violations jsonb,
  p_run_id uuid default null
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
  v_plan text;
  v_scan_limit int;
  v_site_limit int;
  v_used int;
  v_other_hosts int;
  v_scan_id uuid;
  v_token text;
  v_period_start timestamptz := date_trunc('month', now());
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select plan into v_plan from public.profiles where id = p_user_id;
  v_plan := coalesce(v_plan, 'free');

  select l.scan_limit, l.site_limit
    into v_scan_limit, v_site_limit
  from (values
    ('free', 5, 1),
    ('pro', 1000, 3),
    ('agency', 5000, 1000)
  ) as l(plan, scan_limit, site_limit)
  where l.plan = v_plan;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*) into v_used
  from public.scans
  where user_id = p_user_id
    and created_at >= v_period_start;

  if v_used >= v_scan_limit then
    raise exception 'QUOTA_EXCEEDED:%/%', v_used, v_scan_limit;
  end if;

  select count(distinct host) into v_other_hosts
  from public.scans
  where user_id = p_user_id
    and created_at >= v_period_start
    and host <> p_host;

  if v_other_hosts >= v_site_limit then
    raise exception 'SITE_LIMIT_EXCEEDED:%', v_site_limit;
  end if;

  insert into public.scans (
    user_id, url, host, score, violations_count, elements_affected,
    critical_count, serious_count, moderate_count, minor_count, violations, run_id
  )
  values (
    p_user_id, p_url, p_host, p_score, p_violations_count, p_elements_affected,
    p_critical, p_serious, p_moderate, p_minor, p_violations, p_run_id
  )
  returning id into v_scan_id;

  insert into public.badges as b (user_id, host, score, scanned_at)
  values (p_user_id, p_host, p_score, now())
  on conflict (user_id, host) do update
    set score = excluded.score,
        scanned_at = excluded.scanned_at
  returning b.token into v_token;

  return query select v_scan_id, v_token, v_used + 1, v_scan_limit, v_site_limit;
end;
$$;

revoke all on function public.record_scan_for_user(
  uuid, text, text, int, int, int, int, int, int, int, jsonb, uuid
) from public;

grant execute on function public.record_scan_for_user(
  uuid, text, text, int, int, int, int, int, int, int, jsonb, uuid
) to service_role;
