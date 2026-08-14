import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WeightEntry } from '@/types/weight'

const STORAGE_KEY = 'weight-tracker-entries-v1'

function load(): WeightEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e) => e && typeof e.date === 'string' && typeof e.weight === 'number',
    )
  } catch {
    return []
  }
}

export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function useWeightEntries() {
  const [entries, setEntries] = useState<WeightEntry[]>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  /** Add or replace the entry for a given date. */
  const upsertEntry = useCallback(
    (date: string, weight: number, note?: string) => {
      setEntries((prev) => {
        const existing = prev.find((e) => e.date === date)
        if (existing) {
          return prev.map((e) =>
            e.date === date ? { ...e, weight, note } : e,
          )
        }
        const entry: WeightEntry = {
          id: `${date}-${Date.now()}`,
          date,
          weight,
          note,
          createdAt: Date.now(),
        }
        return [...prev, entry]
      })
    },
    [],
  )

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  /** 用远端数据整体替换（飞书为数据源时） */
  const replaceAll = useCallback((list: { date: string; weight: number; note?: string }[]) => {
    setEntries(
      list.map((r) => ({
        id: `${r.date}-remote`,
        date: r.date,
        weight: r.weight,
        note: r.note,
        createdAt: Date.now(),
      })),
    )
  }, [])

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  )

  return { entries: sorted, upsertEntry, removeEntry, replaceAll }
}
