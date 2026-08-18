// POST /api/analysis/analyze
// 触发单股/多股分析（同步返回结果，便于演示；生产可改为异步任务）
import { defineEventHandler, readBody, createError } from 'h3'
import { AnalysisPipeline } from '../../services/pipeline'
import { loadConfig } from '../../utils/config'

export default defineEventHandler(async (event) => {
  const cfg = loadConfig()
  const body = await readBody(event).catch(() => ({}))
  const codes: string[] = Array.isArray(body.codes)
    ? body.codes
    : body.code
      ? [body.code]
      : cfg.stockList

  if (!codes.length) {
    throw createError({ statusCode: 400, statusMessage: 'no stock codes provided' })
  }

  const reportType = body.reportType || 'simple'
  const pipeline = new AnalysisPipeline()
  try {
    const results = await pipeline.analyzeBatch(codes, 3)
    return {
      ok: true,
      count: results.length,
      queryIds: results.map((r) => r.queryId),
      items: results.map((r) => ({
        queryId: r.queryId,
        code: r.history.code,
        name: r.history.name,
        score: r.history.score,
        action: r.history.action,
        summary: r.history.summary,
      })),
    }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err?.message || 'analysis failed' })
  }
})
