-- mPanel 015: website administration, roles, backups and maintenance controls

create table if not exists public.site_members (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.sites(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'viewer' check(role in ('owner','admin','editor','author','viewer')),
 created_at timestamptz not null default now(),
 unique(site_id,user_id)
);

create table if not exists public.site_admin_settings (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.sites(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 maintenance_mode boolean not null default false,
 maintenance_message text not null default 'This website is temporarily unavailable for maintenance.',
 cache_version text not null default '1',
 build_cache_cleared_at timestamptz,
 github_auto_publish boolean not null default false,
 github_allow_force_push boolean not null default false,
 github_branch text not null default 'main',
 updated_at timestamptz not null default now(),
 unique(site_id)
);

create table if not exists public.site_backups (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.sites(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,
 files_snapshot jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);

create index if not exists site_members_site_idx on public.site_members(site_id);
create index if not exists site_members_user_idx on public.site_members(user_id);
create index if not exists site_backups_site_created_idx on public.site_backups(site_id,created_at desc);

alter table public.site_members enable row level security;
alter table public.site_admin_settings enable row level security;
alter table public.site_backups enable row level security;

create or replace function public.is_site_member(p_site_id uuid,p_roles text[] default null)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(
   select 1 from public.site_members m
   where m.site_id=p_site_id and m.user_id=auth.uid()
     and (p_roles is null or m.role=any(p_roles))
 );
$$;

create or replace function public.seed_site_admin()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.site_members(site_id,user_id,role) values(new.id,new.user_id,'owner') on conflict(site_id,user_id) do update set role='owner';
 insert into public.site_admin_settings(site_id,user_id) values(new.id,new.user_id) on conflict(site_id) do nothing;
 return new;
end $$;

drop trigger if exists seed_site_admin_after_site on public.sites;
create trigger seed_site_admin_after_site after insert on public.sites for each row execute function public.seed_site_admin();

insert into public.site_members(site_id,user_id,role)
select id,user_id,'owner' from public.sites
on conflict(site_id,user_id) do update set role='owner';

insert into public.site_admin_settings(site_id,user_id)
select id,user_id from public.sites
on conflict(site_id) do nothing;

drop policy if exists site_members_select on public.site_members;
create policy site_members_select on public.site_members for select using(is_site_member(site_id));
drop policy if exists site_members_manage on public.site_members;
create policy site_members_manage on public.site_members for all
using(is_site_member(site_id,array['owner','admin']))
with check(is_site_member(site_id,array['owner','admin']));

drop policy if exists site_admin_select on public.site_admin_settings;
create policy site_admin_select on public.site_admin_settings for select using(is_site_member(site_id));
drop policy if exists site_admin_manage on public.site_admin_settings;
create policy site_admin_manage on public.site_admin_settings for update
using(is_site_member(site_id,array['owner','admin']))
with check(is_site_member(site_id,array['owner','admin']));

drop policy if exists site_backups_select on public.site_backups;
create policy site_backups_select on public.site_backups for select using(is_site_member(site_id));
drop policy if exists site_backups_insert on public.site_backups;
create policy site_backups_insert on public.site_backups for insert
with check(is_site_member(site_id,array['owner','admin']));
drop policy if exists site_backups_delete on public.site_backups;
create policy site_backups_delete on public.site_backups for delete
using(is_site_member(site_id,array['owner','admin']));

create or replace function public.create_site_backup(p_site_id uuid,p_name text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare backup_id uuid;
begin
 if not is_site_member(p_site_id,array['owner','admin']) then raise exception 'Not authorized'; end if;
 insert into public.site_backups(site_id,user_id,name,files_snapshot)
 select p_site_id,auth.uid(),coalesce(nullif(p_name,''),'Backup '||to_char(now(),'YYYY-MM-DD HH24:MI')),
 coalesce(jsonb_agg(jsonb_build_object('path',f.path,'content',f.content,'mime_type',f.mime_type,'is_protected',f.is_protected) order by f.path),'[]'::jsonb)
 from public.site_files f where f.site_id=p_site_id and f.deleted_at is null
 returning id into backup_id;
 return backup_id;
end $$;

create or replace function public.restore_site_backup(p_backup_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare b record,item jsonb,n integer:=0;
begin
 select * into b from public.site_backups where id=p_backup_id;
 if not found or not is_site_member(b.site_id,array['owner','admin']) then raise exception 'Backup not found or not authorized'; end if;
 for item in select * from jsonb_array_elements(b.files_snapshot) loop
   update public.site_files set content=item->>'content',mime_type=coalesce(item->>'mime_type','text/plain'),is_protected=coalesce((item->>'is_protected')::boolean,false),updated_at=now(),deleted_at=null
   where site_id=b.site_id and path=item->>'path';
   if not found then
     insert into public.site_files(user_id,site_id,path,content,mime_type,is_protected)
     values(auth.uid(),b.site_id,item->>'path',coalesce(item->>'content',''),coalesce(item->>'mime_type','text/plain'),coalesce((item->>'is_protected')::boolean,false));
   end if;
   n:=n+1;
 end loop;
 return n;
end $$;

create or replace function public.clear_site_build_cache(p_site_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_site_member(p_site_id,array['owner','admin']) then raise exception 'Not authorized'; end if;
 update public.site_admin_settings set cache_version=md5(clock_timestamp()::text||random()::text),build_cache_cleared_at=now(),updated_at=now() where site_id=p_site_id;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'site.cache_cleared','site',p_site_id,jsonb_build_object('cache_version',(select cache_version from public.site_admin_settings where site_id=p_site_id)));
end $$;

create or replace function public.manage_site_member(p_site_id uuid,p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_site_member(p_site_id,array['owner','admin']) then raise exception 'Not authorized'; end if;
 if p_role not in ('admin','editor','author','viewer') then raise exception 'Invalid role'; end if;
 insert into public.site_members(site_id,user_id,role) values(p_site_id,p_user_id,p_role)
 on conflict(site_id,user_id) do update set role=excluded.role;
end $$;

create or replace function public.remove_site_member(p_site_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_site_member(p_site_id,array['owner']) then raise exception 'Only the owner can remove members'; end if;
 delete from public.site_members where site_id=p_site_id and user_id=p_user_id and role<>'owner';
end $$;

revoke all on function public.is_site_member(uuid,text[]) from public;
revoke all on function public.create_site_backup(uuid,text) from public;
revoke all on function public.restore_site_backup(uuid) from public;
revoke all on function public.clear_site_build_cache(uuid) from public;
revoke all on function public.manage_site_member(uuid,uuid,text) from public;
revoke all on function public.remove_site_member(uuid,uuid) from public;
grant execute on function public.is_site_member(uuid,text[]) to authenticated;
grant execute on function public.create_site_backup(uuid,text) to authenticated;
grant execute on function public.restore_site_backup(uuid) to authenticated;
grant execute on function public.clear_site_build_cache(uuid) to authenticated;
grant execute on function public.manage_site_member(uuid,uuid,text) to authenticated;
grant execute on function public.remove_site_member(uuid,uuid) to authenticated;


create or replace function public.update_site_general_settings(p_site_id uuid,p_name text,p_url text,p_description text,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not is_site_member(p_site_id,array['owner','admin']) then raise exception 'Not authorized'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Website name is required'; end if;
 if p_status not in ('active','paused') then raise exception 'Invalid site status'; end if;
 update public.sites set name=trim(p_name),url=trim(p_url),description=coalesce(p_description,''),status=p_status,updated_at=now() where id=p_site_id;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'site.settings_updated','site',p_site_id,jsonb_build_object('name',trim(p_name),'url',trim(p_url),'status',p_status));
end $$;

revoke all on function public.update_site_general_settings(uuid,text,text,text,text) from public;
grant execute on function public.update_site_general_settings(uuid,text,text,text,text) to authenticated;

drop policy if exists "audit site members read" on public.audit_logs;
create policy "audit site members read" on public.audit_logs for select
using (
 auth.uid()=user_id
 or (entity_type='site' and entity_id is not null and public.is_site_member(entity_id))
);
