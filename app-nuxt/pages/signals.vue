<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="mb-2 text-2xl font-bold">决策信号</h1>
    <p class="mb-6 text-slate-400">由各次分析自动派生的多空信号汇总。</p>

    <section v-if="data" class="mb-8 grid grid-cols-3 gap-3">
      <div
        v-for="d in data.distribution"
        :key="d.signal"
        class="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-center"
      >
        <div class="text-2xl font-bold" :class="signalColor(d.signal)">{{ d.count }}</div>
        <div class="text-xs text-slate-400">{{ d.signal }}</div>
      </div>
    </section>

    <section>
      <h2 class="mb-3 font-semibold">按股票汇总</h2>
      <div v-if="pending" class="text-slate-400">加载中…</div>
      <div v-else-if="!byCode.length" class="text-slate-500">暂无信号，先运行分析。</div>
      <ul v-else class="space-y-2">
        <li
          v-for="s in byCode"
          :key="s.code"
          class="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 px-4 py-3"
        >
          <div>
            <span class="font-medium">{{ s.code }}</span>
            <span class="ml-2 text-xs text-slate-400">命中 {{ s.count }} 次</span>
          </div>
          <span class="text-sm font-semibold" :class="signalColor(s.signal)">{{ s.signal }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
const { data, pending } = await useFetch<{
  ok: boolean
  distribution: { signal: string; count: number }[]
  byCode: { code: string; signal: string; confidence?: number; count: number }[]
}>('/api/signals', { default: () => ({ ok: true, distribution: [], byCode: [] }) })

const byCode = computed(() => data.value?.byCode ?? [])

function signalColor(signal?: string) {
  if (signal === 'bullish') return 'text-emerald-400'
  if (signal === 'bearish') return 'text-red-400'
  return 'text-yellow-400'
}
</script>
