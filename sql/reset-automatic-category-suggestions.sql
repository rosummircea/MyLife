begin;

-- Preserve categories that were explicitly taught by the user. Older rows
-- still carried the "suggested" marker even after a merchant rule was saved.
with learned as (
  select t.id,r.category_id
  from public.finance_transactions t
  join public.finance_merchant_category_rules r
    on r.household_id=t.household_id
   and r.transaction_type=t.transaction_type
   and r.merchant_key=lower(regexp_replace(trim(coalesce(t.merchant,t.description,'')), '\s+', ' ', 'g'))
  where t.status='posted'
    and t.import_metadata->>'categorization_source'='suggested'
)
update public.finance_transaction_splits s
set category_id=learned.category_id
from learned
where s.transaction_id=learned.id;

update public.finance_transactions t
set import_metadata=t.import_metadata||jsonb_build_object('categorization_source','learned')
where t.status='posted'
  and t.import_metadata->>'categorization_source'='suggested'
  and exists (
    select 1
    from public.finance_merchant_category_rules r
    where r.household_id=t.household_id
      and r.transaction_type=t.transaction_type
      and r.merchant_key=lower(regexp_replace(trim(coalesce(t.merchant,t.description,'')), '\s+', ' ', 'g'))
  );

-- Preserve an explicit multi-category split, but stop treating it as an
-- automatic suggestion.
update public.finance_transactions t
set import_metadata=t.import_metadata||jsonb_build_object('categorization_source','manual')
where t.status='posted'
  and t.import_metadata->>'categorization_source'='suggested'
  and (select count(*) from public.finance_transaction_splits s where s.transaction_id=t.id)>1;

-- Everything that was only guessed automatically becomes uncategorized.
update public.finance_transaction_splits s
set category_id='66cd3a4c-762c-494f-9856-4a3e1fbb4052'
from public.finance_transactions t
where s.transaction_id=t.id
  and t.status='posted'
  and t.transaction_type='expense'
  and t.import_metadata->>'categorization_source'='suggested';

delete from public.finance_transaction_splits s
using public.finance_transactions t
where s.transaction_id=t.id
  and t.status='posted'
  and t.transaction_type='income'
  and t.import_metadata->>'categorization_source'='suggested';

update public.finance_transactions t
set import_metadata=t.import_metadata||jsonb_build_object('categorization_source','uncategorized')
where t.status='posted'
  and t.import_metadata->>'categorization_source'='suggested';

commit;
