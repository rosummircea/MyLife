-- Monthly repayment turnover target for household credit cards.

create table if not exists public.finance_monthly_credit_turnover_targets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month date not null,
  amount numeric(14,2) not null,
  currency char(3) not null default 'RON',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_monthly_credit_turnover_targets_month_start check (month=date_trunc('month',month)::date),
  constraint finance_monthly_credit_turnover_targets_amount_nonnegative check (amount>=0),
  constraint finance_monthly_credit_turnover_targets_unique unique (household_id,month,currency)
);

alter table public.finance_monthly_credit_turnover_targets enable row level security;

drop policy if exists finance_monthly_credit_turnover_targets_select on public.finance_monthly_credit_turnover_targets;
create policy finance_monthly_credit_turnover_targets_select
on public.finance_monthly_credit_turnover_targets for select
to authenticated
using ((select mylife_auth.is_household_member(household_id)));

drop policy if exists finance_monthly_credit_turnover_targets_insert on public.finance_monthly_credit_turnover_targets;
create policy finance_monthly_credit_turnover_targets_insert
on public.finance_monthly_credit_turnover_targets for insert
to authenticated
with check ((select mylife_auth.can_manage_finance(household_id)));

drop policy if exists finance_monthly_credit_turnover_targets_update on public.finance_monthly_credit_turnover_targets;
create policy finance_monthly_credit_turnover_targets_update
on public.finance_monthly_credit_turnover_targets for update
to authenticated
using ((select mylife_auth.can_manage_finance(household_id)))
with check ((select mylife_auth.can_manage_finance(household_id)));

drop policy if exists finance_monthly_credit_turnover_targets_delete on public.finance_monthly_credit_turnover_targets;
create policy finance_monthly_credit_turnover_targets_delete
on public.finance_monthly_credit_turnover_targets for delete
to authenticated
using ((select mylife_auth.can_manage_finance(household_id)));

revoke all on table public.finance_monthly_credit_turnover_targets from authenticated;
grant select,insert,update,delete on table public.finance_monthly_credit_turnover_targets to authenticated;
revoke all on table public.finance_monthly_credit_turnover_targets from anon;
