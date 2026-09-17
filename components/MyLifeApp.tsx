'use client'

import ExpenseReport from '@/components/ExpenseReport'
import TransactionsCalendar from '@/components/TransactionsCalendar'
import { bucharestDay } from '@/lib/expense-report'

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
import DocumentsWorkspace from './DocumentsWorkspace'
import AutoModule from './AutoModule'
import AccountsWorkspace from './AccountsWorkspace'
import TransactionDetails from './TransactionDetails'
import { loadMyLifeData, type MyLifeData, type Account, type Transaction } from '@/lib/mylife-data'
import './MyLifeData.css'

type AreaKey = 'documents' | 'finance' | 'health' | 'auto' | 'homeLife' | 'travel' | 'family' | 'notes'

type LifeArea = {
  key: AreaKey
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  accent: string
  meta: string
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

export default function MyLifeApp({ developmentAccess = false, initialData = null }: { developmentAccess?: boolean; initialData?: MyLifeData | null }) {
  const openMyLifeChat = () => window.open('https://chatgpt.com/c/6aaa7be2-2820-83eb-a8c5-d90d5b9d9cc7', '_blank', 'noopener,noreferrer')
  const supabase = getSupabaseClient()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string>('home')
  const [documentTarget, setDocumentTarget] = useState<string | null>(null)
  const [transactionTarget, setTransactionTarget] = useState<Transaction | null>(null)
  const openDocument = (id: string) => { setDocumentTarget(id); setActive('documents') }
  const openTransaction = (transaction: Transaction) => { setTransactionTarget(transaction); setActive('finance') }
  const [authReady, setAuthReady] = useState(developmentAccess)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [data, setData] = useState<MyLifeData | null>(initialData)
  const [loadingData, setLoadingData] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [connecting, setConnecting] = useState(false)
  const displayName = data?.profile.displayName ?? 'Mircea'
  const householdId = data?.profile.householdId ?? null
  const accounts = data?.accounts ?? []
  const transactions = data?.transactions ?? []
  const documents = data?.documents ?? []
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setLoadError('Sesiunea nu a putut fi restaurată. Reconectează contul.')
      setUserEmail(data.session?.user.email ?? null)
      setAuthReady(true)
    }).catch(() => {
      setLoadError('Sesiunea nu a putut fi restaurată. Reconectează contul.')
      setAuthReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null)
      if (!session) {
        setData(developmentAccess ? initialData : null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [supabase, developmentAccess, initialData])

  useEffect(() => {
    if (!supabase || !userEmail) return
    let cancelled = false
    setLoadingData(true)
    setLoadError('')
    setData(null)
    loadMyLifeData(supabase).then((result) => {
      if (!cancelled) { setData(result); setConnecting(false) }
    }).catch((error: unknown) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Datele nu au putut fi încărcate.')
    }).finally(() => {
      if (!cancelled) setLoadingData(false)
    })
    return () => { cancelled = true }
  }, [supabase, userEmail, refresh])

  const visibleAreas = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ro')
    if (!q) return areas
    return areas.filter((area) => `${area.label} ${area.meta}`.toLocaleLowerCase('ro').includes(q))
  }, [query])

  const activeArea = areas.find((area) => area.key === active)
  const ActiveIcon = activeArea?.icon
  const totalAssets = accounts.filter((a) => a.currency.trim() === 'RON' && Number(a.opening_balance) > 0).reduce((sum, a) => sum + Number(a.opening_balance), 0)

  if (!authReady) return <div className="splash">Se încarcă MyLife…</div>

  if (!supabase && !developmentAccess) {
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

  if (!userEmail && (!developmentAccess || connecting)) return <LoginCard onError={setLoginError} error={loginError} onCancel={developmentAccess ? () => setConnecting(false) : undefined} />

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
          <button className="profileRow profileButton" onClick={() => { if (!developmentAccess) void supabase?.auth.signOut() }} title={developmentAccess ? 'Profil Mircea' : 'Deconectare'}>
            <div className="avatar">{displayName.slice(0, 2).toUpperCase()}</div>
            <div><strong>{displayName}</strong><span>{userEmail || 'Mircea · acces temporar'}</span></div>
            {!developmentAccess && <LogOut size={16}/>}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="mylifeDataStatus" role="status">
          <span>{loadingData ? 'Se încarcă datele reale…' : data?.source === 'live' ? 'Supabase · date actualizate' : data?.source === 'snapshot' ? `Date reale · instantaneu local din ${new Date(data.capturedAt).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })}` : 'Datele Supabase nu sunt conectate.'}</span>
          {userEmail ? <button type="button" disabled={loadingData} onClick={() => setRefresh((value) => value + 1)}>Actualizează</button> : supabase && <button type="button" onClick={() => setConnecting(true)}>Conectează live</button>}
        </div>
        {loadError && <div className="mylifeDataError" role="alert">{loadError}</div>}
        {active === 'home' ? (
          <>
            <div className="topbar">
              <div><p className="eyebrow">MYLIFE</p><h1>Bun venit, {displayName}</h1><p className="subtitle">Tot ce contează, într-un singur loc.</p></div>
              <button type="button" className="iconBtn" aria-label="Deschide Arhitectura MyLife MVP în ChatGPT" onClick={openMyLifeChat}><Sparkles size={19}/></button>
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
              <div className="statCard"><span>Solduri inițiale pozitive · RON</span><strong>{loadingData ? '…' : money(totalAssets)}</strong></div>
              <div className="statCard"><span>Documente</span><strong>{loadingData ? '…' : documents.length}</strong></div>
              <div className="statCard"><span>Household</span><strong>{householdId ? 'Conectat' : '—'}</strong></div>
            </section>
          </>
        ) : active === 'finance' ? (
          <FinanceModule key={transactionTarget?.id ?? 'finance'} target={transactionTarget} onOpenDocument={openDocument} data={data} loading={loadingData} accounts={accounts} transactions={transactions} onHome={() => setActive('home')} />
        ) : active === 'documents' ? (
          <section className="modulePage"><ModuleHeader title="Documente" onHome={() => setActive('home')}/><DocumentsWorkspace key={documentTarget ?? 'documents'} initialSelectedId={documentTarget} transactions={transactions} onOpenTransaction={openTransaction} documents={documents} loading={loadingData} onUpdated={document => setData(previous => previous ? { ...previous, documents: previous.documents.map(item => item.id === document.id ? document : item) } : previous)}/></section>
        ) : active === 'auto' ? (
          <AutoModule key={userEmail ?? 'anonymous'} connected={Boolean(userEmail)} refreshVersion={refresh} documents={documents} documentsLoading={loadingData} onHome={() => setActive('home')} onOpenDocument={openDocument}/>
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
        <button type="button" className="aiMobile" aria-label="Deschide Arhitectura MyLife MVP în ChatGPT" onClick={openMyLifeChat}><Sparkles size={21}/></button>
        <button className={active === 'notes' ? 'active' : ''} onClick={() => setActive('notes')}><NotebookPen size={20}/><span>Notițe</span></button>
        <button onClick={() => { if (!developmentAccess) void supabase?.auth.signOut() }}><Users size={20}/><span>Profil</span></button>
      </nav>
    </div>
  )
}

function LoginCard({ error, onError, onCancel }: { error: string; onError: (value: string) => void; onCancel?: () => void }) {
  const supabase = getSupabaseClient()!
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const login = async (event: FormEvent) => {
    event.preventDefault()
    onError('')
    setLoading(true)
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) onError('Autentificarea a eșuat. Verifică emailul și parola.')
    } catch {
      onError('Conectarea nu a reușit. Încearcă din nou.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="configScreen">
      <form className="loginCard" onSubmit={login}>
        <div className="brandMark large">M</div>
        <h1>MyLife</h1>
        <p>Conectează contul o singură dată. Sesiunea se păstrează la refresh.</p>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required/></label>
        <label>Parolă<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required/></label>
        {error && <div className="errorText">{error}</div>}
        {onCancel && <button type="button" className="mylifeLoginCancel" onClick={onCancel}>Înapoi în aplicație</button>}
        <button className="primaryButton" disabled={loading}><LogIn size={18}/>{loading ? 'Se conectează…' : 'Intră în MyLife'}</button>
      </form>
    </div>
  )
}

function ModuleHeader({ title, onHome }: { title: string; onHome: () => void }) {
  return <div className="topbar"><div><p className="eyebrow">MYLIFE</p><h1>{title}</h1><p className="subtitle">Date reale din MyLife.</p></div><button className="iconBtn" onClick={onHome}><Home size={19}/></button></div>
}

function FinanceModule({ data, loading, accounts, transactions, onHome, target, onOpenDocument }: { target: Transaction | null; onOpenDocument: (id: string) => void; data: MyLifeData | null; loading: boolean; accounts: Account[]; transactions: Transaction[]; onHome: () => void }) {
  const [detailId, setDetailId] = useState<string | null>(target?.id ?? null)
  const detail = transactions.find(item => item.id === detailId)
  const [tab, setTab] = useState<'overview' | 'accounts' | 'transactions' | 'reports'>(target ? 'transactions' : 'reports')
  const [selectedDay, setSelectedDay] = useState(() => bucharestDay(target ? new Date(target.transaction_date) : new Date()))
  useEffect(() => { if (target) document.getElementById(`transaction-${target.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [target])
  const dailyTransactions = useMemo(() => transactions.filter((tx) => bucharestDay(new Date(tx.transaction_date)) === selectedDay), [transactions, selectedDay])
  const selectedDayLabel = new Date(`${selectedDay}T12:00:00Z`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <section className="modulePage">
      <ModuleHeader title="Finanțe" onHome={onHome}/>
      <div className="subnav" aria-label="Submeniu Finanțe">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>Conturi</button>
        <button className={tab === 'transactions' ? 'active' : ''} onClick={() => setTab('transactions')}>Tranzacții</button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>Rapoarte</button>
      </div>

      {detail && <TransactionDetails transaction={detail} data={data} onClose={() => setDetailId(null)} onOpenDocument={onOpenDocument}/>}
      {tab === 'reports' ? <ExpenseReport data={data} loading={loading} /> : tab === 'accounts' ? (
        <AccountsWorkspace accounts={accounts} loading={loading}/>
      ) : tab === 'transactions' ? (
        <>
          <TransactionsCalendar transactions={transactions} selectedDay={selectedDay} onSelect={setSelectedDay}/>
          <div className="sectionTitle"><h2>{selectedDayLabel}</h2><span>{dailyTransactions.length} tranzacții</span></div>
          {loading ? <div className="emptyState" role="status">Se încarcă tranzacțiile…</div> : <TransactionsList transactions={dailyTransactions} onSelect={transaction => setDetailId(transaction.id)} focusedId={target?.id} emptyMessage="Nu există tranzacții în ziua selectată."/>}
        </>
      ) : (
        <><div className="sectionTitle"><h2>Overview</h2><span>rezumat financiar</span></div><div className="accountGrid">{accounts.slice(0,3).map((account) => <div className="accountCard" key={account.id}><span>{account.name}</span><strong>{money(account.opening_balance, account.currency.trim())}</strong><small>Sold inițial · {account.account_type.replace('_',' ')}</small></div>)}</div><div className="sectionTitle"><h2>Tranzacții recente</h2></div><TransactionsList transactions={transactions.slice(0, 8)} onSelect={transaction => setDetailId(transaction.id)}/></>
      )}
    </section>
  )
}

function TransactionsList({ transactions, emptyMessage = 'Nu există tranzacții disponibile.', onSelect, focusedId }: { transactions: Transaction[]; emptyMessage?: string; onSelect: (transaction: Transaction) => void; focusedId?: string }) {
  return <div className="listPanel transactionList">{transactions.length === 0 && <div className="emptyState">{emptyMessage}</div>}{transactions.map((tx) => {
    const Row = 'button'
    return <Row className={`listRow ${focusedId === tx.id ? 'transactionFocused' : ''}`} id={`transaction-${tx.id}`} key={tx.id} {...(Row === 'button' ? { type: 'button' as const, onClick: () => onSelect(tx) } : {})}><div><strong>{tx.merchant || tx.description || 'Tranzacție'}</strong><span>{new Date(tx.transaction_date).toLocaleDateString('ro-RO', { timeZone: 'Europe/Bucharest' })}{' · Vezi detaliile'}</span></div><strong className={tx.transaction_type === 'income' ? 'positive' : ''}>{tx.transaction_type === 'expense' ? '−' : tx.transaction_type === 'income' ? '+' : ''}{money(tx.amount, tx.currency.trim())}</strong></Row>
  })}</div>
}
