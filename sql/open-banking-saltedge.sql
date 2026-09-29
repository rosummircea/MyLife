-- Salt Edge data is written only by trusted server routes. Authenticated users can
-- read their own imported state; RLS blocks access to every other household.
create table if not exists public.open_banking_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  saltedge_customer_id text not null unique,
  identifier text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, household_id)
);

create table if not exists public.open_banking_connections (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.open_banking_customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  saltedge_connection_id text not null unique,
  provider_code text,
  provider_name text,
  country_code text,
  status text not null default 'pending',
  stage text,
  consent_status text,
  last_error_class text,
  last_error_message text,
  last_synced_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.open_banking_accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.open_banking_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  saltedge_account_id text not null unique,
  finance_account_id uuid references public.finance_accounts(id) on delete set null,
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

create table if not exists public.open_banking_transactions (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.open_banking_connections(id) on delete cascade,
  account_id uuid not null references public.open_banking_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  saltedge_transaction_id text not null unique,
  status text not null,
  duplicated boolean not null default false,
  mode text,
  made_on date not null,
  amount numeric not null,
  currency text not null,
  description text,
  category text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists open_banking_connections_user_idx on public.open_banking_connections(user_id, updated_at desc);
create index if not exists open_banking_accounts_connection_idx on public.open_banking_accounts(connection_id);
create index if not exists open_banking_transactions_account_date_idx on public.open_banking_transactions(account_id, made_on desc);

alter table public.open_banking_customers enable row level security;
alter table public.open_banking_connections enable row level security;
alter table public.open_banking_accounts enable row level security;
alter table public.open_banking_transactions enable row level security;

drop policy if exists open_banking_customers_select_own on public.open_banking_customers;
create policy open_banking_customers_select_own on public.open_banking_customers for select to authenticated using (user_id = auth.uid());
drop policy if exists open_banking_connections_select_own on public.open_banking_connections;
create policy open_banking_connections_select_own on public.open_banking_connections for select to authenticated using (user_id = auth.uid());
drop policy if exists open_banking_accounts_select_own on public.open_banking_accounts;
create policy open_banking_accounts_select_own on public.open_banking_accounts for select to authenticated using (user_id = auth.uid());
drop policy if exists open_banking_transactions_select_own on public.open_banking_transactions;
create policy open_banking_transactions_select_own on public.open_banking_transactions for select to authenticated using (user_id = auth.uid());

revoke all on public.open_banking_customers, public.open_banking_connections, public.open_banking_accounts, public.open_banking_transactions from anon;
revoke insert, update, delete on public.open_banking_customers, public.open_banking_connections, public.open_banking_accounts, public.open_banking_transactions from authenticated;
grant select on public.open_banking_customers, public.open_banking_connections, public.open_banking_accounts, public.open_banking_transactions to authenticated;
