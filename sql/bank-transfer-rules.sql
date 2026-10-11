-- Remember bank transaction signatures that represent transfers between MyLife accounts.
create table if not exists public.finance_bank_transfer_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_bank_account_id uuid not null references public.enable_banking_accounts(id) on delete cascade,
  counterpart_bank_account_id uuid references public.enable_banking_accounts(id) on delete cascade,
  source_finance_account_id uuid not null references public.finance_accounts(id) on delete cascade,
  destination_finance_account_id uuid not null references public.finance_accounts(id) on delete cascade,
  source_match_text text not null,
  counterpart_match_text text,
  date_tolerance_days integer not null default 1 check (date_tolerance_days between 0 and 3),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (source_finance_account_id <> destination_finance_account_id),
  unique (household_id, source_bank_account_id, source_match_text)
);

create index if not exists finance_bank_transfer_rules_household_idx
  on public.finance_bank_transfer_rules(household_id, source_bank_account_id);

alter table public.finance_bank_transfer_rules enable row level security;
revoke all on public.finance_bank_transfer_rules from anon, authenticated;
grant select, insert, update, delete on public.finance_bank_transfer_rules to service_role;
