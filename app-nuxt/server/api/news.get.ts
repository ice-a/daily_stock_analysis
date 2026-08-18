import { defineEventHandler, getQuery } from 'h3'
import { newsService } from '../services/news'

/**
 * 新闻检索调试接口（对应原 search_service 的检索能力）。
 * GET /api/news?q=贵州茅台&code=600519
 * 多 provider fallback，失败返回 success:false（fail-open）。
 */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const query = (q.q as string) || (q.query as string) || ''
  const code = (q.code as string) || ''
  if (!query && !code) {
    return { ok: false, error: 'missing query param (q or code)' }
  }
  const resp = await newsService.searchForStock(query, code)
  return {
    ok: resp.success,
    query: resp.query,
    provider: resp.provider,
    count: resp.results.length,
    results: resp.results,
    error: resp.error,
  }
})
