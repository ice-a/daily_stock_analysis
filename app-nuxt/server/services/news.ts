import { loadConfig, type AppConfig } from '../utils/config'

export interface SearchResult {
  title: string
  snippet: string
  url: string
  source?: string
  publishedDate?: string
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  provider: string
  success: boolean
  error?: string
}

interface ProviderKeyMap {
  tavily: keyof Pick<AppConfig, 'tavilyApiKeys'>
  serpapi: keyof Pick<AppConfig, 'serpapiApiKeys'>
  bocha: keyof Pick<AppConfig, 'bochaApiKeys'>
  brave: keyof Pick<AppConfig, 'braveApiKeys'>
}

const PROVIDER_KEYS: ProviderKeyMap = {
  tavily: 'tavilyApiKeys',
  serpapi: 'serpapiApiKeys',
  bocha: 'bochaApiKeys',
  brave: 'braveApiKeys',
}

const EMPTY: SearchResult[] = []

async function postJson(url: string, body: any, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return res.json()
}

function normalizeDate(value: any): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return isNaN(d.getTime()) ? String(value) : d.toISOString()
}

async function tavilySearch(query: string, apiKey: string): Promise<SearchResult[]> {
  const data = await postJson(
    'https://api.tavily.com/search',
    { api_key: apiKey, query, max_results: 8, search_depth: 'basic', topic: 'news' },
    { Authorization: `Bearer ${apiKey}` },
  )
  const raw: any[] = data?.results || []
  return raw.map((r) => ({
    title: r.title || '',
    snippet: r.content || r.snippet || '',
    url: r.url || '',
    source: r.source || undefined,
    publishedDate: normalizeDate(r.published_date),
  }))
}

async function bochaSearch(query: string, apiKey: string): Promise<SearchResult[]> {
  const data = await postJson(
    'https://api.bochaai.com/v1/web-search',
    { query, freshness: 'week', summary: true, count: 8 },
    { Authorization: `Bearer ${apiKey}` },
  )
  const raw: any[] = data?.data?.webPages?.value || []
  return raw.map((r) => ({
    title: r.name || '',
    snippet: r.snippet || r.summary || '',
    url: r.url || '',
    source: r.siteName || undefined,
    publishedDate: normalizeDate(r.dateLastCrawled || r.datePublished),
  }))
}

async function serpapiSearch(query: string, apiKey: string): Promise<SearchResult[]> {
  const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(query)}&api_key=${apiKey}&hl=zh-cn&gl=cn`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const raw: any[] = data?.news_results || data?.organic_results || []
  return raw
    .map((r: any) => {
      const link = r.link || r.link?.link || ''
      const title = r.title || r.story || ''
      const snippet = r.snippet || r.source?.snippet || (typeof r.link === 'object' ? r.link.snippet : '')
      return {
        title,
        snippet: snippet || '',
        url: link,
        source: r.source || r.source_name || undefined,
        publishedDate: normalizeDate(r.date || r.published_datetime || r.timestamp),
      }
    })
    .filter((r: SearchResult) => r.url)
}

async function braveSearch(query: string, apiKey: string): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(query)}&count=8&freshness=pw`
  const data = await postJson(url, {}, { Accept: 'application/json', 'X-Subscription-Token': apiKey })
  const raw: any[] = data?.results || []
  return raw.map((r) => ({
    title: r.title || '',
    snippet: r.description || '',
    url: r.url || '',
    source: r.meta_url?.hostname || undefined,
    publishedDate: normalizeDate(r.age || r.page_age),
  }))
}

const FETCHERS: Record<string, (q: string, key: string) => Promise<SearchResult[]>> = {
  tavily: tavilySearch,
  bocha: bochaSearch,
  serpapi: serpapiSearch,
  brave: braveSearch,
}

function pickKey(cfg: AppConfig, provider: string): string | undefined {
  const field = PROVIDER_KEYS[provider as keyof ProviderKeyMap]
  const keys = field ? (cfg[field] as string[] | undefined) : undefined
  return keys && keys.length ? keys[0] : undefined
}

export class NewsService {
  /**
   * 检索与个股相关的新闻/情报。
   * 多 provider 按顺序 fallback；全部失败时 fail-open 返回空结果（不阻断主分析链路）。
   */
  async searchForStock(stockName: string, stockCode: string, additionalKeywords: string[] = []): Promise<SearchResponse> {
    const cfg = loadConfig()
    const terms = [stockName, stockCode, ...additionalKeywords].filter(Boolean)
    const query = terms.join(' ')
    const providers = (cfg.newsProviderOrder || ['tavily', 'bocha', 'serpapi', 'brave']).filter((p) => FETCHERS[p])

    for (const provider of providers) {
      const apiKey = pickKey(cfg, provider)
      if (!apiKey) continue
      try {
        const results = await FETCHERS[provider](query, apiKey)
        return { query, results: results.slice(0, 8), provider, success: true }
      } catch (err: any) {
        console.warn(`[news] provider ${provider} failed: ${err?.message || err}`)
      }
    }
    return { query, results: EMPTY, provider: 'none', success: false, error: 'no available news provider or all failed' }
  }
}

export const newsService = new NewsService()
