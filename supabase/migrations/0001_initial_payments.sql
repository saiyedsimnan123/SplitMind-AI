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
