create or replace function public.consume_ai_request(p_daily_limit integer default 20)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  jakarta_date date := (now() at time zone 'Asia/Jakarta')::date;
  new_count integer;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_daily_limit < 1 then
    raise exception 'Daily limit must be positive';
  end if;

  insert into public.ai_usage (user_id, usage_date, request_count)
  values (current_user_id, jakarta_date, 1)
  on conflict (user_id, usage_date)
  do update set request_count = public.ai_usage.request_count + 1
  returning request_count into new_count;

  if new_count > p_daily_limit then
    update public.ai_usage
    set request_count = request_count - 1
    where user_id = current_user_id and usage_date = jakarta_date;
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.consume_ai_request(integer) from public;
grant execute on function public.consume_ai_request(integer) to authenticated;