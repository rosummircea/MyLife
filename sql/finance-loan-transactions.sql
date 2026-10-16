-- Every loan and repayment is backed by a balance-affecting finance transaction.
alter table public.finance_loans
  add column if not exists transaction_id uuid references public.finance_transactions(id) on delete set null;

create unique index if not exists finance_loans_transaction_uidx
  on public.finance_loans(transaction_id) where transaction_id is not null;

create table if not exists public.finance_loan_repayments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  loan_id uuid not null references public.finance_loans(id) on delete cascade,
  transaction_id uuid not null unique references public.finance_transactions(id) on delete restrict,
  account_id uuid not null references public.finance_accounts(id),
  created_by_user_id uuid not null default auth.uid() references auth.users(id),
  amount numeric(14,2) not null check (amount > 0),
  repayment_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists finance_loan_repayments_loan_date_idx
  on public.finance_loan_repayments(loan_id,repayment_date desc,id);

alter table public.finance_loan_repayments enable row level security;
revoke all on public.finance_loan_repayments from public,anon,authenticated;
grant select on public.finance_loan_repayments to authenticated;
drop policy if exists finance_loan_repayments_read on public.finance_loan_repayments;
create policy finance_loan_repayments_read on public.finance_loan_repayments
for select to authenticated using (mylife_auth.can_manage_finance(household_id));

create or replace function public.finance_create_loan_with_transaction(
  p_household_id uuid,
  p_direction text,
  p_counterparty text,
  p_amount numeric,
  p_currency text,
  p_day date,
  p_account_id uuid,
  p_purpose text,
  p_notes text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_person uuid;
  v_loan_id uuid:=gen_random_uuid();
  v_transaction_id uuid:=gen_random_uuid();
  v_type text;
  v_title text;
  v_category_id uuid;
  v_account public.finance_accounts;
  v_loan public.finance_loans;
begin
  if v_user is null or not mylife_auth.can_manage_finance(p_household_id) then
    raise exception 'Nu ai permisiunea de a adăuga împrumuturi.';
  end if;
  if p_direction not in ('given','received') then raise exception 'Selectează tipul împrumutului.'; end if;
  if length(btrim(coalesce(p_counterparty,''))) not between 1 and 200 then raise exception 'Completează numele persoanei.'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) then raise exception 'Suma trebuie să fie pozitivă, cu cel mult două zecimale.'; end if;
  if p_day is null then raise exception 'Completează data împrumutului.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text,0));
  select * into v_account from public.finance_accounts
    where id=p_account_id and household_id=p_household_id and is_active=true for share;
  if not found then raise exception 'Alege un cont activ.'; end if;
  if btrim(v_account.currency)<>upper(btrim(p_currency)) then raise exception 'Contul și împrumutul trebuie să aibă aceeași monedă.'; end if;
  select id into v_person from public.people where auth_user_id=v_user limit 1;
  if v_person is null then raise exception 'Profilul MyLife nu este disponibil.'; end if;

  v_type:=case when p_direction='received' then 'income' else 'expense' end;
  v_title:=case when p_direction='received' then 'Împrumut primit de la ' else 'Împrumut acordat către ' end||btrim(p_counterparty);
  select id into v_category_id from public.finance_categories
    where (household_id=p_household_id or household_id is null)
      and kind=v_type and is_active=true and lower(btrim(name))='necategorizat'
    order by (household_id=p_household_id) desc limit 1;

  insert into public.finance_transactions(
    id,household_id,account_id,transfer_account_id,created_by_person_id,
    transaction_type,amount,currency,transaction_date,merchant,description,
    status,source,date_precision,import_metadata
  ) values (
    v_transaction_id,p_household_id,p_account_id,null,v_person,
    v_type,p_amount,upper(btrim(p_currency)),p_day::timestamp at time zone 'Europe/Bucharest',
    btrim(p_counterparty),nullif(btrim(coalesce(p_purpose,'')),''),
    'posted','manual','date',jsonb_build_object(
      'title',v_title,'affects_balance',true,'loan_id',v_loan_id,
      'loan_kind','origination'
    )
  );
  if v_category_id is not null then
    insert into public.finance_transaction_splits(transaction_id,category_id,amount)
      values(v_transaction_id,v_category_id,p_amount);
  end if;

  insert into public.finance_loans(
    id,household_id,created_by_user_id,direction,counterparty,amount,currency,
    loan_date,purpose,notes,repaid_amount,transaction_id
  ) values (
    v_loan_id,p_household_id,v_user,p_direction,btrim(p_counterparty),p_amount,
    upper(btrim(p_currency)),p_day,nullif(btrim(coalesce(p_purpose,'')),''),
    nullif(btrim(coalesce(p_notes,'')),''),0,v_transaction_id
  ) returning * into v_loan;
  return to_jsonb(v_loan);
end $$;

revoke all on function public.finance_create_loan_with_transaction(uuid,text,text,numeric,text,date,uuid,text,text) from public,anon;
grant execute on function public.finance_create_loan_with_transaction(uuid,text,text,numeric,text,date,uuid,text,text) to authenticated;

create or replace function public.finance_repay_loan_with_transaction(
  p_loan_id uuid,
  p_amount numeric,
  p_day date,
  p_account_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_person uuid;
  v_loan public.finance_loans;
  v_account public.finance_accounts;
  v_repayment_id uuid:=gen_random_uuid();
  v_transaction_id uuid:=gen_random_uuid();
  v_type text;
  v_title text;
  v_category_id uuid;
begin
  select * into v_loan from public.finance_loans where id=p_loan_id for update;
  if not found or v_user is null or not mylife_auth.can_manage_finance(v_loan.household_id) then
    raise exception 'Împrumutul nu este disponibil.';
  end if;
  if p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2)
    or p_amount>v_loan.amount-v_loan.repaid_amount then
    raise exception 'Rambursarea trebuie să fie pozitivă și cel mult egală cu suma rămasă.';
  end if;
  if p_day is null then raise exception 'Completează data rambursării.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_loan.household_id::text,0));
  select * into v_account from public.finance_accounts
    where id=p_account_id and household_id=v_loan.household_id and is_active=true for share;
  if not found then raise exception 'Alege un cont activ.'; end if;
  if btrim(v_account.currency)<>btrim(v_loan.currency) then raise exception 'Contul și împrumutul trebuie să aibă aceeași monedă.'; end if;
  select id into v_person from public.people where auth_user_id=v_user limit 1;
  if v_person is null then raise exception 'Profilul MyLife nu este disponibil.'; end if;

  v_type:=case when v_loan.direction='received' then 'expense' else 'income' end;
  v_title:=case when v_loan.direction='received' then 'Rambursare împrumut către ' else 'Rambursare împrumut de la ' end||v_loan.counterparty;
  select id into v_category_id from public.finance_categories
    where (household_id=v_loan.household_id or household_id is null)
      and kind=v_type and is_active=true and lower(btrim(name))='necategorizat'
    order by (household_id=v_loan.household_id) desc limit 1;

  insert into public.finance_transactions(
    id,household_id,account_id,transfer_account_id,created_by_person_id,
    transaction_type,amount,currency,transaction_date,merchant,description,
    status,source,date_precision,import_metadata
  ) values (
    v_transaction_id,v_loan.household_id,p_account_id,null,v_person,
    v_type,p_amount,v_loan.currency,p_day::timestamp at time zone 'Europe/Bucharest',
    v_loan.counterparty,v_title,'posted','manual','date',jsonb_build_object(
      'title',v_title,'affects_balance',true,'loan_id',v_loan.id,
      'loan_repayment_id',v_repayment_id,'loan_kind','repayment'
    )
  );
  if v_category_id is not null then
    insert into public.finance_transaction_splits(transaction_id,category_id,amount)
      values(v_transaction_id,v_category_id,p_amount);
  end if;
  insert into public.finance_loan_repayments(
    id,household_id,loan_id,transaction_id,account_id,created_by_user_id,amount,repayment_date
  ) values (
    v_repayment_id,v_loan.household_id,v_loan.id,v_transaction_id,p_account_id,v_user,p_amount,p_day
  );
  update public.finance_loans set repaid_amount=repaid_amount+p_amount
    where id=v_loan.id returning * into v_loan;
  return to_jsonb(v_loan);
end $$;

revoke all on function public.finance_repay_loan_with_transaction(uuid,numeric,date,uuid) from public,anon;
grant execute on function public.finance_repay_loan_with_transaction(uuid,numeric,date,uuid) to authenticated;

-- Keep the accounting side immutable while still allowing title, description
-- and category edits on linked transactions.
create or replace function public.finance_guard_linked_loan_transaction() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if (exists(select 1 from public.finance_loans where transaction_id=old.id)
      or exists(select 1 from public.finance_loan_repayments where transaction_id=old.id))
    and (new.account_id is distinct from old.account_id
      or new.transaction_type is distinct from old.transaction_type
      or new.amount is distinct from old.amount
      or new.currency is distinct from old.currency
      or new.transaction_date is distinct from old.transaction_date
      or new.status is distinct from old.status) then
    raise exception 'Modifică suma, contul sau data din secțiunea Împrumuturi.';
  end if;
  return new;
end $$;

drop trigger if exists finance_guard_linked_loan_transaction on public.finance_transactions;
create trigger finance_guard_linked_loan_transaction
before update on public.finance_transactions for each row
execute function public.finance_guard_linked_loan_transaction();

-- Deleting a linked repayment from Transactions also reverses the repayment,
-- so a loan can never be left with a phantom repaid amount.
create or replace function public.finance_delete_transaction(p_id uuid,p_expected_updated_at timestamptz) returns void
language plpgsql security definer set search_path=''
as $$
declare
  t public.finance_transactions;
  r public.finance_loan_repayments;
  l public.finance_loans;
begin
  select * into t from public.finance_transactions where id=p_id for update;
  if not found or auth.uid() is null or not mylife_auth.can_manage_finance(t.household_id) then raise exception 'Tranzacția nu este disponibilă.'; end if;
  if t.status='void' then return; end if;
  if t.updated_at is distinct from p_expected_updated_at then raise exception 'Tranzacția a fost modificată. Reîncarcă înainte de ștergere.'; end if;

  select * into r from public.finance_loan_repayments where transaction_id=p_id for update;
  if found then
    update public.finance_loans set repaid_amount=greatest(0,repaid_amount-r.amount) where id=r.loan_id;
    delete from public.finance_loan_repayments where id=r.id;
  else
    select * into l from public.finance_loans where transaction_id=p_id for update;
    if found then
      if l.repaid_amount>0 then raise exception 'Împrumutul are rambursări. Șterge mai întâi tranzacțiile rambursărilor.'; end if;
      delete from public.finance_loans where id=l.id;
    end if;
  end if;
  update public.finance_transactions set status='void' where id=p_id;
end $$;

revoke all on function public.finance_delete_transaction(uuid,timestamptz) from public,anon;
grant execute on function public.finance_delete_transaction(uuid,timestamptz) to authenticated;

-- Link the already-recorded 2,500 RON repayment to its imported Revolut transaction.
insert into public.finance_loan_repayments(
  household_id,loan_id,transaction_id,account_id,created_by_user_id,amount,repayment_date
)
select l.household_id,l.id,t.id,t.account_id,l.created_by_user_id,2500,'2026-10-16'::date
from public.finance_loans l
join public.finance_transactions t on t.id='45059579-29c3-458e-a676-0079637b922a'
where l.id='bb3b3138-9bc3-4b67-97b0-be92a587320a'
  and l.repaid_amount>=2500
on conflict (transaction_id) do update set
  loan_id=excluded.loan_id,household_id=excluded.household_id,account_id=excluded.account_id,
  amount=excluded.amount,repayment_date=excluded.repayment_date;

update public.finance_transactions t
set import_metadata=coalesce(t.import_metadata,'{}'::jsonb)||jsonb_build_object(
  'title','Rambursare împrumut către Mădălina',
  'loan_id','bb3b3138-9bc3-4b67-97b0-be92a587320a',
  'loan_repayment_id',(select id from public.finance_loan_repayments where transaction_id=t.id),
  'loan_kind','repayment'
),updated_at=clock_timestamp()
where t.id='45059579-29c3-458e-a676-0079637b922a' and t.status='posted';
