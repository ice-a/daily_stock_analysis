/**
 * 回测引擎（简化版）。
 * 对应原 Python src/core/backtest_engine.py 的核心思路：
 *   输入策略(均线交叉) + 标的 + 区间 → 在历史行情上撮合 → 输出收益/交易/指标。
 *
 * 当前实现：双均线(MA short/long) 金叉买入、死叉卖出，计算总收益与交易次数。
 * 真实行情通过 FetcherManager 获取（接入同数据源体系）。
 */

import { getDb, Collections } from '../utils/db'
import { FetcherManager } from './fetcher'
import type { Backtest } from '../models/schemas'
import { randomUUID } from 'node:crypto'

export interface BacktestOptions {
  code: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  initialCapital?: number
  shortPeriod?: number
  longPeriod?: number
}

function sma(values: number[], period: number, i: number): number | null {
  if (i < period - 1) return null
  let sum = 0
  for (let j = i - period + 1; j <= i; j++) sum += values[j]
  return sum / period
}

export async function runBacktest(opts: BacktestOptions): Promise<Backtest> {
  const fetcher = new FetcherManager()
  const klines = await fetcher.getDailyKlines(opts.code, 250)
  const closes = klines.map((k) => k.close)
  const shortP = opts.shortPeriod ?? 5
  const longP = opts.longPeriod ?? 20
  const initial = opts.initialCapital ?? 100000

  let cash = initial
  let shares = 0
  let position = false
  const trades: any[] = []

  for (let i = 0; i < closes.length; i++) {
    const s = sma(closes, shortP, i)
    const l = sma(closes, longP, i)
    if (s == null || l == null) continue
    const price = closes[i]
    if (!position && s > l) {
      shares = cash / price
      cash = 0
      position = true
      trades.push({ date: klines[i].date, action: 'BUY', price })
    } else if (position && s < l) {
      cash = shares * price
      trades.push({ date: klines[i].date, action: 'SELL', price, pnl: cash - initial })
      shares = 0
      position = false
    }
  }
  // 清仓估值
  const finalCapital = position ? shares * closes[closes.length - 1] : cash
  const totalReturn = (finalCapital - initial) / initial

  const db = await getDb()
  const doc: Backtest = {
    _id: undefined,
    strategy: `MA${shortP}_MA${longP}`,
    code: opts.code,
    startDate: opts.startDate,
    endDate: opts.endDate,
    initialCapital: initial,
    finalCapital: +finalCapital.toFixed(2),
    totalReturn: +totalReturn.toFixed(4),
    trades,
    metrics: {
      tradeCount: trades.length,
      winRate: trades.filter((t) => t.pnl != null && t.pnl > 0).length / Math.max(1, trades.filter((t) => t.action === 'SELL').length),
    },
    createdAt: new Date(),
  }
  await db.collection(Collections.backtest).insertOne(doc as any)

  return doc
}
