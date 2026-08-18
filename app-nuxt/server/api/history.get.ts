// GET /api/history?code=&limit=&skip=
// 历史分析报告列表
import { defineEventHandler, getQuery } from 'h3'
import { getDb, Collections } from '../utils/db'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const code = typeof q.code === 'string' ? q.code : undefined
  const limit = Math.min(Number(q.limit) || 20, 100)
  const skip = Number(q.skip) || 0

  const db = await getDb()
  const filter = code ? { code } : {}
  const cursor = db
    .collection(Collections.analysisHistory)
    .find(filter, { projection: { markdown: 0, rawOutput: 0, news: 0 } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)

  const items = await cursor.toArray() as Array<Record<string, any>>
  const total = await db.collection(Collections.analysisHistory).countDocuments(filter)

  return {
    ok: true,
    total,
    items: items.map((d) => ({
      queryId: d.queryId,
      code: d.code,
      name: d.name,
      market: d.market,
      reportType: d.reportType,
      score: d.score,
      action: d.action,
      summary: d.summary,
      createdAt: d.createdAt,
    })),
  }
})
