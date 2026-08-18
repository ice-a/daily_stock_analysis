// POST /api/agent/stream  (SSE)
// 基于分析历史 + LLM 的流式问答（对应原 bot/agent + SSE 任务流）。
import { defineEventHandler, readBody } from 'h3'
import { getDb, Collections } from '../../utils/db'
import { loadConfig } from '../../utils/config'

export default defineEventHandler(async (event) => {
  const cfg = loadConfig()
  const body = await readBody(event).catch(() => ({}))
  const question = typeof body.question === 'string' ? body.question : ''
  const code = typeof body.code === 'string' ? body.code : undefined

  // 设置 SSE 头
  const res = event.node.res
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // 取最近分析报告作为上下文
  const db = await getDb()
  const recent = await db
    .collection(Collections.analysisHistory)
    .find(code ? { code } : {}, { projection: { markdown: 1, code: 1, name: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray()

  send({ type: 'context', reports: recent.map((r) => ({ code: r.code, name: r.name, createdAt: r.createdAt })) })

  const apiKey = cfg.geminiApiKey || cfg.openaiApiKey
  if (!apiKey) {
    send({ type: 'token', content: '（未配置 LLM key，返回离线提示）可配置 GEMINI_API_KEY / OPENAI_API_KEY 后获得流式回答。' })
    send({ type: 'done' })
    res.end()
    return
  }

  try {
    const context = recent.map((r) => r.markdown || '').join('\n---\n').slice(0, 4000)
    const baseUrl = cfg.openaiBaseUrl || 'https://api.openai.com/v1'
    const model = cfg.openaiModel || 'gpt-4o-mini'
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: 'system', content: '你是股票分析助手，基于已有分析报告回答用户问题。' },
          { role: 'user', content: `参考分析报告:\n${context}\n\n问题: ${question}` },
        ],
      }),
    })
    if (!r.ok || !r.body) throw new Error(`llm http ${r.status}`)

    const reader = r.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        const t = line.trim()
        if (!t.startsWith('data:') || t === 'data: [DONE]') continue
        try {
          const json = JSON.parse(t.slice(5).trim())
          const token = json.choices?.[0]?.delta?.content
          if (token) send({ type: 'token', content: token })
        } catch { /* ignore */ }
      }
    }
    send({ type: 'done' })
  } catch (err: any) {
    send({ type: 'error', message: err?.message || 'stream failed' })
  } finally {
    res.end()
  }
})
