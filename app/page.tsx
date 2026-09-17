'use client'

import {
  Car,
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

type AreaKey = 'documents' | 'finance' | 'health' | 'auto' | 'home' | 'travel' | 'family' | 'notes'

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
  { key: 'home', label: 'Locuință', icon: House, accent: 'mint', meta: 'Casă, utilități, asigurări' },
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

export default function MyLifeHome() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('home')

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
          <div>
            <strong>MyLife</strong>
            <span>Viața ta. Organizată simplu.</span>
          </div>
        </div>

        <nav className="nav">
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={`navBtn ${active === key ? 'active' : ''}`}
              onClick={() => setActive(key)}
            >
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebarBottom">
          <button className="navBtn">
            <Settings size={18} />
            <span>Setări</span>
          </button>
          <div className="profileRow">
            <div className="avatar">MR</div>
            <div>
              <strong>Mircea</strong>
              <span>MyLife</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        {active === 'home' ? (
          <>
            <div className="topbar">
              <div>
                <p className="eyebrow">MYLIFE</p>
                <h1>Bun venit, Mircea</h1>
                <p className="subtitle">Tot ce contează, într-un singur loc.</p>
              </div>
              <button className="iconBtn" aria-label="MyLife AI">
                <Sparkles size={19} />
              </button>
            </div>

            <label className="searchBar">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Caută în MyLife"
              />
            </label>

            <section className="lifeGrid" aria-label="Domenii MyLife">
              {visibleAreas.map((area) => {
                const Icon = area.icon
                return (
                  <button key={area.key} className="lifeCard" onClick={() => setActive(area.key)}>
                    <div className="cardTop">
                      <div className={`domainIcon ${area.accent}`}>
                        <Icon size={21} strokeWidth={2.1} />
                      </div>
                      <span className="arrow">↗</span>
                    </div>
                    <strong>{area.label}</strong>
                  </button>
                )
              })}
            </section>
          </>
        ) : (
          <section className="modulePage">
            <div className="topbar">
              <div>
                <p className="eyebrow">MYLIFE</p>
                <h1>{activeArea?.label ?? nav.find(([key]) => key === active)?.[1] ?? 'MyLife'}</h1>
                <p className="subtitle">Modul pregătit pentru conectarea datelor reale din Supabase.</p>
              </div>
              <button className="iconBtn" onClick={() => setActive('home')} aria-label="Acasă">
                <Home size={19} />
              </button>
            </div>

            <div className="placeholderPanel">
              <div className="placeholderIcon">
                {ActiveIcon ? <ActiveIcon size={28} /> : <Sparkles size={28} />}
              </div>
              <h2>{activeArea?.label ?? 'Modul MyLife'}</h2>
              <p>
                Structura vizuală este gata. Următorul pas este conectarea acestui modul la datele din proiectul Supabase MyLife.
              </p>
              <div className="statusPill">Supabase-ready</div>
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
