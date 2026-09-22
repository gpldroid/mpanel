-- mPanel CMS Core: posts, pages, categories and tags
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, slug)
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique(site_id, slug)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  title text not null default '',
  slug text not null,
  excerpt text,
  content text not null default '',
  status text not null default 'draft' check (status in ('draft','published','scheduled')),
  featured_image text,
  published_at timestamptz,
  scheduled_at timestamptz,
  meta_title text,
  meta_description text,
  focus_keyword text,
  canonical_url text,
  robots text not null default 'index,follow',
  schema_type text not null default 'BlogPosting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, slug)
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  title text not null default '',
  slug text not null,
  content text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  meta_title text,
  meta_description text,
  canonical_url text,
  robots text not null default 'index,follow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, slug)
);

create table if not exists public.post_categories (
  post_id uuid not null references public.posts(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key(post_id, category_id)
);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key(post_id, tag_id)
);

create index if not exists idx_categories_site on public.categories(site_id);
create index if not exists idx_tags_site on public.tags(site_id);
create index if not exists idx_posts_site_status on public.posts(site_id,status);
create index if not exists idx_posts_updated on public.posts(updated_at desc);
create index if not exists idx_pages_site_status on public.pages(site_id,status);

alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.posts enable row level security;
alter table public.pages enable row level security;
alter table public.post_categories enable row level security;
alter table public.post_tags enable row level security;

drop policy if exists categories_owner_all on public.categories;
create policy categories_owner_all on public.categories for all using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists tags_owner_all on public.tags;
create policy tags_owner_all on public.tags for all using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists posts_owner_all on public.posts;
create policy posts_owner_all on public.posts for all using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists pages_owner_all on public.pages;
create policy pages_owner_all on public.pages for all using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists post_categories_owner_all on public.post_categories;
create policy post_categories_owner_all on public.post_categories for all
using (exists(select 1 from public.posts p where p.id=post_id and p.user_id=auth.uid()))
with check (exists(select 1 from public.posts p where p.id=post_id and p.user_id=auth.uid()));

drop policy if exists post_tags_owner_all on public.post_tags;
create policy post_tags_owner_all on public.post_tags for all
using (exists(select 1 from public.posts p where p.id=post_id and p.user_id=auth.uid()))
with check (exists(select 1 from public.posts p where p.id=post_id and p.user_id=auth.uid()));

-- Keep updated_at current for CMS records.
create or replace function public.set_cms_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at=now();
  return new;
end $$;

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories for each row execute function public.set_cms_updated_at();
drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at before update on public.posts for each row execute function public.set_cms_updated_at();
drop trigger if exists pages_updated_at on public.pages;
create trigger pages_updated_at before update on public.pages for each row execute function public.set_cms_updated_at();

-- Seed useful categories when a site is created.
create or replace function public.seed_cms_categories()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.categories(user_id,site_id,name,slug,description)
  values
    (new.user_id,new.id,'General','general','General website content'),
    (new.user_id,new.id,'News','news','News and updates')
  on conflict (site_id,slug) do nothing;
  return new;
end $$;

drop trigger if exists seed_cms_categories_after_site on public.sites;
create trigger seed_cms_categories_after_site after insert on public.sites
for each row execute function public.seed_cms_categories();
