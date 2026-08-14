import { useEffect, useState } from 'react'
import { X, Cloud, CloudOff, Loader2 } from 'lucide-react'
import {
  type FeishuConfig,
  loadFeishuConfig,
  saveFeishuConfig,
  testConnection,
} from '@/lib/feishu'

interface Props {
  open: boolean
  onClose: () => void
  onConfigChange: (c: FeishuConfig) => void
  syncStatus: string
}

export default function FeishuSheet({ open, onClose, onConfigChange, syncStatus }: Props) {
  const [config, setConfig] = useState<FeishuConfig>(loadFeishuConfig)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')

  useEffect(() => {
    if (open) {
      setConfig(loadFeishuConfig())
      setTestResult('')
    }
  }, [open])

  if (!open) return null

  const update = (patch: Partial<FeishuConfig>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    saveFeishuConfig(next)
    onConfigChange(next)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult('')
    try {
      const msg = await testConnection(config)
      setTestResult(`✅ ${msg}`)
    } catch (e) {
      setTestResult(`❌ ${e instanceof Error ? e.message : '连接失败'}`)
    } finally {
      setTesting(false)
    }
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
            {config.enabled ? (
              <Cloud size={18} className="text-cyan-200" />
            ) : (
              <CloudOff size={18} className="text-white/60" />
            )}
            飞书同步
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/80 transition hover:bg-white/25"
          >
            <X size={16} />
          </button>
        </div>

        {/* 开关 */}
        <button
          onClick={() => update({ enabled: !config.enabled })}
          className={`mb-4 flex w-full items-center justify-between rounded-2xl px-4 py-3 transition active:scale-[0.98] ${
            config.enabled ? 'bg-cyan-400/25' : 'bg-white/10'
          }`}
        >
          <span className="text-sm font-semibold text-white">自动同步到飞书</span>
          <span
            className={`flex h-6 w-11 items-center rounded-full p-0.5 transition ${
              config.enabled ? 'justify-end bg-cyan-300' : 'justify-start bg-white/25'
            }`}
          >
            <span className="h-5 w-5 rounded-full bg-white shadow" />
          </span>
        </button>

        <label className="mb-1 block text-xs font-medium text-white/60">自建应用 App ID</label>
        <input
          type="text"
          placeholder="cli_a1b2c3d4…"
          value={config.appId}
          onChange={(e) => update({ appId: e.target.value.trim() })}
          className="glass-input mb-3"
        />

        <label className="mb-1 block text-xs font-medium text-white/60">App Secret</label>
        <input
          type="password"
          placeholder="••••••••"
          value={config.appSecret}
          onChange={(e) => update({ appSecret: e.target.value.trim() })}
          className="glass-input mb-3"
        />

        <label className="mb-1 block text-xs font-medium text-white/60">多维表格 App Token</label>
        <input
          type="text"
          placeholder="从表格 URL 中获取，bascn 开头"
          value={config.appToken}
          onChange={(e) => update({ appToken: e.target.value.trim() })}
          className="glass-input mb-3"
        />

        <label className="mb-1 block text-xs font-medium text-white/60">数据表 Table ID</label>
        <input
          type="text"
          placeholder="tbl 开头"
          value={config.tableId}
          onChange={(e) => update({ tableId: e.target.value.trim() })}
          className="glass-input mb-3"
        />

        <button
          onClick={handleTest}
          disabled={testing}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/15 py-3 text-sm font-semibold text-white transition hover:bg-white/20 active:scale-[0.98] disabled:opacity-50"
        >
          {testing && <Loader2 size={15} className="animate-spin" />}
          测试连接
        </button>
        {testResult && <p className="mt-2 text-center text-xs font-medium text-white/80">{testResult}</p>}

        {syncStatus && (
          <p className="mt-2 text-center text-xs font-medium text-cyan-200/80">{syncStatus}</p>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-white/45">
          凭据仅保存在本机浏览器。自建应用需在飞书开放平台创建，并开通多维表格读写权限、将应用添加到对应表格。
        </p>
      </div>
    </div>
  )
}
