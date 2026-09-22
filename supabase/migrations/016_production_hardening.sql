-- mPanel 016: production hardening and audit safeguards

create or replace function public.enforce_site_admin_owner()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  owner_id uuid;
begin
  select user_id into owner_id from public.sites where id=new.site_id;
  if owner_id is null then raise exception 'Site not found'; end if;
  new.user_id := owner_id;
  return new;
end;
$$;

drop trigger if exists site_admin_owner_guard on public.site_admin_settings;
create trigger site_admin_owner_guard
before insert or update on public.site_admin_settings
for each row execute function public.enforce_site_admin_owner();

create or replace function public.enforce_backup_owner()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  owner_id uuid;
begin
  select user_id into owner_id from public.sites where id=new.site_id;
  if owner_id is null then raise exception 'Site not found'; end if;
  new.user_id := owner_id;
  return new;
end;
$$;

drop trigger if exists backup_owner_guard on public.site_backups;
create trigger backup_owner_guard
before insert or update on public.site_backups
for each row execute function public.enforce_backup_owner();

alter table public.site_members drop constraint if exists site_members_role_check;
alter table public.site_members add constraint site_members_role_check
check(role in ('owner','admin','editor','author','viewer'));

create index if not exists audit_logs_entity_created_idx
on public.audit_logs(entity_type,entity_id,created_at desc);

create index if not exists site_admin_settings_site_idx
on public.site_admin_settings(site_id);

create index if not exists domain_verifications_site_status_idx
on public.domain_verifications(site_id,status);

create index if not exists deployments_site_created_idx
on public.deployments(site_id,created_at desc);

insert into public.system_checks(user_id,site_id,check_key,status,message,last_checked_at)
select s.user_id,s.id,'website_administration','pass',
       'Website administration controls and role-aware management are available.',
       now()
from public.sites s
on conflict (site_id,check_key) do update
set status=excluded.status,message=excluded.message,last_checked_at=excluded.last_checked_at;

insert into public.system_checks(user_id,site_id,check_key,status,message,last_checked_at)
select s.user_id,s.id,'production_hardening','pass',
       'Production hardening indexes and ownership guards are enabled.',
       now()
from public.sites s
on conflict (site_id,check_key) do update
set status=excluded.status,message=excluded.message,last_checked_at=excluded.last_checked_at;
