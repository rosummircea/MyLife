-- Transfers and balance adjustments never belong to income/expense categories.
-- Clean up historical allocations first, then enforce the invariant both when
-- a transaction changes type and when a split is written directly.
delete from public.finance_transaction_splits s
using public.finance_transactions t
where t.id=s.transaction_id
  and t.transaction_type not in ('expense','income');

create or replace function public.finance_remove_non_category_transaction_splits()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.transaction_type not in ('expense','income') then
    delete from public.finance_transaction_splits where transaction_id=new.id;
  end if;
  return new;
end $$;

drop trigger if exists finance_remove_non_category_transaction_splits on public.finance_transactions;
create trigger finance_remove_non_category_transaction_splits
after insert or update of transaction_type on public.finance_transactions
for each row execute function public.finance_remove_non_category_transaction_splits();

create or replace function public.finance_guard_transaction_split_kind()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if not exists (
    select 1
    from public.finance_transactions t
    where t.id=new.transaction_id
      and t.transaction_type in ('expense','income')
  ) then
    raise exception 'Transferurile și ajustările de sold nu pot avea categorii.';
  end if;
  return new;
end $$;

drop trigger if exists finance_guard_transaction_split_kind on public.finance_transaction_splits;
create trigger finance_guard_transaction_split_kind
before insert or update on public.finance_transaction_splits
for each row execute function public.finance_guard_transaction_split_kind();
