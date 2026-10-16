-- Personal transfer signatures confirmed in MyLife on 2026-10-11.
insert into public.finance_bank_transfer_rules (
  household_id, source_bank_account_id, counterpart_bank_account_id,
  source_finance_account_id, destination_finance_account_id,
  source_match_text, counterpart_match_text, date_tolerance_days
) values
  ('837b4c72-4e95-482a-89b9-b4203fcd3fb6','2d5a9c57-843d-4e70-b09f-16cca1ae32b9','7fe64631-6518-4088-bd5a-69ae6161ad5d','760b7ac1-beed-4f12-8d24-c7b900e90f69','99089155-d148-4c6a-8ad9-8a6642737923','revolut**0376','top-up by *9180',1),
  ('837b4c72-4e95-482a-89b9-b4203fcd3fb6','b56f7d6e-6bdb-4200-97ec-737363eda335','7fe64631-6518-4088-bd5a-69ae6161ad5d','07347128-6355-4bf8-9fd5-7ffdf509cd89','99089155-d148-4c6a-8ad9-8a6642737923','mircea mihai rosu','andreea rosu',1),
  ('837b4c72-4e95-482a-89b9-b4203fcd3fb6','7fe64631-6518-4088-bd5a-69ae6161ad5d','b56f7d6e-6bdb-4200-97ec-737363eda335','99089155-d148-4c6a-8ad9-8a6642737923','07347128-6355-4bf8-9fd5-7ffdf509cd89','andreea rosu','mircea',1)
on conflict (household_id, source_bank_account_id, source_match_text) do update set
  counterpart_bank_account_id=excluded.counterpart_bank_account_id,
  source_finance_account_id=excluded.source_finance_account_id,
  destination_finance_account_id=excluded.destination_finance_account_id,
  counterpart_match_text=excluded.counterpart_match_text,
  date_tolerance_days=excluded.date_tolerance_days,
  updated_at=clock_timestamp();

-- George -> Revolut Mircea.
delete from public.finance_transaction_splits
where transaction_id='a37ae2b5-f155-4a2b-a166-ad4fb152ea2f';

update public.finance_transactions
set transaction_type='transfer',
    transfer_account_id='99089155-d148-4c6a-8ad9-8a6642737923',
    import_metadata=(coalesce(import_metadata,'{}'::jsonb)-'balance_baseline')||jsonb_build_object(
      'title','Transfer George → Revolut Mircea',
      'enable_banking_transaction_ids',jsonb_build_array('a37ae2b5-f155-4a2b-a166-ad4fb152ea2f','90cded79-524d-4deb-8c94-24df71217124'),
      'enable_banking_counterpart_transaction_id','90cded79-524d-4deb-8c94-24df71217124',
      'transfer_rule_id',(select id from public.finance_bank_transfer_rules where source_bank_account_id='2d5a9c57-843d-4e70-b09f-16cca1ae32b9' and source_match_text='revolut**0376'),
      'categorization_source','transfer_rule'
    ),
    updated_at=clock_timestamp()
where id='a37ae2b5-f155-4a2b-a166-ad4fb152ea2f' and status='posted';

-- Revolut Andreea -> Revolut Mircea. Keep the debit as the canonical transfer
-- and void the duplicate credit row while retaining both bank references.
delete from public.finance_transaction_splits
where transaction_id in ('ba357106-7ea5-471c-b47d-5fc117d7be24','cde6f183-7818-45d1-8d76-f03befbc3799');

update public.finance_transactions
set status='void',updated_at=clock_timestamp()
where id='cde6f183-7818-45d1-8d76-f03befbc3799' and status='posted';

update public.finance_transactions
set transaction_type='transfer',
    transfer_account_id='99089155-d148-4c6a-8ad9-8a6642737923',
    import_metadata=coalesce(import_metadata,'{}'::jsonb)||jsonb_build_object(
      'title','Transfer Revolut Andreea → Revolut Mircea',
      'enable_banking_transaction_ids',jsonb_build_array('ba357106-7ea5-471c-b47d-5fc117d7be24','cde6f183-7818-45d1-8d76-f03befbc3799'),
      'enable_banking_counterpart_transaction_id','cde6f183-7818-45d1-8d76-f03befbc3799',
      'transfer_rule_id',(select id from public.finance_bank_transfer_rules where source_bank_account_id='b56f7d6e-6bdb-4200-97ec-737363eda335' and source_match_text='mircea mihai rosu'),
      'categorization_source','transfer_rule'
    ),
    updated_at=clock_timestamp()
where id='ba357106-7ea5-471c-b47d-5fc117d7be24' and status='posted';

-- George -> Revolut Mircea top-up received before Enable Banking exposed a
-- matching George debit. The Revolut credit itself becomes the canonical
-- transfer so both MyLife account balances remain correct.
delete from public.finance_transaction_splits
where transaction_id='8026287a-32e0-4e79-ad63-3b4a0d3ecb5d';

update public.finance_transactions
set account_id='760b7ac1-beed-4f12-8d24-c7b900e90f69',
    transaction_type='transfer',
    transfer_account_id='99089155-d148-4c6a-8ad9-8a6642737923',
    import_metadata=coalesce(import_metadata,'{}'::jsonb)||jsonb_build_object(
      'title','Transfer George → Revolut Mircea',
      'enable_banking_transaction_ids',jsonb_build_array('8026287a-32e0-4e79-ad63-3b4a0d3ecb5d'),
      'enable_banking_counterpart_transaction_id','8026287a-32e0-4e79-ad63-3b4a0d3ecb5d',
      'transfer_rule_id',(select id from public.finance_bank_transfer_rules where source_bank_account_id='2d5a9c57-843d-4e70-b09f-16cca1ae32b9' and source_match_text='revolut**0376'),
      'categorization_source','transfer_rule'
    ),
    updated_at=clock_timestamp()
where id='8026287a-32e0-4e79-ad63-3b4a0d3ecb5d' and status='posted';
