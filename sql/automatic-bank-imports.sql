-- Activate automatic imports without treating any already-fetched bank history as new.
alter table public.enable_banking_accounts
  add column if not exists auto_import_enabled_at timestamptz;

alter table public.enable_banking_transactions
  add column if not exists first_seen_at timestamptz;

update public.enable_banking_transactions
set first_seen_at=coalesce(created_at,clock_timestamp())
where first_seen_at is null;

alter table public.enable_banking_transactions
  alter column first_seen_at set default clock_timestamp(),
  alter column first_seen_at set not null;

create index if not exists enable_banking_transactions_first_seen_idx
  on public.enable_banking_transactions(account_id,first_seen_at);

create table if not exists public.finance_merchant_category_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  merchant_key text not null,
  merchant_name text not null,
  transaction_type text not null check (transaction_type in ('expense','income')),
  category_id uuid not null references public.finance_categories(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (household_id,merchant_key,transaction_type)
);

create index if not exists finance_merchant_category_rules_household_idx
  on public.finance_merchant_category_rules(household_id,merchant_key);

alter table public.finance_merchant_category_rules enable row level security;
revoke all on public.finance_merchant_category_rules from anon,authenticated;

-- This timestamp is deliberately assigned only after historical rows receive
-- their first_seen_at value. Automatic import therefore starts after migration.
update public.enable_banking_accounts
set auto_import_enabled_at=clock_timestamp()
where finance_account_id is not null
  and auto_import_enabled_at is null;
