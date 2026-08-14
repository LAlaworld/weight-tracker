import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'weight-tracker-goal-v1'

function load(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const n = parseFloat(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function useGoalWeight() {
  const [goal, setGoal] = useState<number | null>(load)

  useEffect(() => {
    if (goal === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, String(goal))
    }
  }, [goal])

  const clearGoal = useCallback(() => setGoal(null), [])

  return { goal, setGoal, clearGoal }
}
