import { z } from 'zod'

/**
 * MongoDB 文档 Schema 定义（Zod）。
 * 对应原 Python src/storage.py 中的 SQLAlchemy 表。
 * 迁移策略：原 JSON 字符串字段（payload/source_chain 等）改为嵌套文档。
 */

// ---------- 行情日线 (stock_daily) ----------
export const StockDailySchema = z.object({
  _id: z.any().optional(),
  code: z.string(),
  date: z.string(), // YYYY-MM-DD
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().optional(),
  amount: z.number().optional(),
  pctChg: z.number().optional(),
  ma5: z.number().optional(),
  ma10: z.number().optional(),
  ma20: z.number().optional(),
  volumeRatio: z.number().optional(),
  dataSource: z.string().optional(),
  createdAt: z.date().optional(),
})
export type StockDaily = z.infer<typeof StockDailySchema>

// ---------- 分析历史 (analysis_history) ----------
export const ReportTypeSchema = z.enum(['simple', 'full', 'brief'])
export type ReportType = z.infer<typeof ReportTypeSchema>

export const AnalysisHistorySchema = z.object({
  _id: z.any().optional(),
  queryId: z.string(),
  code: z.string(),
  name: z.string().optional(),
  market: z.string().optional(), // cn/hk/us/jp/kr
  reportType: ReportTypeSchema.default('simple'),
  model: z.string().optional(),
  // 结构化结果（原 JSON 字符串 → 嵌套文档）
  score: z.number().optional(),
  action: z.string().optional(), // buy/sell/hold
  summary: z.string().optional(),
  strategy: z.string().optional(),
  risk: z.string().optional(),
  // Markdown 全文
  markdown: z.string().optional(),
  // 原始 LLM 输出片段
  rawOutput: z.string().optional(),
  // 新闻/情报引用
  news: z.array(z.any()).optional(),
  // 新闻来源 provider（tavily/bocha/serpapi/brave/none）
  newsProvider: z.string().optional(),
  // 技术指标快照
  indicators: z.record(z.any()).optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().optional(),
})
export type AnalysisHistory = z.infer<typeof AnalysisHistorySchema>

// ---------- 决策信号 (decision_signal) ----------
export const DecisionSignalSchema = z.object({
  _id: z.any().optional(),
  queryId: z.string(),
  code: z.string(),
  signal: z.string(), // bullish/bearish/neutral
  confidence: z.number().optional(),
  reason: z.string().optional(),
  source: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
})
export type DecisionSignal = z.infer<typeof DecisionSignalSchema>

// ---------- 回测 (backtest) ----------
export const BacktestSchema = z.object({
  _id: z.any().optional(),
  strategy: z.string(),
  code: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  initialCapital: z.number(),
  finalCapital: z.number().optional(),
  totalReturn: z.number().optional(),
  trades: z.array(z.any()).optional(),
  metrics: z.record(z.any()).optional(),
  createdAt: z.date().default(() => new Date()),
})
export type Backtest = z.infer<typeof BacktestSchema>

// ---------- 任务 (task) —— 异步分析任务 ----------
export const TaskStatusSchema = z.enum(['pending', 'running', 'completed', 'failed'])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const TaskSchema = z.object({
  _id: z.any().optional(),
  taskId: z.string(),
  type: z.string(), // single_stock / market_review
  code: z.string().optional(),
  status: TaskStatusSchema.default('pending'),
  progress: z.number().default(0),
  message: z.string().optional(),
  queryId: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().optional(),
})
export type Task = z.infer<typeof TaskSchema>

// ---------- 系统配置 (system_config) ----------
export const SystemConfigSchema = z.object({
  _id: z.any().optional(),
  key: z.string(),
  value: z.any(),
  updatedAt: z.date().default(() => new Date()),
})
export type SystemConfig = z.infer<typeof SystemConfigSchema>
