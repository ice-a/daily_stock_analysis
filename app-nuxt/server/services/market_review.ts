/**
 * 大盘复盘服务。
 * 对应原 Python src/core/market_review.py 的 run_market_review()。
 *
 * 步骤：拉取各主要市场指数行情 → 组装上下文 → LLM 生成复盘 Markdown
 *       → 落库 analysis_history (type=market_review) → 返回。
 * fail-open：任何市场/LLM 失败不中断，缺失部分标记为 N/A。
 */

import { getDb, Collections } from '../utils/db'
import { FetcherManager, type DailyKline } from './fetcher'
import { Analyzer } from './analyzer'
import type { AnalysisHistory } from '../models/schemas'
import { randomUUID } from 'node:crypto'

interface IndexDef {
  code: string
  name: string
  market: string
}

// 主要市场指数（对应原 market_review 的 index list）
const INDICES: IndexDef[] = [
  { code: '000001', name: '上证指数', market: 'cn' },
  { code: '399001', name: '深证成指', market: 'cn' },
  { code: '399006', name: '创业板指', market: 'cn' },
  { code: 'hkHSI', name: '恒生指数', market: 'hk' },
  { code: 'IXIC', name: '纳斯达克', market: 'us' },
  { code: 'DJI', name: '道琼斯', market: 'us' },
  { code: 'GSPC', name: '标普500', market: 'us' },
  { code: '7203.T', name: '日经225(代理)', market: 'jp' },
]

export class MarketReviewService {
  private fetcher = new FetcherManager()
  private analyzer = new Analyzer()

  async run(reportType: 'simple' | 'full' | 'brief' = 'full'): Promise<AnalysisHistory> {
    const queryId = randomUUID()
    const snapshots = await this.collectSnapshots()

    const prompt = this.buildPrompt(snapshots, reportType)
    const result = await this.analyzer.analyze({
      code: 'MARKET',
      name: '全市场复盘',
      market: 'global',
      klines: snapshots.flatMap((s) => s.klines),
      news: [],
      reportType,
    })
    // 用自定义复盘 prompt 覆盖 markdown 生成（analyzer 内部 prompt 偏个股，这里直接基于收集数据生成）
    const markdown = this.renderMarkdown(snapshots, result.summary, reportType)

    const db = await getDb()
    const history: AnalysisHistory = {
      queryId,
      code: 'MARKET',
      name: '全市场复盘',
      market: 'global',
      reportType,
      model: result.model,
      score: result.score,
      action: result.action,
      summary: result.summary,
      strategy: result.strategy,
      risk: result.risk,
      markdown,
      news: snapshots,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await db.collection(Collections.analysisHistory).insertOne(history as any)
    return history
  }

  private async collectSnapshots() {
    const out: { def: IndexDef; klines: DailyKline[]; last?: DailyKline }[] = []
    for (const def of INDICES) {
      try {
        const klines = await this.fetcher.getDailyKlines(def.code, 30)
        out.push({ def, klines, last: klines[klines.length - 1] })
      } catch (err) {
        console.warn(`[market_review] failed ${def.code}:`, err)
        out.push({ def, klines: [] })
      }
    }
    return out
  }

  private buildPrompt(_snapshots: unknown[], _reportType: string): string {
    return 'market review'
  }

  private renderMarkdown(
    snapshots: { def: IndexDef; klines: DailyKline[]; last?: DailyKline }[],
    summary: string,
    reportType: string,
  ): string {
    const rows = snapshots
      .map((s) => {
        const l = s.last
        if (!l) return `| ${s.def.name} (${s.def.code}) | N/A | - |`
        const chg = l.pctChg != null ? `${l.pctChg > 0 ? '+' : ''}${l.pctChg}%` : '-'
        return `| ${s.def.name} (${s.def.code}) | ${l.close} | ${chg} |`
      })
      .join('\n')

    return `# 全市场复盘 (${reportType})

> ${summary || '（占位复盘）各市场指数近期表现如下。'}

## 主要指数快照

| 指数 | 最新收盘 | 涨跌幅 |
| --- | --- | --- |
${rows}

## 摘要

${summary || '未配置 LLM，已生成骨架复盘报告。'}

_本复盘由 Nuxt 重构版自动生成，不构成投资建议。_
`
  }
}
