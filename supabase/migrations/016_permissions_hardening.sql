-- mPanel 016: role-aware permission reporting and administration hardening

create or replace function public.get_site_permissions(p_site_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'site_id', m.site_id,
        'role', m.role,
        'owner', m.role='owner',
        'admin', m.role in ('owner','admin'),
        'editor', m.role in ('owner','admin','editor'),
        'author', m.role in ('owner','admin','editor','author'),
        'viewer', true
      )
      from public.site_members m
      where m.site_id=p_site_id
        and m.user_id=auth.uid()
      limit 1
    ),
    jsonb_build_object(
      'site_id', p_site_id,
      'role', null,
      'owner', false,
      'admin', false,
      'editor', false,
      'author', false,
      'viewer', false
    )
  );
$$;

revoke all on function public.get_site_permissions(uuid) from public;
grant execute on function public.get_site_permissions(uuid) to authenticated;

-- Owners remain the canonical owner of every site.
create or replace function public.is_site_admin(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_site_member(p_site_id,array['owner','admin']);
$$;

revoke all on function public.is_site_admin(uuid) from public;
grant execute on function public.is_site_admin(uuid) to authenticated;

-- Prevent privileged roles from being changed into another owner through the
-- generic member management RPC.
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
  if not public.is_site_member(p_site_id,array['owner','admin']) then
    raise exception 'Not authorized';
  end if;

  if p_role not in ('admin','editor','author','viewer') then
    raise exception 'Invalid role';
  end if;

  if exists (
    select 1 from public.site_members
    where site_id=p_site_id
      and user_id=p_user_id
      and role='owner'
  ) then
    raise exception 'The site owner role cannot be changed';
  end if;

  insert into public.site_members(site_id,user_id,role)
  values(p_site_id,p_user_id,p_role)
  on conflict(site_id,user_id)
  do update set role=excluded.role;
end;
$$;

revoke all on function public.manage_site_member(uuid,uuid,text) from public;
grant execute on function public.manage_site_member(uuid,uuid,text) to authenticated;

-- An administrator cannot remove the owner; only the owner can remove
-- non-owner members.
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
  if not public.is_site_member(p_site_id,array['owner']) then
    raise exception 'Only the owner can remove members';
  end if;

  delete from public.site_members
  where site_id=p_site_id
    and user_id=p_user_id
    and role <> 'owner';
end;
$$;

revoke all on function public.remove_site_member(uuid,uuid) from public;
grant execute on function public.remove_site_member(uuid,uuid) to authenticated;

-- Keep administration records protected from direct anonymous access.
revoke all on table public.site_members from anon;
revoke all on table public.site_admin_settings from anon;
revoke all on table public.site_backups from anon;
