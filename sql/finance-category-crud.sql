alter table public.finance_categories add column if not exists color text check(color ~ '^#[0-9a-fA-F]{6}$');
alter table public.finance_categories add column if not exists sort_order integer not null default 0;
-- Guard the hierarchy even for direct authenticated table writes.
create or replace function public.finance_category_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(coalesce(new.household_id::text,'global'),0));
 if new.parent_id is not null then
  if not exists(select 1 from public.finance_categories p where p.id=new.parent_id and p.household_id is not distinct from new.household_id and p.kind=new.kind) then raise exception 'Categoria părinte trebuie să aibă același tip și aceeași familie.'; end if;
  if exists(with recursive ancestors as (select id,parent_id from public.finance_categories where id=new.parent_id union select c.id,c.parent_id from public.finance_categories c join ancestors a on c.id=a.parent_id) select 1 from ancestors where id=new.id) then raise exception 'O categorie nu poate fi mutată în propriile subcategorii.'; end if;
 end if;
 if exists(select 1 from public.finance_categories where parent_id=new.id and (kind<>new.kind or household_id is distinct from new.household_id)) then raise exception 'Tipul unei categorii cu subcategorii nu poate fi schimbat.'; end if;
 if TG_OP='UPDATE' and new.kind<>old.kind and exists(select 1 from public.finance_transaction_splits where category_id=new.id) then raise exception 'Tipul unei categorii folosite nu poate fi schimbat.'; end if;
 return new;
end $$;
create trigger finance_category_guard before insert or update on public.finance_categories for each row execute function public.finance_category_guard();
create or replace function public.finance_category_delete_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(coalesce(old.household_id::text,'global'),0));
 if exists(select 1 from public.finance_categories where parent_id=old.id) or exists(select 1 from public.finance_transaction_splits where category_id=old.id) then raise exception 'Categoria are subcategorii sau tranzacții. Mută-le înainte de ștergere sau arhivează categoria.'; end if;
 return old;
end $$;
create trigger finance_category_delete_guard before delete on public.finance_categories for each row execute function public.finance_category_delete_guard();
create or replace function public.finance_reorder_categories(p_ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
declare h uuid; parent uuid; k text; n integer;
begin
 select household_id,parent_id,kind into h,parent,k from public.finance_categories where id=p_ids[1];
 if auth.uid() is null or h is null or not mylife_auth.can_manage_finance(h) then raise exception 'Nu ai permisiunea de a ordona aceste categorii.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(h::text,0));
 select count(*) into n from public.finance_categories where household_id=h and parent_id is not distinct from parent and kind=k;
 if n<>cardinality(p_ids) or n<>(select count(distinct id) from unnest(p_ids) id) or exists(select 1 from unnest(p_ids) ids(id) where not exists(select 1 from public.finance_categories c where c.id=ids.id and c.household_id=h and c.parent_id is not distinct from parent and c.kind=k)) then raise exception 'Lista s-a schimbat. Reîncarcă și încearcă din nou.'; end if;
 update public.finance_categories c set sort_order=ids.position from unnest(p_ids) with ordinality ids(id,position) where c.id=ids.id;
end $$;
revoke all on function public.finance_reorder_categories(uuid[]) from public,anon;
grant execute on function public.finance_reorder_categories(uuid[]) to authenticated;
create or replace function public.finance_create_transaction(p_id uuid,p_household_id uuid,p_title text,p_type text,p_account_id uuid,p_transfer_account_id uuid,p_amount numeric,p_currency text,p_day date,p_merchant text,p_description text,p_splits jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare stamp timestamptz; person uuid;
begin
 if auth.uid() is null or not mylife_auth.can_manage_finance(p_household_id) then raise exception 'Nu ai permisiunea de a adăuga tranzacții.'; end if;
 select id into person from public.people where auth_user_id=auth.uid() limit 1;
 insert into public.finance_transactions(id,household_id,account_id,transfer_account_id,created_by_person_id,transaction_type,amount,currency,transaction_date,status,source,date_precision)
 values(p_id,p_household_id,p_account_id,case when p_type='transfer' then p_transfer_account_id end,person,p_type,p_amount,p_currency,p_day::timestamp at time zone 'Europe/Bucharest','posted','manual','date') returning updated_at into stamp;
 return public.finance_edit_transaction_with_title(p_title,p_id,stamp,p_type,p_account_id,p_transfer_account_id,p_amount,p_currency,p_day,p_merchant,p_description,p_splits);
end $$;
create or replace function public.finance_delete_transaction(p_id uuid,p_expected_updated_at timestamptz) returns void language plpgsql security invoker set search_path='' as $$
declare t public.finance_transactions;
begin
 select * into t from public.finance_transactions where id=p_id for update;
 if not found or auth.uid() is null or not mylife_auth.can_manage_finance(t.household_id) then raise exception 'Tranzacția nu este disponibilă.'; end if;
 if t.status='void' then return; end if;
 if t.updated_at is distinct from p_expected_updated_at then raise exception 'Tranzacția a fost modificată. Reîncarcă înainte de ștergere.'; end if;
 -- Preserve historical baseline so deleting correctly refunds the current effect.
 update public.finance_transactions set status='void' where id=p_id;
end $$;
revoke all on function public.finance_create_transaction(uuid,uuid,text,text,uuid,uuid,numeric,text,date,text,text,jsonb) from public,anon;
grant execute on function public.finance_create_transaction(uuid,uuid,text,text,uuid,uuid,numeric,text,date,text,text,jsonb) to authenticated;
revoke all on function public.finance_delete_transaction(uuid,timestamptz) from public,anon;
grant execute on function public.finance_delete_transaction(uuid,timestamptz) to authenticated;
