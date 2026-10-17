-- Merge the household's two RON cash accounts into Mircea's cash account.
-- Internal transfers between the two accounts cancel out and are removed.
do $$
declare
  v_keep_id uuid;
  v_remove_id uuid;
  v_remove_opening_balance numeric;
begin
  select a.id into strict v_keep_id
  from public.finance_accounts a
  join public.people p on p.id = a.owner_person_id
  where a.account_type = 'cash'
    and upper(trim(a.currency)) = 'RON'
    and a.is_active = true
    and p.display_name = 'Mircea';

  select a.id, a.opening_balance into strict v_remove_id, v_remove_opening_balance
  from public.finance_accounts a
  join public.people p on p.id = a.owner_person_id
  where a.account_type = 'cash'
    and upper(trim(a.currency)) = 'RON'
    and a.is_active = true
    and p.display_name = 'Andreea';

  if v_keep_id = v_remove_id then
    raise exception 'The cash accounts to merge must be different.';
  end if;

  delete from public.finance_transactions
  where transaction_type = 'transfer'
    and ((account_id = v_keep_id and transfer_account_id = v_remove_id)
      or (account_id = v_remove_id and transfer_account_id = v_keep_id));

  update public.finance_transactions set account_id = v_keep_id where account_id = v_remove_id;
  update public.finance_transactions set transfer_account_id = v_keep_id where transfer_account_id = v_remove_id;
  update public.finance_balance_snapshots set account_id = v_keep_id where account_id = v_remove_id;
  update public.finance_loan_repayments set account_id = v_keep_id where account_id = v_remove_id;
  update public.finance_recurring_rules set account_id = v_keep_id where account_id = v_remove_id;
  update public.enable_banking_accounts set finance_account_id = v_keep_id where finance_account_id = v_remove_id;
  update public.open_banking_accounts set finance_account_id = v_keep_id where finance_account_id = v_remove_id;
  update public.finance_bank_transfer_rules set source_finance_account_id = v_keep_id where source_finance_account_id = v_remove_id;
  update public.finance_bank_transfer_rules set destination_finance_account_id = v_keep_id where destination_finance_account_id = v_remove_id;

  update public.finance_accounts
  set opening_balance = opening_balance + coalesce(v_remove_opening_balance, 0),
      updated_at = now()
  where id = v_keep_id;

  delete from public.finance_accounts where id = v_remove_id;
end
$$;
