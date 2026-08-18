<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="mb-2 text-2xl font-bold">策略回测</h1>
    <p class="mb-6 text-slate-400">双均线(MA)策略历史回测（对应原 backtest_engine）。</p>

    <section class="mb-8 grid grid-cols-2 gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-3">
      <label class="text-sm">
        <span class="mb-1 block text-xs text-slate-400">股票代码</span>
        <input v-model="code" class="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-500" placeholder="600519" />
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-xs text-slate-400">开始日期</span>
        <input v-model="startDate" type="date" class="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-500" />
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-xs text-slate-400">结束日期</span>
        <input v-model="endDate" type="date" class="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-500" />
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-xs text-slate-400">初始资金</span>
        <input v-model.number="capital" type="number" class="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-500" />
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-xs text-slate-400">短周期</span>
        <input v-model.number="shortP" type="number" class="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-500" />
      </label>
      <label class="text-sm">
        <span class="mb-1 block text-xs text-slate-400">长周期</span>
        <input v-model.number="longP" type="number" class="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-500" />
      </label>
      <div class="flex items-end">
        <button
          :disabled="loading"
          class="w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          @click="run"
        >{{ loading ? '回测中…' : '运行回测' }}</button>
      </div>
    </section>

    <section v-if="result" class="space-y-4">
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div class="text-xs text-slate-400">总收益率</div>
          <div class="text-xl font-bold" :class="result.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'">
            {{ (result.totalReturn * 100).toFixed(2) }}%
          </div>
        </div>
        <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div class="text-xs text-slate-400">期末资金</div>
          <div class="text-xl font-bold">{{ result.finalCapital }}</div>
        </div>
        <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div class="text-xs text-slate-400">交易次数</div>
          <div class="text-xl font-bold">{{ result.metrics?.tradeCount ?? 0 }}</div>
        </div>
      </div>

      <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 class="mb-2 text-sm font-semibold text-emerald-300">交易记录</h2>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-slate-400">
              <th class="py-1">日期</th><th>动作</th><th>价格</th><th>盈亏</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(t, i) in result.trades" :key="i" class="border-t border-slate-800">
              <td class="py-1">{{ t.date }}</td>
              <td :class="t.action === 'BUY' ? 'text-emerald-400' : 'text-red-400'">{{ t.action }}</td>
              <td>{{ t.price }}</td>
              <td>{{ t.pnl != null ? t.pnl.toFixed(2) : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <p v-if="error" class="mt-4 text-sm text-red-400">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const code = ref('600519')
const startDate = ref('2024-01-01')
const endDate = ref('2024-12-31')
const capital = ref(100000)
const shortP = ref(5)
const longP = ref(20)
const loading = ref(false)
const error = ref('')
const result = ref<any>(null)

async function run() {
  loading.value = true
  error.value = ''
  result.value = null
  try {
    const res = await $fetch<{ ok: boolean; result: any }>('/api/backtest', {
      method: 'POST',
      body: {
        code: code.value, startDate: startDate.value, endDate: endDate.value,
        initialCapital: capital.value, shortPeriod: shortP.value, longPeriod: longP.value,
      },
    })
    result.value = res.result
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || '回测失败'
  } finally {
    loading.value = false
  }
}
</script>
