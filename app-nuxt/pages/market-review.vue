<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="mb-2 text-2xl font-bold">大盘复盘</h1>
    <p class="mb-6 text-slate-400">生成全市场（A股/港股/美股/日股）指数复盘报告。</p>

    <section class="mb-8 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div class="flex items-end gap-3">
        <select v-model="reportType" class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
          <option value="simple">simple</option>
          <option value="full">full</option>
          <option value="brief">brief</option>
        </select>
        <button
          :disabled="loading"
          class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          @click="run"
        >
          {{ loading ? '生成中…' : '生成复盘' }}
        </button>
        <NuxtLink
          v-if="lastQueryId"
          :to="`/history/${lastQueryId}`"
          class="ml-auto text-sm text-emerald-400 hover:underline"
        >查看完整报告 →</NuxtLink>
      </div>
      <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>
    </section>

    <section v-if="markdown" class="markdown-body" v-html="rendered"></section>
    <div v-else-if="!loading" class="text-slate-500">点击「生成复盘」开始。</div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'

const reportType = ref<'simple' | 'full' | 'brief'>('full')
const loading = ref(false)
const error = ref('')
const markdown = ref('')
const lastQueryId = ref('')

const rendered = computed(() => marked.parse(markdown.value || '', { async: false }) as string)

async function run() {
  loading.value = true
  error.value = ''
  markdown.value = ''
  try {
    const res = await $fetch<{ ok: boolean; queryId: string; markdown: string }>('/api/analysis/market-review', {
      method: 'POST',
      body: { reportType: reportType.value },
    })
    markdown.value = res.markdown
    lastQueryId.value = res.queryId
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.message || '生成失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.markdown-body {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgb(30, 41, 59);
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  line-height: 1.7;
  font-size: 0.9rem;
}
.markdown-body :deep(h1) { color: #34d399; }
.markdown-body :deep(table) { width: 100%; border-collapse: collapse; margin: 0.5rem 0; }
.markdown-body :deep(th), .markdown-body :deep(td) { border: 1px solid rgb(30,41,59); padding: 0.4rem 0.6rem; }
.markdown-body :deep(th) { background: rgba(15,23,42,0.8); }
</style>
