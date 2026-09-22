-- mPanel 013: scheduled post publishing state transition
create or replace function public.publish_due_posts(p_site_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  changed integer := 0;
begin
  if p_site_id is null then
    raise exception 'Site is required';
  end if;

  if not exists (
    select 1 from public.sites
    where id=p_site_id and user_id=auth.uid()
  ) then
    raise exception 'Site not found or not owned by the current user';
  end if;

  update public.posts
  set status='published',
      published_at=coalesce(published_at, now()),
      updated_at=now()
  where site_id=p_site_id
    and status='scheduled'
    and scheduled_at is not null
    and scheduled_at <= now();

  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.publish_due_posts(uuid) from public;
grant execute on function public.publish_due_posts(uuid) to authenticated;
