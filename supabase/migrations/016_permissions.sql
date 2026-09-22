-- mPanel 016: role-aware permissions and RLS for the website workspace

create or replace function public.get_site_permissions(p_site_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(
    jsonb_build_object(
      'role',m.role,
      'admin',m.role in ('owner','admin'),
      'editor',m.role in ('owner','admin','editor'),
      'author',m.role in ('owner','admin','editor','author'),
      'viewer',true
    ),
    jsonb_build_object('role','none','admin',false,'editor',false,'author',false,'viewer',false)
  )
  from public.site_members m
  where m.site_id=p_site_id and m.user_id=auth.uid()
  limit 1;
$$;

revoke all on function public.get_site_permissions(uuid) from public;
grant execute on function public.get_site_permissions(uuid) to authenticated;

-- Site files: administrators can manage, editors can edit, viewers can read.
drop policy if exists site_files_members_select on public.site_files;
create policy site_files_members_select on public.site_files for select
using (public.is_site_member(site_id));

drop policy if exists site_files_members_insert on public.site_files;
create policy site_files_members_insert on public.site_files for insert
with check (public.is_site_member(site_id,array['owner','admin','editor']));

drop policy if exists site_files_members_update on public.site_files;
create policy site_files_members_update on public.site_files for update
using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']));

drop policy if exists site_files_members_delete on public.site_files;
create policy site_files_members_delete on public.site_files for delete
using (public.is_site_member(site_id,array['owner','admin']));

-- Content: editors manage pages/posts, authors can manage their own posts through existing ownership rules.
drop policy if exists posts_members_select on public.posts;
create policy posts_members_select on public.posts for select
using (public.is_site_member(site_id));

drop policy if exists posts_members_manage on public.posts;
create policy posts_members_manage on public.posts for all
using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']));

drop policy if exists pages_members_select on public.pages;
create policy pages_members_select on public.pages for select
using (public.is_site_member(site_id));

drop policy if exists pages_members_manage on public.pages;
create policy pages_members_manage on public.pages for all
using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']));

-- Builder/design/SEO controls are administrator/editor workspace operations.
drop policy if exists builder_templates_members_select on public.builder_templates;
create policy builder_templates_members_select on public.builder_templates for select
using (public.is_site_member(site_id));

drop policy if exists builder_templates_members_manage on public.builder_templates;
create policy builder_templates_members_manage on public.builder_templates for all
using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']));

drop policy if exists builder_blocks_members_select on public.builder_blocks;
create policy builder_blocks_members_select on public.builder_blocks for select
using (public.is_site_member(site_id));

drop policy if exists builder_blocks_members_manage on public.builder_blocks;
create policy builder_blocks_members_manage on public.builder_blocks for all
using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']));

drop policy if exists site_seo_members_select on public.site_seo_settings;
create policy site_seo_members_select on public.site_seo_settings for select
using (public.is_site_member(site_id));

drop policy if exists site_seo_members_manage on public.site_seo_settings;
create policy site_seo_members_manage on public.site_seo_settings for all
using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']));

drop policy if exists redirects_members_select on public.seo_redirects;
create policy redirects_members_select on public.seo_redirects for select
using (public.is_site_member(site_id));

drop policy if exists redirects_members_manage on public.seo_redirects;
create policy redirects_members_manage on public.seo_redirects for all
using (public.is_site_member(site_id,array['owner','admin','editor']))
with check (public.is_site_member(site_id,array['owner','admin','editor']));

-- Deployments are operational records: members can read, only admins can change them.
drop policy if exists deployments_members_select on public.deployments;
create policy deployments_members_select on public.deployments for select
using (public.is_site_member(site_id));

drop policy if exists deployments_members_manage on public.deployments;
create policy deployments_members_manage on public.deployments for all
using (public.is_site_member(site_id,array['owner','admin']))
with check (public.is_site_member(site_id,array['owner','admin']));

-- Keep administration settings writable only by owner/admin as defined in 015.
