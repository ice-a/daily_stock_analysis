// GET /api/signals?limit=
// 决策信号列表 + 统计聚合
import { defineEventHandler, getQuery } from 'h3'
import { getDb, Collections } from '../utils/db'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const limit = Math.min(Number(q.limit) || 50, 200)

  const db = await getDb()

  const items = await db
    .collection(Collections.decisionSignal)
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()

  // 按股票聚合最新信号
  const byCode: Record<string, any> = {}
  for (const s of items as any[]) {
    if (!byCode[s.code]) {
      byCode[s.code] = {
        code: s.code,
        signal: s.signal,
        confidence: s.confidence,
        count: 1,
        latestAt: s.createdAt,
      }
    } else {
      byCode[s.code].count++
    }
  }

  // 信号分布
  const distribution = await db
    .collection(Collections.decisionSignal)
    .aggregate([
      { $group: { _id: '$signal', count: { $sum: 1 } } },
    ])
    .toArray()

  return {
    ok: true,
    total: await db.collection(Collections.decisionSignal).countDocuments(),
    distribution: distribution.map((d: any) => ({ signal: d._id, count: d.count })),
    byCode: Object.values(byCode),
    recent: items,
  }
})
