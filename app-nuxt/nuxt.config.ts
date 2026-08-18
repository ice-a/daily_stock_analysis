// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // SSR by default — 前后端不分离
  ssr: true,

  // Runtime target: Vercel (or Node server). Nitro auto-detects Vercel preset.
  nitro: {
    // Vercel Cron is declared in vercel.json (or via vercel cron UI).
    // Keep preset auto-detected so the same code runs locally, on Vercel, and on Node.
    logLevel: 3,
  },

  // Tailwind CSS
  css: ['~/assets/css/main.css'],

  // Global page transition
  app: {
    head: {
      title: 'Daily Stock Analysis',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'AI-powered daily stock analysis (Nuxt + MongoDB)' },
      ],
    },
  },

  // Runtime config exposes env vars to both server and client safely.
  // Server-only secrets stay on the server (useRuntimeConfig().<key> in server/).
  runtimeConfig: {
    // Private (server-only) — never exposed to client unless prefixed with public
    mongodbUri: process.env.MONGODB_URI,
    mongodbDb: process.env.MONGODB_DB,
    geminiApiKey: process.env.GEMINI_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    generationBackend: process.env.GENERATION_BACKEND || 'litellm',
    adminAuthEnabled: processEnvBoolean(process.env.ADMIN_AUTH_ENABLED),
    adminPassword: process.env.ADMIN_PASSWORD,
    cronSecret: process.env.CRON_SECRET,
    // Notification (optional)
    wechatWebhookUrl: process.env.WECHAT_WEBHOOK_URL,
    feishuWebhookUrl: process.env.FEISHU_WEBHOOK_URL,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    tavilyApiKeys: (process.env.TAVILY_API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean),
    serpapiApiKeys: (process.env.SERPAPI_API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean),
    bochaApiKeys: (process.env.BOCHA_API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean),
    braveApiKeys: (process.env.BRAVE_API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean),
    newsProviderOrder: (process.env.NEWS_PROVIDER_ORDER || 'tavily,bocha,serpapi,brave').split(',').map(s => s.trim()).filter(Boolean),
    // Public (safe to expose to browser)
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'Daily Stock Analysis',
      reportLanguage: process.env.NUXT_PUBLIC_REPORT_LANGUAGE || 'zh',
    },
  },

  compatibilityDate: '2025-01-01',
})

function processEnvBoolean(v: string | undefined): boolean {
  if (!v) return false
  return v.toLowerCase() === 'true' || v === '1' || v.toLowerCase() === 'yes'
}
