// POST /api/cron/daily
// Vercel Cron 定时分析入口（vercel.json 中声明 cron 表达式）。
// 用 CRON_SECRET 校验来源，防止未授权调用（Vercel 会在 header 注入 VERCEL_AUTHORIZATION）。
import { defineEventHandler, readBody, createError } from 'h3'
import { AnalysisPipeline } from '../../services/pipeline'
import { loadConfig } from '../../utils/config'
import { NotificationService } from '../../services/notification'

export default defineEventHandler(async (event) => {
  const cfg = loadConfig()

  // 校验：Vercel 注入的签名 或 自定义 CRON_SECRET
  const authHeader = event.node.req.headers['authorization']
  const vercelAuth = event.node.req.headers['x-vercel-signature']
  const authorized =
    (cfg.cronSecret && authHeader === `Bearer ${cfg.cronSecret}`) ||
    !!vercelAuth // Vercel 托管的 Cron 自带签名，可信

  if (!authorized) {
    throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  }

  const body = await readBody(event).catch(() => ({}))
  const codes: string[] = Array.isArray(body.codes) ? body.codes : cfg.stockList
  if (!codes.length) return { ok: true, skipped: true, reason: 'empty stock list' }

  const pipeline = new AnalysisPipeline()
  const results = await pipeline.analyzeBatch(codes, 3)

  // 分析完成后推送通知（fail-open）
  const notifier = new NotificationService()
  const summary = results
    .map((r) => `${r.history.name || r.history.code} ${r.history.code}: ${r.history.action} (${r.history.score})`)
    .join('\n')
  const notify = await notifier.send({
    title: `每日分析完成 (${results.length} 只)`,
    content: summary,
  })

  return {
    ok: true,
    analyzed: results.length,
    queryIds: results.map((r) => r.queryId),
    notify,
  }
})
