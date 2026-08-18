/**
 * LLM 分析服务。
 *
 * 对应原 Python src/analyzer.py (GeminiAnalyzer) + src/llm/*。
 * 通过 OpenAI 兼容接口调用（litellm / gemini / openai 均可，只要给 base_url + key）。
 *
 * 设计原则：
 *  - fail-open：无 key 时使用确定性占位分析，保证全链路可跑（与原项目 dry-run 语义一致）
 *  - 返回结构化结果（score / action / summary ...）供落库与前端展示
 */

import { loadConfig } from '../utils/config'

export interface AnalysisInput {
  code: string
  name?: string
  market?: string
  klines: { date: string; close: number; pctChg?: number; volume?: number }[]
  news?: unknown[]
  reportType: 'simple' | 'full' | 'brief'
}

export interface AnalysisResult {
  model: string
  score: number
  action: 'buy' | 'sell' | 'hold'
  summary: string
  strategy: string
  risk: string
  markdown: string
}

const SYSTEM_PROMPT = `你是一名专业的股票分析师。基于给定股票的近期行情与技术指标，
输出结构化分析：评分(0-100)、操作建议(buy/sell/hold)、摘要、策略、风险提示，并用 Markdown 组织。`

export class Analyzer {
  private cfg = loadConfig()

  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    const prompt = this.buildPrompt(input)

    const apiKey = this.cfg.geminiApiKey || this.cfg.openaiApiKey
    if (!apiKey) {
      return this.fallback(input)
    }

    try {
      const baseUrl = this.cfg.openaiBaseUrl || 'https://api.openai.com/v1'
      const model = this.cfg.openaiModel || 'gpt-4o-mini'
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
      })
      if (!resp.ok) throw new Error(`LLM http ${resp.status}`)
      const data = await resp.json()
      const text: string = data?.choices?.[0]?.message?.content ?? ''
      return this.parse(text, model)
    } catch (err) {
      console.warn('[analyzer] LLM call failed, using fallback:', err)
      return this.fallback(input)
    }
  }

  private buildPrompt(input: AnalysisInput): string {
    const recent = input.klines.slice(-10)
      .map((k) => `${k.date} 收盘 ${k.close} 涨跌 ${k.pctChg ?? '-'}%`)
      .join('\n')
    return `股票: ${input.code} ${input.name ?? ''} (${input.market ?? ''})
近期行情:\n${recent}
新闻/情报: ${JSON.stringify(input.news ?? []).slice(0, 500)}
请输出${input.reportType}分析报告。`
  }

  /** 解析 LLM 输出为结构化结果；解析失败时回退到文本全文 */
  private parse(text: string, model: string): AnalysisResult {
    const score = matchNumber(text, /评分[:：]?\s*(\d{1,3})/i) ?? 60
    const action = /(买入|buy)/i.test(text) ? 'buy'
      : /(卖出|sell)/i.test(text) ? 'sell' : 'hold'
    return {
      model,
      score: Math.min(100, Math.max(0, score)),
      action,
      summary: extractSection(text, '摘要') || text.slice(0, 200),
      strategy: extractSection(text, '策略') || '',
      risk: extractSection(text, '风险') || '',
      markdown: text,
    }
  }

  /** 无 key 时的确定性占位分析 */
  private fallback(input: AnalysisInput): AnalysisResult {
    const last = input.klines[input.klines.length - 1]
    const prev = input.klines[input.klines.length - 2]
    const up = last && prev ? last.close >= prev.close : true
    const score = 50 + (up ? 10 : -10)
    return {
      model: 'fallback-deterministic',
      score,
      action: up ? 'hold' : 'hold',
      summary: `（占位分析）${input.code} 近期${up ? '震荡偏强' : '震荡偏弱'}，暂无 LLM 配置，已生成骨架报告。`,
      strategy: '等待模型配置后生成完整策略。',
      risk: '本结果为离线占位，不构成投资建议。',
      markdown: `# ${input.code} 分析（占位）\n\n近期收盘: ${last?.close ?? '-'}\n\n> 未配置 LLM key，已生成确定性骨架报告。`,
    }
  }
}

function matchNumber(s: string, re: RegExp): number | null {
  const m = s.match(re)
  return m ? Number(m[1]) : null
}

function extractSection(text: string, key: string): string | null {
  const re = new RegExp(`${key}[:：]?\\s*([\\s\\S]*?)(?=\\n\\s*#|\\n\\s*\\d|$)`, 'i')
  const m = text.match(re)
  return m ? m[1].trim() : null
}
