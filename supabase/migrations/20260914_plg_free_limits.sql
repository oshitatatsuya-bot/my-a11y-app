-- PLG: Free plan gets enough room to taste site scan + AI fix before upgrading.
-- Also ignore well-known demo hosts when enforcing the monthly site cap.

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
  v_user uuid := auth.uid();
  v_plan text;
  v_scan_limit int;
  v_site_limit int;
  v_used int;
  v_other_hosts int;
  v_scan_id uuid;
  v_token text;
  v_period_start timestamptz := date_trunc('month', now());
  v_is_demo boolean;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select plan into v_plan from public.profiles where id = v_user;
  v_plan := coalesce(v_plan, 'free');

  select l.scan_limit, l.site_limit
    into v_scan_limit, v_site_limit
  from (values
    ('free', 15, 3),
    ('pro', 1000, 3),
    ('agency', 5000, 1000)
  ) as l(plan, scan_limit, site_limit)
  where l.plan = v_plan;

  v_is_demo := lower(p_host) in (
    'example.com', 'www.example.com',
    'example.org', 'www.example.org',
    'example.net', 'www.example.net'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select count(*) into v_used
  from public.scans
  where user_id = v_user
    and created_at >= v_period_start;

  if v_used >= v_scan_limit then
    raise exception 'QUOTA_EXCEEDED:%/%', v_used, v_scan_limit;
  end if;

  if not v_is_demo then
    select count(distinct host) into v_other_hosts
    from public.scans
    where user_id = v_user
      and created_at >= v_period_start
      and host <> p_host
      and lower(host) not in (
        'example.com', 'www.example.com',
        'example.org', 'www.example.org',
        'example.net', 'www.example.net'
      );

    if v_other_hosts >= v_site_limit then
      raise exception 'SITE_LIMIT_EXCEEDED:%', v_site_limit;
    end if;
  end if;

  insert into public.scans (
    user_id, url, host, score, violations_count, elements_affected,
    critical_count, serious_count, moderate_count, minor_count, violations, run_id
  )
  values (
    v_user, p_url, p_host, p_score, p_violations_count, p_elements_affected,
    p_critical, p_serious, p_moderate, p_minor, p_violations, p_run_id
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
  v_is_demo boolean;
begin
  if p_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select plan into v_plan from public.profiles where id = p_user_id;
  v_plan := coalesce(v_plan, 'free');

  select l.scan_limit, l.site_limit
    into v_scan_limit, v_site_limit
  from (values
    ('free', 15, 3),
    ('pro', 1000, 3),
    ('agency', 5000, 1000)
  ) as l(plan, scan_limit, site_limit)
  where l.plan = v_plan;

  v_is_demo := lower(p_host) in (
    'example.com', 'www.example.com',
    'example.org', 'www.example.org',
    'example.net', 'www.example.net'
  );

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*) into v_used
  from public.scans
  where user_id = p_user_id
    and created_at >= v_period_start;

  if v_used >= v_scan_limit then
    raise exception 'QUOTA_EXCEEDED:%/%', v_used, v_scan_limit;
  end if;

  if not v_is_demo then
    select count(distinct host) into v_other_hosts
    from public.scans
    where user_id = p_user_id
      and created_at >= v_period_start
      and host <> p_host
      and lower(host) not in (
        'example.com', 'www.example.com',
        'example.org', 'www.example.org',
        'example.net', 'www.example.net'
      );

    if v_other_hosts >= v_site_limit then
      raise exception 'SITE_LIMIT_EXCEEDED:%', v_site_limit;
    end if;
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
