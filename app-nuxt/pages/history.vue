<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="mb-6 text-2xl font-bold">历史报告</h1>
    <div v-if="pending" class="text-slate-400">加载中…</div>
    <div v-else-if="!reports.length" class="text-slate-500">暂无报告。</div>
    <ul v-else class="space-y-2">
      <li
        v-for="r in reports"
        :key="r.queryId"
        class="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-4 py-3"
      >
        <div>
          <div class="font-medium">{{ r.name || r.code }} <span class="text-slate-500">· {{ r.code }}</span></div>
          <div class="text-xs text-slate-400">{{ formatDate(r.createdAt) }}</div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold" :class="scoreColor(r.score)">{{ r.score }}</span>
          <NuxtLink :to="`/history/${r.queryId}`" class="text-sm text-emerald-400 hover:underline">查看</NuxtLink>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
interface ReportItem {
  queryId: string
  code: string
  name?: string
  score?: number
  createdAt?: string
}

const { data, pending } = await useFetch<{ ok: boolean; items: ReportItem[] }>('/api/history?limit=50', { default: () => ({ ok: true, items: [] }) })
const reports = computed(() => data.value?.items ?? [])

function formatDate(d?: string | Date) {
  if (!d) return ''
  return new Date(d).toLocaleString('zh-CN')
}
function scoreColor(score?: number) {
  if (!score) return 'text-slate-400'
  if (score >= 70) return 'text-emerald-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}
</script>
