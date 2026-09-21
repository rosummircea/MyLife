'use client'

import {Banknote,Landmark} from 'lucide-react'
import {categoryRoot} from '@/lib/category-display'
import {accountBank} from '@/lib/account-display'
import CategoryPicker from './CategoryPicker'
import {useState} from 'react'
import type {Account,MyLifeData,Transaction} from '@/lib/mylife-data'
import {getSupabaseClient} from '@/lib/supabase'
import {bucharestDay} from '@/lib/expense-report'
import {balanceDelta,initialAllocations,resizeAllocations,type TransactionEdit} from '@/lib/transaction-edit'

export type TransactionCreateMode = 'standard' | 'transfer' | 'adjustment'

type AccountPickerProps = {
  accounts: Account[]
  value: string
  label: string
  fallbackName?: string
  locked?: boolean
  onChange: (id: string) => void
}

function AccountPicker({accounts,value,label,fallbackName,locked=false,onChange}:AccountPickerProps){
  const selected = accounts.find(account => account.id === value)
  return <div className="transactionAccountPicker">
    <span className="transactionPickerLabel">{label}</span>
    <div className="transactionAccountOptions" role="group" aria-label={label}>
      {!selected && value ? <button type="button" className="selected" aria-pressed={true} disabled>
        <span className="transactionAccountIcon"><Landmark size={20}/></span>
        <span><strong>{fallbackName ?? 'Cont arhivat'}</strong></span>
      </button> : null}
      {accounts.map(account => {
        const bank = accountBank(account)
        const active = account.id === value
        return <button
          type="button"
          key={account.id}
          className={active ? 'selected' : ''}
          aria-pressed={active}
          disabled={locked && !active}
          onClick={() => { if (!locked) onChange(account.id) }}
        >
          <span className="transactionAccountIcon">
            {bank.icon ? <img src={bank.icon} alt="" width={28} height={28}/> : account.account_type === 'cash' ? <Banknote size={20}/> : <Landmark size={20}/>}
          </span>
          <span><strong>{account.name}</strong><small>{bank.name}</small></span>
        </button>
      })}
    </div>
  </div>
}

export default function TransactionEditor({
  transaction:tx,
  data,
  onCancel,
  onSaved,
  onSavingChange,
  creating=false,
  createMode='standard',
}:{
  transaction:Transaction
  creating?:boolean
  createMode?:TransactionCreateMode
  data:MyLifeData
  onCancel:()=>void
  onSaved:()=>void
  onSavingChange:(saving:boolean)=>void
}){
  const originalAllocations = initialAllocations(data.splits.filter(s => s.transaction_id === tx.id), Number(tx.amount))
  const [form,setForm] = useState<TransactionEdit>(() => ({
    affects_balance: creating ? true : tx.affects_balance !== false && tx.affects_balance !== 'false',
    transaction_type: tx.transaction_type,
    account_id: tx.account_id ?? '',
    transfer_account_id: tx.transfer_account_id ?? null,
    amount: Number(tx.amount),
    currency: tx.currency.trim(),
    day: bucharestDay(new Date(tx.transaction_date)),
    title: tx.title ?? (tx.transaction_type === 'transfer' ? '' : tx.merchant || tx.description || ''),
    merchant: tx.merchant ?? '',
    description: tx.description ?? '',
    splits: originalAllocations,
  }))
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [splitMode,setSplitMode] = useState(!creating && originalAllocations.length > 1)

  const patch = (value:Partial<TransactionEdit>) => setForm(old => ({...old,...value}))

  async function save(){
    if(saving) return
    setError('')
    const cents = Math.round(form.amount * 100)
    if(!Number.isFinite(cents) || cents < 0 || Math.abs(form.amount * 100 - cents) > .00001){
      setError('Suma trebuie să fie validă, cu cel mult două zecimale.')
      return
    }
    if(form.transaction_type === 'transfer' && (!form.transfer_account_id || form.transfer_account_id === form.account_id)){
      setError('Alege două conturi distincte.')
      return
    }
    if(form.splits.length && form.splits.reduce((sum,s) => sum + Math.round(Number(s.amount) * 100),0) !== cents){
      setError('Sumele pe categorii trebuie să fie egale cu suma tranzacției.')
      return
    }
    const client = getSupabaseClient()
    if(!client) return
    setSaving(true)
    onSavingChange(true)
    try{
      const payload = {
        ...(creating ? {p_household_id:data.profile.householdId} : {}),
        p_affects_balance: form.affects_balance !== false,
        p_title: form.title ?? '',
        p_id: tx.id,
        ...(!creating ? {p_expected_updated_at:tx.updated_at} : {}),
        p_type: form.transaction_type,
        p_account_id: form.account_id,
        p_transfer_account_id: form.transaction_type === 'transfer' ? form.transfer_account_id : null,
        p_amount: form.amount,
        p_currency: form.currency,
        p_day: form.day,
        p_merchant: form.merchant,
        p_description: form.description,
        p_splits: form.splits,
      }
      const {error:saveError} = await client.rpc(
        creating ? 'finance_create_transaction_with_balance' : 'finance_edit_transaction_with_balance',
        payload
      )
      if(saveError) throw Error(saveError.message)
      onSaved()
    }catch(saveError){
      setError(saveError instanceof Error ? saveError.message : 'Tranzacția nu a fost salvată.')
    }finally{
      setSaving(false)
      onSavingChange(false)
    }
  }

  const deltas = balanceDelta(creating ? {...tx,status:'void'} : tx, form)
  const categories = data.categories.filter(category =>
    category.kind === form.transaction_type &&
    (categoryRoot(category.id,data.categories)?.is_active || form.splits.some(split => categoryRoot(split.category_id,data.categories)?.id === categoryRoot(category.id,data.categories)?.id)) &&
    (category.is_active || form.splits.some(split => split.category_id === category.id || categoryRoot(split.category_id,data.categories)?.id === category.id))
  )
  const primary = form.splits[0]

  const changeAmount = (amount:number) => {
    patch({
      amount,
      splits: splitMode
        ? resizeAllocations(form.splits,amount)
        : form.splits.length
          ? [{...form.splits[0],amount}]
          : [],
    })
  }

  const setPrimaryCategory = (categoryId:string|null) => {
    if(categoryId === null && !splitMode){
      patch({splits:[]})
      return
    }
    if(primary){
      patch({splits:[{...primary,category_id:categoryId,amount:splitMode ? primary.amount : form.amount},...form.splits.slice(1)]})
    }else{
      patch({splits:[{category_id:categoryId,amount:form.amount}]})
    }
  }

  const toggleSplitMode = () => {
    if(splitMode){
      setSplitMode(false)
      patch({splits:form.splits.length ? [{...form.splits[0],amount:form.amount}] : []})
    }else{
      setSplitMode(true)
      if(!form.splits.length) patch({splits:[{category_id:null,amount:form.amount}]})
    }
  }

  const setStandardType = (type:'expense'|'income') => {
    setSplitMode(false)
    patch({transaction_type:type,transfer_account_id:null,splits:[]})
  }

  const destinationAccounts = data.accounts.filter(account => account.id !== form.account_id && account.currency.trim() === form.currency)
  const amountTone = form.transaction_type === 'expense' ? 'expense' : form.transaction_type === 'transfer' ? 'transfer' : 'income'

  return <form className="transactionEditForm transactionCreateRedesign" onSubmit={event => {event.preventDefault();void save()}}>
    <fieldset disabled={saving}>
      <legend>Datele tranzacției</legend>

      {creating && createMode === 'standard' ? <div className="transactionTypeToggle" role="group" aria-label="Tip tranzacție">
        <button type="button" className={form.transaction_type === 'expense' ? 'active expense' : ''} aria-pressed={form.transaction_type === 'expense'} onClick={() => setStandardType('expense')}>Cheltuială</button>
        <button type="button" className={form.transaction_type === 'income' ? 'active income' : ''} aria-pressed={form.transaction_type === 'income'} onClick={() => setStandardType('income')}>Venit</button>
      </div> : creating ? <div className="transactionFixedType">{createMode === 'transfer' ? 'Transfer între conturi' : 'Ajustare sold'}</div> : <label>Tip
        <select aria-label="Tip" value={form.transaction_type} onChange={event => {
          setSplitMode(false)
          patch({transaction_type:event.target.value,transfer_account_id:event.target.value === 'transfer' ? form.transfer_account_id : null,splits:[]})
        }}>
          <option value="expense">Cheltuială</option>
          <option value="income">Venit</option>
          <option value="transfer">Transfer</option>
          <option value="adjustment">Ajustare pozitivă</option>
        </select>
      </label>}

      <label className="transactionAmountField">Suma · {form.currency}
        <input className={'transactionAmountInput ' + amountTone} required type="number" inputMode="decimal" step="0.01" min="0" value={Number.isFinite(form.amount) ? form.amount : ''} onChange={event => changeAmount(event.target.valueAsNumber)}/>
      </label>

      <label className="transactionTitleField">Denumire / Titlu
        <input maxLength={1000} value={form.title ?? ''} onChange={event => patch({title:event.target.value})} placeholder={form.transaction_type === 'income' ? 'Ex. Salariu' : 'Ex. Cumpărături, prânz…'}/>
      </label>

      <div className="transactionAccountField">
        <AccountPicker
          accounts={data.accounts}
          value={form.account_id}
          fallbackName={tx.source_account?.name}
          locked={creating && createMode === 'adjustment'}
          label={form.transaction_type === 'transfer' ? 'Din cont' : 'Cont'}
          onChange={id => patch({
            account_id:id,
            currency:data.accounts.find(account => account.id === id)?.currency.trim() ?? form.currency,
            transfer_account_id:form.transfer_account_id === id ? null : form.transfer_account_id,
          })}
        />
      </div>

      {form.transaction_type === 'transfer' ? <div className="transactionAccountField">
        <AccountPicker
          accounts={destinationAccounts}
          value={form.transfer_account_id ?? ''}
          fallbackName={tx.destination_account?.name}
          label="În contul"
          onChange={id => patch({transfer_account_id:id})}
        />
      </div> : null}

      <label>Data<input required type="date" value={form.day} onChange={event => patch({day:event.target.value})}/></label>
      <label>Comerciant<input maxLength={1000} value={form.merchant} onChange={event => patch({merchant:event.target.value})}/></label>
      <label className="transactionDescriptionField">Descriere<textarea maxLength={4000} value={form.description} onChange={event => patch({description:event.target.value})}/></label>

      {form.transaction_type === 'expense' || form.transaction_type === 'income' ? <section className="transactionCategoriesSection">
        <div className="transactionCategoriesHeader">
          <h3>Categorie</h3>
          <label className="transactionSplitToggleLabel">
            <span>Defalcat</span>
            <button type="button" role="switch" aria-label="Defalcat" aria-checked={splitMode} className="transactionBalanceSwitch" onClick={toggleSplitMode}><span/></button>
          </label>
        </div>

        <div className="transactionPrimarySplit">
          <CategoryPicker label="Categorie" rows={categories} value={primary?.category_id ?? null} onChange={setPrimaryCategory}/>
          {splitMode && primary ? <label className="transactionSplitAmount">Sumă categorie
            <input required min="0" step="0.01" type="number" value={primary.amount} onChange={event => patch({splits:form.splits.map((split,index) => index === 0 ? {...split,amount:event.target.value} : split)})}/>
          </label> : null}
        </div>

        {splitMode ? form.splits.slice(1).map((split,offset) => {
          const index = offset + 1
          return <div className="transactionEditSplit" key={split.id ?? 'new-' + index}>
            <CategoryPicker label={'Categoria ' + (index + 1)} rows={categories} value={split.category_id} onChange={id => patch({splits:form.splits.map((item,itemIndex) => itemIndex === index ? {...item,category_id:id} : item)})}/>
            <label>Sumă categorie<input required min="0" step="0.01" type="number" value={split.amount} onChange={event => patch({splits:form.splits.map((item,itemIndex) => itemIndex === index ? {...item,amount:event.target.value} : item)})}/></label>
            <button type="button" onClick={() => patch({splits:form.splits.filter((_,itemIndex) => itemIndex !== index)})}>Elimină</button>
          </div>
        }) : null}

        {splitMode ? <button className="transactionAddSplitButton" type="button" onClick={() => patch({splits:[...form.splits,{category_id:null,amount:0}]})}>+ Adaugă încă o categorie</button> : null}
      </section> : null}

      <section>
        <div className="transactionBalanceToggleHeader">
          <h3>Efect asupra soldurilor</h3>
          <label className="transactionBalanceToggleLabel">Afectează soldul actual
            <button type="button" role="switch" aria-label="Afectează soldul actual" aria-checked={form.affects_balance !== false} className="transactionBalanceSwitch" onClick={() => patch({affects_balance:form.affects_balance === false})}><span/></button>
          </label>
        </div>
        <p className="transactionDetailsEmpty">{form.affects_balance === false ? 'OFF · Tranzacția apare în liste și rapoarte, fără efect propriu asupra soldului.' : 'ON · Tranzacția contribuie la soldul actual.'}</p>
        {!creating && Object.entries(deltas).length > 0 ? <p className="transactionDetailsEmpty">La salvare, modificarea față de tranzacția existentă va fi:</p> : null}
        {Object.entries(deltas).length ? Object.entries(deltas).map(([id,delta]) => <p key={id}>{data.accounts.find(account => account.id === id)?.name ?? 'Cont'}: <strong>{delta > 0 ? '+' : ''}{new Intl.NumberFormat('ro-RO',{style:'currency',currency:data.accounts.find(account => account.id === id)?.currency.trim() ?? tx.currency.trim()}).format(delta)}</strong></p>) : <p className="transactionDetailsEmpty">Soldurile nu se schimbă.</p>}
      </section>

      {error ? <p className="transactionEditError" role="alert">{error}</p> : null}

      <div className="transactionEditActions">
        <button type="submit">{saving ? 'Se salvează…' : creating ? createMode === 'transfer' ? 'Adaugă transferul' : createMode === 'adjustment' ? 'Salvează ajustarea' : 'Adaugă tranzacția' : 'Salvează modificările'}</button>
        <button type="button" onClick={onCancel}>Renunță</button>
      </div>
    </fieldset>
  </form>
}
