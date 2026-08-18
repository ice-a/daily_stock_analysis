/**
 * 行情数据获取服务。
 *
 * 对应原 Python data_provider/ 的多数据源适配 + fallback 机制。
 * 设计原则（与原项目一致，fail-open）：
 *  - 单一数据源失败不拖垮主流程
 *  - 数据源按优先级尝试，命中即用（按市场前缀路由 + token 可用性）
 *  - 所有 provider 用原生 fetch 调用公开 HTTP 接口，无重 SDK 依赖（Vercel 友好）
 *  - MockFetcher 作为最终兜底，保证无网络/无 key 时全链路仍可跑
 */

export interface DailyKline {
  code: string
  date: string // YYYY-MM-DD
  open: number
  high: number
  low: number
  close: number
  volume?: number
  amount?: number
  pctChg?: number
}

export interface Quote {
  code: string
  name?: string
  price: number
  pctChg?: number
}

export interface FetcherProvider {
  readonly name: string
  /** 返回是否支持该代码（按市场前缀判断 + token 可用性） */
  supports(code: string): boolean
  getDailyKlines(code: string, days: number): Promise<DailyKline[]>
  getQuote(code: string): Promise<Quote | null>
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------
function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff
  return h || 1
}

/** 标准化代码到各数据源所需格式 */
function toEastmoneyCode(code: string): string {
  // 600519 -> 1.600519 (沪) / 000001 -> 0.000001 (深)
  if (/^\d{6}$/.test(code)) {
    const prefix = code.startsWith('6') ? '1' : '0'
    return `${prefix}.${code}`
  }
  return code
}

function toYahooCode(code: string): string {
  // AAPL -> AAPL; hk00700 -> 0700.HK; 7203.T -> 7203.T
  if (code.toLowerCase().startsWith('hk')) {
    return `${code.slice(2).padStart(4, '0')}.HK`
  }
  return code.toUpperCase()
}

function marketOf(code: string): 'cn' | 'hk' | 'us' | 'jp' | 'other' {
  if (/^\d{6}$/.test(code)) return 'cn'
  if (code.toLowerCase().startsWith('hk')) return 'hk'
  if (/^\d{4}\./.test(code)) return 'jp'
  if (/^[a-z]{1,5}$/i.test(code)) return 'us'
  return 'other'
}

// ---------------------------------------------------------------------------
// 1) Tushare (A股, 需 TUSHARE_TOKEN)
// ---------------------------------------------------------------------------
class TushareProvider implements FetcherProvider {
  readonly name = 'Tushare'
  private token = process.env.TUSHARE_TOKEN

  supports(code: string): boolean {
    return !!this.token && marketOf(code) === 'cn'
  }

  private async post(api: string, params: Record<string, unknown>) {
    const r = await fetch('https://api.tushare.pro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_name: api, token: this.token, params, fields: '' }),
    })
    if (!r.ok) throw new Error(`tushare http ${r.status}`)
    const j = await r.json()
    if (j.code !== 0) throw new Error(j.msg || 'tushare error')
    return j.data
  }

  async getDailyKlines(code: string, days: number): Promise<DailyKline[]> {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days * 2) // 留出非交易日余量
    const d = await this.post('daily', {
      ts_code: `${code}.SH`.replace('SH', code.startsWith('6') ? 'SH' : 'SZ'),
      start_date: fmt(start),
      end_date: fmt(end),
    })
    return (d.items || []).map((row: any[]) => ({
      code,
      date: row[0],
      open: +row[2], high: +row[3], low: +row[4], close: +row[5],
      pctChg: +row[7], volume: +row[8], amount: +row[9],
    })).reverse()
  }

  async getQuote(code: string): Promise<Quote | null> {
    return null // Tushare 日线为主，实时行情交由 Eastmoney
  }
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

// ---------------------------------------------------------------------------
// 2) Eastmoney (A股, 无需 key)
// ---------------------------------------------------------------------------
class EastmoneyProvider implements FetcherProvider {
  readonly name = 'Eastmoney'
  supports(code: string): boolean {
    return marketOf(code) === 'cn'
  }

  async getDailyKlines(code: string, days: number): Promise<DailyKline[]> {
    const emCode = toEastmoneyCode(code)
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?fields1=f1f2f3&fields2=f51f52f53f54f55f56f57f58&klt=101&fqt=0&secid=${emCode}&end=20500101&lmt=${days}`
    const r = await fetch(url, { headers: { Referer: 'https://quote.eastmoney.com/' } })
    if (!r.ok) throw new Error(`eastmoney http ${r.status}`)
    const j = await r.json()
    const kl = j?.data?.klines || []
    return kl.map((line: string) => {
      const [date, open, close, high, low, volume, amount, pctChg] = line.split(',')
      return {
        code, date,
        open: +open, close: +close, high: +high, low: +low,
        volume: +volume, amount: +amount, pctChg: +pctChg,
      }
    })
  }

  async getQuote(code: string): Promise<Quote | null> {
    const emCode = toEastmoneyCode(code)
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${emCode}&fields=f43,f44,f45,f46,f57,f58,f170`
    const r = await fetch(url, { headers: { Referer: 'https://quote.eastmoney.com/' } })
    if (!r.ok) throw new Error(`eastmoney quote http ${r.status}`)
    const j = await r.json()
    const d = j?.data
    if (!d) return null
    return {
      code,
      name: d.f58,
      price: +d.f43 / 100,
      pctChg: d.f170 != null ? +d.f170 / 100 : undefined,
    }
  }
}

// ---------------------------------------------------------------------------
// 3) Yahoo Finance (美股/港股/日股, 无需 key)
// ---------------------------------------------------------------------------
class YahooProvider implements FetcherProvider {
  readonly name = 'Yahoo'
  supports(code: string): boolean {
    const m = marketOf(code)
    return m === 'us' || m === 'hk' || m === 'jp'
  }

  async getDailyKlines(code: string, days: number): Promise<DailyKline[]> {
    const sym = toYahooCode(code)
    const period1 = Math.floor(Date.now() / 1000) - days * 2 * 86400
    const period2 = Math.floor(Date.now() / 1000)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${period1}&period2=${period2}&interval=1d`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) throw new Error(`yahoo http ${r.status}`)
    const j = await r.json()
    const result = j?.chart?.result?.[0]
    const quotes = result?.indicators?.quote?.[0]
    const timestamps: number[] = result?.timestamp || []
    const out: DailyKline[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const close = quotes.close[i]
      if (close == null) continue
      out.push({
        code,
        date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        open: quotes.open[i], high: quotes.high[i], low: quotes.low[i], close,
        volume: quotes.volume?.[i],
      })
    }
    return out.slice(-days)
  }

  async getQuote(code: string): Promise<Quote | null> {
    const sym = toYahooCode(code)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!r.ok) return null
    const j = await r.json()
    const meta = j?.chart?.result?.[0]?.meta
    if (!meta) return null
    return {
      code,
      name: meta.shortName || sym,
      price: meta.regularMarketPrice,
      pctChg: meta.regularMarketChangePercent,
    }
  }
}

// ---------------------------------------------------------------------------
// 4) Mock (兜底, 无需网络/key)
// ---------------------------------------------------------------------------
class MockFetcher implements FetcherProvider {
  readonly name = 'Mock'

  supports(_code: string): boolean {
    return true
  }

  async getDailyKlines(code: string, days: number): Promise<DailyKline[]> {
    const out: DailyKline[] = []
    let seed = hashCode(code)
    let price = 50 + (seed % 100)
    const today = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const change = ((seed % 1000) / 1000 - 0.5) * 0.06
      const open = price
      const close = +(price * (1 + change)).toFixed(2)
      const high = +(Math.max(open, close) * (1 + (seed % 100) / 10000)).toFixed(2)
      const low = +(Math.min(open, close) * (1 - (seed % 100) / 10000)).toFixed(2)
      out.push({
        code, date: d.toISOString().slice(0, 10),
        open: +open.toFixed(2), high, low, close,
        volume: seed % 1000000, amount: close * (seed % 1000000),
        pctChg: +((change) * 100).toFixed(2),
      })
      price = close
    }
    return out
  }

  async getQuote(code: string): Promise<Quote | null> {
    const klines = await this.getDailyKlines(code, 1)
    const last = klines[klines.length - 1]
    return last ? { code, name: code, price: last.close, pctChg: last.pctChg } : null
  }
}

// ---------------------------------------------------------------------------
// 管理器：按优先级 + 市场路由 + fallback
// ---------------------------------------------------------------------------
export class FetcherManager {
  private providers: FetcherProvider[] = []

  constructor() {
    // 优先级：Tushare(A股+token) > Eastmoney(A股) > Yahoo(美股/港股/日股) > Mock(兜底)
    this.providers.push(new TushareProvider())
    this.providers.push(new EastmoneyProvider())
    this.providers.push(new YahooProvider())
    this.providers.push(new MockFetcher())
  }

  register(provider: FetcherProvider, prepend = false) {
    if (prepend) this.providers.unshift(provider)
    else this.providers.push(provider)
  }

  get activeProviders(): string[] {
    return this.providers.map((p) => p.name)
  }

  private resolve(code: string): FetcherProvider {
    return this.providers.find((p) => p.supports(code)) ?? this.providers[this.providers.length - 1]
  }

  async getDailyKlines(code: string, days = 30): Promise<DailyKline[]> {
    try {
      return await this.resolve(code).getDailyKlines(code, days)
    } catch (err) {
      console.warn(`[fetcher] getDailyKlines failed for ${code}, fallback to Mock:`, err)
      return new MockFetcher().getDailyKlines(code, days)
    }
  }

  async getQuote(code: string): Promise<Quote | null> {
    try {
      return await this.resolve(code).getQuote(code)
    } catch (err) {
      console.warn(`[fetcher] getQuote failed for ${code}:`, err)
      return null
    }
  }
}
