-- A loan repayment links an existing posted transaction. It must never create
-- another accounting event because bank imports already changed the balance.

create or replace function public.finance_loan_repayment_candidates(p_loan_id uuid)
returns table (
  id uuid,
  account_id uuid,
  account_name text,
  amount numeric,
  currency text,
  transaction_date timestamptz,
  title text,
  description text,
  imported_from text
)
language plpgsql stable security definer set search_path=''
as $$
declare
  v_loan public.finance_loans;
  v_expected_type text;
begin
  select * into v_loan from public.finance_loans where finance_loans.id=p_loan_id;
  if not found or auth.uid() is null or not mylife_auth.can_manage_finance(v_loan.household_id) then
    raise exception 'Împrumutul nu este disponibil.';
  end if;

  v_expected_type:=case when v_loan.direction='received' then 'expense' else 'income' end;
  return query
  select
    t.id,
    t.account_id,
    a.name,
    t.amount,
    btrim(t.currency)::text,
    t.transaction_date,
    coalesce(nullif(btrim(t.import_metadata->>'title'),''),nullif(btrim(t.merchant),''),nullif(btrim(t.description),''),'Tranzacție')::text,
    t.description,
    nullif(btrim(t.import_metadata->>'imported_from'),'')::text
  from public.finance_transactions t
  join public.finance_accounts a on a.id=t.account_id and a.household_id=t.household_id
  where t.household_id=v_loan.household_id
    and t.status='posted'
    and t.transaction_type=v_expected_type
    and t.transfer_account_id is null
    and btrim(t.currency)=btrim(v_loan.currency)
    and t.amount>0
    and t.amount<=v_loan.amount-v_loan.repaid_amount
    and coalesce(t.import_metadata->>'affects_balance','true')<>'false'
    and coalesce(t.source,'')<>'forecast'
    and not exists(select 1 from public.finance_loan_repayments r where r.transaction_id=t.id)
    and not exists(select 1 from public.finance_loans l where l.transaction_id=t.id)
  order by t.transaction_date desc,t.created_at desc,t.id
  limit 200;
end $$;

revoke all on function public.finance_loan_repayment_candidates(uuid) from public,anon;
grant execute on function public.finance_loan_repayment_candidates(uuid) to authenticated;

create or replace function public.finance_link_loan_repayment(
  p_loan_id uuid,
  p_transaction_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid:=auth.uid();
  v_loan public.finance_loans;
  v_transaction public.finance_transactions;
  v_repayment_id uuid:=gen_random_uuid();
  v_expected_type text;
  v_repayment_day date;
begin
  select * into v_loan from public.finance_loans where id=p_loan_id for update;
  if not found or v_user is null or not mylife_auth.can_manage_finance(v_loan.household_id) then
    raise exception 'Împrumutul nu este disponibil.';
  end if;
  if v_loan.amount-v_loan.repaid_amount<=0 then
    raise exception 'Împrumutul este deja rambursat integral.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_loan.household_id::text,0));
  select * into v_transaction from public.finance_transactions
    where id=p_transaction_id and household_id=v_loan.household_id for update;
  if not found then raise exception 'Tranzacția nu este disponibilă.'; end if;

  v_expected_type:=case when v_loan.direction='received' then 'expense' else 'income' end;
  if v_transaction.status<>'posted'
    or v_transaction.transaction_type<>v_expected_type
    or v_transaction.transfer_account_id is not null
    or coalesce(v_transaction.source,'')='forecast'
    or coalesce(v_transaction.import_metadata->>'affects_balance','true')='false' then
    raise exception 'Alege o tranzacție finalizată de tipul corect.';
  end if;
  if btrim(v_transaction.currency)<>btrim(v_loan.currency) then
    raise exception 'Tranzacția și împrumutul trebuie să aibă aceeași monedă.';
  end if;
  if v_transaction.amount<=0 or v_transaction.amount>v_loan.amount-v_loan.repaid_amount then
    raise exception 'Suma tranzacției depășește suma rămasă a împrumutului.';
  end if;
  if exists(select 1 from public.finance_loan_repayments where transaction_id=v_transaction.id)
    or exists(select 1 from public.finance_loans where transaction_id=v_transaction.id) then
    raise exception 'Tranzacția este deja legată de un împrumut.';
  end if;

  v_repayment_day:=(v_transaction.transaction_date at time zone 'Europe/Bucharest')::date;
  insert into public.finance_loan_repayments(
    id,household_id,loan_id,transaction_id,account_id,created_by_user_id,amount,repayment_date
  ) values (
    v_repayment_id,v_loan.household_id,v_loan.id,v_transaction.id,v_transaction.account_id,
    v_user,v_transaction.amount,v_repayment_day
  );

  update public.finance_loans
  set repaid_amount=repaid_amount+v_transaction.amount
  where id=v_loan.id
  returning * into v_loan;

  update public.finance_transactions
  set import_metadata=coalesce(import_metadata,'{}'::jsonb)||jsonb_build_object(
        'loan_id',v_loan.id,
        'loan_repayment_id',v_repayment_id,
        'loan_kind','repayment'
      ),
      updated_at=clock_timestamp()
  where id=v_transaction.id;

  return to_jsonb(v_loan);
end $$;

revoke all on function public.finance_link_loan_repayment(uuid,uuid) from public,anon;
grant execute on function public.finance_link_loan_repayment(uuid,uuid) to authenticated;

-- The former RPC created a second transaction for every repayment. Keep the
-- function definition only for migration history, but make it unreachable to
-- app clients so an older cached UI cannot create duplicates.
revoke execute on function public.finance_repay_loan_with_transaction(uuid,numeric,date,uuid) from authenticated;
