-- mPanel Phase 3/4: advanced SEO, revisions, integrations and publishing
create table if not exists public.site_seo_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  site_title text not null default '',
  meta_description text not null default '',
  canonical_base text not null default '',
  robots_index boolean not null default true,
  robots_follow boolean not null default true,
  og_title text not null default '',
  og_description text not null default '',
  og_image text not null default '',
  twitter_card text not null default 'summary_large_image' check (twitter_card in ('summary','summary_large_image')),
  twitter_title text not null default '',
  twitter_description text not null default '',
  twitter_image text not null default '',
  schema_type text not null default 'WebSite',
  schema_json jsonb not null default '{}'::jsonb,
  sitemap_enabled boolean not null default true,
  robots_txt text not null default 'User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml',
  custom_head text not null default '',
  updated_at timestamptz not null default now(),
  unique(site_id)
);

create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  entity_type text not null check (entity_type in ('post','page','site_file')),
  entity_id uuid not null,
  revision_number integer not null default 1,
  title text not null default '',
  content text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(entity_type,entity_id,revision_number)
);

create table if not exists public.site_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  github_repo text,
  github_branch text default 'main',
  publish_path text default '',
  provider text not null default 'github',
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(site_id,provider)
);

create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  provider text not null default 'github',
  repository text,
  branch text,
  commit_sha text,
  status text not null default 'pending' check (status in ('pending','success','failed')),
  files_count integer not null default 0,
  message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_site_seo_site on public.site_seo_settings(site_id);
create index if not exists idx_revisions_entity on public.content_revisions(entity_type,entity_id,created_at desc);
create index if not exists idx_integrations_site on public.site_integrations(site_id);
create index if not exists idx_deployments_site_created on public.deployments(site_id,created_at desc);

alter table public.site_seo_settings enable row level security;
alter table public.content_revisions enable row level security;
alter table public.site_integrations enable row level security;
alter table public.deployments enable row level security;

drop policy if exists site_seo_owner_all on public.site_seo_settings;
create policy site_seo_owner_all on public.site_seo_settings for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists content_revisions_owner_all on public.content_revisions;
create policy content_revisions_owner_all on public.content_revisions for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists site_integrations_owner_all on public.site_integrations;
create policy site_integrations_owner_all on public.site_integrations for all using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists deployments_owner_all on public.deployments;
create policy deployments_owner_all on public.deployments for all using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.set_phase3_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

drop trigger if exists site_seo_updated_at on public.site_seo_settings;
create trigger site_seo_updated_at before update on public.site_seo_settings for each row execute function public.set_phase3_updated_at();
drop trigger if exists site_integrations_updated_at on public.site_integrations;
create trigger site_integrations_updated_at before update on public.site_integrations for each row execute function public.set_phase3_updated_at();

create or replace function public.seed_phase3_defaults()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.site_seo_settings(user_id,site_id,site_title,canonical_base)
  values(new.user_id,new.id,new.name,trim(trailing '/' from new.url))
  on conflict(site_id) do nothing;
  insert into public.site_integrations(user_id,site_id)
  values(new.user_id,new.id)
  on conflict(site_id,provider) do nothing;
  return new;
end $$;

drop trigger if exists seed_phase3_defaults_after_site on public.sites;
create trigger seed_phase3_defaults_after_site after insert on public.sites
for each row execute function public.seed_phase3_defaults();
