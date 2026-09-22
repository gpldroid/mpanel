-- mPanel 016: PostgreSQL Site -> Role -> Capability authorization
-- Capability matrix:
-- owner/admin: full site administration
-- editor: content, media, layout, builder, SEO
-- author: own posts/pages only
-- viewer: read-only

create or replace function public.site_has_capability(p_site_id uuid,p_capability text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
 select exists(
   select 1
   from public.site_members m
   where m.site_id=p_site_id
     and m.user_id=auth.uid()
     and (
       m.role in ('owner','admin')
       or (m.role='editor' and p_capability in (
         'content.read','content.write','media.read','media.write',
         'design.read','design.write','builder.read','builder.write',
         'seo.read','seo.write','analytics.read'
       ))
       or (m.role='author' and p_capability in ('content.read','content.own.write'))
       or (m.role='viewer' and p_capability in (
         'content.read','media.read','design.read','builder.read',
         'seo.read','analytics.read','deployment.read'
       ))
     )
 );
$$;

create or replace function public.site_role(p_site_id uuid)
returns text
language sql
stable
security definer
set search_path=public
as $$
 select m.role
 from public.site_members m
 where m.site_id=p_site_id and m.user_id=auth.uid()
 limit 1;
$$;

revoke all on function public.site_has_capability(uuid,text) from public;
revoke all on function public.site_role(uuid) from public;
grant execute on function public.site_has_capability(uuid,text) to authenticated;
grant execute on function public.site_role(uuid) to authenticated;

-- Generic ownership guard. Members cannot move records between users/sites.
create or replace function public.lock_site_record_owner()
returns trigger
language plpgsql
as $$
begin
  new.user_id := old.user_id;
  new.site_id := old.site_id;
  return new;
end;
$$;

-- Core site access.
drop policy if exists "sites own rows" on public.sites;
drop policy if exists sites_member_select on public.sites;
drop policy if exists sites_admin_update on public.sites;
drop policy if exists sites_owner_delete on public.sites;
drop policy if exists sites_create_own on public.sites;
create policy sites_member_select on public.sites for select
using (public.site_has_capability(id,'content.read'));
create policy sites_create_own on public.sites for insert
with check (auth.uid()=user_id);
create policy sites_admin_update on public.sites for update
using (public.site_has_capability(id,'admin'))
with check (public.site_has_capability(id,'admin'));
create policy sites_owner_delete on public.sites for delete
using (public.site_role(id)='owner');

-- Domains: owner/admin only for mutation, all members may inspect.
drop policy if exists "domains own rows" on public.domains;
drop policy if exists domains_member_select on public.domains;
drop policy if exists domains_admin_write on public.domains;
create policy domains_member_select on public.domains for select
using (public.site_has_capability(site_id,'content.read'));
create policy domains_admin_write on public.domains for all
using (public.site_has_capability(site_id,'admin'))
with check (public.site_has_capability(site_id,'admin'));

-- SEO checks: members read; editors/admins manage.
drop policy if exists "seo own rows" on public.seo_checks;
drop policy if exists seo_member_select on public.seo_checks;
drop policy if exists seo_editor_write on public.seo_checks;
create policy seo_member_select on public.seo_checks for select
using (public.site_has_capability(site_id,'seo.read'));
create policy seo_editor_write on public.seo_checks for all
using (public.site_has_capability(site_id,'seo.write'))
with check (public.site_has_capability(site_id,'seo.write'));

-- Workspace files: editor/admin write; everyone else read-only.
drop policy if exists "site files own rows" on public.site_files;
create policy site_files_member_select on public.site_files for select
using (public.site_has_capability(site_id,'content.read'));
create policy site_files_editor_write on public.site_files for insert
with check (public.site_has_capability(site_id,'design.write') and user_id=auth.uid());
create policy site_files_editor_update on public.site_files for update
using (public.site_has_capability(site_id,'design.write'))
with check (public.site_has_capability(site_id,'design.write'));
create policy site_files_admin_delete on public.site_files for delete
using (public.site_has_capability(site_id,'admin'));

drop policy if exists "site file versions own rows" on public.site_file_versions;
create policy site_file_versions_member_select on public.site_file_versions for select
using (public.site_has_capability(site_id,'content.read'));

-- CMS content.
drop policy if exists categories_owner_all on public.categories;
create policy categories_member_select on public.categories for select
using (public.site_has_capability(site_id,'content.read'));
create policy categories_editor_write on public.categories for all
using (public.site_has_capability(site_id,'content.write'))
with check (public.site_has_capability(site_id,'content.write') and user_id=auth.uid());

drop policy if exists tags_owner_all on public.tags;
create policy tags_member_select on public.tags for select
using (public.site_has_capability(site_id,'content.read'));
create policy tags_editor_write on public.tags for all
using (public.site_has_capability(site_id,'content.write'))
with check (public.site_has_capability(site_id,'content.write') and user_id=auth.uid());

drop policy if exists posts_owner_all on public.posts;
create policy posts_member_select on public.posts for select
using (public.site_has_capability(site_id,'content.read'));
create policy posts_editor_insert on public.posts for insert
with check (public.site_has_capability(site_id,'content.write') and user_id=auth.uid());
create policy posts_editor_update on public.posts for update
using (public.site_has_capability(site_id,'content.write'))
with check (public.site_has_capability(site_id,'content.write'));
create policy posts_author_insert on public.posts for insert
with check (public.site_has_capability(site_id,'content.own.write') and user_id=auth.uid());
create policy posts_author_update_own on public.posts for update
using (public.site_has_capability(site_id,'content.own.write') and user_id=auth.uid())
with check (public.site_has_capability(site_id,'content.own.write') and user_id=auth.uid());
create policy posts_editor_delete on public.posts for delete
using (public.site_has_capability(site_id,'content.write'));

drop policy if exists pages_owner_all on public.pages;
create policy pages_member_select on public.pages for select
using (public.site_has_capability(site_id,'content.read'));
create policy pages_editor_insert on public.pages for insert
with check (public.site_has_capability(site_id,'content.write') and user_id=auth.uid());
create policy pages_editor_update on public.pages for update
using (public.site_has_capability(site_id,'content.write'))
with check (public.site_has_capability(site_id,'content.write'));
create policy pages_author_insert on public.pages for insert
with check (public.site_has_capability(site_id,'content.own.write') and user_id=auth.uid());
create policy pages_author_update_own on public.pages for update
using (public.site_has_capability(site_id,'content.own.write') and user_id=auth.uid())
with check (public.site_has_capability(site_id,'content.own.write') and user_id=auth.uid());
create policy pages_editor_delete on public.pages for delete
using (public.site_has_capability(site_id,'content.write'));

drop policy if exists post_categories_owner_all on public.post_categories;
create policy post_categories_member_select on public.post_categories for select
using (exists(select 1 from public.posts p where p.id=post_id and public.site_has_capability(p.site_id,'content.read')));
create policy post_categories_content_write on public.post_categories for all
using (
  exists(select 1 from public.posts p where p.id=post_id and (
    public.site_has_capability(p.site_id,'content.write')
    or (public.site_has_capability(p.site_id,'content.own.write') and p.user_id=auth.uid())
  ))
)
with check (
  exists(select 1 from public.posts p where p.id=post_id and (
    public.site_has_capability(p.site_id,'content.write')
    or (public.site_has_capability(p.site_id,'content.own.write') and p.user_id=auth.uid())
  ))
);

drop policy if exists post_tags_owner_all on public.post_tags;
create policy post_tags_member_select on public.post_tags for select
using (exists(select 1 from public.posts p where p.id=post_id and public.site_has_capability(p.site_id,'content.read')));
create policy post_tags_content_write on public.post_tags for all
using (
  exists(select 1 from public.posts p where p.id=post_id and (
    public.site_has_capability(p.site_id,'content.write')
    or (public.site_has_capability(p.site_id,'content.own.write') and p.user_id=auth.uid())
  ))
)
with check (
  exists(select 1 from public.posts p where p.id=post_id and (
    public.site_has_capability(p.site_id,'content.write')
    or (public.site_has_capability(p.site_id,'content.own.write') and p.user_id=auth.uid())
  ))
);

-- Design.
drop policy if exists layout_sections_owner_all on public.layout_sections;
create policy layout_member_select on public.layout_sections for select using(public.site_has_capability(site_id,'design.read'));
create policy layout_editor_write on public.layout_sections for all using(public.site_has_capability(site_id,'design.write')) with check(public.site_has_capability(site_id,'design.write') and user_id=auth.uid());

drop policy if exists widgets_owner_all on public.widgets;
create policy widgets_member_select on public.widgets for select using(public.site_has_capability(site_id,'design.read'));
create policy widgets_editor_write on public.widgets for all using(public.site_has_capability(site_id,'design.write')) with check(public.site_has_capability(site_id,'design.write') and user_id=auth.uid());

drop policy if exists menus_owner_all on public.menus;
create policy menus_member_select on public.menus for select using(public.site_has_capability(site_id,'design.read'));
create policy menus_editor_write on public.menus for all using(public.site_has_capability(site_id,'design.write')) with check(public.site_has_capability(site_id,'design.write') and user_id=auth.uid());

drop policy if exists menu_items_owner_all on public.menu_items;
create policy menu_items_member_select on public.menu_items for select using(public.site_has_capability(site_id,'design.read'));
create policy menu_items_editor_write on public.menu_items for all using(public.site_has_capability(site_id,'design.write')) with check(public.site_has_capability(site_id,'design.write') and user_id=auth.uid());

drop policy if exists theme_settings_owner_all on public.theme_settings;
create policy theme_member_select on public.theme_settings for select using(public.site_has_capability(site_id,'design.read'));
create policy theme_editor_write on public.theme_settings for all using(public.site_has_capability(site_id,'design.write')) with check(public.site_has_capability(site_id,'design.write') and user_id=auth.uid());

-- Phase 3: SEO/editor read, admin-only integrations and deployments.
drop policy if exists site_seo_owner_all on public.site_seo_settings;
create policy site_seo_member_select on public.site_seo_settings for select using(public.site_has_capability(site_id,'seo.read'));
create policy site_seo_editor_write on public.site_seo_settings for all using(public.site_has_capability(site_id,'seo.write')) with check(public.site_has_capability(site_id,'seo.write') and user_id=auth.uid());

drop policy if exists content_revisions_owner_all on public.content_revisions;
create policy content_revisions_member_select on public.content_revisions for select using(public.site_has_capability(site_id,'content.read'));
create policy content_revisions_content_write on public.content_revisions for insert
with check(
  user_id=auth.uid()
  and (
    public.site_has_capability(site_id,'content.write')
    or (
      public.site_has_capability(site_id,'content.own.write')
      and (
        (entity_type='post' and exists(select 1 from public.posts p where p.id=entity_id and p.user_id=auth.uid()))
        or (entity_type='page' and exists(select 1 from public.pages p where p.id=entity_id and p.user_id=auth.uid()))
      )
    )
  )
);

drop policy if exists site_integrations_owner_all on public.site_integrations;
create policy site_integrations_member_select on public.site_integrations for select using(public.site_has_capability(site_id,'content.read'));
create policy site_integrations_admin_write on public.site_integrations for all using(public.site_has_capability(site_id,'admin')) with check(public.site_has_capability(site_id,'admin') and user_id=auth.uid());

drop policy if exists deployments_owner_all on public.deployments;
create policy deployments_member_select on public.deployments for select using(public.site_has_capability(site_id,'deployment.read'));
create policy deployments_admin_write on public.deployments for all using(public.site_has_capability(site_id,'admin')) with check(public.site_has_capability(site_id,'admin') and user_id=auth.uid());

-- Platform: Media.
drop policy if exists media_folders_owner_all on public.media_folders;
create policy media_folders_member_select on public.media_folders for select using(public.site_has_capability(site_id,'media.read'));
create policy media_folders_editor_write on public.media_folders for all using(public.site_has_capability(site_id,'media.write')) with check(public.site_has_capability(site_id,'media.write') and user_id=auth.uid());

drop policy if exists media_assets_owner_all on public.media_assets;
create policy media_assets_member_select on public.media_assets for select using(public.site_has_capability(site_id,'media.read'));
create policy media_assets_editor_write on public.media_assets for all using(public.site_has_capability(site_id,'media.write')) with check(public.site_has_capability(site_id,'media.write') and user_id=auth.uid());

drop policy if exists builder_templates_owner_all on public.builder_templates;
create policy builder_templates_member_select on public.builder_templates for select using(public.site_has_capability(site_id,'builder.read'));
create policy builder_templates_editor_write on public.builder_templates for all using(public.site_has_capability(site_id,'builder.write')) with check(public.site_has_capability(site_id,'builder.write') and user_id=auth.uid());

drop policy if exists builder_blocks_owner_all on public.builder_blocks;
create policy builder_blocks_member_select on public.builder_blocks for select using(public.site_has_capability(site_id,'builder.read'));
create policy builder_blocks_editor_write on public.builder_blocks for all using(public.site_has_capability(site_id,'builder.write')) with check(public.site_has_capability(site_id,'builder.write') and user_id=auth.uid());

drop policy if exists seo_redirects_owner_all on public.seo_redirects;
create policy seo_redirects_member_select on public.seo_redirects for select using(public.site_has_capability(site_id,'seo.read'));
create policy seo_redirects_editor_write on public.seo_redirects for all using(public.site_has_capability(site_id,'seo.write')) with check(public.site_has_capability(site_id,'seo.write') and user_id=auth.uid());

drop policy if exists domain_verifications_owner_all on public.domain_verifications;
create policy domain_verifications_member_select on public.domain_verifications for select using(public.site_has_capability(site_id,'content.read'));
create policy domain_verifications_admin_write on public.domain_verifications for all using(public.site_has_capability(site_id,'admin')) with check(public.site_has_capability(site_id,'admin') and user_id=auth.uid());

drop policy if exists site_security_owner_all on public.site_security_settings;
create policy site_security_member_select on public.site_security_settings for select using(public.site_has_capability(site_id,'content.read'));
create policy site_security_admin_write on public.site_security_settings for all using(public.site_has_capability(site_id,'admin')) with check(public.site_has_capability(site_id,'admin') and user_id=auth.uid());

drop policy if exists site_performance_owner_all on public.site_performance_settings;
create policy site_performance_member_select on public.site_performance_settings for select using(public.site_has_capability(site_id,'content.read'));
create policy site_performance_admin_write on public.site_performance_settings for all using(public.site_has_capability(site_id,'admin')) with check(public.site_has_capability(site_id,'admin') and user_id=auth.uid());

drop policy if exists system_checks_owner_all on public.system_checks;
create policy system_checks_member_select on public.system_checks for select using(public.site_has_capability(site_id,'content.read'));
create policy system_checks_admin_write on public.system_checks for all using(public.site_has_capability(site_id,'admin')) with check(public.site_has_capability(site_id,'admin') and user_id=auth.uid());

-- Analytics: site members can inspect analytics; only admins change settings.
drop policy if exists site_analytics_settings_owner_all on public.site_analytics_settings;
create policy analytics_settings_member_select on public.site_analytics_settings for select using(public.site_has_capability(site_id,'analytics.read'));
create policy analytics_settings_admin_write on public.site_analytics_settings for all using(public.site_has_capability(site_id,'admin')) with check(public.site_has_capability(site_id,'admin') and user_id=auth.uid());

drop policy if exists analytics_events_owner_select on public.analytics_events;
create policy analytics_events_member_select on public.analytics_events for select using(public.site_has_capability(site_id,'analytics.read'));

-- Site admin controls are already protected by 015, but make the capability explicit.
drop policy if exists site_admin_select on public.site_admin_settings;
create policy site_admin_member_select on public.site_admin_settings for select using(public.site_has_capability(site_id,'content.read'));
drop policy if exists site_admin_manage on public.site_admin_settings;
create policy site_admin_admin_write on public.site_admin_settings for all using(public.site_has_capability(site_id,'admin')) with check(public.site_has_capability(site_id,'admin') and user_id=auth.uid());

-- Prevent users from changing ownership/site boundaries.
do $$
declare t text;
begin
 foreach t in array array[
  'site_files','site_file_versions','categories','tags','posts','pages',
  'layout_sections','widgets','menus','menu_items','theme_settings',
  'site_seo_settings','content_revisions','site_integrations','deployments',
  'media_folders','media_assets','builder_templates','builder_blocks',
  'seo_redirects','domain_verifications','site_security_settings',
  'site_performance_settings','system_checks','site_analytics_settings'
 ] loop
   execute format('drop trigger if exists lock_site_record_owner_%s on public.%I',t,t);
   execute format('create trigger lock_site_record_owner_%s before update on public.%I for each row execute function public.lock_site_record_owner()',t,t);
 end loop;
end $$;

-- Storage follows the same site capability model.
drop policy if exists mpanel_media_insert on storage.objects;
create policy mpanel_media_insert on storage.objects for insert to authenticated
with check (
 bucket_id='mpanel-media'
 and public.site_has_capability((storage.foldername(name))[2]::uuid,'media.write')
);
drop policy if exists mpanel_media_update on storage.objects;
create policy mpanel_media_update on storage.objects for update to authenticated
using (
 bucket_id='mpanel-media'
 and public.site_has_capability((storage.foldername(name))[2]::uuid,'media.write')
)
with check (
 bucket_id='mpanel-media'
 and public.site_has_capability((storage.foldername(name))[2]::uuid,'media.write')
);
drop policy if exists mpanel_media_delete on storage.objects;
create policy mpanel_media_delete on storage.objects for delete to authenticated
using (
 bucket_id='mpanel-media'
 and public.site_has_capability((storage.foldername(name))[2]::uuid,'media.write')
);

-- Helper RPC for UI and server-side checks.
create or replace function public.get_site_permissions(p_site_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
 select jsonb_build_object(
   'role', coalesce(public.site_role(p_site_id),'none'),
   'content_read', public.site_has_capability(p_site_id,'content.read'),
   'content_write', public.site_has_capability(p_site_id,'content.write'),
   'content_own_write', public.site_has_capability(p_site_id,'content.own.write'),
   'media_write', public.site_has_capability(p_site_id,'media.write'),
   'design_write', public.site_has_capability(p_site_id,'design.write'),
   'builder_write', public.site_has_capability(p_site_id,'builder.write'),
   'seo_write', public.site_has_capability(p_site_id,'seo.write'),
   'admin', public.site_has_capability(p_site_id,'admin'),
   'deployment_read', public.site_has_capability(p_site_id,'deployment.read')
 );
$$;

revoke all on function public.get_site_permissions(uuid) from public;
grant execute on function public.get_site_permissions(uuid) to authenticated;
