import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, TrendingDown, TrendingUp, Minus, Trash2, Pencil, Scale, Target, RefreshCw } from 'lucide-react'
import { useWeightEntries, todayISO } from '@/hooks/useWeightEntries'
import { useGoalWeight } from '@/hooks/useGoalWeight'
import {
  type FeishuConfig,
  loadFeishuConfig,
  feishuConfigured,
  syncUpsert,
  syncRemove,
  syncBatchCreate,
  fetchAll,
} from '@/lib/feishu'
import type { WeightEntry } from '@/types/weight'
import WeightChart from '@/components/WeightChart'
import AddEntrySheet from '@/components/AddEntrySheet'
import GoalSheet from '@/components/GoalSheet'

type Range = 'week' | 'month' | 'all'

const RANGE_LABEL: Record<Range, string> = { week: '近 7 天', month: '近 30 天', all: '全部' }

/** 把同步错误翻译成用户能看懂的提示 */
function friendlyError(e: unknown): string {
  if (
    e instanceof Error &&
    (e.name === 'TimeoutError' || e.name === 'AbortError' || e.message.includes('timed out'))
  ) {
    return '网络超时，当前网络可能无法访问同步代理'
  }
  return e instanceof Error ? e.message : '未知错误'
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const week = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  const today = todayISO()
  if (iso === today) return `今天 · 周${week}`
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(
    yesterday.getDate(),
  ).padStart(2, '0')}`
  if (iso === yISO) return `昨天 · 周${week}`
  return `${m}月${d}日 · 周${week}`
}

export default function Home() {
  const { entries, upsertEntry, removeEntry, replaceAll } = useWeightEntries()
  const { goal, setGoal } = useGoalWeight()
  const [range, setRange] = useState<Range>('month')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [editing, setEditing] = useState<WeightEntry | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [feishuConfig] = useState<FeishuConfig>(loadFeishuConfig)
  const [syncStatus, setSyncStatus] = useState('')
  const [loadingRemote, setLoadingRemote] = useState(false)

  /** 从飞书拉取全部记录并覆盖本地（飞书为数据源，localStorage 作离线缓存） */
  const refreshFromFeishu = useCallback(() => {
    if (!feishuConfigured(feishuConfig)) return
    setLoadingRemote(true)
    fetchAll(feishuConfig)
      .then(async (list) => {
        // 首次迁移：飞书是空表但本地有数据 → 把本地上传上去，而不是用空表覆盖本地
        const localRaw = localStorage.getItem('weight-tracker-entries-v1')
        const localList: { date: string; weight: number; note?: string }[] = localRaw
          ? JSON.parse(localRaw)
          : []
        if (list.length === 0 && localList.length > 0) {
          await syncBatchCreate(feishuConfig, localList)
          setSyncStatus(`已把本地 ${localList.length} 条记录上传到飞书`)
          return
        }
        replaceAll(list)
        setSyncStatus(`已从飞书加载 ${list.length} 条记录`)
      })
      .catch((e) =>
        setSyncStatus(`读取飞书失败：${friendlyError(e)}`),
      )
      .finally(() => setLoadingRemote(false))
  }, [feishuConfig, replaceAll])

  // 打开页面时自动从飞书加载一次
  useEffect(() => {
    refreshFromFeishu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 删除确认 / 同步状态提示自动复位
  useEffect(() => {
    if (!confirmDeleteId) return
    const t = setTimeout(() => setConfirmDeleteId(null), 3000)
    return () => clearTimeout(t)
  }, [confirmDeleteId])

  useEffect(() => {
    if (!syncStatus) return
    const t = setTimeout(() => setSyncStatus(''), 4000)
    return () => clearTimeout(t)
  }, [syncStatus])

  /** 保存记录并同步飞书（失败不影响本地保存） */
  const handleSave = (date: string, weight: number, note?: string) => {
    upsertEntry(date, weight, note)
    if (feishuConfigured(feishuConfig)) {
      setSyncStatus('正在同步飞书…')
      syncUpsert(feishuConfig, date, weight, note)
        .then(() => setSyncStatus('已同步到飞书 ✓'))
        .catch((e) => setSyncStatus(`飞书同步失败：${friendlyError(e)}`))
    }
  }

  /** 删除记录并同步飞书 */
  const handleRemove = (entry: WeightEntry) => {
    removeEntry(entry.id)
    if (feishuConfigured(feishuConfig)) {
      setSyncStatus('正在同步飞书…')
      syncRemove(feishuConfig, entry.date)
        .then(() => setSyncStatus('已同步到飞书 ✓'))
        .catch((e) => setSyncStatus(`飞书同步失败：${friendlyError(e)}`))
    }
  }

  const filtered = useMemo(() => {
    if (range === 'all') return entries
    const days = range === 'week' ? 7 : 30
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (days - 1))
    const cutoffISO = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(
      cutoff.getDate(),
    ).padStart(2, '0')}`
    return entries.filter((e) => e.date >= cutoffISO)
  }, [entries, range])

  const latest = entries[entries.length - 1]
  const first = entries[0]
  const totalChange = latest && first && entries.length > 1 ? latest.weight - first.weight : null

  const weekAvg = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 6)
    const cutoffISO = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(
      cutoff.getDate(),
    ).padStart(2, '0')}`
    const recent = entries.filter((e) => e.date >= cutoffISO)
    if (recent.length === 0) return null
    return recent.reduce((s, e) => s + e.weight, 0) / recent.length
  }, [entries])

  const trend = totalChange === null ? null : totalChange > 0.05 ? 'up' : totalChange < -0.05 ? 'down' : 'flat'

  // 目标进度：从首次记录到目标，当前走到百分之几
  const goalInfo = useMemo(() => {
    if (goal === null || !latest) return null
    const remaining = latest.weight - goal
    let progress: number | null = null
    if (first && entries.length > 1 && first.weight !== goal) {
      progress = Math.min(1, Math.max(0, (first.weight - latest.weight) / (first.weight - goal)))
    }
    return { remaining, progress }
  }, [goal, latest, first, entries.length])

  return (
    <div className="aurora-bg min-h-dvh">
      <div className="pt-safe mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-28 pt-12">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-white/55">Weight Log</p>
            <h1 className="text-2xl font-extrabold text-white drop-shadow-sm">每日重量记录</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label="设置目标体重"
              onClick={() => setGoalOpen(true)}
              className={`glass-card flex h-11 w-11 items-center justify-center rounded-2xl transition active:scale-95 ${
                goal !== null ? 'text-fuchsia-200' : 'text-white/90'
              }`}
            >
              <Target size={20} />
            </button>
            <div className="glass-card flex h-11 w-11 items-center justify-center rounded-2xl">
              <Scale size={20} className="text-white/90" />
            </div>
          </div>
        </header>

        {/* Current weight hero card */}
        <section className="glass-card mb-4 rounded-[28px] p-6">
          <p className="text-xs font-medium text-white/60">当前重量</p>
          <div className="mt-1 flex items-end gap-2">
            <span key={latest?.id ?? 'empty'} className="animate-pop-in text-6xl font-extrabold leading-none tracking-tight text-white">
              {latest ? latest.weight.toFixed(1) : '--'}
            </span>
            <span className="pb-1 text-lg font-semibold text-white/60">kg</span>
          </div>
          {latest && (
            <p className="mt-2 text-xs text-white/55">最近记录：{formatDate(latest.date)}</p>
          )}

          {goalInfo && goal !== null && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium">
                <span className="text-white/55">目标 {goal.toFixed(1)} kg</span>
                <span
                  className={
                    Math.abs(goalInfo.remaining) < 0.05
                      ? 'text-emerald-300'
                      : goalInfo.remaining > 0
                        ? 'text-fuchsia-200'
                        : 'text-cyan-200'
                  }
                >
                  {Math.abs(goalInfo.remaining) < 0.05
                    ? '🎉 已达成目标'
                    : goalInfo.remaining > 0
                      ? `还差 ${goalInfo.remaining.toFixed(1)} kg`
                      : `低于目标 ${Math.abs(goalInfo.remaining).toFixed(1)} kg`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-300 transition-all duration-500"
                  style={{ width: `${((goalInfo.progress ?? 0) * 100).toFixed(0)}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="text-[10px] font-medium text-white/55">7 天平均</p>
              <p className="mt-0.5 text-sm font-bold text-white">
                {weekAvg !== null ? `${weekAvg.toFixed(1)} kg` : '--'}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="text-[10px] font-medium text-white/55">累计变化</p>
              <p
                className={`mt-0.5 flex items-center gap-1 text-sm font-bold ${
                  trend === 'down'
                    ? 'text-emerald-300'
                    : trend === 'up'
                      ? 'text-rose-300'
                      : 'text-white'
                }`}
              >
                {trend === 'down' && <TrendingDown size={14} />}
                {trend === 'up' && <TrendingUp size={14} />}
                {trend === 'flat' && <Minus size={14} />}
                {totalChange !== null
                  ? `${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)} kg`
                  : '--'}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2.5">
              <p className="text-[10px] font-medium text-white/55">记录天数</p>
              <p className="mt-0.5 text-sm font-bold text-white">{entries.length} 天</p>
            </div>
          </div>
        </section>

        {/* Chart card */}
        <section className="glass-card mb-4 rounded-[28px] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">趋势</h2>
            <div className="flex rounded-full bg-white/10 p-0.5">
              {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    range === r ? 'bg-white text-violet-700 shadow' : 'text-white/65'
                  }`}
                >
                  {RANGE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          <WeightChart entries={filtered} />
        </section>

        {/* History */}
        <section className="glass-card rounded-[28px] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">历史记录</h2>
            {feishuConfigured(feishuConfig) && (
              <button
                aria-label="从飞书刷新"
                onClick={refreshFromFeishu}
                disabled={loadingRemote}
                className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70 transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={11} className={loadingRemote ? 'animate-spin' : ''} />
                {loadingRemote ? '加载中' : '飞书刷新'}
              </button>
            )}
          </div>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/50">暂无记录</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {[...entries].reverse().map((e, i, arr) => {
                const prev = arr[i + 1]
                const diff = prev ? e.weight - prev.weight : null
                return (
                  <li key={e.id} className="group flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{formatDate(e.date)}</p>
                      {e.note && <p className="truncate text-xs text-white/50">{e.note}</p>}
                    </div>
                    {diff !== null && (
                      <span
                        className={`text-xs font-semibold ${
                          diff > 0 ? 'text-rose-300' : diff < 0 ? 'text-emerald-300' : 'text-white/50'
                        }`}
                      >
                        {diff > 0 ? '+' : ''}
                        {diff.toFixed(1)}
                      </span>
                    )}
                    <span className="w-16 text-right text-base font-bold text-white">
                      {e.weight.toFixed(1)}
                    </span>
                    <button
                      aria-label="编辑"
                      onClick={() => {
                        setEditing(e)
                        setSheetOpen(true)
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
                    >
                      <Pencil size={13} />
                    </button>
                    {confirmDeleteId === e.id ? (
                      <button
                        onClick={() => {
                          handleRemove(e)
                          setConfirmDeleteId(null)
                        }}
                        className="flex h-7 items-center rounded-full bg-rose-500/80 px-2.5 text-[11px] font-bold text-white transition active:scale-95"
                      >
                        确认
                      </button>
                    ) : (
                      <button
                        aria-label="删除"
                        onClick={() => setConfirmDeleteId(e.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-rose-400/30 hover:text-rose-200"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Floating add button（右下角） */}
      <button
        onClick={() => {
          setEditing(null)
          setSheetOpen(true)
        }}
        className="mb-safe fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white text-violet-700 shadow-xl shadow-violet-900/40 transition active:scale-95"
        aria-label="记录重量"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {/* 飞书同步状态提示 */}
      {syncStatus && (
        <div className="mb-safe fixed bottom-24 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-800 shadow-lg backdrop-blur">
          {syncStatus}
        </div>
      )}

      <AddEntrySheet
        open={sheetOpen}
        editing={editing}
        onClose={() => setSheetOpen(false)}
        onSave={handleSave}
      />

      <GoalSheet
        open={goalOpen}
        goal={goal}
        onClose={() => setGoalOpen(false)}
        onSave={setGoal}
      />
    </div>
  )
}
