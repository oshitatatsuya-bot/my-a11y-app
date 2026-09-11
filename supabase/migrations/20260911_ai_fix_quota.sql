-- Cap AI fix generation per plan so Free users cannot exhaust OpenAI credits.
-- Counts are enforced in /api/fix against rows created this UTC month.

create table if not exists public.ai_fixes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_id text,
  created_at timestamptz not null default now()
);

create index if not exists ai_fixes_user_created_idx
  on public.ai_fixes (user_id, created_at desc);

alter table public.ai_fixes enable row level security;

drop policy if exists "Users read own ai fixes" on public.ai_fixes;
create policy "Users read own ai fixes"
  on public.ai_fixes
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users insert own ai fixes" on public.ai_fixes;
create policy "Users insert own ai fixes"
  on public.ai_fixes
  for insert
  to authenticated
  with check (user_id = auth.uid());
