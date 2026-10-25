begin;

-- Merge the duplicate third-level categories into their existing direct
-- children of Auto before removing the duplicates.
update public.finance_transaction_splits
set category_id='8d82bebf-0d37-4eef-827f-903811c5c515'
where category_id='cd26f08e-e4ed-496e-909c-7c14b6baeff8';
update public.finance_transaction_splits
set category_id='971d59f0-b01d-45c2-8780-3275b6f7c5be'
where category_id='35b6b753-a0a5-42c8-9cd7-8c3dc57e7317';
update public.finance_transaction_splits
set category_id='66ba5bc7-2dc1-46db-9e7c-84916f53c09a'
where category_id='f6c4c0bc-9b8d-42fc-a268-4a9085c62d67';

update public.finance_merchant_category_rules
set category_id='8d82bebf-0d37-4eef-827f-903811c5c515'
where category_id='cd26f08e-e4ed-496e-909c-7c14b6baeff8';
update public.finance_merchant_category_rules
set category_id='971d59f0-b01d-45c2-8780-3275b6f7c5be'
where category_id='35b6b753-a0a5-42c8-9cd7-8c3dc57e7317';
update public.finance_merchant_category_rules
set category_id='66ba5bc7-2dc1-46db-9e7c-84916f53c09a'
where category_id='f6c4c0bc-9b8d-42fc-a268-4a9085c62d67';

delete from public.finance_categories
where id in (
  'cd26f08e-e4ed-496e-909c-7c14b6baeff8',
  '35b6b753-a0a5-42c8-9cd7-8c3dc57e7317',
  'f6c4c0bc-9b8d-42fc-a268-4a9085c62d67'
);

-- Service and Spălătorie do not have direct duplicates, so keep them and
-- move them directly under Auto.
update public.finance_categories
set parent_id='98a46ef5-bb29-49d0-bf14-1991808f5744'
where id in (
  '6e84b1fe-780c-47e0-9049-ebce083ea8c7',
  'fca2578f-b80b-41c4-9aa7-f5cf65b2904c'
);

-- Enforce a maximum hierarchy depth of two: category and subcategory.
create or replace function public.finance_category_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(coalesce(new.household_id::text,'global'),0));
 if new.parent_id is not null then
  if not exists(select 1 from public.finance_categories p where p.id=new.parent_id and p.parent_id is null and p.household_id is not distinct from new.household_id and p.kind=new.kind) then raise exception 'Categoria părinte trebuie să fie o categorie principală cu același tip și aceeași familie.'; end if;
  if exists(select 1 from public.finance_categories where parent_id=new.id) then raise exception 'O categorie care are subcategorii nu poate deveni subcategorie.'; end if;
  if exists(with recursive ancestors as (select id,parent_id from public.finance_categories where id=new.parent_id union select c.id,c.parent_id from public.finance_categories c join ancestors a on c.id=a.parent_id) select 1 from ancestors where id=new.id) then raise exception 'O categorie nu poate fi mutată în propriile subcategorii.'; end if;
 end if;
 if exists(select 1 from public.finance_categories where parent_id=new.id and (kind<>new.kind or household_id is distinct from new.household_id)) then raise exception 'Tipul unei categorii cu subcategorii nu poate fi schimbat.'; end if;
 if TG_OP='UPDATE' and new.kind<>old.kind and exists(select 1 from public.finance_transaction_splits where category_id=new.id) then raise exception 'Tipul unei categorii folosite nu poate fi schimbat.'; end if;
 return new;
end $$;

commit;
