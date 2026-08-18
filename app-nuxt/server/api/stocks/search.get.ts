// GET /api/stocks/search?q=
// 股票代码/名称自动补全（对应原 stocks.index.json 静态索引）。
import { defineEventHandler, getQuery, createError } from 'h3'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const keyword = typeof q.q === 'string' ? q.q.trim().toLowerCase() : ''
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const data = JSON.parse(readFileSync(join(here, '../../data/stocks.index.json'), 'utf-8'))
    if (!keyword) return { ok: true, items: data.slice(0, 20) }
    const items = data.filter(
      (s: any) => s.code.toLowerCase().includes(keyword) || s.name.toLowerCase().includes(keyword),
    ).slice(0, 20)
    return { ok: true, items }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: 'index load failed' })
  }
})
