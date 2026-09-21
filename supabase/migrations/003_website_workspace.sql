-- mPanel website workspace: files, versions and editor metadata
create table if not exists public.site_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  path text not null,
  content text not null default '',
  mime_type text not null default 'text/plain',
  is_protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, site_id, path)
);

create index if not exists site_files_user_id_idx on public.site_files(user_id);
create index if not exists site_files_site_id_idx on public.site_files(site_id);
create index if not exists site_files_path_idx on public.site_files(site_id, path);

alter table public.site_files enable row level security;
drop policy if exists "site files own rows" on public.site_files;
create policy "site files own rows"
on public.site_files for all
using (auth.uid()=user_id)
with check (auth.uid()=user_id);

create table if not exists public.site_file_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  file_id uuid not null references public.site_files(id) on delete cascade,
  path text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists site_file_versions_user_id_idx on public.site_file_versions(user_id);
create index if not exists site_file_versions_file_id_idx on public.site_file_versions(file_id);
create index if not exists site_file_versions_created_at_idx on public.site_file_versions(created_at desc);

alter table public.site_file_versions enable row level security;
drop policy if exists "site file versions own rows" on public.site_file_versions;
create policy "site file versions own rows"
on public.site_file_versions for select
using (auth.uid()=user_id);

create or replace function public.snapshot_site_file()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='UPDATE' and old.content is distinct from new.content then
    insert into public.site_file_versions(user_id,site_id,file_id,path,content)
    values(old.user_id,old.site_id,old.id,old.path,old.content);
  end if;
  return new;
end;
$$;

drop trigger if exists snapshot_site_file_before_update on public.site_files;
create trigger snapshot_site_file_before_update
before update on public.site_files
for each row execute procedure public.snapshot_site_file();

create or replace function public.seed_site_workspace()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.site_files(user_id,site_id,path,content,mime_type,is_protected)
  values
   (new.user_id,new.id,'index.html','<!doctype html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>'+replace(new.name,'&','&amp;')+'</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n<main>\n  <h1>'+replace(new.name,'&','&amp;')+'</h1>\n  <p>Welcome to your website. Edit this file from mPanel.</p>\n</main>\n<script src="script.js"></script>\n</body>\n</html>','text/html',true),
   (new.user_id,new.id,'style.css','body{font-family:system-ui,sans-serif;margin:0;padding:48px;background:#f8fafc;color:#0f172a}main{max-width:900px;margin:auto;background:white;padding:40px;border-radius:20px;box-shadow:0 20px 50px rgba(15,23,42,.08)}h1{font-size:42px;margin-top:0}','text/css',false),
   (new.user_id,new.id,'script.js','document.documentElement.dataset.mpanel="preview";','text/javascript',false)
  on conflict(user_id,site_id,path) do nothing;
  return new;
end;
$$;

drop trigger if exists seed_site_workspace_after_insert on public.sites;
create trigger seed_site_workspace_after_insert
after insert on public.sites
for each row execute procedure public.seed_site_workspace();

create or replace function public.lock_site_file_owner()
returns trigger language plpgsql as $$
begin
  new.user_id:=old.user_id;
  new.site_id:=old.site_id;
  return new;
end;
$$;

drop trigger if exists lock_site_file_owner_trigger on public.site_files;
create trigger lock_site_file_owner_trigger
before update on public.site_files
for each row execute procedure public.lock_site_file_owner();
