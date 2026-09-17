-- Proposed migration. Apply only after user approval.
create table public.finance_loans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_user_id uuid not null default auth.uid() references auth.users(id),
  direction text not null check (direction in ('given','received')),
  counterparty text not null check (length(btrim(counterparty)) between 1 and 200),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  loan_date date not null,
  purpose text check (length(purpose) <= 1000),
  notes text check (length(notes) <= 4000),
  repaid_amount numeric(14,2) not null default 0 check (repaid_amount >= 0 and repaid_amount <= amount),
  created_at timestamptz not null default now()
);
create index finance_loans_household_date_idx on public.finance_loans(household_id,loan_date desc,id);
alter table public.finance_loans enable row level security;
revoke all on public.finance_loans from public, anon, authenticated;
grant select,insert on public.finance_loans to authenticated;
create policy finance_loans_read on public.finance_loans for select to authenticated
using (exists (select 1 from public.household_members hm join public.people p on p.id=hm.person_id where hm.household_id=finance_loans.household_id and hm.status='active' and p.auth_user_id=(select auth.uid())));
create policy finance_loans_create on public.finance_loans for insert to authenticated
with check (created_by_user_id=(select auth.uid()) and exists (select 1 from public.household_members hm join public.people p on p.id=hm.person_id where hm.household_id=finance_loans.household_id and hm.status='active' and p.auth_user_id=(select auth.uid())));
-- UI only updates the total repaid amount. Ownership and loan terms cannot be reassigned.
revoke update on public.finance_loans from authenticated;
grant update(repaid_amount) on public.finance_loans to authenticated;
create policy finance_loans_repay on public.finance_loans for update to authenticated
using (exists (select 1 from public.household_members hm join public.people p on p.id=hm.person_id where hm.household_id=finance_loans.household_id and hm.status='active' and p.auth_user_id=(select auth.uid())))
with check (exists (select 1 from public.household_members hm join public.people p on p.id=hm.person_id where hm.household_id=finance_loans.household_id and hm.status='active' and p.auth_user_id=(select auth.uid())));
