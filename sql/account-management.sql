-- Run once. Authenticated callers remain subject to household RLS.
create or replace function public.finance_manage_account(p_household_id uuid, p_id uuid, p_action text, p_values jsonb default '{}'::jsonb, p_expected_updated_at timestamptz default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare a public.finance_accounts%rowtype; result_id uuid; used boolean;
begin
 if not mylife_auth.can_manage_finance(p_household_id) then raise exception 'Nu ai permisiunea de a administra conturile.'; end if;
 if p_action in ('create','edit') then
  if length(trim(p_values->>'name'))>150 or p_values->>'opening_balance' is null or p_values->>'opening_balance' !~ '^-?[0-9]+([.][0-9]+)?$' then raise exception 'Nume sau sold invalid.'; end if;
  if p_values->>'credit_limit' is not null and p_values->>'credit_limit' !~ '^[0-9]+([.][0-9]+)?$' then raise exception 'Limită credit invalidă.'; end if;
 end if;
 if p_action='create' then
  if p_values->>'owner_person_id' is not null and not exists(select 1 from public.household_members where household_id=p_household_id and person_id=(p_values->>'owner_person_id')::uuid and status='active') then raise exception 'Proprietar invalid.'; end if;
  if coalesce(length(trim(p_values->>'name')),0)=0 then raise exception 'Completează numele contului.'; end if;
  if p_values->>'currency' !~ '^[A-Z]{3}$' then raise exception 'Monedă invalidă.'; end if;
  insert into public.finance_accounts(household_id,name,account_type,currency,institution,owner_person_id,opening_balance,credit_limit)
  values(p_household_id,trim(p_values->>'name'),p_values->>'account_type',p_values->>'currency',nullif(trim(p_values->>'institution'),''),(p_values->>'owner_person_id')::uuid,round((p_values->>'opening_balance')::numeric,2),(p_values->>'credit_limit')::numeric) returning id into result_id;
  return result_id;
 end if;
 select * into a from public.finance_accounts where id=p_id and household_id=p_household_id for update;
 if not found then raise exception 'Contul nu există.'; end if;
 if p_expected_updated_at is distinct from a.updated_at then raise exception 'Contul a fost modificat. Reîncarcă pagina.'; end if;
 select exists(select 1 from public.finance_transactions t where t.account_id=a.id or t.transfer_account_id=a.id or t.import_metadata->'balance_baseline'->>'account_id'=a.id::text or t.import_metadata->'balance_baseline'->>'transfer_account_id'=a.id::text) or exists(select 1 from public.finance_recurring_rules where account_id=a.id) or exists(select 1 from public.finance_balance_snapshots where account_id=a.id) into used;
 if p_action='delete' then
  if used then raise exception 'Contul are istoric financiar. Arhivează-l pentru a păstra datele.'; end if;
  delete from public.finance_accounts where id=a.id;
 elsif p_action in ('archive','restore') then update public.finance_accounts set is_active=p_action='restore',updated_at=clock_timestamp() where id=a.id;
 elsif p_action='edit' then
  if coalesce(length(trim(p_values->>'name')),0)=0 then raise exception 'Completează numele contului.'; end if;
  if p_values->>'currency' !~ '^[A-Z]{3}$' then raise exception 'Monedă invalidă.'; end if;
  if used and (p_values->>'currency'<>trim(a.currency) or p_values->>'account_type'<>a.account_type) then raise exception 'Moneda și tipul unui cont cu istoric nu pot fi schimbate.'; end if;
  if p_values->>'owner_person_id' is not null and not exists(select 1 from public.household_members where household_id=p_household_id and person_id=(p_values->>'owner_person_id')::uuid and status='active') then raise exception 'Proprietar invalid.'; end if;
  update public.finance_accounts set name=trim(p_values->>'name'),institution=nullif(trim(p_values->>'institution'),''),owner_person_id=(p_values->>'owner_person_id')::uuid,account_type=p_values->>'account_type',currency=p_values->>'currency',opening_balance=round((p_values->>'opening_balance')::numeric,2),credit_limit=(p_values->>'credit_limit')::numeric,updated_at=clock_timestamp() where id=a.id;
 else raise exception 'Operațiune invalidă.';
 end if;
 return a.id;
end $$;
revoke all on function public.finance_manage_account(uuid,uuid,text,jsonb,timestamptz) from public, anon;
grant execute on function public.finance_manage_account(uuid,uuid,text,jsonb,timestamptz) to authenticated;
-- Snapshot references must be readable for safe account deletion checks.
alter policy fbs_select on public.finance_balance_snapshots using (exists(select 1 from public.finance_accounts a where a.id=finance_balance_snapshots.account_id and mylife_auth.is_household_member(a.household_id)));
