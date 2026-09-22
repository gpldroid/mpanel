-- mPanel 012: analytics retention enforcement
create or replace function public.purge_expired_analytics(p_site_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  keep_days integer;
  removed integer := 0;
begin
  select retention_days into keep_days
  from public.site_analytics_settings
  where site_id=p_site_id
    and user_id=auth.uid();

  if keep_days is null then
    raise exception 'Analytics site not found or not owned by the current user';
  end if;

  delete from public.analytics_events
  where site_id=p_site_id
    and created_at < now() - make_interval(days => keep_days);

  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_expired_analytics(uuid) from public;
grant execute on function public.purge_expired_analytics(uuid) to authenticated;
