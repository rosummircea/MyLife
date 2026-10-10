-- Enable Banking imports stay in a staging area until the user explicitly maps
-- an external account to a MyLife finance account. Only trusted server routes write.
create table if not exists public.enable_banking_authorizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  state_hash text not null unique,
  authorization_id text unique,
  provider_name text not null,
  country_code text not null,
  status text not null default 'pending',
  error_message text,
  expires_at timestamptz not null,
  completed_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enable_banking_sessions (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid references public.enable_banking_authorizations(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  external_session_id text not null unique,
  provider_name text not null,
  country_code text not null,
  status text not null default 'AUTHORIZED',
  consent_valid_until timestamptz,
  last_error_message text,
  last_synced_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enable_banking_accounts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.enable_banking_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  external_account_id text not null unique,
  finance_account_id uuid references public.finance_accounts(id) on delete set null,
  auto_import_enabled_at timestamptz,
  name text not null,
  nature text,
  currency text not null,
  balance numeric,
  available_amount numeric,
  iban_last4 text,
  status text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enable_banking_transactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.enable_banking_sessions(id) on delete cascade,
  account_id uuid not null references public.enable_banking_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  external_transaction_id text not null,
  status text not null,
  made_on date not null,
  amount numeric not null,
  currency text not null,
  description text,
  merchant_name text,
  merchant_category_code text,
  first_seen_at timestamptz not null default clock_timestamp(),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, external_transaction_id)
);

create index if not exists enable_banking_authorizations_user_idx on public.enable_banking_authorizations(user_id, created_at desc);
create index if not exists enable_banking_sessions_user_idx on public.enable_banking_sessions(user_id, updated_at desc);
create index if not exists enable_banking_accounts_session_idx on public.enable_banking_accounts(session_id);
create index if not exists enable_banking_transactions_account_date_idx on public.enable_banking_transactions(account_id, made_on desc);
create index if not exists enable_banking_transactions_first_seen_idx on public.enable_banking_transactions(account_id, first_seen_at);

create table if not exists public.finance_merchant_category_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  merchant_key text not null,
  merchant_name text not null,
  transaction_type text not null check (transaction_type in ('expense','income')),
  category_id uuid not null references public.finance_categories(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (household_id, merchant_key, transaction_type)
);
create index if not exists finance_merchant_category_rules_household_idx on public.finance_merchant_category_rules(household_id, merchant_key);

alter table public.enable_banking_authorizations enable row level security;
alter table public.enable_banking_sessions enable row level security;
alter table public.enable_banking_accounts enable row level security;
alter table public.enable_banking_transactions enable row level security;
alter table public.finance_merchant_category_rules enable row level security;

drop policy if exists enable_banking_authorizations_select_own on public.enable_banking_authorizations;
create policy enable_banking_authorizations_select_own on public.enable_banking_authorizations for select to authenticated using (user_id = auth.uid());
drop policy if exists enable_banking_sessions_select_own on public.enable_banking_sessions;
create policy enable_banking_sessions_select_own on public.enable_banking_sessions for select to authenticated using (user_id = auth.uid());
drop policy if exists enable_banking_accounts_select_own on public.enable_banking_accounts;
create policy enable_banking_accounts_select_own on public.enable_banking_accounts for select to authenticated using (user_id = auth.uid());
drop policy if exists enable_banking_transactions_select_own on public.enable_banking_transactions;
create policy enable_banking_transactions_select_own on public.enable_banking_transactions for select to authenticated using (user_id = auth.uid());

revoke all on public.enable_banking_authorizations, public.enable_banking_sessions, public.enable_banking_accounts, public.enable_banking_transactions from anon;
revoke all on public.finance_merchant_category_rules from anon, authenticated;
revoke insert, update, delete on public.enable_banking_authorizations, public.enable_banking_sessions, public.enable_banking_accounts, public.enable_banking_transactions from authenticated;
grant select on public.enable_banking_authorizations, public.enable_banking_sessions, public.enable_banking_accounts, public.enable_banking_transactions to authenticated;
