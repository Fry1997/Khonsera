-- Layer 4 — job queue table.
-- Interface only: no worker yet. Real workers (pg_cron, Supabase Edge
-- Functions, or external) drop in later and pick rows up by:
--   1. set status='running', locked_at=now(), locked_by=<worker-id>
--      where status='pending' and run_at <= now() and locked_at is null
--      returning a small batch
--   2. process payload
--   3. set status='completed' (or back to 'pending' with attempts++ on
--      transient failure, or 'failed' if attempts >= max_attempts)
--
-- Locking + retry columns are already here so we never have to migrate.

create type job_status as enum (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  job_name text not null,
  payload jsonb not null default '{}'::jsonb,
  run_at timestamptz not null default now(),
  status job_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  -- Optional dedupe key. A queued job with the same key and status='pending'
  -- can be detected by callers to avoid enqueueing duplicates.
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger jobs_updated_at before update on jobs
  for each row execute function set_updated_at();

-- Workers scan by (status, run_at).
create index jobs_pending_runnable_idx
  on jobs(run_at) where status = 'pending';
-- Per-workspace browsing.
create index jobs_workspace_idx on jobs(workspace_id, created_at desc);
-- Dedupe lookup.
create unique index jobs_idempotency_unique
  on jobs(workspace_id, job_name, idempotency_key)
  where idempotency_key is not null and status in ('pending','running');

-- RLS: members read their workspace's jobs; only members enqueue (insert).
-- Updates/deletes happen via the worker (service role) or via SECURITY
-- DEFINER cancel helpers added later.
alter table jobs enable row level security;

create policy "jobs_member_select" on jobs
  for select using (workspace_id is null or is_workspace_member(workspace_id));

create policy "jobs_member_insert" on jobs
  for insert with check (workspace_id is null or is_workspace_member(workspace_id));
