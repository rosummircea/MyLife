'use client'

import {
  Car,
  FileText,
  HeartPulse,
  Home,
  House,
  LogIn,
  LogOut,
  NotebookPen,
  Plane,
  Settings,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

type AreaKey = 'documents' | 'finance' | 'health' | 'auto' | 'homeLife' | 'travel' | 'family' | 'notes'

type LifeArea = {
  key: AreaKey
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  accent: string
  meta: string
}

type Account = {
  id: string
  name: string
  account_type: string
  opening_balance: number | string
  currency: string
  credit_limit: number | string | null
}

type Transaction = {
  id: string
  transaction_type: string
  amount: number | string
  currency: string
  transaction_date: string
  merchant: string | null
  description: string | null
}

type DocumentRow = {
  id: string
  document_type: string
  source_filename: string | null
  expires_at: string | null
  issuer: string | null
  storage_path: string | null
}

const areas: LifeArea[] = [
  { key: 'documents', label: 'Documente', icon: FileText, accent: 'blue', meta: 'Acte, polițe, contracte' },
  { key: 'finance', label: 'Finanțe', icon: WalletCards, accent: 'mint', meta: 'Conturi și tranzacții' },
  { key: 'health', label: 'Sănătate', icon: HeartPulse, accent: 'pink', meta: 'Analize și indicatori' },
  { key: 'auto', label: 'Auto', icon: Car, accent: 'blue', meta: 'Mașini și mentenanță' },
  { key: 'homeLife', label: 'Locuință', icon: House, accent: 'mint', meta: 'Casă, utilități, asigurări' },
  { key: 'travel', label: 'Călătorii', icon: Plane, accent: 'cyan', meta: 'Planuri și documente' },
  { key: 'family', label: 'Familie', icon: Users, accent: 'purple', meta: 'Profiluri și informații' },
  { key: 'notes', label: 'Notițe', icon: NotebookPen, accent: 'amber', meta: 'Idei și lucruri de ținut minte' },
]

const nav = [
  ['home', 'Acasă', Home],
  ['documents', 'Documente', FileText],
  ['finance', 'Finanțe', WalletCards],
  ['health', 'Sănătate', HeartPulse],
  ['auto', 'Auto', Car],
  ['homeLife', 'Locuință', House],
  ['travel', 'Călătorii', Plane],
  ['family', 'Familie', Users],
  ['notes', 'Notițe', NotebookPen],
] as const

function money(value: number | string, currency = 'RON') {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value))
}

export default function MyLifeApp() {
  const supabase = getSupabaseClient()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string>('home')
  const [authReady, setAuthReady] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('Mircea')
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null)
      setAuthReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null)
      if (!session) {
        setHouseholdId(null)
        setAccounts([])
        setTransactions([])
        setDocuments([])
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (!supabase || !userEmail) return

    const load = async () => {
      setLoadingData(true)
      const { data: authData } = await supabase.auth.getUser()
      const uid = authData.user?.id
      if (!uid) {
        setLoadingData(false)
        return
      }

      const { data: person } = await supabase
        .from('people')
        .select('id,display_name')
        .eq('auth_user_id', uid)
        .maybeSingle()

      if (!person) {
        setLoadingData(false)
        return
      }

      setDisplayName(person.display_name || 'Mircea')

      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('person_id', person.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      const hid = membership?.household_id ?? null
      setHouseholdId(hid)

      const promises = [
        hid
          ? supabase.from('finance_accounts').select('id,name,account_type,opening_balance,currency,credit_limit').eq('household_id', hid).eq('is_active', true).order('name')
          : Promise.resolve({ data: [] as Account[] }),
        hid
          ? supabase.from('finance_transactions').select('id,transaction_type,amount,currency,transaction_date,merchant,description').eq('household_id', hid).eq('status', 'posted').order('transaction_date', { ascending: false }).limit(8)
          : Promise.resolve({ data: [] as Transaction[] }),
        supabase.from('documents').select('id,document_type,source_filename,expires_at,issuer,storage_path').order('created_at', { ascending: false }).limit(20),
      ]

      const [accountsResult, transactionsResult, documentsResult] = await Promise.all(promises)
      setAccounts((accountsResult.data ?? []) as Account[])
      setTransactions((transactionsResult.data ?? []) as Transaction[])
      setDocuments((documentsResult.data ?? []) as DocumentRow[])
      setLoadingData(false)
    }

    load()
  }, [supabase, userEmail])

  const visibleAreas = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ro')
    if (!q) return areas
    return areas.filter((area) => `${area.label} ${area.meta}`.toLocaleLowerCase('ro').includes(q))
  }, [query])

  const activeArea = areas.find((area) => area.key === active)
  const ActiveIcon = activeArea?.icon
  const totalAssets = accounts.filter((a) => a.account_type !== 'credit_card').reduce((sum, a) => sum + Number(a.opening_balance), 0)

  if (!authReady) return <div className="splash">Se încarcă MyLife…</div>

  if (!supabase) {
    return (
      <div className="configScreen">
        <div className="loginCard">
          <div className="brandMark large">M</div>
          <h1>MyLife</h1>
          <p>Aplicația este construită. Mai trebuie configurate variabilele publice Supabase în mediul de deployment.</p>
          <code>NEXT_PUBLIC_SUPABASE_URL</code>
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
        </div>
      </div>
    )
  }

  if (!userEmail) {
    return <LoginCard onError={setLoginError} error={loginError} />
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">M</div>
          <div><strong>MyLife</strong><span>Viața ta. Organizată simplu.</span></div>
        </div>

        <nav className="nav">
          {nav.map(([key, label, Icon]) => (
            <button key={key} className={`navBtn ${active === key ? 'active' : ''}`} onClick={() => setActive(key)}>
              <Icon size={18} strokeWidth={2} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebarBottom">
          <button className="navBtn"><Settings size={18}/><span>Setări</span></button>
          <button className="profileRow profileButton" onClick={() => supabase.auth.signOut()} title="Deconectare">
            <div className="avatar">{displayName.slice(0, 2).toUpperCase()}</div>
            <div><strong>{displayName}</strong><span>{userEmail}</span></div>
            <LogOut size={16}/>
          </button>
        </div>
      </aside>

      <main className="main">
        {active === 'home' ? (
          <>
            <div className="topbar">
              <div><p className="eyebrow">MYLIFE</p><h1>Bun venit, {displayName}</h1><p className="subtitle">Tot ce contează, într-un singur loc.</p></div>
              <button className="iconBtn" aria-label="MyLife AI"><Sparkles size={19}/></button>
            </div>

            <label className="searchBar"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută în MyLife"/></label>

            <section className="lifeGrid" aria-label="Domenii MyLife">
              {visibleAreas.map((area) => {
                const Icon = area.icon
                return <button key={area.key} className="lifeCard" onClick={() => setActive(area.key)}><div className="cardTop"><div className={`domainIcon ${area.accent}`}><Icon size={21}/></div><span className="arrow">↗</span></div><strong>{area.label}</strong></button>
              })}
            </section>

            <section className="quickStats">
              <div className="statCard"><span>Conturi active</span><strong>{loadingData ? '…' : accounts.length}</strong></div>
              <div className="statCard"><span>Solduri pozitive</span><strong>{loadingData ? '…' : money(totalAssets)}</strong></div>
              <div className="statCard"><span>Documente</span><strong>{loadingData ? '…' : documents.length}</strong></div>
              <div className="statCard"><span>Household</span><strong>{householdId ? 'Conectat' : '—'}</strong></div>
            </section>
          </>
        ) : active === 'finance' ? (
          <FinanceModule accounts={accounts} transactions={transactions} />
        ) : active === 'documents' ? (
          <DocumentsModule documents={documents} />
        ) : (
          <section className="modulePage">
            <ModuleHeader title={activeArea?.label ?? 'MyLife'} onHome={() => setActive('home')} />
            <div className="placeholderPanel"><div className="placeholderIcon">{ActiveIcon ? <ActiveIcon size={28}/> : <Sparkles size={28}/>}</div><h2>{activeArea?.label ?? 'Modul MyLife'}</h2><p>Structura vizuală este gata. Acest modul va fi conectat progresiv la datele reale din Supabase.</p><div className="statusPill">Supabase-ready</div></div>
          </section>
        )}
      </main>

      <nav className="mobileNav" aria-label="Navigație mobilă">
        <button className={active === 'home' ? 'active' : ''} onClick={() => setActive('home')}><Home size={20}/><span>Acasă</span></button>
        <button className={active === 'documents' ? 'active' : ''} onClick={() => setActive('documents')}><FileText size={20}/><span>Documente</span></button>
        <button className="aiMobile"><Sparkles size={21}/></button>
        <button className={active === 'notes' ? 'active' : ''} onClick={() => setActive('notes')}><NotebookPen size={20}/><span>Notițe</span></button>
        <button onClick={() => supabase.auth.signOut()}><Users size={20}/><span>Profil</span></button>
      </nav>
    </div>
  )
}

function LoginCard({ error, onError }: { error: string; onError: (value: string) => void }) {
  const supabase = getSupabaseClient()!
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const login = async (event: FormEvent) => {
    event.preventDefault()
    onError('')
    setLoading(true)
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) onError('Autentificarea a eșuat. Verifică emailul și parola.')
    setLoading(false)
  }

  return (
    <div className="configScreen">
      <form className="loginCard" onSubmit={login}>
        <div className="brandMark large">M</div>
        <h1>MyLife</h1>
        <p>Intră în spațiul tău personal.</p>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required/></label>
        <label>Parolă<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required/></label>
        {error && <div className="errorText">{error}</div>}
        <button className="primaryButton" disabled={loading}><LogIn size={18}/>{loading ? 'Se conectează…' : 'Intră în MyLife'}</button>
      </form>
    </div>
  )
}

function ModuleHeader({ title, onHome }: { title: string; onHome: () => void }) {
  return <div className="topbar"><div><p className="eyebrow">MYLIFE</p><h1>{title}</h1><p className="subtitle">Date reale din MyLife.</p></div><button className="iconBtn" onClick={onHome}><Home size={19}/></button></div>
}

function FinanceModule({ accounts, transactions }: { accounts: Account[]; transactions: Transaction[] }) {
  return <section className="modulePage"><ModuleHeader title="Finanțe" onHome={() => location.reload()}/><div className="sectionTitle"><h2>Conturi</h2><span>{accounts.length} active</span></div><div className="accountGrid">{accounts.map((account) => <div className="accountCard" key={account.id}><span>{account.name}</span><strong>{money(account.opening_balance, account.currency.trim())}</strong><small>{account.account_type.replace('_',' ')}</small></div>)}</div><div className="sectionTitle"><h2>Tranzacții recente</h2></div><div className="listPanel">{transactions.map((tx) => <div className="listRow" key={tx.id}><div><strong>{tx.merchant || tx.description || 'Tranzacție'}</strong><span>{new Date(tx.transaction_date).toLocaleDateString('ro-RO')}</span></div><strong className={tx.transaction_type === 'income' ? 'positive' : ''}>{tx.transaction_type === 'expense' ? '−' : tx.transaction_type === 'income' ? '+' : ''}{money(tx.amount, tx.currency.trim())}</strong></div>)}</div></section>
}

function DocumentsModule({ documents }: { documents: DocumentRow[] }) {
  return <section className="modulePage"><ModuleHeader title="Documente" onHome={() => location.reload()}/><div className="sectionTitle"><h2>Documentele mele</h2><span>{documents.length} documente</span></div><div className="listPanel">{documents.length === 0 ? <div className="emptyState">Nu există documente vizibile pentru acest cont.</div> : documents.map((doc) => <div className="listRow" key={doc.id}><div><strong>{doc.source_filename || doc.document_type}</strong><span>{doc.issuer || doc.document_type}{doc.expires_at ? ` · expiră ${new Date(doc.expires_at).toLocaleDateString('ro-RO')}` : ''}</span></div><span className={`fileStatus ${doc.storage_path ? 'ok' : ''}`}>{doc.storage_path ? 'Fișier ✓' : 'Doar date'}</span></div>)}</div></section>
}
