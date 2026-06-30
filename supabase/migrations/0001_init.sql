-- Claudable Cloud — initial schema
-- Multi-tenant: every row is owned by a user (directly or via its project).
-- Row-Level Security is enabled on every table; policies restrict access to
-- the authenticated owner. The backend uses the service-role key which
-- bypasses RLS, so it must enforce ownership in application code as well.

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type project_status as enum ('idle', 'provisioning', 'running', 'executing', 'stopped', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type chat_role as enum ('user', 'assistant', 'system', 'tool');
exception when duplicate_object then null; end $$;

-- ============================================================
-- users  (profile mirror of auth.users)
-- ============================================================
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- projects
-- ============================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  project_name text not null,
  description text,
  status project_status not null default 'idle',
  -- host path of the bind-mounted workspace
  workspace_path text,
  -- docker container id for the active workspace (nullable when stopped)
  container_id text,
  -- Claude Code session id for multi-turn resumption
  claude_session_id text,
  selected_model text,
  initial_prompt text,
  -- storage path of the latest artifact archive
  latest_artifact_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);
create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_status_idx on public.projects (status);

-- ============================================================
-- chat_sessions  (one row per message in a project's conversation)
-- ============================================================
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  role chat_role not null,
  message text not null,
  -- normalized event metadata: tool name, action, file path, summary, etc.
  metadata jsonb,
  -- ties assistant/tool messages back to the originating user request
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists chat_sessions_project_id_idx on public.chat_sessions (project_id);
create index if not exists chat_sessions_created_at_idx on public.chat_sessions (created_at);
create index if not exists chat_sessions_request_id_idx on public.chat_sessions (request_id);

-- ============================================================
-- project_files  (manifest of generated files, contents live in workspace/storage)
-- ============================================================
create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  filename text not null,
  language text,
  -- storage path inside the artifacts bucket, when persisted
  storage_path text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, filename)
);
create index if not exists project_files_project_id_idx on public.project_files (project_id);

-- ============================================================
-- updated_at maintenance
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists project_files_touch on public.project_files;
create trigger project_files_touch before update on public.project_files
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.project_files enable row level security;

-- users: a user can see and update only their own profile row.
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (auth.uid() = id);
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (auth.uid() = id);

-- projects: full CRUD limited to the owner.
drop policy if exists projects_owner_all on public.projects;
create policy projects_owner_all on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- chat_sessions: access only if the parent project belongs to the user.
drop policy if exists chat_sessions_owner_all on public.chat_sessions;
create policy chat_sessions_owner_all on public.chat_sessions
  for all using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

-- project_files: same project-ownership gate.
drop policy if exists project_files_owner_all on public.project_files;
create policy project_files_owner_all on public.project_files
  for all using (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );
