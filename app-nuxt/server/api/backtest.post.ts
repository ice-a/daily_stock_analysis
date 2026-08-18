// POST /api/backtest
import { defineEventHandler, readBody, createError } from 'h3'
import { runBacktest } from '../services/backtest'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  if (!body.code || !body.startDate || !body.endDate) {
    throw createError({ statusCode: 400, statusMessage: 'code/startDate/endDate required' })
  }
  try {
    const result = await runBacktest({
      code: body.code,
      startDate: body.startDate,
      endDate: body.endDate,
      initialCapital: Number(body.initialCapital) || 100000,
      shortPeriod: Number(body.shortPeriod) || 5,
      longPeriod: Number(body.longPeriod) || 20,
    })
    return { ok: true, result }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err?.message || 'backtest failed' })
  }
})
