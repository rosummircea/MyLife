'use client'

import {
  CalendarRange,
  Car,
  ChevronRight,
  FileText,
  HeartPulse,
  Home,
  House,
  NotebookPen,
  Plane,
  Settings,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react'
import { useMemo, useState } from 'react'

type AreaKey = 'documents' | 'finance' | 'health' | 'auto' | 'homeLife' | 'travel' | 'family' | 'notes'
type ReportPeriod = 'Zi' | 'Săptămână' | 'Lună' | 'An' | 'Custom'
type ExpenseCategory = { name: string; amount: number; percent: number; color: string }

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

const demoAccounts = [
  ['Cont principal', '8.420,50 RON', 'checking'],
  ['Economii', '12.500,00 RON', 'savings'],
  ['Cash', '650,00 RON', 'cash'],
]

const demoTransactions = [
  ['Supermarket', '16.09.2026', '−178,40 RON'],
  ['Combustibil', '15.09.2026', '−82,15 RON'],
  ['Venit', '14.09.2026', '+4.200,00 RON'],
]

const demoDocuments = [
  ['Poliță locuință.pdf', 'Asigurare locuință · expiră 16.01.2027', 'Fișier ✓'],
  ['Document identitate.jpg', 'Document personal · expiră 22.04.2031', 'Fișier ✓'],
]

const mockExpenses: ExpenseCategory[] = [
  { name: 'Mâncare și băuturi', amount: 2860, percent: 28, color: '#6ea8fe' },
  { name: 'Utilități', amount: 1960, percent: 19, color: '#67d8c1' },
  { name: 'Casă', amount: 1540, percent: 15, color: '#a889f4' },
  { name: 'Transport', amount: 1230, percent: 12, color: '#f5bd63' },
  { name: 'Cumpărături', amount: 1020, percent: 10, color: '#f07fa0' },
  { name: 'Sănătate', amount: 720, percent: 7, color: '#75c8ff' },
  { name: 'Patrick', amount: 510, percent: 5, color: '#9fda7d' },
  { name: 'Altele', amount: 410, percent: 4, color: '#8d98a8' },
]

function money(value: number) {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 2 }).format(value)
}

export default function DemoApp() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string>('home')

  const visibleAreas = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('ro')
    if (!q) return areas
    return areas.filter((area) => `${area.label} ${area.meta}`.toLocaleLowerCase('ro').includes(q))
  }, [query])

  const activeArea = areas.find((area) => area.key === active)
  const ActiveIcon = activeArea?.icon

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
          <div className="profileRow">
            <div className="avatar">DE</div>
            <div><strong>Demo</strong><span>Preview fără date personale</span></div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="statusPill" style={{ width: 'fit-content', marginBottom: 18 }}>Preview live · date demonstrative</div>

        {active === 'home' ? (
          <>
            <div className="topbar">
              <div><p className="eyebrow">MYLIFE</p><h1>Bun venit</h1><p className="subtitle">Tot ce contează, într-un singur loc.</p></div>
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
              <div className="statCard"><span>Conturi active</span><strong>3</strong></div>
              <div className="statCard"><span>Solduri pozitive</span><strong>21.570,50 RON</strong></div>
              <div className="statCard"><span>Documente</span><strong>2</strong></div>
              <div className="statCard"><span>Household</span><strong>Preview</strong></div>
            </section>
          </>
        ) : active === 'finance' ? (
          <FinancePreview onHome={() => setActive('home')} />
        ) : active === 'documents' ? (
          <section className="modulePage">
            <ModuleHeader title="Documente" onHome={() => setActive('home')} subtitle="Preview cu documente demonstrative." />
            <div className="sectionTitle"><h2>Documentele mele</h2><span>2 documente</span></div>
            <div className="listPanel">
              {demoDocuments.map(([name, detail, status]) => <div className="listRow" key={name}><div><strong>{name}</strong><span>{detail}</span></div><span className="fileStatus ok">{status}</span></div>)}
            </div>
          </section>
        ) : (
          <section className="modulePage">
            <ModuleHeader title={activeArea?.label ?? 'MyLife'} onHome={() => setActive('home')} subtitle="Preview de structură." />
            <div className="placeholderPanel">
              <div className="placeholderIcon">{ActiveIcon ? <ActiveIcon size={28}/> : <Sparkles size={28}/>}</div>
              <h2>{activeArea?.label ?? 'Modul MyLife'}</h2>
              <p>Acest modul este pregătit în aplicația reală și va fi conectat progresiv la datele din Supabase.</p>
              <div className="statusPill">Preview</div>
            </div>
          </section>
        )}
      </main>

      <nav className="mobileNav" aria-label="Navigație mobilă">
        <button className={active === 'home' ? 'active' : ''} onClick={() => setActive('home')}><Home size={20}/><span>Acasă</span></button>
        <button className={active === 'documents' ? 'active' : ''} onClick={() => setActive('documents')}><FileText size={20}/><span>Documente</span></button>
        <button className="aiMobile"><Sparkles size={21}/></button>
        <button className={active === 'notes' ? 'active' : ''} onClick={() => setActive('notes')}><NotebookPen size={20}/><span>Notițe</span></button>
        <button><Users size={20}/><span>Profil</span></button>
      </nav>
    </div>
  )
}

function FinancePreview({ onHome }: { onHome: () => void }) {
  const [tab, setTab] = useState<'overview' | 'accounts' | 'transactions' | 'reports'>('reports')

  return (
    <section className="modulePage">
      <ModuleHeader title="Finanțe" onHome={onHome} subtitle="Preview cu valori demonstrative." />
      <div className="subnav" aria-label="Submeniu Finanțe">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>Conturi</button>
        <button className={tab === 'transactions' ? 'active' : ''} onClick={() => setTab('transactions')}>Tranzacții</button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>Rapoarte</button>
      </div>

      {tab === 'reports' ? <ExpenseReport /> : tab === 'accounts' ? (
        <><div className="sectionTitle"><h2>Conturi</h2><span>3 active</span></div><div className="accountGrid">{demoAccounts.map(([name, amount, type]) => <div className="accountCard" key={name}><span>{name}</span><strong>{amount}</strong><small>{type}</small></div>)}</div></>
      ) : tab === 'transactions' ? (
        <><div className="sectionTitle"><h2>Tranzacții recente</h2></div><DemoTransactions/></>
      ) : (
        <><div className="sectionTitle"><h2>Overview</h2><span>rezumat financiar</span></div><div className="accountGrid">{demoAccounts.map(([name, amount, type]) => <div className="accountCard" key={name}><span>{name}</span><strong>{amount}</strong><small>{type}</small></div>)}</div><div className="sectionTitle"><h2>Tranzacții recente</h2></div><DemoTransactions/></>
      )}
    </section>
  )
}

function ExpenseReport() {
  const [period, setPeriod] = useState<ReportPeriod>('Lună')
  const [selected, setSelected] = useState<ExpenseCategory | null>(null)
  const total = mockExpenses.reduce((sum, item) => sum + item.amount, 0)
  let cursor = 0
  const gradient = mockExpenses.map((item) => {
    const start = cursor
    cursor += item.percent
    return `${item.color} ${start}% ${cursor}%`
  }).join(', ')

  return (
    <div className="reportWrap">
      <div className="reportToolbar">
        <div>
          <p className="eyebrow">RAPORT CHELTUIELI</p>
          <h2>Unde s-au dus banii</h2>
          <p className="subtitle">Mockup vizual. Datele reale le conectăm după ce stabilim raportul.</p>
        </div>
        <div className="periodSwitch">
          {(['Zi','Săptămână','Lună','An','Custom'] as ReportPeriod[]).map((item) => <button key={item} className={period === item ? 'active' : ''} onClick={() => setPeriod(item)}>{item === 'Custom' && <CalendarRange size={14}/>} {item}</button>)}
        </div>
      </div>

      <div className="reportHero">
        <div className="pieStage">
          <div className="pieChart" style={{ background: `conic-gradient(${gradient})` }} aria-label="Distribuția cheltuielilor">
            <div className="pieHole"><span>Total cheltuieli</span><strong>{money(total)}</strong><small>{period}</small></div>
          </div>
        </div>
        <div className="reportSummary">
          <span className="summaryLabel">Perioadă selectată</span>
          <strong>{period === 'Lună' ? 'Septembrie 2026' : period}</strong>
          <p>Fiecare culoare reprezintă o categorie principală. Procentul arată ponderea ei din total.</p>
          <div className="summaryMini"><span>Categorii</span><strong>{mockExpenses.length}</strong></div>
          <div className="summaryMini"><span>Cea mai mare categorie</span><strong>{mockExpenses[0].percent}%</strong></div>
        </div>
      </div>

      <div className="sectionTitle reportListTitle"><h2>Cheltuieli pe categorii</h2><span>click pentru detalii</span></div>
      <div className="expenseList">
        {mockExpenses.map((item) => (
          <button key={item.name} className={`expenseRow ${selected?.name === item.name ? 'selected' : ''}`} onClick={() => setSelected(item)}>
            <span className="expenseDot" style={{ background: item.color }}/>
            <div className="expenseName"><strong>{item.name}</strong><span>{item.percent}% din total</span></div>
            <div className="expenseValue"><strong>{money(item.amount)}</strong><span>{item.percent}%</span></div>
            <ChevronRight size={18}/>
          </button>
        ))}
      </div>
      {selected && <div className="categoryPeek"><div><span>Categoria selectată</span><strong>{selected.name}</strong><p>{money(selected.amount)} · {selected.percent}% din total</p></div><button onClick={() => setSelected(null)}>Închide</button></div>}
    </div>
  )
}

function DemoTransactions() {
  return <div className="listPanel">{demoTransactions.map(([name, date, amount]) => <div className="listRow" key={`${name}-${date}`}><div><strong>{name}</strong><span>{date}</span></div><strong className={amount.startsWith('+') ? 'positive' : ''}>{amount}</strong></div>)}</div>
}

function ModuleHeader({ title, onHome, subtitle }: { title: string; onHome: () => void; subtitle: string }) {
  return <div className="topbar"><div><p className="eyebrow">MYLIFE</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div><button className="iconBtn" onClick={onHome}><Home size={19}/></button></div>
}
