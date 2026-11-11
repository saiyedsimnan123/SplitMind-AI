-- SplitMind AI: Email/password authentication with optional, unique normalized phone numbers on profiles
-- Non-destructive migration: preserves all existing users, profiles, groups, and transactions.

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

do $$
begin
  if not exists (
    select 1
    from public.profiles
    where phone <> ''
    group by phone
    having count(*) > 1
  ) then
    drop index if exists public.idx_profiles_phone;
    create unique index if not exists uq_profiles_phone
      on public.profiles(phone)
      where phone <> '';
  else
    create index if not exists idx_profiles_phone
      on public.profiles(phone)
      where phone <> '';
  end if;
end $$;
