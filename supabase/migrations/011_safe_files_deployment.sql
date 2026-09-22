-- mPanel 011: safe file recovery and verified deployment metadata
alter table public.site_files add column if not exists deleted_at timestamptz;
alter table public.site_files add column if not exists deleted_by uuid references auth.users(id) on delete set null;
create index if not exists idx_site_files_active on public.site_files(site_id,deleted_at,path);
do $$
begin
  if exists(select 1 from pg_constraint where conname='site_files_user_id_site_id_path_key' and conrelid='public.site_files'::regclass) then
    alter table public.site_files drop constraint site_files_user_id_site_id_path_key;
  end if;
end $$;
create unique index if not exists site_files_active_path_unique
on public.site_files(user_id,site_id,path)
where deleted_at is null;

alter table public.deployments add column if not exists build_hash text not null default '';
alter table public.deployments add column if not exists verified boolean not null default false;
alter table public.deployments add column if not exists verification_status text not null default 'pending'
  check(verification_status in ('pending','verified','failed'));
alter table public.deployments add column if not exists verification_message text not null default '';
alter table public.deployments add column if not exists verified_at timestamptz;
alter table public.deployments add column if not exists deleted_files integer not null default 0;
alter table public.deployments add column if not exists manifest_sha text;
alter table public.deployments add column if not exists previous_commit_sha text;
alter table public.deployments add column if not exists rollback_of uuid references public.deployments(id) on delete set null;
create index if not exists idx_deployments_site_status on public.deployments(site_id,status,created_at desc);

create or replace function public.lock_site_file_delete_owner()
returns trigger language plpgsql as $$
begin
  new.user_id:=old.user_id;
  new.site_id:=old.site_id;
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_by:=coalesce(new.deleted_by,auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists lock_site_file_delete_owner_trigger on public.site_files;
create trigger lock_site_file_delete_owner_trigger
before update on public.site_files
for each row execute function public.lock_site_file_delete_owner();

insert into public.system_checks(user_id,site_id,check_key,status,message)
select s.user_id,s.id,'deployment_verification','pending','Deployment verification not checked yet'
from public.sites s
on conflict(site_id,check_key) do nothing;
insert into public.builder_templates(user_id,site_id,name,slug,template_type,is_default,settings)
select s.user_id,s.id,'Archive','archive-template','archive',true,'{"seo":{"noindex":false}}'::jsonb
from public.sites s
on conflict(site_id,slug) do nothing;
insert into public.builder_templates(user_id,site_id,name,slug,template_type,is_default,settings)
select s.user_id,s.id,'404 Page','404-template','404',true,'{"seo":{"noindex":true}}'::jsonb
from public.sites s
on conflict(site_id,slug) do nothing;
