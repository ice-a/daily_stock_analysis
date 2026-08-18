<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="mb-2 text-2xl font-bold">每日股票分析</h1>
    <p class="mb-6 text-slate-400">触发 AI 分析并查看历史决策仪表盘（Nuxt SSR + MongoDB）。</p>

    <!-- 触发分析 -->
    <section class="mb-8 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <h2 class="mb-3 font-semibold">触发分析</h2>
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex-1">
          <span class="mb-1 block text-xs text-slate-400">股票代码（逗号分隔，留空则用配置列表）</span>
          <input
            v-model="codesInput"
            placeholder="600519, hk00700, AAPL"
            class="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </label>
        <select v-model="reportType" class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
          <option value="simple">simple</option>
          <option value="full">full</option>
          <option value="brief">brief</option>
        </select>
        <button
          :disabled="loading"
          class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          @click="runAnalysis"
        >
          {{ loading ? '分析中…' : '开始分析' }}
        </button>
      </div>
      <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>
      <div v-if="lastResult" class="mt-3 text-sm text-emerald-300">
        完成 {{ lastResult.count }} 项，queryIds: {{ lastResult.queryIds.join(', ') }}
      </div>
    </section>

    <!-- 股票自动补全 -->
    <section class="mb-8 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <h2 class="mb-3 font-semibold">股票检索</h2>
      <div class="relative">
        <input
          v-model="searchQ"
          placeholder="输入代码或名称，如 600519 / 茅台"
          class="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          @input="onSearch"
        />
        <ul v-if="suggestions.length" class="absolute z-10 mt-1 w-full rounded border border-slate-700 bg-slate-900">
          <li
            v-for="s in suggestions"
            :key="s.code"
            class="cursor-pointer px-3 py-2 text-sm hover:bg-slate-800"
            @click="pick(s)"
          >
            <span class="font-medium">{{ s.name }}</span>
            <span class="ml-2 text-slate-400">{{ s.code }}</span>
            <span class="ml-2 text-xs text-slate-500">{{ s.market }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- 最近报告 -->
    <section>
      <h2 class="mb-3 font-semibold">最近报告</h2>
      <div v-if="pending" class="text-slate-400">加载中…</div>
      <div v-else-if="!reports.length" class="text-slate-500">暂无报告，先触发一次分析。</div>
      <ul v-else class="space-y-2">
        <li
          v-for="r in reports"
          :key="r.queryId"
          class="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-4 py-3"
        >
          <div>
            <div class="font-medium">{{ r.name || r.code }} <span class="text-slate-500">· {{ r.code }}</span></div>
            <div class="text-xs text-slate-400">{{ r.summary?.slice(0, 80) }}</div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold" :class="scoreColor(r.score)">{{ r.score }}</span>
            <NuxtLink :to="`/history/${r.queryId}`" class="text-sm text-emerald-400 hover:underline">查看</NuxtLink>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
interface ReportItem {
  queryId: string
  code: string
  name?: string
  score?: number
  action?: string
  summary?: string
}

const codesInput = ref('')
const reportType = ref<'simple' | 'full' | 'brief'>('simple')
const loading = ref(false)
const error = ref('')
const lastResult = ref<{ count: number; queryIds: string[] } | null>(null)

// 股票自动补全
const searchQ = ref('')
const suggestions = ref<{ code: string; name: string; market: string }[]>([])
let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    if (!searchQ.value.trim()) { suggestions.value = []; return }
    try {
      const res = await $fetch<{ ok: boolean; items: { code: string; name: string; market: string }[] }>(
        `/api/stocks/search?q=${encodeURIComponent(searchQ.value)}`,
      )
      suggestions.value = res.items
    } catch { suggestions.value = [] }
  }, 250)
}
function pick(s: { code: string; name: string; market: string }) {
  searchQ.value = ''
  suggestions.value = []
  codesInput.value = codesInput.value ? `${codesInput.value},${s.code}` : s.code
}

// SSR + client 共用：useFetch 在服务端预取，hydrate 后客户端复用
const { data, pending, refresh } = await useFetch<{ ok: boolean; items: ReportItem[] }>('/api/history', { default: () => ({ ok: true, items: [] }) })
const reports = computed(() => data.value?.items ?? [])

async function runAnalysis() {
  loading.value = true
  error.value = ''
  lastResult.value = null
  try {
    const codes = codesInput.value.split(',').map((s) => s.trim()).filter(Boolean)
    const res = await $fetch<{ ok: boolean; count: number; queryIds: string[] }>('/api/analysis/analyze', {
      method: 'POST',
      body: { codes, reportType: reportType.value },
    })
    lastResult.value = { count: res.count, queryIds: res.queryIds }
    await refresh()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || '分析失败'
  } finally {
    loading.value = false
  }
}

function scoreColor(score?: number) {
  if (!score) return 'text-slate-400'
  if (score >= 70) return 'text-emerald-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}
</script>
