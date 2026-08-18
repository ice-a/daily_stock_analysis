<template>
  <div class="mx-auto flex h-[calc(100vh-3rem)] max-w-3xl flex-col">
    <h1 class="mb-2 text-2xl font-bold">分析助手</h1>
    <p class="mb-4 text-slate-400">基于历史分析报告流式问答（SSE）。</p>

    <div class="flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div v-if="!messages.length" class="text-slate-500">先运行一些分析，再来这里提问。</div>
      <div
        v-for="(m, i) in messages"
        :key="i"
        :class="m.role === 'user' ? 'text-right' : 'text-left'"
      >
        <span
          class="inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm"
          :class="m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-100'"
        >{{ m.content }}</span>
      </div>
      <div v-if="streaming" class="text-left">
        <span class="inline-block rounded-lg bg-slate-800 px-3 py-2 text-sm text-emerald-300">{{ streamingText }}<span class="animate-pulse">▌</span></span>
      </div>
    </div>

    <form class="mt-3 flex gap-2" @submit.prevent="ask">
      <input
        v-model="question"
        placeholder="例如：600519 最近的策略建议是什么？"
        class="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      <button
        :disabled="sending"
        class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >发送</button>
    </form>
  </div>
</template>

<script setup lang="ts">
const question = ref('')
const messages = ref<{ role: 'user' | 'assistant'; content: string }[]>([])
const streaming = ref(false)
const streamingText = ref('')
const sending = ref(false)

async function ask() {
  const q = question.value.trim()
  if (!q || sending.value) return
  messages.value.push({ role: 'user', content: q })
  question.value = ''
  sending.value = true
  streaming.value = true
  streamingText.value = ''

  const assistantMsg = { role: 'assistant' as const, content: '' }
  messages.value.push(assistantMsg)

  try {
    const res = await fetch('/api/agent/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q }),
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() || ''
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data:')) continue
        const data = JSON.parse(line.slice(5))
        if (data.type === 'token') {
          streamingText.value += data.content
          assistantMsg.content = streamingText.value
        }
      }
    }
  } catch (e: any) {
    assistantMsg.content = '对话失败：' + (e?.message || '')
  } finally {
    streaming.value = false
    sending.value = false
  }
}
</script>
