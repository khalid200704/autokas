create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  timezone text not null default 'Asia/Jakarta',
  onboarding_goal text check (onboarding_goal in ('FREELANCER', 'PERSONAL_FINANCE')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('PENGELUARAN', 'PENDAPATAN')),
  merchant text not null default 'Umum',
  description text not null default '',
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  date date not null,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  item_name text not null,
  price numeric(12, 2) not null check (price >= 0),
  qty integer not null default 1 check (qty > 0),
  category text not null check (category in (
    'Makanan & Minuman', 'Kebutuhan Rumah', 'Kesehatan',
    'Transportasi/BBM', 'Tagihan', 'Operasional', 'Pendapatan', 'Lain-lain'
  )),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_date)
);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.extraction_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  image_path text,
  source_file_name text,
  ai_result jsonb not null,
  corrected_result jsonb not null,
  model_name text,
  model_version text,
  latency_ms integer,
  consented_for_training boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_date on public.transactions(user_id, date desc);
create index if not exists idx_transactions_user_type on public.transactions(user_id, transaction_type);
create index if not exists idx_transaction_items_transaction on public.transaction_items(transaction_id);
create index if not exists idx_corrections_user_created on public.extraction_corrections(user_id, created_at desc);
create index if not exists idx_events_user_created on public.events(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.ai_usage enable row level security;
alter table public.events enable row level security;
alter table public.extraction_corrections enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.create_transaction_with_items(
  p_id uuid,
  p_merchant text,
  p_description text,
  p_total_amount numeric,
  p_date date,
  p_transaction_type text,
  p_image_path text,
  p_items jsonb,
  p_ai_result jsonb default null,
  p_source_file_name text default null,
  p_consented_for_training boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  item jsonb;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_total_amount < 0 then
    raise exception 'Total must be non-negative';
  end if;
  if p_transaction_type not in ('PENGELUARAN', 'PENDAPATAN') then
    raise exception 'Invalid transaction type';
  end if;

  insert into public.transactions (
    id, user_id, merchant, description, total_amount, date,
    transaction_type, image_path
  ) values (
    p_id, current_user_id, coalesce(nullif(trim(p_merchant), ''), 'Umum'),
    coalesce(p_description, ''), p_total_amount, p_date,
    p_transaction_type, p_image_path
  );

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.transaction_items (
      transaction_id, item_name, price, qty, category
    ) values (
      p_id,
      coalesce(nullif(item->>'item_name', ''), 'Item tidak dikenal'),
      greatest(coalesce((item->>'price')::numeric, 0), 0),
      greatest(coalesce((item->>'qty')::integer, 1), 1),
      case
        when item->>'category' in (
          'Makanan & Minuman', 'Kebutuhan Rumah', 'Kesehatan',
          'Transportasi/BBM', 'Tagihan', 'Operasional', 'Pendapatan', 'Lain-lain'
        ) then item->>'category'
        else 'Lain-lain'
      end
    );
  end loop;

  if p_ai_result is not null then
    insert into public.extraction_corrections (
      user_id, transaction_id, image_path, source_file_name,
      ai_result, corrected_result, consented_for_training
    ) values (
      current_user_id, p_id, p_image_path, p_source_file_name,
      p_ai_result, jsonb_build_object(
        'merchant', p_merchant,
        'description', p_description,
        'total_amount', p_total_amount,
        'date', p_date,
        'transaction_type', p_transaction_type,
        'items', coalesce(p_items, '[]'::jsonb)
      ), p_consented_for_training
    );
  end if;

  return p_id;
end;
$$;

create or replace function public.consume_ai_request(p_daily_limit integer default 20)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_count integer;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.ai_usage (user_id, usage_date, request_count)
  values (current_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set request_count = public.ai_usage.request_count + 1
  returning request_count into new_count;

  if new_count > p_daily_limit then
    update public.ai_usage
    set request_count = request_count - 1
    where user_id = current_user_id and usage_date = current_date;
    return false;
  end if;
  return true;
end;
$$;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "transactions_select_own" on public.transactions for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_delete_own" on public.transactions for delete using (auth.uid() = user_id);
create policy "items_select_own" on public.transaction_items for select using (exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid()));
create policy "items_insert_own" on public.transaction_items for insert with check (exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid()));
create policy "items_update_own" on public.transaction_items for update using (exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid())) with check (exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid()));
create policy "items_delete_own" on public.transaction_items for delete using (exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid()));
create policy "ai_usage_select_own" on public.ai_usage for select using (auth.uid() = user_id);
create policy "events_insert_own" on public.events for insert with check (auth.uid() = user_id);
create policy "corrections_select_own" on public.extraction_corrections for select using (auth.uid() = user_id);
create policy "corrections_insert_own" on public.extraction_corrections for insert with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_select_own" on storage.objects for select using (
  bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "receipts_insert_own" on storage.objects for insert with check (
  bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "receipts_delete_own" on storage.objects for delete using (
  bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
);
