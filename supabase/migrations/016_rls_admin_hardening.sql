-- mPanel 016: RLS and privilege hardening for website administration

-- Keep ownership metadata immutable when using the administration tables.
create or replace function public.lock_site_admin_metadata()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.site_id := old.site_id;
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists lock_site_admin_settings_metadata on public.site_admin_settings;
create trigger lock_site_admin_settings_metadata
before update on public.site_admin_settings
for each row execute function public.lock_site_admin_metadata();

-- Backups always belong to the authenticated actor who created them.
create or replace function public.lock_backup_owner()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op = 'UPDATE' then
    new.site_id := old.site_id;
    new.user_id := old.user_id;
    new.files_snapshot := old.files_snapshot;
  elsif tg_op = 'INSERT' then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists lock_site_backup_owner on public.site_backups;
create trigger lock_site_backup_owner
before insert or update on public.site_backups
for each row execute function public.lock_backup_owner();

-- Direct table writes to membership are intentionally restricted.
-- Role changes/removals must go through the checked RPCs below.
drop policy if exists site_members_manage on public.site_members;
drop policy if exists site_members_insert on public.site_members;
drop policy if exists site_members_update on public.site_members;
drop policy if exists site_members_delete on public.site_members;

create policy site_members_insert
on public.site_members
for insert
with check (
  public.is_site_member(site_id,array['owner','admin'])
  and role in ('admin','editor','author','viewer')
  and user_id <> auth.uid()
);

create policy site_members_update
on public.site_members
for update
using (
  public.is_site_member(site_id,array['owner'])
  and role <> 'owner'
)
with check (
  public.is_site_member(site_id,array['owner'])
  and role in ('admin','editor','author','viewer')
  and user_id <> auth.uid()
);

create policy site_members_delete
on public.site_members
for delete
using (
  public.is_site_member(site_id,array['owner'])
  and role <> 'owner'
);

-- The RPCs remain the canonical management path.
create or replace function public.manage_site_member(
  p_site_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_site_member(p_site_id,array['owner','admin']) then
    raise exception 'Not authorized';
  end if;

  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'Invalid member user';
  end if;

  if p_role not in ('admin','editor','author','viewer') then
    raise exception 'Invalid role';
  end if;

  -- Admins may manage non-owner members but may not grant/remove ownership.
  insert into public.site_members(site_id,user_id,role)
  values(p_site_id,p_user_id,p_role)
  on conflict(site_id,user_id)
  do update set role=excluded.role
  where public.is_site_member(p_site_id,array['owner'])
     or public.site_members.role <> 'owner';

  if not found then
    raise exception 'Only the owner can change an existing owner member';
  end if;

  perform public.write_audit_log(
    'site.member_role_changed',
    'site',
    p_site_id,
    jsonb_build_object('member_user_id',p_user_id,'role',p_role)
  );
end;
$$;

create or replace function public.remove_site_member(
  p_site_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_site_member(p_site_id,array['owner']) then
    raise exception 'Only the owner can remove members';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'The owner cannot remove themselves';
  end if;

  delete from public.site_members
  where site_id=p_site_id
    and user_id=p_user_id
    and role <> 'owner';

  perform public.write_audit_log(
    'site.member_removed',
    'site',
    p_site_id,
    jsonb_build_object('member_user_id',p_user_id)
  );
end;
$$;

revoke all on function public.manage_site_member(uuid,uuid,text) from public;
revoke all on function public.remove_site_member(uuid,uuid) from public;
grant execute on function public.manage_site_member(uuid,uuid,text) to authenticated;
grant execute on function public.remove_site_member(uuid,uuid) to authenticated;

-- Only site administrators may mutate administration settings.
drop policy if exists site_admin_manage on public.site_admin_settings;
create policy site_admin_update
on public.site_admin_settings
for update
using (public.is_site_member(site_id,array['owner','admin']))
with check (public.is_site_member(site_id,array['owner','admin']));

-- Backups: members may see backups, administrators create/restore/delete.
drop policy if exists site_backups_select on public.site_backups;
create policy site_backups_select
on public.site_backups
for select
using (public.is_site_member(site_id));

drop policy if exists site_backups_insert on public.site_backups;
create policy site_backups_insert
on public.site_backups
for insert
with check (
  public.is_site_member(site_id,array['owner','admin'])
  and user_id=auth.uid()
);

drop policy if exists site_backups_delete on public.site_backups;
create policy site_backups_delete
on public.site_backups
for delete
using (public.is_site_member(site_id,array['owner','admin']));

-- Explicitly deny direct writes to audit logs. Logging goes through write_audit_log().
drop policy if exists "audit own rows" on public.audit_logs;
drop policy if exists "audit site members read" on public.audit_logs;
create policy audit_site_members_read
on public.audit_logs
for select
using (
  auth.uid()=user_id
  or (
    entity_type='site'
    and entity_id is not null
    and public.is_site_member(entity_id)
  )
);

-- Keep helper functions inaccessible to anonymous clients.
revoke all on function public.is_site_member(uuid,text[]) from anon;
revoke all on function public.create_site_backup(uuid,text) from anon;
revoke all on function public.restore_site_backup(uuid) from anon;
revoke all on function public.clear_site_build_cache(uuid) from anon;
revoke all on function public.manage_site_member(uuid,uuid,text) from anon;
revoke all on function public.remove_site_member(uuid,uuid) from anon;
revoke all on function public.update_site_general_settings(uuid,text,text,text,text) from anon;
grant execute on function public.is_site_member(uuid,text[]) to authenticated;

-- Ensure administration rows exist for every existing site.
insert into public.site_admin_settings(site_id,user_id)
select s.id,s.user_id
from public.sites s
on conflict(site_id) do nothing;

insert into public.site_members(site_id,user_id,role)
select s.id,s.user_id,'owner'
from public.sites s
on conflict(site_id,user_id) do update set role='owner';
