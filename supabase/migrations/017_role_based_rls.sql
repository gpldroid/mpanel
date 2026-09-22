-- mPanel 017: role-aware RLS for site workspaces

create or replace function public.site_role(p_site_id uuid)
returns text
language sql
stable
security definer
set search_path=public
as $$
  select role from public.site_members
  where site_id=p_site_id and user_id=auth.uid()
  limit 1;
$$;

revoke all on function public.site_role(uuid) from public;
grant execute on function public.site_role(uuid) to authenticated;

create or replace function public.site_can_write(p_site_id uuid, p_area text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select case
    when public.site_role(p_site_id) in ('owner','admin') then true
    when p_area='content' and public.site_role(p_site_id) in ('editor','author') then true
    when p_area='design' and public.site_role(p_site_id)='editor' then true
    else false
  end;
$$;

revoke all on function public.site_can_write(uuid,text) from public;
grant execute on function public.site_can_write(uuid,text) to authenticated;

create or replace function public.protect_site_row_user_id()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='UPDATE' and old.user_id <> new.user_id then
    if not public.is_site_member(old.site_id,array['owner']) then
      raise exception 'Only the site owner can change row ownership';
    end if;
  end if;
  return new;
end;
$$;

-- CMS
drop policy if exists cms_members_select on public.posts;
create policy cms_members_select on public.posts for select
using(public.is_site_member(site_id));

drop policy if exists cms_members_insert on public.posts;
create policy cms_members_insert on public.posts for insert
with check(public.site_can_write(site_id,'content') and user_id=auth.uid());

drop policy if exists cms_members_update on public.posts;
create policy cms_members_update on public.posts for update
using(public.site_can_write(site_id,'content'))
with check(public.site_can_write(site_id,'content'));

drop policy if exists cms_members_delete on public.posts;
create policy cms_members_delete on public.posts for delete
using(public.is_site_member(site_id,array['owner','admin','editor']));

drop policy if exists cms_pages_members_select on public.pages;
create policy cms_pages_members_select on public.pages for select
using(public.is_site_member(site_id));

drop policy if exists cms_pages_members_insert on public.pages;
create policy cms_pages_members_insert on public.pages for insert
with check(public.site_can_write(site_id,'content') and user_id=auth.uid());

drop policy if exists cms_pages_members_update on public.pages;
create policy cms_pages_members_update on public.pages for update
using(public.site_can_write(site_id,'content'))
with check(public.site_can_write(site_id,'content'));

drop policy if exists cms_pages_members_delete on public.pages;
create policy cms_pages_members_delete on public.pages for delete
using(public.is_site_member(site_id,array['owner','admin','editor']));

drop policy if exists taxonomy_members_select on public.categories;
create policy taxonomy_members_select on public.categories for select using(public.is_site_member(site_id));
drop policy if exists taxonomy_members_write on public.categories;
create policy taxonomy_members_write on public.categories for all
using(public.site_can_write(site_id,'content'))
with check(public.site_can_write(site_id,'content') and user_id=auth.uid());

drop policy if exists tags_members_select on public.tags;
create policy tags_members_select on public.tags for select using(public.is_site_member(site_id));
drop policy if exists tags_members_write on public.tags;
create policy tags_members_write on public.tags for all
using(public.site_can_write(site_id,'content'))
with check(public.site_can_write(site_id,'content') and user_id=auth.uid());

-- Design
do $$
declare t text;
begin
  foreach t in array array['layout_sections','widgets','menus','menu_items','theme_settings'] loop
    execute format('drop policy if exists role_members_select on public.%I',t);
    execute format('create policy role_members_select on public.%I for select using(public.is_site_member(site_id))',t);
    execute format('drop policy if exists role_members_write on public.%I',t);
    execute format('create policy role_members_write on public.%I for all using(public.site_can_write(site_id,''design'')) with check(public.site_can_write(site_id,''design''))',t);
  end loop;
end $$;

-- Platform/workspace data
do $$
declare t text;
begin
  foreach t in array array[
    'media_folders','media_assets','builder_templates','builder_blocks',
    'seo_redirects','domain_verifications','site_security_settings',
    'site_performance_settings','system_checks'
  ] loop
    execute format('drop policy if exists platform_members_select on public.%I',t);
    execute format('create policy platform_members_select on public.%I for select using(public.is_site_member(site_id))',t);
    execute format('drop policy if exists platform_admin_write on public.%I',t);
    execute format('create policy platform_admin_write on public.%I for all using(public.is_site_member(site_id,array[''owner'',''admin''])) with check(public.is_site_member(site_id,array[''owner'',''admin'']))',t);
  end loop;
end $$;

-- SEO and deployment controls
drop policy if exists seo_members_select on public.site_seo_settings;
create policy seo_members_select on public.site_seo_settings for select using(public.is_site_member(site_id));
drop policy if exists seo_admin_write on public.site_seo_settings;
create policy seo_admin_write on public.site_seo_settings for all
using(public.is_site_member(site_id,array['owner','admin']))
with check(public.is_site_member(site_id,array['owner','admin']));

drop policy if exists deployment_members_select on public.deployments;
create policy deployment_members_select on public.deployments for select using(public.is_site_member(site_id));
drop policy if exists deployment_admin_write on public.deployments;
create policy deployment_admin_write on public.deployments for all
using(public.is_site_member(site_id,array['owner','admin']))
with check(public.is_site_member(site_id,array['owner','admin']));

-- Prevent non-owner members from transferring ownership on workspace rows.
do $$
declare t text;
begin
  foreach t in array array[
    'posts','pages','categories','tags','layout_sections','widgets','menus',
    'menu_items','theme_settings','media_folders','media_assets',
    'builder_templates','builder_blocks','seo_redirects','domain_verifications',
    'site_security_settings','site_performance_settings','system_checks',
    'site_seo_settings','deployments'
  ] loop
    execute format('drop trigger if exists protect_%s_user_id on public.%I',replace(t,'-','_'),t);
    execute format('create trigger protect_%s_user_id before update on public.%I for each row execute function public.protect_site_row_user_id()',replace(t,'-','_'),t);
  end loop;
end $$;
