-- PostgREST generates ON CONFLICT(source_transaction_id) for recurring-rule
-- upserts. A partial unique index cannot be inferred by that clause, while a
-- regular UNIQUE constraint still permits multiple NULL values in PostgreSQL.
drop index if exists public.finance_recurring_rules_source_transaction_uidx;

alter table public.finance_recurring_rules
  drop constraint if exists finance_recurring_rules_source_transaction_key;

alter table public.finance_recurring_rules
  add constraint finance_recurring_rules_source_transaction_key
  unique (source_transaction_id);
