begin;

-- Income categories do not need a generic "Venituri" container. Keep a real
-- uncategorized destination so imports and existing direct allocations remain
-- editable, then promote every former child to the top level.
with income_roots as (
  select household_id,id
  from public.finance_categories
  where kind='income' and parent_id is null and lower(trim(name))='venituri'
)
insert into public.finance_categories (id,household_id,parent_id,name,kind,icon,color,sort_order,is_active)
select gen_random_uuid(),household_id,null,'Necategorizat','income','tag','#8d98a8',0,true
from income_roots
on conflict (household_id,parent_id,name,kind)
do update set is_active=true,icon='tag',color='#8d98a8';

with income_roots as (
  select household_id,id
  from public.finance_categories
  where kind='income' and parent_id is null and lower(trim(name))='venituri'
), uncategorized as (
  select household_id,id
  from public.finance_categories
  where kind='income' and parent_id is null and lower(trim(name))='necategorizat'
)
update public.finance_transaction_splits split
set category_id=uncategorized.id
from income_roots root
join uncategorized using (household_id)
where split.category_id=root.id;

with income_roots as (
  select household_id,id
  from public.finance_categories
  where kind='income' and parent_id is null and lower(trim(name))='venituri'
), uncategorized as (
  select household_id,id
  from public.finance_categories
  where kind='income' and parent_id is null and lower(trim(name))='necategorizat'
)
update public.finance_historical_aggregates aggregate
set category_id=uncategorized.id
from income_roots root
join uncategorized using (household_id)
where aggregate.category_id=root.id;

with income_roots as (
  select id
  from public.finance_categories
  where kind='income' and parent_id is null and lower(trim(name))='venituri'
)
update public.finance_categories category
set parent_id=null
from income_roots root
where category.parent_id=root.id;

delete from public.finance_categories category
where category.kind='income'
  and category.parent_id is null
  and lower(trim(category.name))='venituri'
  and not exists (select 1 from public.finance_categories child where child.parent_id=category.id)
  and not exists (select 1 from public.finance_transaction_splits split where split.category_id=category.id)
  and not exists (select 1 from public.finance_merchant_category_rules rule where rule.category_id=category.id);

with ranked as (
  select id,row_number() over (
    partition by household_id
    order by case when lower(trim(name))='necategorizat' then 0 else 1 end,sort_order,name,id
  )-1 as new_order
  from public.finance_categories
  where kind='income' and parent_id is null
)
update public.finance_categories category
set sort_order=ranked.new_order
from ranked
where category.id=ranked.id;

commit;
