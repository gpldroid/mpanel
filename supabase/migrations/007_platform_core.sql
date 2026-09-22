-- mPanel Platform Core: media, builder, redirects, domain verification,
-- security, performance and production health. Idempotent.
create table if not exists public.media_folders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade, name text not null, slug text not null,
 parent_id uuid references public.media_folders(id) on delete cascade, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(site_id,slug)
);
create table if not exists public.media_assets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade, folder_id uuid references public.media_folders(id) on delete set null,
 original_name text not null default '', path text not null default '', url text not null default '',
 mime_type text not null default 'application/octet-stream', size_bytes bigint not null default 0 check(size_bytes>=0),
 width integer, height integer, alt_text text not null default '', title text not null default '', caption text not null default '',
 storage_provider text not null default 'external', storage_path text not null default '', optimized boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.builder_templates (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade, name text not null, slug text not null,
 template_type text not null default 'page' check(template_type in ('site','page','post','archive','404')),
 settings jsonb not null default '{}'::jsonb, is_default boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(site_id,slug)
);
create table if not exists public.builder_blocks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade, template_id uuid references public.builder_templates(id) on delete cascade,
 area text not null default 'main', block_type text not null default 'html', content jsonb not null default '{}'::jsonb,
 position integer not null default 0, enabled boolean not null default true, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.theme_presets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, slug text not null, settings jsonb not null default '{}'::jsonb, is_system boolean not null default false,
 created_at timestamptz not null default now(), unique(slug)
);
create table if not exists public.seo_redirects (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade, from_path text not null, to_path text not null,
 status_code integer not null default 301 check(status_code in (301,302,307,308)), enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(site_id,from_path)
);
create table if not exists public.domain_verifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade, domain_id uuid not null references public.domains(id) on delete cascade,
 method text not null default 'dns_txt' check(method in ('dns_txt','dns_cname','html_file','meta_tag')),
 token text not null, status text not null default 'pending' check(status in ('pending','verified','failed')),
 verified_at timestamptz, last_checked_at timestamptz, created_at timestamptz not null default now(), unique(domain_id,method)
);
create table if not exists public.site_security_settings (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade, https_redirect boolean not null default true,
 hsts_enabled boolean not null default true, x_frame_options text not null default 'SAMEORIGIN' check(x_frame_options in ('DENY','SAMEORIGIN')),
 referrer_policy text not null default 'strict-origin-when-cross-origin', content_security_policy text not null default '',
 custom_headers jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), unique(site_id)
);
create table if not exists public.site_performance_settings (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade, minify_html boolean not null default true,
 minify_css boolean not null default true, minify_js boolean not null default true, lazy_images boolean not null default true,
 preload_fonts boolean not null default true, compression boolean not null default true,
 cache_control text not null default 'public,max-age=31536000,immutable', updated_at timestamptz not null default now(), unique(site_id)
);
create table if not exists public.system_checks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade, check_key text not null,
 status text not null default 'pending' check(status in ('pending','pass','fail','warning')), message text not null default '',
 last_checked_at timestamptz not null default now(), unique(site_id,check_key)
);
create index if not exists idx_media_assets_site_created on public.media_assets(site_id,created_at desc);
create index if not exists idx_media_assets_folder on public.media_assets(folder_id);
create index if not exists idx_builder_templates_site on public.builder_templates(site_id);
create index if not exists idx_builder_blocks_template_position on public.builder_blocks(template_id,position);
create index if not exists idx_seo_redirects_site on public.seo_redirects(site_id);
create index if not exists idx_domain_verifications_domain on public.domain_verifications(domain_id);
create index if not exists idx_system_checks_site on public.system_checks(site_id);

alter table public.media_folders enable row level security;
alter table public.media_assets enable row level security;
alter table public.builder_templates enable row level security;
alter table public.builder_blocks enable row level security;
alter table public.theme_presets enable row level security;
alter table public.seo_redirects enable row level security;
alter table public.domain_verifications enable row level security;
alter table public.site_security_settings enable row level security;
alter table public.site_performance_settings enable row level security;
alter table public.system_checks enable row level security;

drop policy if exists media_folders_owner_all on public.media_folders;
create policy media_folders_owner_all on public.media_folders for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists media_assets_owner_all on public.media_assets;
create policy media_assets_owner_all on public.media_assets for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists builder_templates_owner_all on public.builder_templates;
create policy builder_templates_owner_all on public.builder_templates for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists builder_blocks_owner_all on public.builder_blocks;
create policy builder_blocks_owner_all on public.builder_blocks for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists theme_presets_owner_all on public.theme_presets;
create policy theme_presets_owner_all on public.theme_presets for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists seo_redirects_owner_all on public.seo_redirects;
create policy seo_redirects_owner_all on public.seo_redirects for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists domain_verifications_owner_all on public.domain_verifications;
create policy domain_verifications_owner_all on public.domain_verifications for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists site_security_owner_all on public.site_security_settings;
create policy site_security_owner_all on public.site_security_settings for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists site_performance_owner_all on public.site_performance_settings;
create policy site_performance_owner_all on public.site_performance_settings for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists system_checks_owner_all on public.system_checks;
create policy system_checks_owner_all on public.system_checks for all using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.set_platform_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists media_folders_updated_at on public.media_folders;
create trigger media_folders_updated_at before update on public.media_folders for each row execute function public.set_platform_updated_at();
drop trigger if exists media_assets_updated_at on public.media_assets;
create trigger media_assets_updated_at before update on public.media_assets for each row execute function public.set_platform_updated_at();
drop trigger if exists builder_templates_updated_at on public.builder_templates;
create trigger builder_templates_updated_at before update on public.builder_templates for each row execute function public.set_platform_updated_at();
drop trigger if exists builder_blocks_updated_at on public.builder_blocks;
create trigger builder_blocks_updated_at before update on public.builder_blocks for each row execute function public.set_platform_updated_at();
drop trigger if exists seo_redirects_updated_at on public.seo_redirects;
create trigger seo_redirects_updated_at before update on public.seo_redirects for each row execute function public.set_platform_updated_at();
drop trigger if exists site_security_updated_at on public.site_security_settings;
create trigger site_security_updated_at before update on public.site_security_settings for each row execute function public.set_platform_updated_at();
drop trigger if exists site_performance_updated_at on public.site_performance_settings;
create trigger site_performance_updated_at before update on public.site_performance_settings for each row execute function public.set_platform_updated_at();

create or replace function public.seed_platform_defaults()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.site_security_settings(user_id,site_id) values(new.user_id,new.id) on conflict(site_id) do nothing;
 insert into public.site_performance_settings(user_id,site_id) values(new.user_id,new.id) on conflict(site_id) do nothing;
 insert into public.builder_templates(user_id,site_id,name,slug,template_type,is_default)
 values(new.user_id,new.id,'Default Site','default-site','site',true) on conflict(site_id,slug) do nothing;
 return new;
end $$;
drop trigger if exists seed_platform_defaults_after_site on public.sites;
create trigger seed_platform_defaults_after_site after insert on public.sites for each row execute function public.seed_platform_defaults();

create or replace function public.validate_platform_links()
returns trigger language plpgsql as $$
declare ok boolean;
begin
 if tg_table_name='menu_items' then
  select exists(select 1 from public.menus m where m.id=new.menu_id and m.site_id=new.site_id and m.user_id=new.user_id) into ok;
  if not ok then raise exception 'menu_items.menu_id must belong to the same site and user'; end if;
  if new.parent_id is not null then
   select exists(select 1 from public.menu_items p where p.id=new.parent_id and p.menu_id=new.menu_id and p.site_id=new.site_id and p.user_id=new.user_id) into ok;
   if not ok then raise exception 'menu_items.parent_id must belong to the same menu'; end if;
  end if;
 elsif tg_table_name='post_categories' then
  select exists(select 1 from public.posts p join public.categories c on c.id=new.category_id where p.id=new.post_id and p.site_id=c.site_id and p.user_id=c.user_id) into ok;
  if not ok then raise exception 'post category must belong to the same site and user'; end if;
 elsif tg_table_name='post_tags' then
  select exists(select 1 from public.posts p join public.tags t on t.id=new.tag_id where p.id=new.post_id and p.site_id=t.site_id and p.user_id=t.user_id) into ok;
  if not ok then raise exception 'post tag must belong to the same site and user'; end if;
 elsif tg_table_name='builder_blocks' and new.template_id is not null then
  select exists(select 1 from public.builder_templates x where x.id=new.template_id and x.site_id=new.site_id and x.user_id=new.user_id) into ok;
  if not ok then raise exception 'builder block template must belong to the same site and user'; end if;
 end if;
 return new;
end $$;
drop trigger if exists validate_menu_item_site on public.menu_items;
create trigger validate_menu_item_site before insert or update on public.menu_items for each row execute function public.validate_platform_links();
drop trigger if exists validate_post_category_site on public.post_categories;
create trigger validate_post_category_site before insert or update on public.post_categories for each row execute function public.validate_platform_links();
drop trigger if exists validate_post_tag_site on public.post_tags;
create trigger validate_post_tag_site before insert or update on public.post_tags for each row execute function public.validate_platform_links();
drop trigger if exists validate_builder_block_site on public.builder_blocks;
create trigger validate_builder_block_site before insert or update on public.builder_blocks for each row execute function public.validate_platform_links();

create or replace function public.lock_platform_owner()
returns trigger language plpgsql as $$ begin new.user_id=old.user_id; new.site_id=old.site_id; return new; end $$;
drop trigger if exists lock_media_folders_owner on public.media_folders;
create trigger lock_media_folders_owner before update on public.media_folders for each row execute function public.lock_platform_owner();
drop trigger if exists lock_media_assets_owner on public.media_assets;
create trigger lock_media_assets_owner before update on public.media_assets for each row execute function public.lock_platform_owner();
drop trigger if exists lock_builder_templates_owner on public.builder_templates;
create trigger lock_builder_templates_owner before update on public.builder_templates for each row execute function public.lock_platform_owner();
drop trigger if exists lock_builder_blocks_owner on public.builder_blocks;
create trigger lock_builder_blocks_owner before update on public.builder_blocks for each row execute function public.lock_platform_owner();
drop trigger if exists lock_seo_redirects_owner on public.seo_redirects;
create trigger lock_seo_redirects_owner before update on public.seo_redirects for each row execute function public.lock_platform_owner();
drop trigger if exists lock_domain_verifications_owner on public.domain_verifications;
create trigger lock_domain_verifications_owner before update on public.domain_verifications for each row execute function public.lock_platform_owner();
drop trigger if exists lock_site_security_settings_owner on public.site_security_settings;
create trigger lock_site_security_settings_owner before update on public.site_security_settings for each row execute function public.lock_platform_owner();
drop trigger if exists lock_site_performance_settings_owner on public.site_performance_settings;
create trigger lock_site_performance_settings_owner before update on public.site_performance_settings for each row execute function public.lock_platform_owner();
drop trigger if exists lock_system_checks_owner on public.system_checks;
create trigger lock_system_checks_owner before update on public.system_checks for each row execute function public.lock_platform_owner();

insert into public.system_checks(user_id,site_id,check_key,status,message)
select s.user_id,s.id,v.key,'pending','Not checked yet'
from public.sites s cross join (values('site_access'),('site_seo'),('site_security'),('site_performance'),('github_integration'),('build_output')) v(key)
on conflict(site_id,check_key) do nothing;
