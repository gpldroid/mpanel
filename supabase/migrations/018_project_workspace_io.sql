-- mPanel 018: full project workspace storage + Premium unlimited backend
create extension if not exists pgcrypto;

-- Product tier is Premium; this does not weaken RLS or per-user isolation.
drop trigger if exists free_site_limit on public.sites;
drop function if exists public.enforce_free_site_limit();

alter table public.profiles alter column plan set default 'pro';
update public.profiles set plan='pro' where plan is distinct from 'pro';

insert into storage.buckets(id,name,public,file_size_limit)
values('mpanel-projects','mpanel-projects',false,52428800)
on conflict(id) do update set public=false,file_size_limit=52428800;

create table if not exists public.site_binary_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  path text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  storage_bucket text not null default 'mpanel-projects',
  storage_object_path text not null,
  is_protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,site_id,path)
);

create index if not exists site_binary_files_site_path_idx on public.site_binary_files(site_id,path);
create index if not exists site_binary_files_user_id_idx on public.site_binary_files(user_id);

alter table public.site_binary_files enable row level security;
drop policy if exists "site binary files own rows" on public.site_binary_files;
create policy "site binary files own rows" on public.site_binary_files
for all using(auth.uid()=user_id) with check(auth.uid()=user_id);

drop policy if exists mpanel_project_read on storage.objects;
create policy mpanel_project_read on storage.objects for select to authenticated
using(bucket_id='mpanel-projects' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists mpanel_project_insert on storage.objects;
create policy mpanel_project_insert on storage.objects for insert to authenticated
with check(bucket_id='mpanel-projects' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists mpanel_project_update on storage.objects;
create policy mpanel_project_update on storage.objects for update to authenticated
using(bucket_id='mpanel-projects' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='mpanel-projects' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists mpanel_project_delete on storage.objects;
create policy mpanel_project_delete on storage.objects for delete to authenticated
using(bucket_id='mpanel-projects' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.lock_site_binary_owner()
returns trigger language plpgsql as $$
begin
  new.user_id:=old.user_id;
  new.site_id:=old.site_id;
  return new;
end;
$$;

drop trigger if exists lock_site_binary_owner_trigger on public.site_binary_files;
create trigger lock_site_binary_owner_trigger
before update on public.site_binary_files
for each row execute procedure public.lock_site_binary_owner();
