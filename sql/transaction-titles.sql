-- Explicit title stored in existing JSON metadata; no schema columns added.
-- Older clients keep using finance_edit_transaction unchanged.
create or replace function public.finance_edit_transaction_with_title(p_title text,p_id uuid,p_expected_updated_at timestamptz,p_type text,p_account_id uuid,p_transfer_account_id uuid,p_amount numeric,p_currency text,p_day date,p_merchant text,p_description text,p_splits jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if length(coalesce(p_title,''))>1000 then raise exception 'Titlul este prea lung.'; end if;
 result:=public.finance_edit_transaction(p_id,p_expected_updated_at,p_type,p_account_id,p_transfer_account_id,p_amount,p_currency,p_day,p_merchant,p_description,p_splits);
 update public.finance_transactions set import_metadata=case when nullif(btrim(p_title),'') is null then import_metadata-'title' else import_metadata||jsonb_build_object('title',btrim(p_title)) end where id=p_id;
 if not found then raise exception 'Titlul nu a putut fi salvat.'; end if;
 return result;
end $$;
revoke all on function public.finance_edit_transaction_with_title(text,uuid,timestamptz,text,uuid,uuid,numeric,text,date,text,text,jsonb) from public,anon;
grant execute on function public.finance_edit_transaction_with_title(text,uuid,timestamptz,text,uuid,uuid,numeric,text,date,text,text,jsonb) to authenticated;
