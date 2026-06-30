-- Claudable Cloud — private storage bucket for generated project archives.
-- Access is brokered by the backend via signed URLs; direct client access is
-- still restricted to the owner so a leaked path cannot be downloaded by others.

insert into storage.buckets (id, name, public)
values ('project-artifacts', 'project-artifacts', false)
on conflict (id) do nothing;

-- Object paths are namespaced as: <project_id>/<filename>
-- A user may read/write an object only if they own the project whose id is the
-- first path segment.
drop policy if exists artifacts_owner_select on storage.objects;
create policy artifacts_owner_select on storage.objects
  for select using (
    bucket_id = 'project-artifacts'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.user_id = auth.uid()
    )
  );

drop policy if exists artifacts_owner_write on storage.objects;
create policy artifacts_owner_write on storage.objects
  for insert with check (
    bucket_id = 'project-artifacts'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.user_id = auth.uid()
    )
  );
