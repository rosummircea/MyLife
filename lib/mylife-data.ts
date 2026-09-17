import type { SupabaseClient } from '@supabase/supabase-js'

export type Account = {
  id: string
  name: string
  account_type: string
  opening_balance: number | string
  currency: string
  credit_limit: number | string | null
}
export type Transaction = {
  id: string
  transaction_type: string
  amount: number | string
  currency: string
  transaction_date: string
  account_id?: string
  date_precision?: string
  attachment_document_id?: string | null
  status?: string
  merchant: string | null
  description: string | null
}
export type DocumentRow = {
  mime_type?: string | null
  issued_at?: string | null
  issuing_country?: string | null
  issuing_authority?: string | null
  document_date?: string | null
  notes?: string | null
  extra?: Record<string, unknown> | null
  id: string
  document_type: string
  source_filename: string | null
  expires_at: string | null
  issuer: string | null
  storage_path: string | null
}
export type CategoryRow = {
  id: string
  parent_id: string | null
  name: string
  kind: string
  is_active: boolean
}
export type SplitRow = {
  id: string
  transaction_id: string
  category_id: string | null
  amount: number | string
}
export type MyLifeData = {
  profile: { displayName: string; householdId: string }
  accounts: Account[]
  transactions: Transaction[]
  categories: CategoryRow[]
  splits: SplitRow[]
  documents: DocumentRow[]
  source: 'live' | 'snapshot'
  capturedAt: string
}

// PostgREST returns at most one page; keep loading instead of silently truncating reports.
async function allRows<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []) as T[])
    if (!data || data.length < pageSize) return rows
  }
}

export async function loadMyLifeData(client: SupabaseClient): Promise<MyLifeData> {
  const { data: auth, error: authError } = await client.auth.getUser()
  if (authError || !auth.user) throw new Error('Sesiunea Supabase nu este validă. Reconectează contul.')
  const { data: person, error: personError } = await client.from('people')
    .select('id,display_name').eq('auth_user_id', auth.user.id).maybeSingle()
  if (personError) throw new Error(`Profil: ${personError.message}`)
  if (!person) throw new Error('Contul autentificat nu are un profil MyLife asociat.')
  const { data: membership, error: membershipError } = await client.from('household_members')
    .select('household_id').eq('person_id', person.id).eq('status', 'active').order('joined_at').limit(1).maybeSingle()
  if (membershipError) throw new Error(`Familie: ${membershipError.message}`)
  if (!membership) throw new Error('Profilul nu are o familie activă asociată.')
  const hid: string = membership.household_id
  const [accounts, transactions, categories, splits, documents] = await Promise.all([
    allRows<Account>((from, to) => client.from('finance_accounts')
      .select('id,name,account_type,opening_balance,currency,credit_limit').eq('household_id', hid)
      .eq('is_active', true).order('name').order('id').range(from, to)),
    allRows<Transaction>((from, to) => client.from('finance_transactions')
      .select('id,transaction_type,amount,currency,transaction_date,merchant,description,status,attachment_document_id,account_id,date_precision').eq('household_id', hid)
      .eq('status', 'posted').order('transaction_date', { ascending: false }).order('id').range(from, to)),
    allRows<CategoryRow>((from, to) => client.from('finance_categories')
      .select('id,parent_id,name,kind,is_active').or(`household_id.eq.${hid},household_id.is.null`)
      .order('name').order('id').range(from, to)),
    allRows<SplitRow>((from, to) => client.from('finance_transaction_splits')
      .select('id,transaction_id,category_id,amount,finance_transactions!inner(household_id,status,transaction_type)')
      .eq('finance_transactions.household_id', hid).eq('finance_transactions.status', 'posted')
      .eq('finance_transactions.transaction_type', 'expense').order('id').range(from, to)),
    allRows<DocumentRow>((from, to) => client.from('documents')
      .select('id,document_type,source_filename,mime_type,storage_path,issued_at,expires_at,issuing_country,issuing_authority,document_date,issuer,notes,extra').eq('user_id', auth.user.id)
      .order('created_at', { ascending: false }).order('id').range(from, to)),
  ])
  return {
    profile: { displayName: person.display_name || 'Mircea', householdId: hid },
    accounts, transactions, categories, splits, documents, source: 'live', capturedAt: new Date().toISOString(),
  }
}
