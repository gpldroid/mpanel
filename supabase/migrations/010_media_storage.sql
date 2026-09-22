-- mPanel 010: real media storage, builder publishing metadata and production helpers

create extension if not exists pgcrypto;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'mpanel-media',
  'mpanel-media',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','image/avif','image/x-icon']
)
on conflict(id) do update set public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists mpanel_media_read on storage.objects;
create policy mpanel_media_read on storage.objects for select using(bucket_id='mpanel-media');

drop policy if exists mpanel_media_insert on storage.objects;
create policy mpanel_media_insert on storage.objects for insert to authenticated
with check(bucket_id='mpanel-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists mpanel_media_update on storage.objects;
create policy mpanel_media_update on storage.objects for update to authenticated
using(bucket_id='mpanel-media' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='mpanel-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists mpanel_media_delete on storage.objects;
create policy mpanel_media_delete on storage.objects for delete to authenticated
using(bucket_id='mpanel-media' and (storage.foldername(name))[1]=auth.uid()::text);

alter table public.media_assets add column if not exists storage_bucket text not null default 'mpanel-media';
alter table public.media_assets add column if not exists storage_object_path text not null default '';
alter table public.media_assets add column if not exists public_url text not null default '';

create index if not exists idx_media_assets_site_path on public.media_assets(site_id,storage_object_path);

create or replace function public.validate_media_asset_storage()
returns trigger language plpgsql as $$
begin
  if new.storage_provider='supabase' then
    if new.storage_bucket<>'mpanel-media' then
      raise exception 'unsupported media storage bucket';
    end if;
    if new.storage_object_path='' then
      raise exception 'storage_object_path is required for Supabase media';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists validate_media_asset_storage on public.media_assets;
create trigger validate_media_asset_storage
before insert or update on public.media_assets
for each row execute function public.validate_media_asset_storage();

insert into public.system_checks(user_id,site_id,check_key,status,message)
select s.user_id,s.id,'media_storage','pending','Media storage not checked yet'
from public.sites s
on conflict(site_id,check_key) do nothing;