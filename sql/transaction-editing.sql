-- Preserve today's authoritative saved balances as the baseline.
-- Existing transactions initially contribute zero; future transactions contribute normally.
update public.finance_transactions set import_metadata=coalesce(import_metadata,'{}'::jsonb)||jsonb_build_object('balance_baseline',jsonb_build_object('account_id',account_id,'transfer_account_id',transfer_account_id,'transaction_type',transaction_type,'amount',amount,'status',status)) where not (coalesce(import_metadata,'{}'::jsonb) ? 'balance_baseline');
create or replace function public.finance_account_balance(p_account_id uuid) returns numeric language sql stable security invoker set search_path='' as $$
select a.opening_balance+coalesce(sum(
 case when t.status<>'posted' then 0 when t.account_id=a.id and t.transaction_type in ('expense','transfer') then -t.amount when t.account_id=a.id and t.transaction_type in ('income','adjustment') then t.amount when t.transfer_account_id=a.id and t.transaction_type='transfer' then t.amount else 0 end
 - case when t.import_metadata->'balance_baseline'->>'status'<>'posted' then 0 when t.import_metadata->'balance_baseline'->>'account_id'=a.id::text and t.import_metadata->'balance_baseline'->>'transaction_type' in ('expense','transfer') then -(t.import_metadata->'balance_baseline'->>'amount')::numeric when t.import_metadata->'balance_baseline'->>'account_id'=a.id::text and t.import_metadata->'balance_baseline'->>'transaction_type' in ('income','adjustment') then (t.import_metadata->'balance_baseline'->>'amount')::numeric when t.import_metadata->'balance_baseline'->>'transfer_account_id'=a.id::text and t.import_metadata->'balance_baseline'->>'transaction_type'='transfer' then (t.import_metadata->'balance_baseline'->>'amount')::numeric else 0 end
 ),0) from public.finance_accounts a left join public.finance_transactions t on t.household_id=a.household_id where a.id=p_account_id group by a.id,a.opening_balance;
$$;
revoke all on function public.finance_account_balance(uuid) from public,anon;
grant execute on function public.finance_account_balance(uuid) to authenticated;
create or replace function public.finance_edit_transaction(p_id uuid,p_expected_updated_at timestamptz,p_type text,p_account_id uuid,p_transfer_account_id uuid,p_amount numeric,p_currency text,p_day date,p_merchant text,p_description text,p_splits jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare old public.finance_transactions%rowtype; updated public.finance_transactions%rowtype; split jsonb; cat uuid; part numeric; total numeric:=0;
begin
 if auth.uid() is null then raise exception 'Conectează contul.'; end if;
 select * into old from public.finance_transactions where id=p_id for update;
 if not found or not mylife_auth.can_manage_finance(old.household_id) then raise exception 'Tranzacția nu poate fi editată de acest utilizator.'; end if;
 if old.updated_at is distinct from p_expected_updated_at then raise exception 'Tranzacția s-a modificat între timp. Actualizează datele și reîncearcă.'; end if;
 if old.status<>'posted' then raise exception 'Doar tranzacțiile înregistrate pot fi editate.'; end if;
 if p_type not in ('expense','income','transfer','adjustment') or p_type is null or p_amount is null or p_amount<0 or p_amount<>round(p_amount,2) or p_amount::text in ('NaN','Infinity','-Infinity') or p_currency is null or p_day is null then raise exception 'Tipul, suma, moneda sau data nu sunt valide.'; end if;
 if not exists(select 1 from public.finance_accounts where id=p_account_id and household_id=old.household_id and (is_active or id=old.account_id) and btrim(currency)=p_currency) then raise exception 'Contul sursă sau moneda nu sunt valide.'; end if;
 if p_type='transfer' then
  if p_transfer_account_id is null or p_transfer_account_id=p_account_id or not exists(select 1 from public.finance_accounts where id=p_transfer_account_id and household_id=old.household_id and (is_active or id=old.transfer_account_id) and btrim(currency)=p_currency) then raise exception 'Alege două conturi distincte în aceeași monedă. Transferurile cu schimb valutar nu sunt încă suportate.'; end if;
 elsif p_transfer_account_id is not null then raise exception 'Doar transferurile au cont destinație.'; end if;
 if jsonb_typeof(p_splits) is distinct from 'array' then raise exception 'Repartizarea pe categorii nu este validă.'; end if;
 if p_type not in ('expense','income') and jsonb_array_length(p_splits)>0 then raise exception 'Transferurile și ajustările nu au categorii de venit/cheltuială.'; end if;
 if (select count(*) from jsonb_array_elements(p_splits) x where nullif(x->>'id','') is not null)<>(select count(distinct x->>'id') from jsonb_array_elements(p_splits) x where nullif(x->>'id','') is not null) then raise exception 'Repartizările nu pot fi duplicate.'; end if;
 for split in select value from jsonb_array_elements(p_splits) loop
  cat:=nullif(split->>'category_id','')::uuid; part:=(split->>'amount')::numeric;
  if part is null or part<0 or part<>round(part,2) or part::text in ('NaN','Infinity','-Infinity') then raise exception 'Sumele repartizate nu sunt valide.'; end if;
  if cat is not null and not exists(select 1 from public.finance_categories where id=cat and (household_id=old.household_id or household_id is null) and kind=p_type and (is_active or exists(select 1 from public.finance_transaction_splits s where s.transaction_id=p_id and s.id=nullif(split->>'id','')::uuid and s.category_id=cat))) then raise exception 'Categoria nu aparține familiei sau tipului tranzacției.'; end if;
  total:=total+part;
 end loop;
 if jsonb_array_length(p_splits)>0 and total<>p_amount then raise exception 'Repartizarea trebuie să însumeze exact suma tranzacției.'; end if;
 update public.finance_transactions set transaction_type=p_type,account_id=p_account_id,transfer_account_id=p_transfer_account_id,amount=p_amount,currency=p_currency,
 transaction_date=case when (old.transaction_date at time zone 'Europe/Bucharest')::date=p_day then old.transaction_date else (p_day+time '12:00') at time zone 'Europe/Bucharest' end,
 date_precision=case when (old.transaction_date at time zone 'Europe/Bucharest')::date=p_day then old.date_precision else 'date' end,
 merchant=nullif(btrim(p_merchant),''),description=nullif(btrim(p_description),''),updated_at=clock_timestamp() where id=p_id returning * into updated;
 if not found then raise exception 'Salvarea tranzacției a fost refuzată.'; end if;
 -- Preserve split metadata for retained splits. Remove only explicitly removed allocations.
 delete from public.finance_transaction_splits s where transaction_id=p_id and not exists(select 1 from jsonb_array_elements(p_splits) x where x->>'id'=s.id::text);
 for split in select value from jsonb_array_elements(p_splits) loop
  if nullif(split->>'id','') is not null then
   update public.finance_transaction_splits set category_id=nullif(split->>'category_id','')::uuid,amount=(split->>'amount')::numeric where transaction_id=p_id and id=(split->>'id')::uuid;
   if not found then raise exception 'Repartizarea s-a modificat între timp.'; end if;
  else insert into public.finance_transaction_splits(transaction_id,category_id,amount) values(p_id,nullif(split->>'category_id','')::uuid,(split->>'amount')::numeric); end if;
 end loop;
 return jsonb_build_object('id',updated.id,'updated_at',updated.updated_at);
end $$;
revoke all on function public.finance_edit_transaction(uuid,timestamptz,text,uuid,uuid,numeric,text,date,text,text,jsonb) from public,anon;
grant execute on function public.finance_edit_transaction(uuid,timestamptz,text,uuid,uuid,numeric,text,date,text,text,jsonb) to authenticated;
