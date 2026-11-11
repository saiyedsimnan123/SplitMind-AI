create table if not exists public.splitmind_payments (
  idempotency_key text primary key,
  order_id text not null unique,
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null check (currency = 'USD'),
  status text not null,
  capture_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.splitmind_payments enable row level security;

create or replace function public.touch_splitmind_payment_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists splitmind_payment_updated_at on public.splitmind_payments;
create trigger splitmind_payment_updated_at
before update on public.splitmind_payments
for each row execute function public.touch_splitmind_payment_updated_at();
-- SplitMind AI: Multi-group workspaces, Supabase Auth profiles, financial ledger, and immutable security/audit logs.

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. User profiles linked to Supabase Auth users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  phone text not null default '',
  full_name text not null check (char_length(trim(full_name)) between 1 and 80),
  initials text not null check (char_length(trim(initials)) between 1 and 4),
  avatar_color text not null default 'coral',
  default_currency text not null default 'INR' check (default_currency in ('INR', 'USD', 'EUR', 'GBP')),
  workspace_initialized boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_profiles_phone on public.profiles(phone) where phone <> '';

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- Automatically provision a profile when a Supabase Auth user is created
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
  derived_initials text;
  raw_phone text;
  normalized_phone text;
begin
  raw_phone := coalesce(
    nullif(trim(new.phone), ''),
    nullif(trim(new.raw_user_meta_data ->> 'contact_phone'), ''),
    ''
  );
  normalized_phone := regexp_replace(raw_phone, '[^0-9+]', '', 'g');
  if normalized_phone <> '' and left(normalized_phone, 1) <> '+' then
    normalized_phone := '+' || normalized_phone;
  end if;

  if normalized_phone <> '' and exists (
    select 1 from public.profiles as existing
    where existing.phone = normalized_phone
      and existing.id <> new.id
  ) then
    normalized_phone := '';
  end if;

  raw_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    case
      when normalized_phone <> '' then 'Member ' || right(normalized_phone, 4)
      else null
    end,
    'Member'
  );
  raw_name := left(raw_name, 80);
  derived_initials := upper(
    left(
      regexp_replace(raw_name, '[^A-Za-z0-9]', '', 'g'),
      2
    )
  );
  if char_length(derived_initials) = 0 then
    derived_initials := 'SM';
  end if;

  insert into public.profiles (id, email, phone, full_name, initials)
  values (new.id, coalesce(new.email, ''), normalized_phone, raw_name, derived_initials)
  on conflict (id) do update
    set email = case when excluded.email <> '' then excluded.email else public.profiles.email end,
        phone = case
          when public.profiles.phone = '' and excluded.phone <> ''
            and not exists (
              select 1 from public.profiles as other
              where other.phone = excluded.phone
                and other.id <> public.profiles.id
            )
            then excluded.phone
          else public.profiles.phone
        end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- 2. Groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 100),
  plan_type text not null default 'trip' check (plan_type in ('trip', 'roommates', 'event', 'project', 'other')),
  description text not null default '' check (char_length(description) <= 500),
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP')),
  total_budget numeric(12, 2) not null default 0 check (total_budget >= 0),
  start_date date not null default current_date,
  end_date date,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_end_date_after_start check (end_date is null or end_date >= start_date)
);

create index if not exists idx_groups_owner_id on public.groups(owner_id);
create index if not exists idx_groups_archived_at on public.groups(archived_at);

drop trigger if exists groups_updated_at on public.groups;
create trigger groups_updated_at
before update on public.groups
for each row execute function public.touch_updated_at();

-- 3. Group memberships (supports linked auth users and managed roster participants)
create table if not exists public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  email text,
  initials text not null check (char_length(trim(initials)) between 1 and 4),
  avatar_color text not null default 'sky',
  role text not null default 'member' check (role in ('owner', 'organizer', 'member')),
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_group_memberships_group_id on public.group_memberships(group_id);
create index if not exists idx_group_memberships_user_id on public.group_memberships(user_id);
create unique index if not exists uq_group_memberships_group_user
  on public.group_memberships(group_id, user_id)
  where user_id is not null;
create unique index if not exists uq_group_memberships_group_name
  on public.group_memberships(group_id, lower(display_name));

drop trigger if exists group_memberships_updated_at on public.group_memberships;
create trigger group_memberships_updated_at
before update on public.group_memberships
for each row execute function public.touch_updated_at();

-- 4. Group budgets (category budgets + draft proposals)
create table if not exists public.group_budgets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  category_key text not null check (char_length(trim(category_key)) between 1 and 60),
  label text not null check (char_length(trim(label)) between 1 and 80),
  planned_amount numeric(12, 2) not null default 0 check (planned_amount >= 0),
  draft_amount numeric(12, 2) not null default 0 check (draft_amount >= 0),
  spent_amount numeric(12, 2) not null default 0 check (spent_amount >= 0),
  color text not null default '#b9a2ff',
  sort_order integer not null default 0,
  proposal_requested boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_group_budgets_group_key unique (group_id, category_key)
);

create index if not exists idx_group_budgets_group_order on public.group_budgets(group_id, sort_order);

drop trigger if exists group_budgets_updated_at on public.group_budgets;
create trigger group_budgets_updated_at
before update on public.group_budgets
for each row execute function public.touch_updated_at();

-- 5. Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  category_id uuid references public.group_budgets(id) on delete set null,
  category_label text not null check (char_length(trim(category_label)) between 1 and 80),
  title text not null check (char_length(trim(title)) between 1 and 140),
  amount numeric(12, 2) not null check (amount > 0),
  paid_by_member_id uuid not null references public.group_memberships(id) on delete restrict,
  paid_by_name text not null,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  verified boolean not null default false,
  verified_by_user_id uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  receipt_name text,
  receipt_data text,
  expense_date date not null default current_date,
  notes text not null default '' check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expenses_group_created on public.expenses(group_id, created_at desc);
create index if not exists idx_expenses_paid_by on public.expenses(paid_by_member_id);

drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at
before update on public.expenses
for each row execute function public.touch_updated_at();

-- 6. Contributions
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  member_id uuid not null references public.group_memberships(id) on delete cascade,
  recipient_member_id uuid references public.group_memberships(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP')),
  source text not null default 'manual' check (source in ('manual', 'expense', 'settlement', 'paypal_sandbox')),
  payment_idempotency_key text references public.splitmind_payments(idempotency_key) on delete set null,
  note text not null default '' check (char_length(note) <= 300),
  recorded_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_contributions_group_created on public.contributions(group_id, created_at desc);
create index if not exists idx_contributions_member_id on public.contributions(member_id);

-- 7. Settlements
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_member_id uuid not null references public.group_memberships(id) on delete restrict,
  to_member_id uuid not null references public.group_memberships(id) on delete restrict,
  from_name text not null,
  to_name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR', 'GBP')),
  status text not null default 'recorded' check (status in ('suggested', 'recorded', 'verified')),
  note text not null default '' check (char_length(note) <= 300),
  recorded_by_user_id uuid references public.profiles(id) on delete set null,
  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlements_distinct_parties check (from_member_id <> to_member_id)
);

create index if not exists idx_settlements_group_created on public.settlements(group_id, created_at desc);

drop trigger if exists settlements_updated_at on public.settlements;
create trigger settlements_updated_at
before update on public.settlements
for each row execute function public.touch_updated_at();

-- 8. Link PayPal payment ledger rows optionally to user & group without breaking existing behavior
alter table public.splitmind_payments
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists group_id uuid references public.groups(id) on delete set null;

create index if not exists idx_splitmind_payments_user_id on public.splitmind_payments(user_id);
create index if not exists idx_splitmind_payments_group_id on public.splitmind_payments(group_id);

-- 9. Immutable Security & Audit Events
create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('authentication', 'financial', 'group', 'security')),
  event_type text not null check (char_length(trim(event_type)) between 2 and 80),
  event_name text not null check (char_length(trim(event_name)) between 2 and 120),
  status text not null check (status in ('success', 'failure', 'warning', 'info')),
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text not null check (char_length(trim(actor_label)) between 1 and 120),
  group_id uuid references public.groups(id) on delete set null,
  group_name text,
  description text not null check (char_length(description) <= 600),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_actor_created on public.security_audit_events(actor_user_id, created_at desc);
create index if not exists idx_audit_group_created on public.security_audit_events(group_id, created_at desc);
create index if not exists idx_audit_category_created on public.security_audit_events(category, created_at desc);
create index if not exists idx_audit_created on public.security_audit_events(created_at desc);

create or replace function public.prevent_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'security_audit_events is append-only; updates and deletes are forbidden';
end;
$$;

drop trigger if exists security_audit_events_immutable on public.security_audit_events;
create trigger security_audit_events_immutable
before update or delete on public.security_audit_events
for each row execute function public.prevent_audit_mutation();

-- 10. Security-definer RLS membership helpers (avoid recursive RLS evaluation)
create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups g
    where g.id = target_group_id and g.owner_id = auth.uid()
  ) or exists (
    select 1 from public.group_memberships gm
    where gm.group_id = target_group_id and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_organizer(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups g
    where g.id = target_group_id and g.owner_id = auth.uid()
  ) or exists (
    select 1 from public.group_memberships gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.role in ('owner', 'organizer')
  );
$$;

create or replace function public.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups g
    where g.id = target_group_id and g.owner_id = auth.uid()
  );
$$;

create or replace function public.shares_group_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_memberships gm1
    join public.group_memberships gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid() and gm2.user_id = target_user_id
  );
$$;

-- 11. Enable Row Level Security on all tables
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.group_budgets enable row level security;
alter table public.expenses enable row level security;
alter table public.contributions enable row level security;
alter table public.settlements enable row level security;
alter table public.security_audit_events enable row level security;

-- Profiles RLS
drop policy if exists profiles_select_self_or_shared on public.profiles;
create policy profiles_select_self_or_shared on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.shares_group_with(id)
);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Groups RLS
drop policy if exists groups_select_member on public.groups;
create policy groups_select_member on public.groups
for select to authenticated
using (
  owner_id = auth.uid()
  or public.is_group_member(id)
);

drop policy if exists groups_insert_owner on public.groups;
create policy groups_insert_owner on public.groups
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists groups_update_organizer on public.groups;
create policy groups_update_organizer on public.groups
for update to authenticated
using (public.is_group_organizer(id))
with check (public.is_group_organizer(id));

drop policy if exists groups_delete_owner on public.groups;
create policy groups_delete_owner on public.groups
for delete to authenticated
using (public.is_group_owner(id));

-- Group memberships RLS
drop policy if exists memberships_select_member on public.group_memberships;
create policy memberships_select_member on public.group_memberships
for select to authenticated
using (public.is_group_member(group_id));

drop policy if exists memberships_insert_organizer on public.group_memberships;
create policy memberships_insert_organizer on public.group_memberships
for insert to authenticated
with check (public.is_group_organizer(group_id));

drop policy if exists memberships_update_organizer on public.group_memberships;
create policy memberships_update_organizer on public.group_memberships
for update to authenticated
using (public.is_group_organizer(group_id))
with check (public.is_group_organizer(group_id));

drop policy if exists memberships_delete_organizer on public.group_memberships;
create policy memberships_delete_organizer on public.group_memberships
for delete to authenticated
using (public.is_group_organizer(group_id));

-- Group budgets RLS
drop policy if exists budgets_select_member on public.group_budgets;
create policy budgets_select_member on public.group_budgets
for select to authenticated
using (public.is_group_member(group_id));

drop policy if exists budgets_insert_member on public.group_budgets;
create policy budgets_insert_member on public.group_budgets
for insert to authenticated
with check (public.is_group_member(group_id));

drop policy if exists budgets_update_member on public.group_budgets;
create policy budgets_update_member on public.group_budgets
for update to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id));

drop policy if exists budgets_delete_organizer on public.group_budgets;
create policy budgets_delete_organizer on public.group_budgets
for delete to authenticated
using (public.is_group_organizer(group_id));

-- Expenses RLS
drop policy if exists expenses_select_member on public.expenses;
create policy expenses_select_member on public.expenses
for select to authenticated
using (public.is_group_member(group_id));

drop policy if exists expenses_insert_member on public.expenses;
create policy expenses_insert_member on public.expenses
for insert to authenticated
with check (
  public.is_group_member(group_id)
  and (created_by_user_id is null or created_by_user_id = auth.uid())
);

drop policy if exists expenses_update_member on public.expenses;
create policy expenses_update_member on public.expenses
for update to authenticated
using (public.is_group_member(group_id))
with check (public.is_group_member(group_id));

drop policy if exists expenses_delete_creator_or_organizer on public.expenses;
create policy expenses_delete_creator_or_organizer on public.expenses
for delete to authenticated
using (
  public.is_group_organizer(group_id)
  or created_by_user_id = auth.uid()
);

-- Contributions RLS
drop policy if exists contributions_select_member on public.contributions;
create policy contributions_select_member on public.contributions
for select to authenticated
using (public.is_group_member(group_id));

drop policy if exists contributions_insert_member on public.contributions;
create policy contributions_insert_member on public.contributions
for insert to authenticated
with check (
  public.is_group_member(group_id)
  and (recorded_by_user_id is null or recorded_by_user_id = auth.uid())
);

-- Settlements RLS
drop policy if exists settlements_select_member on public.settlements;
create policy settlements_select_member on public.settlements
for select to authenticated
using (public.is_group_member(group_id));

drop policy if exists settlements_insert_member on public.settlements;
create policy settlements_insert_member on public.settlements
for insert to authenticated
with check (
  public.is_group_member(group_id)
  and (recorded_by_user_id is null or recorded_by_user_id = auth.uid())
);

drop policy if exists settlements_update_organizer on public.settlements;
create policy settlements_update_organizer on public.settlements
for update to authenticated
using (public.is_group_organizer(group_id))
with check (public.is_group_organizer(group_id));

-- Security & audit events RLS: strictly read-only for authenticated users; inserts happen only via server service role
drop policy if exists audit_select_own_or_group on public.security_audit_events;
create policy audit_select_own_or_group on public.security_audit_events
for select to authenticated
using (
  actor_user_id = auth.uid()
  or (group_id is not null and public.is_group_member(group_id))
);

revoke insert, update, delete, truncate on public.security_audit_events from anon, authenticated;

-- Payments ledger optional authenticated read policy for own orders
drop policy if exists payments_select_own on public.splitmind_payments;
create policy payments_select_own on public.splitmind_payments
for select to authenticated
using (
  user_id = auth.uid()
  or (group_id is not null and public.is_group_member(group_id))
);
