-- Search across all compatible transactions before applying the display cap,
-- so older imported repayments remain discoverable without scrolling.
drop function if exists public.finance_loan_repayment_candidates(uuid);

create function public.finance_loan_repayment_candidates(
  p_loan_id uuid,
  p_search text default null
)
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
  v_search text:=nullif(btrim(p_search),'');
  v_search_digits text:=regexp_replace(coalesce(p_search,''),'[^0-9]','','g');
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
    and (
      v_search is null
      or concat_ws(' ',t.import_metadata->>'title',t.merchant,t.description,a.name,t.import_metadata->>'imported_from',t.transaction_date::date::text) ilike '%'||v_search||'%'
      or (v_search_digits<>'' and regexp_replace(to_char(t.amount,'FM999999999999990.00'),'[^0-9]','','g') ilike '%'||v_search_digits||'%')
    )
  order by t.transaction_date desc,t.created_at desc,t.id
  limit 200;
end $$;

revoke all on function public.finance_loan_repayment_candidates(uuid,text) from public,anon;
grant execute on function public.finance_loan_repayment_candidates(uuid,text) to authenticated;
