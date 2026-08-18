/**
 * 分析流水线（对应原 Python src/core/pipeline.py 的 analyze_stock 单股流程）。
 *
 * 流程：解析代码 → 行情获取(fetcher) → 新闻检索(可选) → LLM 分析(analyzer)
 *       → 结构化结果 → 落库(analysis_history + decision_signal) → 返回。
 *
 * 与原项目一致：各可选服务 fail-open，主链路不中断。
 */

import { getDb, Collections, ensureIndexes } from '../utils/db'
import { FetcherManager } from './fetcher'
import { Analyzer } from './analyzer'
import { newsService, type SearchResult } from './news'
import type { AnalysisHistory, DecisionSignal } from '../models/schemas'
import { randomUUID } from 'node:crypto'

export interface AnalyzeOptions {
  code: string
  name?: string
  reportType?: 'simple' | 'full' | 'brief'
}

export interface AnalyzeOutcome {
  queryId: string
  history: AnalysisHistory
  signal?: DecisionSignal
}

export class AnalysisPipeline {
  private fetcher = new FetcherManager()
  private analyzer = new Analyzer()

  constructor() {
    // 首次实例化时确保索引存在（幂等）
    ensureIndexes().catch((e) => console.warn('[pipeline] ensureIndexes failed:', e))
  }

  /** 单股完整分析 + 落库 */
  async analyzeStock(opts: AnalyzeOptions): Promise<AnalyzeOutcome> {
    const code = opts.code.trim()
    const queryId = randomUUID()
    const reportType = opts.reportType ?? 'simple'

    // 1. 行情（近 60 日）
    const klines = await this.fetcher.getDailyKlines(code, 60)
    const quote = await this.fetcher.getQuote(code)

    // 2. 新闻/情报（fail-open：provider 不可用时返回空，不阻断主链路）
    let news: SearchResult[] = []
    let newsProvider = 'none'
    try {
      const resp = await newsService.searchForStock(quote?.name || opts.name || code, code)
      news = resp.results
      newsProvider = resp.provider
    } catch (err) {
      console.warn('[pipeline] news search failed, skip:', err)
    }

    // 3. LLM 分析
    const result = await this.analyzer.analyze({
      code,
      name: opts.name || quote?.name,
      market: detectMarket(code),
      klines: klines.map((k) => ({ date: k.date, close: k.close, pctChg: k.pctChg, volume: k.volume })),
      news,
      reportType,
    })

    // 4. 落库
    const db = await getDb()

    // 4a. 行情增量落库（stock_daily，按 code+date upsert）
    if (klines.length) {
      const ops = klines.map((k) => ({
        updateOne: {
          filter: { code: k.code, date: k.date },
          update: {
            $set: {
              code: k.code, date: k.date,
              open: k.open, high: k.high, low: k.low, close: k.close,
              volume: k.volume, amount: k.amount, pctChg: k.pctChg,
              dataSource: this.fetcher.activeProviders[0],
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      }))
      await db.collection(Collections.stockDaily).bulkWrite(ops, { ordered: false })
    }

    const history: AnalysisHistory = {
      queryId,
      code,
      name: opts.name || quote?.name,
      market: detectMarket(code),
      reportType,
      model: result.model,
      score: result.score,
      action: result.action,
      summary: result.summary,
      strategy: result.strategy,
      risk: result.risk,
      markdown: result.markdown,
      news,
      newsProvider,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await db.collection(Collections.analysisHistory).insertOne(history as any)

    // 5. 决策信号（从分析结果派生）
    const signal: DecisionSignal = {
      queryId,
      code,
      signal: result.action === 'buy' ? 'bullish' : result.action === 'sell' ? 'bearish' : 'neutral',
      confidence: result.score / 100,
      reason: result.summary,
      source: 'pipeline',
      createdAt: new Date(),
    }
    await db.collection(Collections.decisionSignal).insertOne(signal as any)

    return { queryId, history, signal }
  }

  /** 批量分析（对应原 pipeline.run，并发受 maxWorkers 限制） */
  async analyzeBatch(codes: string[], maxWorkers = 3): Promise<AnalyzeOutcome[]> {
    const results: AnalyzeOutcome[] = []
    for (let i = 0; i < codes.length; i += maxWorkers) {
      const chunk = codes.slice(i, i + maxWorkers)
      const chunkResults = await Promise.all(chunk.map((c) => this.analyzeStock({ code: c })))
      results.push(...chunkResults)
    }
    return results
  }
}

export function detectMarket(code: string): string {
  if (code.toLowerCase().startsWith('hk') || code.startsWith('0') && code.length <= 5) return 'hk'
  if (/^[a-z]+\./i.test(code) || /^\d{4}\./.test(code)) return 'jp' // 7203.T
  if (/^\d{6}$/.test(code)) return 'cn'
  if (/^[a-z]{1,5}$/i.test(code)) return 'us'
  return 'cn'
}
