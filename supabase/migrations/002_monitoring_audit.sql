create table if not exists public.monitoring_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid not null references public.sites(id) on delete cascade,
 status text not null check (status in ('up','down','error')),
 response_time_ms integer,
 message text,
 checked_at timestamptz not null default now()
);

create index if not exists monitoring_events_user_id_idx on public.monitoring_events(user_id);
create index if not exists monitoring_events_site_id_idx on public.monitoring_events(site_id);
create index if not exists monitoring_events_checked_at_idx on public.monitoring_events(checked_at desc);

alter table public.monitoring_events enable row level security;

drop policy if exists "monitoring own rows" on public.monitoring_events;
create policy "monitoring own rows"
on public.monitoring_events for all
using (auth.uid()=user_id)
with check (auth.uid()=user_id);

create table if not exists public.audit_logs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 action text not null,
 entity_type text,
 entity_id uuid,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit own rows" on public.audit_logs;
create policy "audit own rows"
on public.audit_logs for select
using (auth.uid()=user_id);

create or replace function public.write_audit_log(
 p_action text,
 p_entity_type text default null,
 p_entity_id uuid default null,
 p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
 if auth.uid() is null then return; end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details)
 values(auth.uid(),p_action,p_entity_type,p_entity_id,coalesce(p_details,'{}'::jsonb));
end;
$$;

revoke all on function public.write_audit_log(text,text,uuid,jsonb) from public;
grant execute on function public.write_audit_log(text,text,uuid,jsonb) to authenticated;
