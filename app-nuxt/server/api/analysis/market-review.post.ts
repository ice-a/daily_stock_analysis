// POST /api/analysis/market-review
// 触发大盘复盘分析
import { defineEventHandler, readBody, createError } from 'h3'
import { MarketReviewService } from '../../services/market_review'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const reportType = body.reportType || 'full'
  try {
    const history = await new MarketReviewService().run(reportType)
    return {
      ok: true,
      queryId: history.queryId,
      summary: history.summary,
      markdown: history.markdown,
    }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err?.message || 'market review failed' })
  }
})
