import { useEffect, useState } from 'react'
import { X, Target } from 'lucide-react'

interface Props {
  open: boolean
  goal: number | null
  onClose: () => void
  onSave: (goal: number | null) => void
}

export default function GoalSheet({ open, goal, onClose, onSave }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setValue(goal !== null ? String(goal) : '')
      setError('')
    }
  }, [open, goal])

  if (!open) return null

  const handleSave = () => {
    if (!value.trim()) {
      onSave(null)
      onClose()
      return
    }
    const g = parseFloat(value)
    if (Number.isNaN(g) || g <= 0 || g > 500) {
      setError('请输入有效的目标体重（0 ~ 500 kg）')
      return
    }
    onSave(Math.round(g * 10) / 10)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal>
      <button
        aria-label="关闭"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-sheet-up relative w-full max-w-md rounded-t-[32px] border-t border-white/30 bg-white/20 p-6 pb-10 shadow-2xl backdrop-blur-2xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/40" />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Target size={18} className="text-fuchsia-200" />
            目标体重
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/80 transition hover:bg-white/25"
          >
            <X size={16} />
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-white/60">目标（kg）</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          placeholder="例如 58.0，留空表示取消目标"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="glass-input mb-2 text-2xl font-bold"
          autoFocus
        />

        {error && <p className="mb-2 text-xs font-medium text-rose-200">{error}</p>}

        <button
          onClick={handleSave}
          className="mt-3 w-full rounded-2xl bg-white py-3.5 text-base font-bold text-violet-700 shadow-lg shadow-violet-900/30 transition active:scale-[0.98]"
        >
          保存
        </button>
        {goal !== null && (
          <button
            onClick={() => {
              onSave(null)
              onClose()
            }}
            className="mt-2 w-full rounded-2xl bg-white/10 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/15 active:scale-[0.98]"
          >
            清除目标
          </button>
        )}
      </div>
    </div>
  )
}
