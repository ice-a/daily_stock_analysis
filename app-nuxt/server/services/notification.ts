/**
 * 通知服务。
 * 对应原 Python src/notification.py (NotificationService)。
 *
 * 支持渠道（至少配置一个即生效，fail-open：单个渠道失败不影响其他渠道和分析主流程）：
 *  - 企业微信 (WECHAT_WEBHOOK_URL)
 *  - 飞书     (FEISHU_WEBHOOK_URL)
 *  - Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
 *  - 邮件     (SMTP_*) —— 后续接入，先占位
 */

import { loadConfig } from '../utils/config'

export interface NotifyPayload {
  title: string
  content: string // Markdown 文本
  // 可选：附加链接（如 Vercel 部署的报告 URL）
  url?: string
}

export class NotificationService {
  private cfg = loadConfig()

  /** 发送通知到所有已配置的渠道 */
  async send(payload: NotifyPayload): Promise<{ channel: string; ok: boolean; error?: string }[]> {
    const tasks: Promise<{ channel: string; ok: boolean; error?: string }>[] = []

    if (this.cfg.wechatWebhookUrl) tasks.push(this.toWechat(payload))
    if (this.cfg.feishuWebhookUrl) tasks.push(this.toFeishu(payload))
    if (this.cfg.telegramBotToken && this.cfg.telegramChatId) tasks.push(this.toTelegram(payload))

    if (!tasks.length) return [{ channel: 'none', ok: true }]
    return Promise.all(tasks)
  }

  private async postJson(url: string, body: unknown): Promise<void> {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(`http ${r.status}`)
  }

  private async toWechat(p: NotifyPayload) {
    try {
      const md = `## ${p.title}\n${p.content}${p.url ? `\n\n[查看报告](${p.url})` : ''}`
      await this.postJson(this.cfg.wechatWebhookUrl!, {
        msgtype: 'markdown',
        markdown: { content: md.slice(0, 4000) },
      })
      return { channel: 'wechat', ok: true }
    } catch (e: any) {
      return { channel: 'wechat', ok: false, error: e?.message }
    }
  }

  private async toFeishu(p: NotifyPayload) {
    try {
      const md = `**${p.title}**\n${p.content}${p.url ? `\n\n[查看报告](${p.url})` : ''}`
      await this.postJson(this.cfg.feishuWebhookUrl!, {
        msg_type: 'text',
        content: { text: md.slice(0, 4000) },
      })
      return { channel: 'feishu', ok: true }
    } catch (e: any) {
      return { channel: 'feishu', ok: false, error: e?.message }
    }
  }

  private async toTelegram(p: NotifyPayload) {
    try {
      const text = `*${p.title}*\n${p.content}${p.url ? `\n\n${p.url}` : ''}`.slice(0, 4000)
      const url = `https://api.telegram.org/bot${this.cfg.telegramBotToken}/sendMessage`
      await this.postJson(url, {
        chat_id: this.cfg.telegramChatId,
        text,
        parse_mode: 'Markdown',
      })
      return { channel: 'telegram', ok: true }
    } catch (e: any) {
      return { channel: 'telegram', ok: false, error: e?.message }
    }
  }
}
