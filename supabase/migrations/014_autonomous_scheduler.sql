-- mPanel 014: autonomous scheduled publishing + deployment queue
-- Requires Supabase Cron (pg_cron). Supabase-hosted projects support pg_cron/cron jobs.

create extension if not exists pg_cron;

create table if not exists public.scheduled_publish_runs (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.sites(id) on delete cascade,
 published_count integer not null default 0,
 status text not null default 'success' check (status in ('success','error')),
 message text,
 ran_at timestamptz not null default now()
);

create index if not exists scheduled_publish_runs_site_idx
 on public.scheduled_publish_runs(site_id, ran_at desc);

alter table public.scheduled_publish_runs enable row level security;

drop policy if exists "scheduled publish runs own rows" on public.scheduled_publish_runs;
create policy "scheduled publish runs own rows"
on public.scheduled_publish_runs for select
using (exists (
 select 1 from public.sites s
 where s.id=scheduled_publish_runs.site_id and s.user_id=auth.uid()
));

create table if not exists public.deployment_queue (
 id uuid primary key default gen_random_uuid(),
 site_id uuid not null references public.sites(id) on delete cascade,
 reason text not null default 'scheduled_post',
 status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
 scheduled_run_id uuid references public.scheduled_publish_runs(id) on delete set null,
 attempts integer not null default 0,
 available_at timestamptz not null default now(),
 processed_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index if not exists deployment_queue_site_status_idx
 on public.deployment_queue(site_id,status,available_at);

alter table public.deployment_queue enable row level security;

drop policy if exists "deployment queue own rows" on public.deployment_queue;
create policy "deployment queue own rows"
on public.deployment_queue for select
using (exists (
 select 1 from public.sites s
 where s.id=deployment_queue.site_id and s.user_id=auth.uid()
));

create or replace function public.run_scheduled_publishing()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
 s record;
 changed integer := 0;
 total integer := 0;
 run_id uuid;
begin
 for s in
   select id from public.sites where status='active'
 loop
   begin
     update public.posts
       set status='published',
           published_at=coalesce(published_at,now()),
           updated_at=now()
     where site_id=s.id
       and status='scheduled'
       and scheduled_at is not null
       and scheduled_at <= now();

     get diagnostics changed=row_count;
     total := total + changed;

     if changed > 0 then
       insert into public.scheduled_publish_runs(site_id,published_count,status,message)
       values(s.id,changed,'success',changed||' scheduled post(s) published')
       returning id into run_id;

       if not exists (
         select 1 from public.deployment_queue q
         where q.site_id=s.id and q.status in ('pending','processing')
       ) then
         insert into public.deployment_queue(site_id,reason,status,scheduled_run_id)
         values(s.id,'scheduled_post','pending',run_id);
       end if;
     end if;
   exception when others then
     insert into public.scheduled_publish_runs(site_id,published_count,status,message)
     values(s.id,0,'error',sqlerrm);
   end;
 end loop;
 return total;
end;
$$;

revoke all on function public.run_scheduled_publishing() from public, anon, authenticated;
grant execute on function public.run_scheduled_publishing() to postgres;

-- Run every five minutes. If the Cron module is disabled, enable it in
-- Supabase Dashboard > Integrations > Cron, then re-run this migration/job block.
do $$
begin
 if to_regnamespace('cron') is not null then
   perform cron.unschedule(jobid)
   from cron.job
   where jobname='mpanel-scheduled-posts';

   perform cron.schedule(
     'mpanel-scheduled-posts',
     '*/5 * * * *',
     $$select public.run_scheduled_publishing();$$
   );
 end if;
exception when others then
 null;
end $$;
