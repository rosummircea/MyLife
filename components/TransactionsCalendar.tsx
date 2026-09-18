'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { bucharestDay } from '@/lib/expense-report'
import type { Transaction } from '@/lib/mylife-data'
import './TransactionsCalendar.css'

const weekdays = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']
const fullWeekdays = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']

export default function TransactionsCalendar({ transactions, selectedDay, onSelect, month, onMonthChange }: {
  transactions: Transaction[]; selectedDay: string | null; onSelect: (day: string) => void; month: string; onMonthChange: (month: string) => void
}) {
  const today = bucharestDay(new Date())
  const counts = useMemo(() => {
    const result = new Map<string, { incoming: boolean; outgoing: boolean }>()
    for (const transaction of transactions) {
      const day = bucharestDay(new Date(transaction.transaction_date))
      if (transaction.status && transaction.status !== 'posted' || Number(transaction.amount) <= 0) continue
      const activity = result.get(day) ?? { incoming: false, outgoing: false }
      activity.incoming ||= ['income', 'adjustment', 'transfer'].includes(transaction.transaction_type)
      activity.outgoing ||= ['expense', 'transfer'].includes(transaction.transaction_type)
      result.set(day, activity)
    }
    return result
  }, [transactions])
  const [year, monthNumber] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year, monthNumber - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const monthLabel = first.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const cells = Math.ceil((offset + days) / 7) * 7
  const moveMonth = (direction: number) => {
    const next = new Date(Date.UTC(year, monthNumber - 1 + direction, 1))
    onMonthChange(next.toISOString().slice(0, 7))
  }

  return (
    <section className="transactionsCalendar" aria-label="Calendar tranzacții">
      <div className="transactionsCalendarHeader">
        <div><p>TRANZACȚII PE ZILE</p><h2 aria-live="polite">{monthLabel}</h2></div>
        <div className="transactionsCalendarNavigation">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Luna precedentă"><ChevronLeft size={18}/></button>
          <button type="button" className="transactionsCalendarToday" onClick={() => { onMonthChange(today.slice(0, 7)); onSelect(today) }}>Astăzi</button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Luna următoare"><ChevronRight size={18}/></button>
        </div>
      </div>
      <div className="transactionsCalendarWeekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="transactionsCalendarDays">
        {Array.from({ length: cells }, (_, index) => {
          const number = index - offset + 1
          if (number < 1 || number > days) return <span key={`empty-${index}`} aria-hidden="true"/>
          const day = `${month}-${String(number).padStart(2, '0')}`
          const activity = counts.get(day)
          const label = [activity?.incoming && 'intrări', activity?.outgoing && 'ieșiri'].filter(Boolean).join(' și ') || 'fără mișcări'
          return <button type="button" key={day} className={`transactionsCalendarDay ${activity ? 'hasTransactions' : ''}`} aria-label={`${fullWeekdays[index % 7]}, ${number} ${monthLabel}, ${label}`} aria-pressed={selectedDay === day} aria-current={today === day ? 'date' : undefined} onClick={() => onSelect(day)}>
            <span>{number}</span><span className="transactionsCalendarMarkers" aria-hidden="true">{activity?.incoming && <i className="transactionDayDot incoming"/>}{activity?.outgoing && <i className="transactionDayDot outgoing"/>}</span>
          </button>
        })}
      </div>
      <p className="transactionsCalendarHint">Verde: intrări · Roșu: ieșiri. Transferurile au ambele puncte. Alege o zi pentru a vedea lista.</p>
    </section>
  )
}
