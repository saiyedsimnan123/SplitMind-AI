-- SplitMind AI: Multi-method authentication profile support (Email OTP, Phone OTP + Twilio, Google OAuth)

alter table public.profiles
  add column if not exists phone text not null default '';

update public.profiles as p
set phone = coalesce(u.phone, '')
from auth.users as u
where p.id = u.id
  and coalesce(p.phone, '') = ''
  and coalesce(u.phone, '') <> '';

create index if not exists idx_profiles_phone
  on public.profiles(phone)
  where phone <> '';

-- Preserve email and phone identities safely without merging unverified accounts across distinct auth.users IDs
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
  derived_initials text;
  normalized_phone text;
begin
  normalized_phone := coalesce(new.phone, '');
  if normalized_phone <> '' and left(normalized_phone, 1) <> '+' then
    normalized_phone := '+' || normalized_phone;
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
        phone = case when excluded.phone <> '' then excluded.phone else public.profiles.phone end;

  return new;
end;
$$;
