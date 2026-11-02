alter table public.finance_recurring_rules
  add column if not exists source_transaction_id uuid references public.finance_transactions(id) on delete cascade,
  add column if not exists forecast_months smallint not null default 2;

alter table public.finance_recurring_rules
  drop constraint if exists finance_recurring_rules_forecast_months_check;
alter table public.finance_recurring_rules
  add constraint finance_recurring_rules_forecast_months_check check (forecast_months between 0 and 12);

create unique index if not exists finance_recurring_rules_source_transaction_uidx
  on public.finance_recurring_rules(source_transaction_id)
  where source_transaction_id is not null;
create index if not exists finance_recurring_rules_household_active_idx
  on public.finance_recurring_rules(household_id,is_active);

grant select,insert,update,delete on table public.finance_recurring_rules to authenticated;
revoke all on table public.finance_recurring_rules from anon;
