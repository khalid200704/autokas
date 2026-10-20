create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 60),
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('OWNER', 'MEMBER')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table if not exists public.circle_activities (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  message text not null check (length(trim(message)) between 1 and 240),
  merchant text,
  category text,
  amount numeric(12, 2) check (amount is null or amount >= 0),
  created_at timestamptz not null default now(),
  constraint circle_activity_category_check check (
    category is null or category in (
      'Makanan & Minuman', 'Kebutuhan Rumah', 'Kesehatan',
      'Transportasi/BBM', 'Tagihan', 'Operasional', 'Pendapatan', 'Lain-lain'
    )
  )
);

create table if not exists public.circle_reactions (
  activity_id uuid not null references public.circle_activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create table if not exists public.circle_challenges (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  title text not null check (length(trim(title)) between 3 and 80),
  description text not null default '' check (length(description) <= 240),
  target_count integer not null check (target_count between 1 and 100),
  starts_on date not null default (now() at time zone 'Asia/Jakarta')::date,
  ends_on date not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.circle_challenge_progress (
  challenge_id uuid not null references public.circle_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  check_ins integer not null default 0 check (check_ins >= 0),
  last_check_in date,
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table if not exists public.transaction_splits (
  transaction_id uuid primary key references public.transactions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  split_data jsonb not null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(split_data) = 'object')
);

create index if not exists idx_circle_members_user on public.circle_members(user_id, joined_at desc);
create index if not exists idx_circle_activities_circle_created on public.circle_activities(circle_id, created_at desc);
create index if not exists idx_circle_challenges_circle_dates on public.circle_challenges(circle_id, ends_on);
create index if not exists idx_challenge_progress_challenge on public.circle_challenge_progress(challenge_id, check_ins desc);

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_activities enable row level security;
alter table public.circle_reactions enable row level security;
alter table public.circle_challenges enable row level security;
alter table public.circle_challenge_progress enable row level security;
alter table public.transaction_splits enable row level security;

create or replace function public.is_circle_member(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.circle_members cm
    where cm.circle_id = p_circle_id and cm.user_id = auth.uid()
  );
$$;

create policy "circle_members_read_own_circles"
on public.circles for select to authenticated
using (public.is_circle_member(id));

create policy "circle_members_read_circle_peers"
on public.circle_members for select to authenticated
using (public.is_circle_member(circle_id));

create policy "circle_activities_read_members"
on public.circle_activities for select to authenticated
using (public.is_circle_member(circle_id));

create policy "circle_activities_insert_members"
on public.circle_activities for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_circle_member(circle_id)
);

create policy "circle_activities_delete_own"
on public.circle_activities for delete to authenticated
using (user_id = auth.uid());

create policy "circle_reactions_read_members"
on public.circle_reactions for select to authenticated
using (exists (
  select 1
  from public.circle_activities ca
  join public.circle_members cm on cm.circle_id = ca.circle_id
  where ca.id = circle_reactions.activity_id and cm.user_id = auth.uid()
));

create policy "circle_reactions_insert_members"
on public.circle_reactions for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.circle_activities ca
    join public.circle_members cm on cm.circle_id = ca.circle_id
    where ca.id = circle_reactions.activity_id and cm.user_id = auth.uid()
  )
);

create policy "circle_reactions_delete_own"
on public.circle_reactions for delete to authenticated
using (user_id = auth.uid());

create policy "circle_challenges_read_members"
on public.circle_challenges for select to authenticated
using (public.is_circle_member(circle_id));

create policy "circle_challenges_insert_members"
on public.circle_challenges for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_circle_member(circle_id)
);

create policy "circle_challenges_update_own"
on public.circle_challenges for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid() and public.is_circle_member(circle_id));

create policy "circle_challenge_progress_read_members"
on public.circle_challenge_progress for select to authenticated
using (exists (
  select 1
  from public.circle_challenges cc
  where cc.id = circle_challenge_progress.challenge_id
    and public.is_circle_member(cc.circle_id)
));

create policy "transaction_splits_owner_all"
on public.transaction_splits for all to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.transactions t
    where t.id = transaction_splits.transaction_id and t.user_id = auth.uid()
  )
)
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.transactions t
    where t.id = transaction_splits.transaction_id and t.user_id = auth.uid()
  )
);

create or replace function public.create_circle(p_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  new_circle public.circles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 60 then
    raise exception 'Nama sirkel harus terdiri dari 2 sampai 60 karakter';
  end if;

  insert into public.circles (name, invite_code, created_by)
  values (trim(p_name), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), current_user_id)
  returning * into new_circle;

  insert into public.circle_members (circle_id, user_id, role)
  values (new_circle.id, current_user_id, 'OWNER');

  return query select new_circle.id, new_circle.name, new_circle.invite_code;
end;
$$;

create or replace function public.join_circle(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_circle_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.id into selected_circle_id
  from public.circles c
  where c.invite_code = upper(trim(p_invite_code));
  if selected_circle_id is null then
    raise exception 'Kode undangan tidak ditemukan';
  end if;

  insert into public.circle_members (circle_id, user_id)
  values (selected_circle_id, current_user_id)
  on conflict (circle_id, user_id) do nothing;
  return selected_circle_id;
end;
$$;

create or replace function public.check_in_circle_challenge(p_challenge_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  next_count integer;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.circle_challenges cc
    where cc.id = p_challenge_id
      and public.is_circle_member(cc.circle_id)
      and (now() at time zone 'Asia/Jakarta')::date between cc.starts_on and cc.ends_on
  ) then
    raise exception 'Tantangan tidak aktif atau Anda bukan anggota sirkel';
  end if;

  insert into public.circle_challenge_progress (challenge_id, user_id, display_name, check_ins, last_check_in)
  values (
    p_challenge_id,
    current_user_id,
    coalesce(
      nullif(trim((select p.full_name from public.profiles p where p.id = current_user_id)), ''),
      'Anggota'
    ),
    1,
    (now() at time zone 'Asia/Jakarta')::date
  )
  on conflict (challenge_id, user_id)
  do update set
    check_ins = least(
      public.circle_challenge_progress.check_ins + 1,
      (select target_count from public.circle_challenges where id = p_challenge_id)
    ),
    last_check_in = (now() at time zone 'Asia/Jakarta')::date,
    updated_at = now()
  where coalesce(
    public.circle_challenge_progress.last_check_in,
    '-infinity'::date
  ) < (now() at time zone 'Asia/Jakarta')::date
  returning check_ins into next_count;

  if next_count is null then
    raise exception 'Anda sudah check-in untuk tantangan ini hari ini';
  end if;
  return next_count;
end;
$$;

revoke all on function public.create_circle(text) from public;
revoke all on function public.join_circle(text) from public;
revoke all on function public.check_in_circle_challenge(uuid) from public;
revoke all on function public.is_circle_member(uuid) from public;
grant execute on function public.create_circle(text) to authenticated;
grant execute on function public.join_circle(text) to authenticated;
grant execute on function public.check_in_circle_challenge(uuid) to authenticated;
grant execute on function public.is_circle_member(uuid) to authenticated;
