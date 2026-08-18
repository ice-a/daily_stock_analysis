// GET /api/health
import { defineEventHandler } from 'h3'

export default defineEventHandler(async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})
