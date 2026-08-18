import { MongoClient, Db, type MongoClientOptions } from 'mongodb'

/**
 * MongoDB 连接管理（单例）。
 *
 * Vercel / Cloudflare 等 Serverless 环境下，每次冷启动都会新建连接。
 * 通过 globalThis 缓存 client + db，避免函数重复调用时建立过多连接。
 */
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const MONGODB_DB = process.env.MONGODB_DB || 'daily_stock_analysis'

const options: MongoClientOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
}

interface MongoCache {
  client: MongoClient | null
  db: Db | null
  promise: Promise<{ client: MongoClient; db: Db }> | null
}

// 在 globalThis 上缓存，跨 serverless 调用复用
const globalForMongo = globalThis as unknown as { __mongo?: MongoCache }
const cache: MongoCache = globalForMongo.__mongo ?? { client: null, db: null, promise: null }
if (!globalForMongo.__mongo) globalForMongo.__mongo = cache

export async function getDb(): Promise<Db> {
  if (cache.db) return cache.db

  if (!cache.promise) {
    const client = new MongoClient(MONGODB_URI, options)
    cache.promise = client.connect().then((c) => ({ client: c, db: c.db(MONGODB_DB) }))
  }

  const { client, db } = await cache.promise
  cache.client = client
  cache.db = db
  return db
}

export async function getClient(): Promise<MongoClient> {
  const db = await getDb()
  return (db as unknown as { client?: MongoClient }).client
    ?? (await getDb(), cache.client!)
}

/**
 * 确保关键集合存在索引（幂等，应用启动/首次写库时调用一次）。
 * 避免全表扫描，对应原 SQLAlchemy 的索引定义。
 */
export async function ensureIndexes(): Promise<void> {
  const db = await getDb()
  await db.collection(Collections.analysisHistory).createIndex({ code: 1, createdAt: -1 })
  await db.collection(Collections.analysisHistory).createIndex({ queryId: 1 }, { unique: true })
  await db.collection(Collections.stockDaily).createIndex({ code: 1, date: -1 }, { unique: true })
  await db.collection(Collections.decisionSignal).createIndex({ code: 1, createdAt: -1 })
  await db.collection(Collections.task).createIndex({ taskId: 1 }, { unique: true })
}

/** 集合名常量（对应原 SQLAlchemy 表，迁移为 MongoDB collection） */
export const Collections = {
  schemaMigrations: 'schema_migrations',
  stockDaily: 'stock_daily',
  fundamentalSnapshot: 'fundamental_snapshot',
  newsIntel: 'news_intel',
  analysisHistory: 'analysis_history',
  analysisRunFlow: 'analysis_run_flow',
  portfolio: 'portfolio',
  portfolioTransaction: 'portfolio_transaction',
  portfolioCashflow: 'portfolio_cashflow',
  decisionSignal: 'decision_signal',
  decisionSignalOutcome: 'decision_signal_outcome',
  backtest: 'backtest',
  intelligence: 'intelligence',
  alert: 'alert',
  alertRule: 'alert_rule',
  alertTrigger: 'alert_trigger',
  screeningRun: 'screening_run',
  task: 'task',
  systemConfig: 'system_config',
  usage: 'usage',
  skillOpinion: 'skill_opinion',
} as const

export type CollectionName = (typeof Collections)[keyof typeof Collections]
