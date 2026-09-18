-- No baseline recapture or record migration: existing balances stay unchanged.
create or replace function public.finance_account_balance(p_account_id uuid) returns numeric language sql stable security invoker set search_path='' as $$
select a.opening_balance+coalesce(sum(case when t.import_metadata->'affects_balance'='false'::jsonb then 0 else
 case when t.status<>'posted' then 0 when t.account_id=a.id and t.transaction_type in ('expense','transfer') then -t.amount when t.account_id=a.id and t.transaction_type in ('income','adjustment') then t.amount when t.transfer_account_id=a.id and t.transaction_type='transfer' then t.amount else 0 end
 - case when t.import_metadata->'balance_baseline'->>'status'<>'posted' then 0 when t.import_metadata->'balance_baseline'->>'account_id'=a.id::text and t.import_metadata->'balance_baseline'->>'transaction_type' in ('expense','transfer') then -(t.import_metadata->'balance_baseline'->>'amount')::numeric when t.import_metadata->'balance_baseline'->>'account_id'=a.id::text and t.import_metadata->'balance_baseline'->>'transaction_type' in ('income','adjustment') then (t.import_metadata->'balance_baseline'->>'amount')::numeric when t.import_metadata->'balance_baseline'->>'transfer_account_id'=a.id::text and t.import_metadata->'balance_baseline'->>'transaction_type'='transfer' then (t.import_metadata->'balance_baseline'->>'amount')::numeric else 0 end
 end),0) from public.finance_accounts a left join public.finance_transactions t on t.household_id=a.household_id where a.id=p_account_id group by a.id,a.opening_balance;
$$;
revoke all on function public.finance_account_balance(uuid) from public,anon;
grant execute on function public.finance_account_balance(uuid) to authenticated;

create or replace function public.finance_create_transaction_with_balance(p_id uuid,p_household_id uuid,p_title text,p_type text,p_account_id uuid,p_transfer_account_id uuid,p_amount numeric,p_currency text,p_day date,p_merchant text,p_description text,p_splits jsonb,p_affects_balance boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; stamp timestamptz;
begin
 if p_affects_balance is null then raise exception 'Alege efectul asupra soldului.'; end if;
 result:=public.finance_create_transaction(p_id,p_household_id,p_title,p_type,p_account_id,p_transfer_account_id,p_amount,p_currency,p_day,p_merchant,p_description,p_splits);
 update public.finance_transactions set import_metadata=coalesce(import_metadata,'{}'::jsonb)||jsonb_build_object('affects_balance',p_affects_balance),updated_at=clock_timestamp() where id=p_id returning updated_at into stamp;
 if not found then raise exception 'Tranzacția nu a putut fi salvată.'; end if;
 return result||jsonb_build_object('updated_at',stamp);
end $$;
revoke all on function public.finance_create_transaction_with_balance(uuid,uuid,text,text,uuid,uuid,numeric,text,date,text,text,jsonb,boolean) from public,anon;
grant execute on function public.finance_create_transaction_with_balance(uuid,uuid,text,text,uuid,uuid,numeric,text,date,text,text,jsonb,boolean) to authenticated;

create or replace function public.finance_edit_transaction_with_balance(p_id uuid,p_expected_updated_at timestamptz,p_title text,p_type text,p_account_id uuid,p_transfer_account_id uuid,p_amount numeric,p_currency text,p_day date,p_merchant text,p_description text,p_splits jsonb,p_affects_balance boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; stamp timestamptz;
begin
 if p_affects_balance is null then raise exception 'Alege efectul asupra soldului.'; end if;
 result:=public.finance_edit_transaction_with_title(p_title,p_id,p_expected_updated_at,p_type,p_account_id,p_transfer_account_id,p_amount,p_currency,p_day,p_merchant,p_description,p_splits);
 update public.finance_transactions set import_metadata=coalesce(import_metadata,'{}'::jsonb)||jsonb_build_object('affects_balance',p_affects_balance),updated_at=clock_timestamp() where id=p_id returning updated_at into stamp;
 if not found then raise exception 'Tranzacția nu a putut fi salvată.'; end if;
 return result||jsonb_build_object('updated_at',stamp);
end $$;
revoke all on function public.finance_edit_transaction_with_balance(uuid,timestamptz,text,text,uuid,uuid,numeric,text,date,text,text,jsonb,boolean) from public,anon;
grant execute on function public.finance_edit_transaction_with_balance(uuid,timestamptz,text,text,uuid,uuid,numeric,text,date,text,text,jsonb,boolean) to authenticated;
