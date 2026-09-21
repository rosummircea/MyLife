'use client'
import FinanceOverview from './FinanceOverview'
import CategoriesWorkspace from './CategoriesWorkspace'
import NewTransaction from './NewTransaction'

import ExpenseReport from '@/components/ExpenseReport'
import TransactionsCalendar from '@/components/TransactionsCalendar'
import { bucharestDay } from '@/lib/expense-report'

import {
  Car,
  FileText,
  HeartPulse,
  Home,
  ArrowLeft,
  House,
  LogIn,
  LogOut,
  NotebookPen,
  Plane,
  Settings,
  Sparkles,
  ArrowLeftRight,
  ChartPie,
  LayoutDashboard,
  ListTree,
  ReceiptText,
  HandCoins,
  Users,
  WalletCards,
} from 'lucide-react'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { getSupabaseClient } from '@/lib/supabase'
import DocumentsWorkspace from './DocumentsWorkspace'
import AutoModule from './AutoModule'
import AccountsWorkspace from './AccountsWorkspace'
import LoansWorkspace from './LoansWorkspace'
import TransactionDetails from './TransactionDetails'
import TransactionsList from './TransactionsList'
import DailyTransactionSummary from './DailyTransactionSummary'
import { loadMyLifeData, type MyLifeData, type Account, type Transaction } from '@/lib/mylife-data'
import './MyLifeData.css'

type AreaKey = 'documents' | 'finance' | 'health' | 'auto' | 'homeLife' | 'travel' | 'family' | 'notes'
type FinanceTab = 'overview' | 'accounts' | 'transactions' | 'reports' | 'transfers' | 'loans' | 'categories'

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

export default function MyLifeApp({ developmentAccess = false, initialData = null }: { developmentAccess?: boolean; initialData?: MyLifeData | null }) {
  const openMyLifeChat = () => window.open('https://chatgpt.com/c/6aaa7be2-2820-83eb-a8c5-d90d5b9d9cc7', '_blank', 'noopener,noreferrer')
  const supabase = getSupabaseClient()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string>('home')
  const swipePageRef = useRef<HTMLElement>(null)
  const swipeBackdropRef = useRef<HTMLDivElement>(null)
  const swipeDestinationRef = useRef<HTMLElement>(null)
  const mobileBackHandler = useRef<(() => boolean) | null>(null)
  const registerMobileBack = useCallback((handler: (() => boolean) | null) => { mobileBackHandler.current = handler }, [])
  const [financeTab, setFinanceTab] = useState<FinanceTab>('overview')
  const [financeNavVersion, setFinanceNavVersion] = useState(0)
  const navigateFinance = (tab: FinanceTab) => { setFinanceTab(tab); setFinanceNavVersion(value => value + 1) }
  const [documentTarget, setDocumentTarget] = useState<string | null>(null)
  const [transactionTarget, setTransactionTarget] = useState<Transaction | null>(null)
  const openDocument = (id: string) => { setDocumentTarget(id); setActive('documents') }
  const openTransaction = (transaction: Transaction) => { setTransactionTarget(transaction); setFinanceTab('transactions'); setActive('finance') }
  const [authReady, setAuthReady] = useState(developmentAccess)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [data, setData] = useState<MyLifeData | null>(initialData)
  const [loadingData, setLoadingData] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const sawPullLoading = useRef(false)
  const [connecting, setConnecting] = useState(false)
  const displayName = data?.profile.displayName ?? 'Mircea'
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

  useEffect(() => {
    if (!pullRefreshing) return
    if (loadingData) sawPullLoading.current = true
    else if (sawPullLoading.current) { sawPullLoading.current = false; setPullRefreshing(false) }
  }, [loadingData, pullRefreshing])

  useEffect(() => {
    let startY = 0, startX = 0, distance = 0, pulling = false
    const mobile = window.matchMedia('(max-width: 720px)')
    const start = (event: TouchEvent) => {
      const target = event.target as Element | null
      const nestedScroll = target?.closest('.expenseTrendScroll, .subnav, .documentsList, [role="dialog"], input, textarea, select')
      pulling = mobile.matches && Boolean(userEmail) && !loadingData && !pullRefreshing && window.scrollY <= 0 && !nestedScroll && event.touches.length === 1
      if (pulling) { startY = event.touches[0].clientY; startX = event.touches[0].clientX; distance = 0 }
    }
    const move = (event: TouchEvent) => {
      if (!pulling || event.touches.length !== 1) return
      const delta = event.touches[0].clientY - startY
      if (Math.abs(event.touches[0].clientX - startX) > Math.abs(delta) || delta < 8) return
      if (delta <= 0 || window.scrollY > 0) { distance = 0; setPullDistance(0); return }
      event.preventDefault()
      distance = Math.min(110, delta * 0.55)
      setPullDistance(distance)
    }
    const end = () => {
      if (pulling && distance >= 72) { sawPullLoading.current = false; setPullRefreshing(true); setRefresh(value => value + 1) }
      pulling = false; distance = 0; setPullDistance(0)
    }
    const cancel = () => { pulling = false; distance = 0; setPullDistance(0) }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', cancel)
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', cancel) }
  }, [userEmail, loadingData, pullRefreshing])

  useEffect(() => {
    if (active === 'home') return
    let startX = 0, startY = 0, tracking = false, horizontal = false, settling = false
    let page: HTMLElement | null = null
    let finishTimer: ReturnType<typeof setTimeout> | null = null
    const mobile = window.matchMedia('(max-width: 720px)')
    const reset = () => {
      if (finishTimer) clearTimeout(finishTimer)
      finishTimer = null
      if (page) {
        page.style.transition = 'none'
        page.style.transform = ''
        page.style.boxShadow = ''
        page.style.willChange = ''
      }
      swipeBackdropRef.current?.classList.remove('visible')
      swipeBackdropRef.current?.style.removeProperty('opacity')
      document.body.classList.remove('swipeBackInProgress')
      page = null
      tracking = false
      horizontal = false
      settling = false
    }
    const start = (event: TouchEvent) => {
      const touch = event.touches[0]
      tracking = !settling && mobile.matches && event.touches.length === 1 && touch.clientX <= 32
      horizontal = false
      if (!tracking) return
      const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
      const closeButton = dialog?.querySelector<HTMLButtonElement>('header button[aria-label^="Închide"]')
      if (closeButton?.disabled) { tracking = false; return }
      page = dialog ?? swipePageRef.current
      if (!page) { tracking = false; return }
      startX = touch.clientX
      startY = touch.clientY
      if (swipeDestinationRef.current) swipeDestinationRef.current.textContent = dialog ? 'Închide' : document.querySelector('.accountTransactions') ? 'Conturi' : document.querySelector('.autoVehicleDetail') ? 'Vehicule' : 'Acasă'
    }
    const move = (event: TouchEvent) => {
      if (!tracking || !page || event.touches.length !== 1) return
      const dx = event.touches[0].clientX - startX
      const dy = event.touches[0].clientY - startY
      if (!horizontal && Math.abs(dy) > Math.abs(dx)) { tracking = false; return }
      if (!horizontal && dx > 16 && dx > Math.abs(dy) * 1.5) {
        horizontal = true
        page.style.transition = 'none'
        page.style.willChange = 'transform'
        if (page === swipePageRef.current) {
          swipeBackdropRef.current?.classList.add('visible')
          document.body.classList.add('swipeBackInProgress')
        }
      }
      if (!horizontal) return
      event.preventDefault()
      const distance = Math.max(0, Math.min(window.innerWidth, dx))
      page.style.transform = `translate3d(${distance}px, 0, 0)`
      page.style.boxShadow = `-18px 0 42px rgba(0, 0, 0, ${Math.min(.32, distance / window.innerWidth * .32)})`
      if (swipeBackdropRef.current) swipeBackdropRef.current.style.opacity = String(Math.min(1, distance / 90))
    }
    const end = (event: TouchEvent) => {
      if (!tracking || !horizontal || !mobile.matches || !page) { reset(); return }
      const touch = event.changedTouches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      tracking = false
      settling = true
      const completed = dx >= 75 && Math.abs(dy) <= dx * 0.5
      const target = page
      const finish = () => {
        target.removeEventListener('transitionend', onTransitionEnd)
        if (completed) {
          flushSync(() => {
            if (target instanceof HTMLDialogElement) target.close()
            else if (!mobileBackHandler.current?.()) setActive('home')
          })
        }
        reset()
      }
      const onTransitionEnd = (transition: TransitionEvent) => {
        if (transition.target === target && transition.propertyName === 'transform') finish()
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return }
      target.addEventListener('transitionend', onTransitionEnd)
      target.style.transition = `transform ${completed ? 220 : 180}ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms ease`
      target.style.transform = completed ? `translate3d(${window.innerWidth}px, 0, 0)` : 'translate3d(0, 0, 0)'
      finishTimer = setTimeout(finish, 300)
    }
    const cancel = () => {
      if (!horizontal || !page) { reset(); return }
      page.style.transition = 'transform 180ms cubic-bezier(.2,.8,.2,1)'
      page.style.transform = 'translate3d(0, 0, 0)'
      finishTimer = setTimeout(reset, 200)
      tracking = false
      settling = true
    }
    window.addEventListener('touchstart', start, { passive: true })
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', end)
    window.addEventListener('touchcancel', cancel)
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', cancel); reset() }
  }, [active])

  const visibleAreas = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ro')
    if (!q) return areas
    return areas.filter((area) => `${area.label} ${area.meta}`.toLocaleLowerCase('ro').includes(q))
  }, [query])

  const activeArea = areas.find((area) => area.key === active)
  const ActiveIcon = activeArea?.icon

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

      <div className="swipeBackBackdrop" aria-hidden="true" ref={swipeBackdropRef}><span className="swipeBackHint"><ArrowLeft size={22}/><strong ref={swipeDestinationRef}>Acasă</strong></span></div>
      <main className="main" ref={swipePageRef}>
        <div className={`pullRefreshIndicator ${pullDistance || pullRefreshing ? 'visible' : ''} ${pullRefreshing ? 'refreshing' : ''}`} style={{ transform: `translate(-50%, ${pullRefreshing ? 0 : Math.min(pullDistance, 60) - 60}px)` }} role="status" aria-live="polite"><span className="pullRefreshSpinner" aria-hidden="true"/><span>{pullRefreshing ? 'Se actualizează…' : pullDistance >= 72 ? 'Eliberează pentru actualizare' : 'Trage pentru actualizare'}</span></div>
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
          </>
        ) : active === 'finance' ? (
          <FinanceModule tab={financeTab} setTab={setFinanceTab} mobileNavVersion={financeNavVersion} registerMobileBack={registerMobileBack} onCategoriesChange={categories=>setData(previous=>previous?{...previous,categories}:previous)} onSaved={()=>setRefresh(v=>v+1)} key={transactionTarget?.id ?? 'finance'} target={transactionTarget} onOpenDocument={openDocument} data={data} loading={loadingData} accounts={accounts} transactions={transactions} onHome={() => setActive('home')} />
        ) : active === 'documents' ? (
          <section className="modulePage"><ModuleHeader title="Documente" onHome={() => setActive('home')}/><DocumentsWorkspace key={documentTarget ?? 'documents'} initialSelectedId={documentTarget} transactions={transactions} onOpenTransaction={openTransaction} documents={documents} loading={loadingData} onUpdated={document => setData(previous => previous ? { ...previous, documents: previous.documents.map(item => item.id === document.id ? document : item) } : previous)}/></section>
        ) : active === 'auto' ? (
          <AutoModule key={userEmail ?? 'anonymous'} connected={Boolean(userEmail)} refreshVersion={refresh} documents={documents} documentsLoading={loadingData} registerMobileBack={registerMobileBack} onHome={() => setActive('home')} onOpenDocument={openDocument}/>
        ) : (
          <section className="modulePage">
            <ModuleHeader title={activeArea?.label ?? 'MyLife'} onHome={() => setActive('home')} />
            <div className="placeholderPanel"><div className="placeholderIcon">{ActiveIcon ? <ActiveIcon size={28}/> : <Sparkles size={28}/>}</div><h2>{activeArea?.label ?? 'Modul MyLife'}</h2><p>Structura vizuală este gata. Acest modul va fi conectat progresiv la datele reale din Supabase.</p><div className="statusPill">Supabase-ready</div></div>
          </section>
        )}
      </main>

      <nav className="mobileNav" aria-label="Navigație mobilă">
        {active === 'finance' ? <>
          <button className={financeTab === 'overview' ? 'active' : ''} onClick={() => navigateFinance('overview')}><LayoutDashboard size={20}/><span>Overview</span></button>
          <button className={financeTab === 'transactions' ? 'active' : ''} onClick={() => navigateFinance('transactions')}><ReceiptText size={20}/><span>Tranzacții</span></button>
          <button type="button" className="aiMobile" aria-label="Deschide Arhitectura MyLife MVP în ChatGPT" onClick={openMyLifeChat}><Sparkles size={21}/></button>
          <button className={financeTab === 'accounts' ? 'active' : ''} onClick={() => navigateFinance('accounts')}><WalletCards size={20}/><span>Conturi</span></button>
          <button className={financeTab === 'reports' ? 'active' : ''} onClick={() => navigateFinance('reports')}><ChartPie size={20}/><span>Rapoarte</span></button>
        </> : <>
          <button className={active === 'home' ? 'active' : ''} onClick={() => setActive('home')}><Home size={20}/><span>Acasă</span></button>
          <button className={active === 'documents' ? 'active' : ''} onClick={() => setActive('documents')}><FileText size={20}/><span>Documente</span></button>
          <button type="button" className="aiMobile" aria-label="Deschide Arhitectura MyLife MVP în ChatGPT" onClick={openMyLifeChat}><Sparkles size={21}/></button>
          <button className={active === 'notes' ? 'active' : ''} onClick={() => setActive('notes')}><NotebookPen size={20}/><span>Notițe</span></button>
          <button onClick={() => { if (!developmentAccess) void supabase?.auth.signOut() }}><Users size={20}/><span>Profil</span></button>
        </>}
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

function ModuleHeader({ title, onHome, actions }: { title: string; onHome: () => void; actions?: React.ReactNode }) {
  return <div className="topbar"><div><p className="eyebrow">MYLIFE</p><h1>{title}</h1></div><div className="moduleHeaderActions"><button type="button" className="iconBtn moduleHomeButton" onClick={onHome} aria-label="Înapoi acasă"><Home size={19}/></button>{actions}</div></div>
}

function FinanceModule({ data, loading, accounts, transactions, onHome, target, onOpenDocument, onSaved, onCategoriesChange, tab, setTab, mobileNavVersion, registerMobileBack }: { onCategoriesChange:(categories:MyLifeData['categories'])=>void; onSaved:()=>void; target: Transaction | null; onOpenDocument: (id: string) => void; data: MyLifeData | null; loading: boolean; accounts: Account[]; transactions: Transaction[]; onHome: () => void; tab: FinanceTab; setTab: React.Dispatch<React.SetStateAction<FinanceTab>>; mobileNavVersion: number; registerMobileBack: (handler: (() => boolean) | null) => void }) {
  const [categoryKind,setCategoryKind]=useState('expense')
  const [creating,setCreating]=useState<{mode:'standard'|'transfer'|'adjustment';accountId?:string}|null>(null)
  const [detailId, setDetailId] = useState<string | null>(target?.id ?? null)
  const detail = transactions.find(item => item.id === detailId)
  const [accountRecord,setAccountRecord]=useState<Account|null>(null)
  const selectedAccount=accounts.find(account=>account.id===accountRecord?.id)??accountRecord??undefined
  const openAccount=(account:Account)=>{setAccountRecord(account);setTab('accounts')}
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!mobileMenuOpen) return
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && !mobileMenuRef.current?.contains(target)) setMobileMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [mobileMenuOpen])
  useEffect(() => {
    registerMobileBack(() => {
      if (mobileMenuOpen) { setMobileMenuOpen(false); return true }
      if (tab === 'accounts' && accountRecord) { setAccountRecord(null); return true }
      return false
    })
    return () => registerMobileBack(null)
  }, [accountRecord, mobileMenuOpen, registerMobileBack, tab])
  useEffect(() => { setAccountRecord(null); setMobileMenuOpen(false) }, [mobileNavVersion])
  const [selectedDay, setSelectedDay] = useState<string | null>(() => bucharestDay(target ? new Date(target.transaction_date) : new Date()))
  const [calendarMonth, setCalendarMonth] = useState(() => bucharestDay(target ? new Date(target.transaction_date) : new Date()).slice(0,7))
  const monthlyTransactions = useMemo(() => transactions.filter(tx => bucharestDay(new Date(tx.transaction_date)).startsWith(calendarMonth)), [transactions, calendarMonth])
  const monthLabel = new Date(`${calendarMonth}-01T12:00:00Z`).toLocaleDateString('ro-RO', {month:'long',year:'numeric',timeZone:'UTC'})
  useEffect(() => { if (target) document.getElementById(`transaction-${target.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [target])
  const dailyTransactions = useMemo(() => transactions.filter((tx) => bucharestDay(new Date(tx.transaction_date)) === selectedDay), [transactions, selectedDay])
  const selectedDayLabel = new Date(`${selectedDay}T12:00:00Z`).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const addTransactionAction = <div className="financeCreateAction"><button aria-label="Adaugă tranzacție" disabled={data?.source!=='live'} onClick={()=>setCreating({mode:'standard'})}><span aria-hidden="true">+ </span><span className="transactionAddLabelDesktop">Adaugă tranzacție</span><span className="transactionAddLabelMobile">Adaugă</span></button></div>

  return (
    <section className="modulePage financeModule">
      <ModuleHeader title="Finanțe" onHome={onHome} actions={<div ref={mobileMenuRef} className="financeMobileMenu" onKeyDown={event=>{if(event.key==='Escape')setMobileMenuOpen(false)}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setMobileMenuOpen(false)}}><button type="button" className={`iconBtn ${['transfers','loans','categories'].includes(tab)?'active':''}`} aria-label="Mai multe pagini Finanțe" aria-expanded={mobileMenuOpen} aria-controls={mobileMenuOpen?'finance-more-pages':undefined} onClick={()=>setMobileMenuOpen(value=>!value)}><Settings size={19}/></button>{mobileMenuOpen&&<div id="finance-more-pages" className="financeMobileMenuList" aria-label="Alte pagini Finanțe"><button type="button" className={tab==='transfers'?'active':''} onClick={()=>{setTab('transfers');setMobileMenuOpen(false)}}><ArrowLeftRight size={18}/> Transferuri</button><button type="button" className={tab==='loans'?'active':''} onClick={()=>{setTab('loans');setMobileMenuOpen(false)}}><HandCoins size={18}/> Împrumuturi</button><button type="button" className={tab==='categories'?'active':''} onClick={()=>{setTab('categories');setMobileMenuOpen(false)}}><ListTree size={18}/> Categorii</button></div>}</div>}/>
      <div className="subnav" aria-label="Submeniu Finanțe">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>Conturi</button>
        <button className={tab === 'transactions' ? 'active' : ''} onClick={() => setTab('transactions')}>Tranzacții</button>
        <button className={tab === 'transfers' ? 'active' : ''} onClick={() => setTab('transfers')}>Transferuri</button>
        <button className={tab === 'loans' ? 'active' : ''} onClick={() => setTab('loans')}>Împrumuturi</button>
        <button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>Categorii</button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>Rapoarte</button>
      </div>

      {creating&&data&&<NewTransaction data={data} mode={creating.mode} accountId={creating.accountId} onClose={()=>setCreating(null)} onSaved={()=>{setCreating(null);onSaved()}}/>}
      {detail && <TransactionDetails onSaved={onSaved} transaction={detail} data={data} onClose={() => setDetailId(null)} onOpenDocument={onOpenDocument}/>}
      {tab === 'categories' ? data ? <CategoriesWorkspace onCategoriesChange={onCategoriesChange} kind={categoryKind} onKindChange={setCategoryKind} data={data} onSaved={onSaved}/> : <div className="emptyState">Se încarcă categoriile…</div> : tab === 'reports' ? <ExpenseReport data={data} loading={loading} onSelectTransaction={tx=>setDetailId(tx.id)} /> : tab === 'accounts' ? (
        <AccountsWorkspace accounts={accounts} selectedAccount={selectedAccount} onBack={()=>setAccountRecord(null)} onSelectTransaction={tx=>setDetailId(tx.id)} onAdjustAccount={account=>setCreating({mode:'adjustment',accountId:account.id})} loading={loading} onSelectAccount={openAccount} data={data} onSaved={onSaved}/>
      ) : tab === 'loans' ? <LoansWorkspace householdId={data?.source==='live' ? data.profile.householdId : null}/> : tab === 'transfers' ? (
        <><div className="sectionTitle"><h2>Transferuri între conturi</h2><span>{transactions.filter(tx=>tx.transaction_type==='transfer').length} transferuri</span></div><div className="financeCreateAction"><button disabled={data?.source!=='live'} onClick={()=>setCreating({mode:'transfer'})}>+ Adaugă transfer</button></div>{loading ? <div className="emptyState">Se încarcă transferurile…</div> : <TransactionsList categories={data?.categories??[]} splits={data?.splits??[]} accounts={accounts} transactions={transactions.filter(tx=>tx.transaction_type==='transfer')} onSelect={tx=>setDetailId(tx.id)} emptyMessage="Nu există transferuri înregistrate."/>}</>
      ) : tab === 'transactions' ? (
        <>
          <DailyTransactionSummary monthly dateLabel={monthLabel} transactions={monthlyTransactions} loading={loading}/>
          <TransactionsCalendar transactions={transactions} selectedDay={selectedDay} onSelect={setSelectedDay} month={calendarMonth} onMonthChange={month=>{setCalendarMonth(month);setSelectedDay(null)}}/>
          {selectedDay && <DailyTransactionSummary action={addTransactionAction} dateLabel={selectedDayLabel} transactions={dailyTransactions} loading={loading}/>}
          {!selectedDay && addTransactionAction}
          {!selectedDay ? <div className="emptyState">Selectează o zi din calendar pentru a vedea tranzacțiile.</div> : loading ? <div className="emptyState" role="status">Se încarcă tranzacțiile…</div> : <TransactionsList categories={data?.categories??[]} splits={data?.splits??[]} accounts={accounts} transactions={dailyTransactions} showDate={false} onSelect={transaction => setDetailId(transaction.id)} focusedId={target?.id} emptyMessage="Nu există tranzacții în ziua selectată."/>}
        </>
      ) : (
        <FinanceOverview data={data} loading={loading} onAccounts={()=>{setAccountRecord(null);setTab('accounts')}} onLoans={()=>setTab('loans')} onReports={()=>setTab('reports')}/>
      )}
    </section>
  )
}
