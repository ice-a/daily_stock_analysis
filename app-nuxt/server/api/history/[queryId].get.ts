// GET /api/history/:queryId
// 单份分析报告的完整 Markdown 与结构化字段
import { defineEventHandler, createError } from 'h3'
import { getDb, Collections } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const queryId = event.context.params?.queryId
  if (!queryId) throw createError({ statusCode: 400, statusMessage: 'missing queryId' })

  const db = await getDb()
  const doc = await db.collection(Collections.analysisHistory).findOne({ queryId })
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'not found' })

  return {
    ok: true,
    report: {
      queryId: doc.queryId,
      code: doc.code,
      name: doc.name,
      market: doc.market,
      reportType: doc.reportType,
      model: doc.model,
      score: doc.score,
      action: doc.action,
      summary: doc.summary,
      strategy: doc.strategy,
      risk: doc.risk,
      markdown: doc.markdown,
      createdAt: doc.createdAt,
    },
  }
})
