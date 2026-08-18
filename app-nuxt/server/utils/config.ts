/**
 * 类型化运行时配置。统一从 Nuxt runtimeConfig 读取，避免散落 process.env。
 * server/ 内使用 useRuntimeConfig() 获取（注入后的最终值）。
 */
import { useRuntimeConfig } from 'nitropack/runtime'

export interface AppConfig {
  mongodbUri: string
  mongodbDb: string
  stockList: string[]
  generationBackend: 'litellm' | 'gemini' | 'openai'
  geminiApiKey?: string
  openaiApiKey?: string
  openaiBaseUrl?: string
  openaiModel?: string
  adminAuthEnabled: boolean
  adminPassword?: string
  cronSecret?: string
  wechatWebhookUrl?: string
  feishuWebhookUrl?: string
  telegramBotToken?: string
  telegramChatId?: string
  // 新闻/情报检索 provider key（对齐原项目 .env 命名，支持逗号分隔多个）
  tavilyApiKeys?: string[]
  serpapiApiKeys?: string[]
  bochaApiKeys?: string[]
  braveApiKeys?: string[]
  newsProviderOrder?: string[]
  reportLanguage: 'zh' | 'en' | 'ko'
  logLevel: string
  scheduleTime: string
}

function splitList(v: string | undefined): string[] {
  if (!v) return []
  return v.split(',').map((s) => s.trim()).filter(Boolean)
}

export function loadConfig(): AppConfig {
  const rc = useRuntimeConfig()
  return {
    mongodbUri: (rc.mongodbUri as string) || 'mongodb://127.0.0.1:27017',
    mongodbDb: (rc.mongodbDb as string) || 'daily_stock_analysis',
    stockList: splitList(process.env.STOCK_LIST),
    generationBackend: (rc.generationBackend as AppConfig['generationBackend']) || 'litellm',
    geminiApiKey: rc.geminiApiKey as string | undefined,
    openaiApiKey: rc.openaiApiKey as string | undefined,
    openaiBaseUrl: rc.openaiBaseUrl as string | undefined,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    adminAuthEnabled: rc.adminAuthEnabled as boolean,
    adminPassword: rc.adminPassword as string | undefined,
    cronSecret: rc.cronSecret as string | undefined,
    wechatWebhookUrl: rc.wechatWebhookUrl as string | undefined,
    feishuWebhookUrl: rc.feishuWebhookUrl as string | undefined,
    telegramBotToken: rc.telegramBotToken as string | undefined,
    telegramChatId: rc.telegramChatId as string | undefined,
    tavilyApiKeys: splitList(process.env.TAVILY_API_KEYS),
    serpapiApiKeys: splitList(process.env.SERPAPI_API_KEYS),
    bochaApiKeys: splitList(process.env.BOCHA_API_KEYS),
    braveApiKeys: splitList(process.env.BRAVE_API_KEYS),
    newsProviderOrder: splitList(process.env.NEWS_PROVIDER_ORDER) || ['tavily', 'bocha', 'serpapi', 'brave'],
    reportLanguage: (process.env.NUXT_PUBLIC_REPORT_LANGUAGE as AppConfig['reportLanguage']) || 'zh',
    logLevel: process.env.LOG_LEVEL || 'info',
    scheduleTime: process.env.SCHEDULE_TIME || '18:00',
  }
}
