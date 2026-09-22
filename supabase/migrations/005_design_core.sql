-- mPanel Phase 2: layout, widgets, navigation and theme
create table if not exists public.layout_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  section_key text not null,
  name text not null,
  enabled boolean not null default true,
  position integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, section_key)
);

create table if not exists public.widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  section_key text not null default 'sidebar',
  title text not null default '',
  widget_type text not null default 'html',
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  slug text not null,
  location text not null default 'header',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, slug)
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  label text not null,
  url text not null,
  target text not null default '_self' check (target in ('_self','_blank')),
  parent_id uuid references public.menu_items(id) on delete cascade,
  position integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.theme_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  primary_color text not null default '#4f46e5',
  accent_color text not null default '#7c3aed',
  background_color text not null default '#f6f8fc',
  surface_color text not null default '#ffffff',
  text_color text not null default '#111827',
  font_family text not null default 'system-ui',
  container_width integer not null default 1200,
  border_radius integer not null default 16,
  custom_css text not null default '',
  updated_at timestamptz not null default now(),
  unique(site_id)
);

create index if not exists idx_layout_site_position on public.layout_sections(site_id,position);
create index if not exists idx_widgets_site_section_position on public.widgets(site_id,section_key,position);
create index if not exists idx_menus_site on public.menus(site_id);
create index if not exists idx_menu_items_menu_position on public.menu_items(menu_id,position);

alter table public.layout_sections enable row level security;
alter table public.widgets enable row level security;
alter table public.menus enable row level security;
alter table public.menu_items enable row level security;
alter table public.theme_settings enable row level security;

drop policy if exists layout_sections_owner_all on public.layout_sections;
create policy layout_sections_owner_all on public.layout_sections for all using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists widgets_owner_all on public.widgets;
create policy widgets_owner_all on public.widgets for all using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists menus_owner_all on public.menus;
create policy menus_owner_all on public.menus for all using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists menu_items_owner_all on public.menu_items;
create policy menu_items_owner_all on public.menu_items for all using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists theme_settings_owner_all on public.theme_settings;
create policy theme_settings_owner_all on public.theme_settings for all using (user_id=auth.uid()) with check (user_id=auth.uid());

create or replace function public.set_design_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at=now();
  return new;
end $$;

drop trigger if exists layout_sections_updated_at on public.layout_sections;
create trigger layout_sections_updated_at before update on public.layout_sections for each row execute function public.set_design_updated_at();
drop trigger if exists widgets_updated_at on public.widgets;
create trigger widgets_updated_at before update on public.widgets for each row execute function public.set_design_updated_at();
drop trigger if exists menus_updated_at on public.menus;
create trigger menus_updated_at before update on public.menus for each row execute function public.set_design_updated_at();
drop trigger if exists menu_items_updated_at on public.menu_items;
create trigger menu_items_updated_at before update on public.menu_items for each row execute function public.set_design_updated_at();
drop trigger if exists theme_settings_updated_at on public.theme_settings;
create trigger theme_settings_updated_at before update on public.theme_settings for each row execute function public.set_design_updated_at();

create or replace function public.seed_design_defaults()
returns trigger language plpgsql security definer set search_path=public as $$
declare m uuid;
begin
  insert into public.layout_sections(user_id,site_id,section_key,name,position)
  values
    (new.user_id,new.id,'header','Header',0),
    (new.user_id,new.id,'main','Main Content',1),
    (new.user_id,new.id,'sidebar','Sidebar',2),
    (new.user_id,new.id,'footer','Footer',3)
  on conflict (site_id,section_key) do nothing;

  insert into public.theme_settings(user_id,site_id)
  values(new.user_id,new.id)
  on conflict (site_id) do nothing;

  insert into public.menus(user_id,site_id,name,slug,location)
  values(new.user_id,new.id,'Main Menu','main-menu','header')
  on conflict (site_id,slug) do nothing
  returning id into m;

  if m is not null then
    insert into public.menu_items(user_id,site_id,menu_id,label,url,position)
    values
      (new.user_id,new.id,m,'Home','/',0),
      (new.user_id,new.id,m,'Blog','/blog/',1),
      (new.user_id,new.id,m,'Contact','/contact/',2);
  end if;
  return new;
end $$;

drop trigger if exists seed_design_defaults_after_site on public.sites;
create trigger seed_design_defaults_after_site after insert on public.sites
for each row execute function public.seed_design_defaults();
