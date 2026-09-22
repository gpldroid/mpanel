-- mPanel 016: role-aware RLS for the website administration model
-- Existing owner policies remain; these additional policies grant only the intended site-member capabilities.

create or replace function public.site_role(p_site_id uuid)
returns text
language sql
stable
security definer
set search_path=public
as $$
  select role
  from public.site_members
  where site_id=p_site_id and user_id=auth.uid()
  limit 1
$$;

revoke all on function public.site_role(uuid) from public;
grant execute on function public.site_role(uuid) to authenticated;

-- A member may see the website record, while only its owner can change ownership-level fields.
drop policy if exists sites_member_select on public.sites;
create policy sites_member_select on public.sites
for select using (public.is_site_member(id));

-- Domains: members may inspect; only owner/admin may manage.
drop policy if exists domains_member_select on public.domains;
create policy domains_member_select on public.domains
for select using (public.is_site_member(site_id));

drop policy if exists domains_admin_manage on public.domains;
create policy domains_admin_manage on public.domains
for all
using (public.is_site_member(site_id,array['owner','admin']))
with check (public.is_site_member(site_id,array['owner','admin']));

-- Workspace files: every site member may read; owner/admin/editor may edit.
drop policy if exists site_files_member_select on public.site_files;
create policy site_files_member_select on public.site_files
for select using (public.is_site_member(site_id));

drop policy if exists site_files_editor_manage on public.site_files;
create policy site_files_editor_manage on public.site_files
for all
using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (
  public.is_site_member(site_id,array['owner','admin','editor'])
  and user_id=auth.uid()
);

drop policy if exists site_file_versions_member_select on public.site_file_versions;
create policy site_file_versions_member_select on public.site_file_versions
for select using (public.is_site_member(site_id));

-- CMS read access follows site membership. Write access follows the CMS role matrix.
drop policy if exists categories_member_select on public.categories;
create policy categories_member_select on public.categories
for select using (public.is_site_member(site_id));
drop policy if exists categories_editor_manage on public.categories;
create policy categories_editor_manage on public.categories
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists tags_member_select on public.tags;
create policy tags_member_select on public.tags
for select using (public.is_site_member(site_id));
drop policy if exists tags_editor_manage on public.tags;
create policy tags_editor_manage on public.tags
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists posts_member_select on public.posts;
create policy posts_member_select on public.posts
for select using (public.is_site_member(site_id));
drop policy if exists posts_editor_manage on public.posts;
create policy posts_editor_manage on public.posts
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());
drop policy if exists posts_author_manage on public.posts;
create policy posts_author_manage on public.posts
for all using (public.site_role(site_id)='author' and user_id=auth.uid())
with check (public.site_role(site_id)='author' and user_id=auth.uid());

drop policy if exists pages_member_select on public.pages;
create policy pages_member_select on public.pages
for select using (public.is_site_member(site_id));
drop policy if exists pages_editor_manage on public.pages;
create policy pages_editor_manage on public.pages
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

-- Design: owner/admin/editor can change the website design; all members can inspect it.
drop policy if exists layout_member_select on public.layout_sections;
create policy layout_member_select on public.layout_sections
for select using (public.is_site_member(site_id));
drop policy if exists layout_editor_manage on public.layout_sections;
create policy layout_editor_manage on public.layout_sections
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists widgets_member_select on public.widgets;
create policy widgets_member_select on public.widgets
for select using (public.is_site_member(site_id));
drop policy if exists widgets_editor_manage on public.widgets;
create policy widgets_editor_manage on public.widgets
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists menus_member_select on public.menus;
create policy menus_member_select on public.menus
for select using (public.is_site_member(site_id));
drop policy if exists menus_editor_manage on public.menus;
create policy menus_editor_manage on public.menus
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists menu_items_member_select on public.menu_items;
create policy menu_items_member_select on public.menu_items
for select using (public.is_site_member(site_id));
drop policy if exists menu_items_editor_manage on public.menu_items;
create policy menu_items_editor_manage on public.menu_items
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists theme_member_select on public.theme_settings;
create policy theme_member_select on public.theme_settings
for select using (public.is_site_member(site_id));
drop policy if exists theme_editor_manage on public.theme_settings;
create policy theme_editor_manage on public.theme_settings
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

-- Phase 3: SEO can be edited by owner/admin/editor; GitHub/deployments remain owner/admin.
drop policy if exists site_seo_member_select on public.site_seo_settings;
create policy site_seo_member_select on public.site_seo_settings
for select using (public.is_site_member(site_id));
drop policy if exists site_seo_editor_manage on public.site_seo_settings;
create policy site_seo_editor_manage on public.site_seo_settings
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists revisions_member_select on public.content_revisions;
create policy revisions_member_select on public.content_revisions
for select using (public.is_site_member(site_id));
drop policy if exists revisions_editor_manage on public.content_revisions;
create policy revisions_editor_manage on public.content_revisions
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists integrations_member_select on public.site_integrations;
create policy integrations_member_select on public.site_integrations
for select using (public.is_site_member(site_id));
drop policy if exists integrations_admin_manage on public.site_integrations;
create policy integrations_admin_manage on public.site_integrations
for all using (public.is_site_member(site_id,array['owner','admin']))
with check (public.is_site_member(site_id,array['owner','admin']) and user_id=auth.uid());

drop policy if exists deployments_member_select on public.deployments;
create policy deployments_member_select on public.deployments
for select using (public.is_site_member(site_id));

-- Platform controls: members can inspect, admins control production configuration.
drop policy if exists security_member_select on public.site_security_settings;
create policy security_member_select on public.site_security_settings
for select using (public.is_site_member(site_id));
drop policy if exists security_admin_manage on public.site_security_settings;
create policy security_admin_manage on public.site_security_settings
for all using (public.is_site_member(site_id,array['owner','admin']))
with check (public.is_site_member(site_id,array['owner','admin']) and user_id=auth.uid());

drop policy if exists performance_member_select on public.site_performance_settings;
create policy performance_member_select on public.site_performance_settings
for select using (public.is_site_member(site_id));
drop policy if exists performance_admin_manage on public.site_performance_settings;
create policy performance_admin_manage on public.site_performance_settings
for all using (public.is_site_member(site_id,array['owner','admin']))
with check (public.is_site_member(site_id,array['owner','admin']) and user_id=auth.uid());

drop policy if exists redirects_member_select on public.seo_redirects;
create policy redirects_member_select on public.seo_redirects
for select using (public.is_site_member(site_id));
drop policy if exists redirects_admin_manage on public.seo_redirects;
create policy redirects_admin_manage on public.seo_redirects
for all using (public.is_site_member(site_id,array['owner','admin']))
with check (public.is_site_member(site_id,array['owner','admin']) and user_id=auth.uid());

drop policy if exists media_member_select on public.media_assets;
create policy media_member_select on public.media_assets
for select using (public.is_site_member(site_id));
drop policy if exists media_editor_manage on public.media_assets;
create policy media_editor_manage on public.media_assets
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists media_folders_member_select on public.media_folders;
create policy media_folders_member_select on public.media_folders
for select using (public.is_site_member(site_id));
drop policy if exists media_folders_editor_manage on public.media_folders;
create policy media_folders_editor_manage on public.media_folders
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists builder_templates_member_select on public.builder_templates;
create policy builder_templates_member_select on public.builder_templates
for select using (public.is_site_member(site_id));
drop policy if exists builder_templates_editor_manage on public.builder_templates;
create policy builder_templates_editor_manage on public.builder_templates
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists builder_blocks_member_select on public.builder_blocks;
create policy builder_blocks_member_select on public.builder_blocks
for select using (public.is_site_member(site_id));
drop policy if exists builder_blocks_editor_manage on public.builder_blocks;
create policy builder_blocks_editor_manage on public.builder_blocks
for all using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']) and user_id=auth.uid());

drop policy if exists domain_verifications_member_select on public.domain_verifications;
create policy domain_verifications_member_select on public.domain_verifications
for select using (public.is_site_member(site_id));
drop policy if exists domain_verifications_admin_manage on public.domain_verifications;
create policy domain_verifications_admin_manage on public.domain_verifications
for all using (public.is_site_member(site_id,array['owner','admin']))
with check (public.is_site_member(site_id,array['owner','admin']) and user_id=auth.uid());

drop policy if exists system_checks_member_select on public.system_checks;
create policy system_checks_member_select on public.system_checks
for select using (public.is_site_member(site_id));

-- Analytics settings are admin-level; analytics event ingestion remains RPC-controlled.
drop policy if exists analytics_settings_member_select on public.site_analytics_settings;
create policy analytics_settings_member_select on public.site_analytics_settings
for select using (public.is_site_member(site_id));
drop policy if exists analytics_settings_admin_manage on public.site_analytics_settings;
create policy analytics_settings_admin_manage on public.site_analytics_settings
for all using (public.is_site_member(site_id,array['owner','admin']))
with check (public.is_site_member(site_id,array['owner','admin']) and user_id=auth.uid());

drop policy if exists analytics_events_member_select on public.analytics_events;
create policy analytics_events_member_select on public.analytics_events
for select using (public.is_site_member(site_id));

-- Strengthen administration member management: never modify or remove the owner.
create or replace function public.manage_site_member(p_site_id uuid,p_user_id uuid,p_role text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare existing_role text;
begin
  if not is_site_member(p_site_id,array['owner','admin']) then
    raise exception 'Not authorized';
  end if;
  if p_role not in ('admin','editor','author','viewer') then
    raise exception 'Invalid role';
  end if;

  select role into existing_role
  from public.site_members
  where site_id=p_site_id and user_id=p_user_id;

  if existing_role='owner' then
    raise exception 'The site owner role cannot be changed';
  end if;

  if site_role(p_site_id)='admin' and p_role='admin' then
    raise exception 'Only the site owner can assign the admin role';
  end if;

  insert into public.site_members(site_id,user_id,role)
  values(p_site_id,p_user_id,p_role)
  on conflict(site_id,user_id)
  do update set role=excluded.role;

  perform public.write_audit_log(
    'site.member_role_changed',
    'site',
    p_site_id,
    jsonb_build_object('target_user_id',p_user_id,'role',p_role)
  );
end
$$;

create or replace function public.remove_site_member(p_site_id uuid,p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare target_role text;
begin
  if not is_site_member(p_site_id,array['owner']) then
    raise exception 'Only the owner can remove members';
  end if;

  select role into target_role
  from public.site_members
  where site_id=p_site_id and user_id=p_user_id;

  if target_role='owner' then
    raise exception 'The site owner cannot be removed';
  end if;

  delete from public.site_members
  where site_id=p_site_id
    and user_id=p_user_id
    and role<>'owner';

  perform public.write_audit_log(
    'site.member_removed',
    'site',
    p_site_id,
    jsonb_build_object('target_user_id',p_user_id)
  );
end
$$;

-- Avoid exposing helper functions to unauthenticated callers.
revoke all on function public.site_role(uuid) from public;
grant execute on function public.site_role(uuid) to authenticated;
