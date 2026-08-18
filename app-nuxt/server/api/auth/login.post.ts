// POST /api/auth/login  { password }
// 对应原 Python 登录接口。校验 ADMIN_PASSWORD 后下发 cookie。
import { defineEventHandler, readBody, createError } from 'h3'
import { loadConfig } from '../../utils/config'

export default defineEventHandler(async (event) => {
  const cfg = loadConfig()
  if (!cfg.adminAuthEnabled) {
    return { ok: true, enabled: false }
  }
  const body = await readBody(event).catch(() => ({}))
  if (body.password !== cfg.adminPassword) {
    throw createError({ statusCode: 401, statusMessage: 'invalid password' })
  }
  // 下发 cookie（httpOnly）
  event.node.res.setHeader('Set-Cookie', 'dsa_auth=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400')
  return { ok: true, enabled: true }
})
