-- Claudable Cloud — per-user settings (BYOK Anthropic API key).
-- The key is stored AES-256-GCM encrypted by the backend; this column never
-- holds plaintext. RLS still restricts the row to its owner as defense in depth.

create table if not exists public.user_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  anthropic_key_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists user_settings_owner_all on public.user_settings;
create policy user_settings_owner_all on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists user_settings_touch on public.user_settings;
create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();
