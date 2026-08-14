/**
 * Cloudflare Worker：飞书 OpenAPI 转发代理
 *
 * 作用：GitHub Pages 等静态托管环境没有 Vite 代理，浏览器直连 open.feishu.cn
 * 会被 CORS 拦截。本 Worker 转发请求并补上 CORS 响应头。
 *
 * 部署：
 *   cd worker
 *   npx wrangler login      （浏览器登录 Cloudflare 账号）
 *   npx wrangler deploy
 * 部署后把输出的 https://xxx.workers.dev 填到 src/lib/feishu.ts 的 PROD_PROXY。
 */

const FEISHU_ORIGIN = 'https://open.feishu.cn'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

export default {
  async fetch(request) {
    // 预检请求直接放行
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    const url = new URL(request.url)
    const target = FEISHU_ORIGIN + url.pathname + url.search

    const headers = new Headers()
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json')
    const auth = request.headers.get('Authorization')
    if (auth) headers.set('Authorization', auth)

    const resp = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
    })

    const out = new Response(resp.body, {
      status: resp.status,
      headers: { 'Content-Type': resp.headers.get('Content-Type') || 'application/json' },
    })
    for (const [k, v] of Object.entries(corsHeaders())) out.headers.set(k, v)
    return out
  },
}
