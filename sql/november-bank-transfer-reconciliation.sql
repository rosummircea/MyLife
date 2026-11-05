-- Signatures confirmed on 2026-11-02.
-- They also let a later refresh reconcile bank legs that were imported first.
insert into public.finance_bank_transfer_rules (
  household_id, source_bank_account_id, counterpart_bank_account_id,
  source_finance_account_id, destination_finance_account_id,
  source_match_text, counterpart_match_text, date_tolerance_days
) values
  (
    '837b4c72-4e95-482a-89b9-b4203fcd3fb6',
    '9436236d-1c45-4057-8698-f73fa60e7c46',
    '45becbf8-da0c-4840-a012-4126776df5b9',
    'f2ae1804-9d40-4cef-8630-7595788978b8',
    'e1bd382d-f7bb-4a64-b54e-bcf823a353e7',
    'plata op intra - canal electronic;rulaj;andreea eliza rosu',
    'incasare op - canal electronic;rulaj;rosu mircea mihai',
    3
  ),
  (
    '837b4c72-4e95-482a-89b9-b4203fcd3fb6',
    '9436236d-1c45-4057-8698-f73fa60e7c46',
    '7fe64631-6518-4088-bd5a-69ae6161ad5d',
    'f2ae1804-9d40-4cef-8630-7595788978b8',
    '99089155-d148-4c6a-8ad9-8a6642737923',
    'revolut**',
    'top-up by *2075',
    3
  )
on conflict (household_id, source_bank_account_id, source_match_text) do update set
  counterpart_bank_account_id=excluded.counterpart_bank_account_id,
  source_finance_account_id=excluded.source_finance_account_id,
  destination_finance_account_id=excluded.destination_finance_account_id,
  counterpart_match_text=excluded.counterpart_match_text,
  date_tolerance_days=excluded.date_tolerance_days,
  updated_at=clock_timestamp();

-- Keep only the debit leg for BT Mircea -> Card cumpărături.
delete from public.finance_transaction_splits
where transaction_id in (
  '5cf8a29a-d7e2-41b1-af94-4e6565d28fb4',
  'd57dde42-d3bb-4990-a87e-a256cbe82206'
);

delete from public.finance_transactions
where id='d57dde42-d3bb-4990-a87e-a256cbe82206'
  and (import_metadata->>'auto_imported')::boolean is true;

update public.finance_transactions
set account_id='f2ae1804-9d40-4cef-8630-7595788978b8',
    transfer_account_id='e1bd382d-f7bb-4a64-b54e-bcf823a353e7',
    transaction_type='transfer',
    import_metadata=coalesce(import_metadata,'{}'::jsonb)||jsonb_build_object(
      'title',null,
      'enable_banking_transaction_ids',jsonb_build_array(
        '5cf8a29a-d7e2-41b1-af94-4e6565d28fb4',
        'd57dde42-d3bb-4990-a87e-a256cbe82206'
      ),
      'enable_banking_counterpart_transaction_id','d57dde42-d3bb-4990-a87e-a256cbe82206',
      'transfer_rule_id',(
        select id from public.finance_bank_transfer_rules
        where source_bank_account_id='9436236d-1c45-4057-8698-f73fa60e7c46'
          and source_match_text='plata op intra - canal electronic;rulaj;andreea eliza rosu'
      ),
      'categorization_source','transfer_rule'
    ),
    updated_at=clock_timestamp()
where id='5cf8a29a-d7e2-41b1-af94-4e6565d28fb4'
  and status='posted';

-- BT can book the card debit a few days after Revolut exposes the credit. Keep
-- the Revolut credit as the canonical row because it carries the operation date;
-- a later refresh links the delayed BT leg to the same transfer.
delete from public.finance_transaction_splits
where transaction_id='9c10229f-8b43-47c6-85f4-571e406404fc';

update public.finance_transactions
set account_id='f2ae1804-9d40-4cef-8630-7595788978b8',
    transfer_account_id='99089155-d148-4c6a-8ad9-8a6642737923',
    transaction_type='transfer',
    amount=1000,
    import_metadata=coalesce(import_metadata,'{}'::jsonb)||jsonb_build_object(
      'title',null,
      'enable_banking_transaction_ids',jsonb_build_array('9c10229f-8b43-47c6-85f4-571e406404fc'),
      'enable_banking_counterpart_transaction_id','9c10229f-8b43-47c6-85f4-571e406404fc',
      'transfer_rule_id',(
        select id from public.finance_bank_transfer_rules
        where source_bank_account_id='9436236d-1c45-4057-8698-f73fa60e7c46'
          and source_match_text='revolut**'
      ),
      'categorization_source','transfer_rule'
    ),
    updated_at=clock_timestamp()
where id='9c10229f-8b43-47c6-85f4-571e406404fc'
  and status='posted';
