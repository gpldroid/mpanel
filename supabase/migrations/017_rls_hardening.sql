-- mPanel 017: close direct privilege-escalation paths and align Supabase Storage with site roles

-- Member changes must go through the protected RPCs; do not expose a generic FOR ALL policy.
drop policy if exists site_members_manage on public.site_members;

-- Administration settings are seeded by trusted triggers and changed through role-checked updates/RPCs.
drop policy if exists site_admin_insert on public.site_admin_settings;

-- Backups are created/restored through SECURITY DEFINER functions.
drop policy if exists site_backups_insert on public.site_backups;

-- Storage paths are: <uploader-user-id>/<site-id>/<filename>.
-- Reading is allowed only to members of the corresponding site.
drop policy if exists mpanel_media_read on storage.objects;
create policy mpanel_media_read on storage.objects
for select
using (
  bucket_id='mpanel-media'
  and (
    (storage.foldername(name))[2] is null
    or public.is_site_member(((storage.foldername(name))[2])::uuid)
  )
);

drop policy if exists mpanel_media_insert on storage.objects;
create policy mpanel_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='mpanel-media'
  and (storage.foldername(name))[1]=auth.uid()::text
  and public.is_site_member(((storage.foldername(name))[2])::uuid,array['owner','admin','editor'])
);

drop policy if exists mpanel_media_update on storage.objects;
create policy mpanel_media_update on storage.objects
for update to authenticated
using (
  bucket_id='mpanel-media'
  and public.is_site_member(((storage.foldername(name))[2])::uuid,array['owner','admin','editor'])
)
with check (
  bucket_id='mpanel-media'
  and public.is_site_member(((storage.foldername(name))[2])::uuid,array['owner','admin','editor'])
);

drop policy if exists mpanel_media_delete on storage.objects;
create policy mpanel_media_delete on storage.objects
for delete to authenticated
using (
  bucket_id='mpanel-media'
  and public.is_site_member(((storage.foldername(name))[2])::uuid,array['owner','admin','editor'])
);

-- Make member lookup fail closed if the site id is malformed.
create or replace function public.is_site_member(p_site_id uuid,p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.site_members m
    where m.site_id=p_site_id
      and m.user_id=auth.uid()
      and (p_roles is null or m.role=any(p_roles))
  )
$$;

revoke all on function public.is_site_member(uuid,text[]) from public;
grant execute on function public.is_site_member(uuid,text[]) to authenticated;
