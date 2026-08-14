/**
 * 飞书多维表格（Bitable）同步客户端。
 *
 * 通过 Vite dev server 代理（/feishu -> https://open.feishu.cn）访问 OpenAPI，
 * 避免浏览器 CORS 限制。自建应用凭据保存在 localStorage。
 */

const CONFIG_KEY = 'weight-tracker-feishu-v1'
const TOKEN_KEY = 'weight-tracker-feishu-token-v1'

/**
 * API 基础地址：
 * - 本地 dev：走 Vite 代理 '/feishu'
 * - 线上（GitHub Pages）：走 Cloudflare Worker（部署 worker 后回填 PROD_PROXY）
 */
export const PROD_PROXY = 'https://feishu-proxy.lalaworld.workers.dev'
const API_BASE = import.meta.env.DEV ? '/feishu' : PROD_PROXY

/** 请求超时：网络不可达时快速失败，避免界面卡在加载态 */
const FETCH_TIMEOUT_MS = 12000

/**
 * 多维表格位置（已由 API 建好，用户无需手动填写）。
 * 表格「体重记录 / 每日记录」，字段：日期(文本) / 体重(数字) / 备注(文本)
 * https://zcnftbfryh86.feishu.cn/base/PqqbbqhoEaiuNLsUs9rczAgNnsc
 */
export const DEFAULT_APP_TOKEN = 'PqqbbqhoEaiuNLsUs9rczAgNnsc'
export const DEFAULT_TABLE_ID = 'tblFI2cs7Xne2PhY'
/** 自建应用 App ID（不敏感，内置） */
export const DEFAULT_APP_ID = 'cli_aaf5f072dbb8dcb0'
/**
 * App Secret 不写入仓库（GitHub 推送保护会拦截）：
 * 本地 dev 读 .env.local，线上构建由 GitHub Actions 注入 secrets.FEISHU_APP_SECRET
 */
export const DEFAULT_APP_SECRET = import.meta.env.VITE_FEISHU_APP_SECRET ?? ''

export interface FeishuConfig {
  appId: string
  appSecret: string
  /** 多维表格 app_token（创建后由我来填） */
  appToken: string
  /** 数据表 table_id */
  tableId: string
  enabled: boolean
}

export function loadFeishuConfig(): FeishuConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      const c = JSON.parse(raw)
      return {
        appId: c.appId || DEFAULT_APP_ID,
        appSecret: c.appSecret || DEFAULT_APP_SECRET,
        appToken: c.appToken || DEFAULT_APP_TOKEN,
        tableId: c.tableId || DEFAULT_TABLE_ID,
        // 未显式设置过时默认开启
        enabled: c.enabled === undefined ? true : Boolean(c.enabled),
      }
    }
  } catch {
    /* ignore */
  }
  return {
    appId: DEFAULT_APP_ID,
    appSecret: DEFAULT_APP_SECRET,
    appToken: DEFAULT_APP_TOKEN,
    tableId: DEFAULT_TABLE_ID,
    enabled: true,
  }
}

export function saveFeishuConfig(c: FeishuConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
}

export function feishuConfigured(c: FeishuConfig): boolean {
  // 线上未配置 Worker 代理时自动停用同步（避免发注定失败的请求）
  if (!API_BASE) return false
  return Boolean(c.enabled && c.appId && c.appSecret && c.appToken && c.tableId)
}

interface CachedToken {
  token: string
  /** epoch ms when the token expires */
  expiresAt: number
}

async function getTenantToken(c: FeishuConfig): Promise<string> {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (raw) {
      const cached: CachedToken = JSON.parse(raw)
      // 提前 5 分钟视为过期
      if (cached.token && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
        return cached.token
      }
    }
  } catch {
    /* ignore */
  }
  const res = await fetch(`${API_BASE}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: c.appId, app_secret: c.appSecret }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(`获取飞书 token 失败：${data.msg ?? data.code}`)
  }
  const token = data.tenant_access_token as string
  localStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({ token, expiresAt: Date.now() + (data.expire - 60) * 1000 }),
  )
  return token
}

async function api(c: FeishuConfig, path: string, init?: RequestInit) {
  const token = await getTenantToken(c)
  const res = await fetch(`${API_BASE}/open-apis${path}`, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(`飞书接口报错：${data.msg ?? data.code}`)
  }
  return data
}

/** 按日期查找记录，返回 record_id */
async function findRecordId(c: FeishuConfig, date: string): Promise<string | null> {
  const data = await api(
    c,
    `/bitable/v1/apps/${c.appToken}/tables/${c.tableId}/records/search`,
    {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          conjunction: 'and',
          conditions: [{ field_name: '日期', operator: 'is', value: [date] }],
        },
        page_size: 1,
      }),
    },
  )
  const items = data.data?.items
  return items && items.length > 0 ? items[0].record_id : null
}

/** 新增或更新某天的体重记录（飞书侧） */
export async function syncUpsert(c: FeishuConfig, date: string, weight: number, note?: string) {
  const fields: Record<string, unknown> = { 日期: date, 体重: weight }
  if (note) fields.备注 = note
  const existing = await findRecordId(c, date)
  if (existing) {
    await api(c, `/bitable/v1/apps/${c.appToken}/tables/${c.tableId}/records/${existing}`, {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    })
  } else {
    await api(c, `/bitable/v1/apps/${c.appToken}/tables/${c.tableId}/records`, {
      method: 'POST',
      body: JSON.stringify({ fields }),
    })
  }
}

/** 删除某天的记录（飞书侧） */
export async function syncRemove(c: FeishuConfig, date: string) {
  const existing = await findRecordId(c, date)
  if (existing) {
    await api(c, `/bitable/v1/apps/${c.appToken}/tables/${c.tableId}/records/${existing}`, {
      method: 'DELETE',
    })
  }
}

export interface FeishuWeightRecord {
  date: string
  weight: number
  note?: string
}

function parseText(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  // 文本字段偶尔返回富文本分段
  if (Array.isArray(v)) {
    return v.map((seg) => (seg && typeof seg.text === 'string' ? seg.text : '')).join('')
  }
  return undefined
}

/** 从飞书读取全部体重记录（按日期升序，自动翻页） */
export async function fetchAll(c: FeishuConfig): Promise<FeishuWeightRecord[]> {
  const out: FeishuWeightRecord[] = []
  let pageToken: string | undefined
  do {
    const data = await api(
      c,
      `/bitable/v1/apps/${c.appToken}/tables/${c.tableId}/records/search${pageToken ? `?page_token=${pageToken}` : ''}`,
      {
        method: 'POST',
        body: JSON.stringify({
          sort: [{ field_name: '日期', desc: false }],
          page_size: 100,
        }),
      },
    )
    for (const item of data.data?.items ?? []) {
      const f = item.fields ?? {}
      const date = parseText(f['日期'])
      const w = typeof f['体重'] === 'number' ? f['体重'] : parseFloat(String(f['体重']))
      if (!date || Number.isNaN(w)) continue
      out.push({ date, weight: w, note: parseText(f['备注']) || undefined })
    }
    pageToken = data.data?.has_more ? data.data?.page_token : undefined
  } while (pageToken)
  return out
}

/** 批量上传记录（用于首次把本地数据迁移到飞书） */
export async function syncBatchCreate(
  c: FeishuConfig,
  list: { date: string; weight: number; note?: string }[],
) {
  // batch_create 单次上限 500 条
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500)
    await api(c, `/bitable/v1/apps/${c.appToken}/tables/${c.tableId}/records/batch_create`, {
      method: 'POST',
      body: JSON.stringify({
        records: chunk.map((r) => ({
          fields: { 日期: r.date, 体重: r.weight, ...(r.note ? { 备注: r.note } : {}) },
        })),
      }),
    })
  }
}

/** 测试凭据是否可用（拉一条记录试试） */
export async function testConnection(c: FeishuConfig): Promise<string> {
  const data = await api(
    c,
    `/bitable/v1/apps/${c.appToken}/tables/${c.tableId}/records?page_size=1`,
    { method: 'GET' },
  )
  const total = data.data?.total ?? 0
  return `连接成功，表中已有 ${total} 条记录`
}
