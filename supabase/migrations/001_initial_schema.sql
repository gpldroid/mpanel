create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text, avatar_url text,
 plan text not null default 'free' check (plan in ('free','pro')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.sites (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null, url text not null, description text,
 status text not null default 'active' check (status in ('active','paused')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.domains (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade,
 domain text not null,
 status text not null default 'pending' check (status in ('pending','verified','failed')),
 created_at timestamptz not null default now(),
 unique(user_id,domain)
);

create table if not exists public.seo_checks (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid references public.sites(id) on delete cascade,
 title text not null, description text,
 completed boolean not null default false,
 created_at timestamptz not null default now()
);

create index if not exists sites_user_id_idx on public.sites(user_id);
create index if not exists domains_user_id_idx on public.domains(user_id);
create index if not exists seo_checks_user_id_idx on public.seo_checks(user_id);

alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.domains enable row level security;
alter table public.seo_checks enable row level security;

create policy "profiles own row" on public.profiles for all using (auth.uid()=id) with check (auth.uid()=id);
create policy "sites own rows" on public.sites for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "domains own rows" on public.domains for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "seo own rows" on public.seo_checks for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id) values(new.id) on conflict(id) do nothing;
 return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.enforce_free_site_limit()
returns trigger language plpgsql security definer set search_path=public as $$
declare site_count integer;
begin
 select count(*) into site_count from public.sites where user_id=new.user_id;
 if site_count>=3 then raise exception 'Free plan limit reached: maximum 3 websites'; end if;
 return new;
end;
$$;

drop trigger if exists free_site_limit on public.sites;
create trigger free_site_limit before insert on public.sites
for each row execute procedure public.enforce_free_site_limit();

create or replace function public.seed_seo_checks()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.seo_checks(user_id,site_id,title,description) values
 (new.user_id,new.id,'Unique page title','Use a clear and unique title for the homepage.'),
 (new.user_id,new.id,'Meta description','Add a useful description for search engines.'),
 (new.user_id,new.id,'HTTPS enabled','Serve the website over HTTPS.'),
 (new.user_id,new.id,'Sitemap available','Make sitemap.xml available to crawlers.'),
 (new.user_id,new.id,'Robots.txt configured','Provide a valid robots.txt file.');
 return new;
end;
$$;

drop trigger if exists seed_site_seo on public.sites;
create trigger seed_site_seo after insert on public.sites
for each row execute procedure public.seed_seo_checks();

create or replace function public.lock_site_owner()
returns trigger language plpgsql as $$
begin new.user_id:=old.user_id; return new; end;
$$;

drop trigger if exists lock_site_owner_trigger on public.sites;
create trigger lock_site_owner_trigger before update on public.sites
for each row execute procedure public.lock_site_owner();

create or replace function public.lock_domain_owner()
returns trigger language plpgsql as $$
begin new.user_id:=old.user_id; return new; end;
$$;

drop trigger if exists lock_domain_owner_trigger on public.domains;
create trigger lock_domain_owner_trigger before update on public.domains
for each row execute procedure public.lock_domain_owner();
