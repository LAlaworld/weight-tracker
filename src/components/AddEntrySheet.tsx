import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { WeightEntry } from '@/types/weight'
import { todayISO } from '@/hooks/useWeightEntries'

interface Props {
  open: boolean
  editing?: WeightEntry | null
  onClose: () => void
  onSave: (date: string, weight: number, note?: string) => void
}

export default function AddEntrySheet({ open, editing, onClose, onSave }: Props) {
  const [date, setDate] = useState(todayISO())
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDate(editing?.date ?? todayISO())
      setWeight(editing ? String(editing.weight) : '')
      setNote(editing?.note ?? '')
      setError('')
    }
  }, [open, editing])

  if (!open) return null

  const handleSave = () => {
    const w = parseFloat(weight)
    if (!weight || Number.isNaN(w) || w <= 0 || w > 500) {
      setError('请输入有效的重量（0 ~ 500 kg）')
      return
    }
    if (!date) {
      setError('请选择日期')
      return
    }
    onSave(date, Math.round(w * 10) / 10, note.trim() || undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal>
      {/* backdrop */}
      <button
        aria-label="关闭"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* sheet */}
      <div className="animate-sheet-up relative w-full max-w-md rounded-t-[32px] border-t border-white/30 bg-white/20 p-6 pb-10 shadow-2xl backdrop-blur-2xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/40" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {editing ? '编辑记录' : '记录重量'}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/80 transition hover:bg-white/25"
          >
            <X size={16} />
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-white/60">日期</label>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="glass-input mb-4"
        />

        <label className="mb-1 block text-xs font-medium text-white/60">重量（kg）</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          placeholder="例如 62.5"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="glass-input mb-4 text-2xl font-bold"
          autoFocus
        />

        <label className="mb-1 block text-xs font-medium text-white/60">备注（可选）</label>
        <input
          type="text"
          maxLength={40}
          placeholder="例如：空腹、运动后…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="glass-input mb-2"
        />

        {error && <p className="mb-2 text-xs font-medium text-rose-200">{error}</p>}

        <button
          onClick={handleSave}
          className="mt-3 w-full rounded-2xl bg-white py-3.5 text-base font-bold text-violet-700 shadow-lg shadow-violet-900/30 transition active:scale-[0.98]"
        >
          保存
        </button>
      </div>
    </div>
  )
}
