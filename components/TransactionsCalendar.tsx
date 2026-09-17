'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { bucharestDay } from '@/lib/expense-report'
import type { Transaction } from '@/lib/mylife-data'
import './TransactionsCalendar.css'

const weekdays = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']
const fullWeekdays = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică']

export default function TransactionsCalendar({ transactions, selectedDay, onSelect }: {
  transactions: Transaction[]; selectedDay: string; onSelect: (day: string) => void
}) {
  const [month, setMonth] = useState(selectedDay.slice(0, 7))
  const today = bucharestDay(new Date())
  const counts = useMemo(() => {
    const result = new Map<string, number>()
    for (const transaction of transactions) {
      const day = bucharestDay(new Date(transaction.transaction_date))
      result.set(day, (result.get(day) ?? 0) + 1)
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
    setMonth(next.toISOString().slice(0, 7))
  }

  return (
    <section className="transactionsCalendar" aria-label="Calendar tranzacții">
      <div className="transactionsCalendarHeader">
        <div><p>TRANZACȚII PE ZILE</p><h2 aria-live="polite">{monthLabel}</h2></div>
        <div className="transactionsCalendarNavigation">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Luna precedentă"><ChevronLeft size={18}/></button>
          <button type="button" className="transactionsCalendarToday" onClick={() => { setMonth(today.slice(0, 7)); onSelect(today) }}>Astăzi</button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Luna următoare"><ChevronRight size={18}/></button>
        </div>
      </div>
      <div className="transactionsCalendarWeekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="transactionsCalendarDays">
        {Array.from({ length: cells }, (_, index) => {
          const number = index - offset + 1
          if (number < 1 || number > days) return <span key={`empty-${index}`} aria-hidden="true"/>
          const day = `${month}-${String(number).padStart(2, '0')}`
          const count = counts.get(day) ?? 0
          return <button type="button" key={day} className={`transactionsCalendarDay ${count ? 'hasTransactions' : ''}`} aria-label={`${fullWeekdays[index % 7]}, ${number} ${monthLabel}, ${count} tranzacții`} aria-pressed={selectedDay === day} aria-current={today === day ? 'date' : undefined} onClick={() => onSelect(day)}>
            <span>{number}</span><small>{count ? count : '\u00a0'}</small>
          </button>
        })}
      </div>
      <p className="transactionsCalendarHint">Numărul de sub dată indică tranzacțiile. Alege o zi pentru a vedea lista.</p>
    </section>
  )
}
