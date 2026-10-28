-- Monthly spending budgets for top-level expense categories.

create table if not exists public.finance_category_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.finance_categories(id) on delete cascade,
  month date not null,
  amount numeric(14,2) not null,
  currency char(3) not null default 'RON',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_category_budgets_month_start check (month = date_trunc('month',month)::date),
  constraint finance_category_budgets_unique unique (household_id,category_id,month,currency)
);

alter table public.finance_category_budgets
  drop constraint if exists finance_category_budgets_amount_check;
alter table public.finance_category_budgets
  drop constraint if exists finance_category_budgets_amount_nonnegative;
alter table public.finance_category_budgets
  add constraint finance_category_budgets_amount_nonnegative check (amount >= 0);

create index if not exists finance_category_budgets_household_month_idx
  on public.finance_category_budgets (household_id,month);

create index if not exists finance_category_budgets_category_idx
  on public.finance_category_budgets (category_id);

create or replace function public.finance_category_budget_guard()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if not exists (
    select 1
    from public.finance_categories category
    where category.id=new.category_id
      and category.household_id=new.household_id
      and category.parent_id is null
      and category.kind='expense'
      and category.is_active
      and lower(category.name) not in ('animale','necategorizat')
  ) then
    raise exception 'Bugetele pot fi stabilite doar pentru categorii principale active de cheltuieli din aceeași familie.';
  end if;
  new.month:=date_trunc('month',new.month)::date;
  new.updated_at:=now();
  return new;
end;
$$;

drop trigger if exists finance_category_budget_guard on public.finance_category_budgets;
create trigger finance_category_budget_guard
before insert or update on public.finance_category_budgets
for each row execute function public.finance_category_budget_guard();

alter table public.finance_category_budgets enable row level security;

drop policy if exists finance_category_budgets_select on public.finance_category_budgets;
create policy finance_category_budgets_select
on public.finance_category_budgets for select
to authenticated
using ((select mylife_auth.is_household_member(household_id)));

drop policy if exists finance_category_budgets_insert on public.finance_category_budgets;
create policy finance_category_budgets_insert
on public.finance_category_budgets for insert
to authenticated
with check ((select mylife_auth.can_manage_finance(household_id)));

drop policy if exists finance_category_budgets_update on public.finance_category_budgets;
create policy finance_category_budgets_update
on public.finance_category_budgets for update
to authenticated
using ((select mylife_auth.can_manage_finance(household_id)))
with check ((select mylife_auth.can_manage_finance(household_id)));

drop policy if exists finance_category_budgets_delete on public.finance_category_budgets;
create policy finance_category_budgets_delete
on public.finance_category_budgets for delete
to authenticated
using ((select mylife_auth.can_manage_finance(household_id)));

grant select,insert,update,delete on table public.finance_category_budgets to authenticated;
revoke all on table public.finance_category_budgets from anon;

-- Seed October 2026 from actual spending, rounded up with a small safety margin.
with root_spend as (
  select root.id as category_id,
         root.household_id,
         coalesce(sum(split.amount) filter (where transaction.id is not null),0)::numeric as spent
  from public.finance_categories root
  left join public.finance_categories used_category
    on used_category.id=root.id or used_category.parent_id=root.id
  left join public.finance_transaction_splits split on split.category_id=used_category.id
  left join public.finance_transactions transaction
    on transaction.id=split.transaction_id
   and transaction.transaction_type='expense'
   and transaction.currency='RON'
   and transaction.status='posted'
   and (transaction.transaction_date at time zone 'Europe/Bucharest')::date
       between date '2026-10-01' and date '2026-10-31'
  where root.parent_id is null
    and root.kind='expense'
    and root.is_active
    and root.household_id is not null
    and lower(root.name) not in ('animale','necategorizat')
  group by root.id,root.household_id
), suggested as (
  select category_id,household_id,
    case
      when spent<=0 then 500
      when spent<1000 then ceil(spent*1.15/100)*100
      when spent<5000 then ceil(spent*1.12/250)*250
      when spent<20000 then ceil(spent*1.10/500)*500
      else ceil(spent*1.08/1000)*1000
    end as amount
  from root_spend
)
insert into public.finance_category_budgets (household_id,category_id,month,amount,currency)
select household_id,category_id,date '2026-10-01',amount,'RON'
from suggested
on conflict (household_id,category_id,month,currency) do nothing;

delete from public.finance_category_budgets budget
using public.finance_categories category
where category.id=budget.category_id
  and lower(category.name) in ('animale','necategorizat');
