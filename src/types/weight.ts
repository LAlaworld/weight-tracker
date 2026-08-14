export interface WeightEntry {
  id: string
  /** ISO date string, e.g. "2026-08-15" */
  date: string
  /** weight in kg */
  weight: number
  note?: string
  createdAt: number
}
