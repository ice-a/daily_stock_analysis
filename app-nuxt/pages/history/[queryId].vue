<template>
  <div class="mx-auto max-w-3xl">
    <NuxtLink to="/history" class="text-sm text-emerald-400 hover:underline">← 返回历史</NuxtLink>
    <div v-if="pending" class="mt-6 text-slate-400">加载中…</div>
    <div v-else-if="!report" class="mt-6 text-slate-500">报告不存在。</div>
    <article v-else class="mt-4">
      <header class="mb-4">
        <h1 class="text-2xl font-bold">{{ report.name || report.code }} <span class="text-slate-500">· {{ report.code }}</span></h1>
        <div class="mt-1 flex items-center gap-3 text-sm text-slate-400">
          <span>模型: {{ report.model }}</span>
          <span>评分: <b :class="scoreColor(report.score)">{{ report.score }}</b></span>
          <span>建议: {{ report.action }}</span>
          <span>{{ formatDate(report.createdAt) }}</span>
        </div>
      </header>

      <section v-if="report.summary" class="mb-4 rounded border border-slate-800 bg-slate-900/40 p-3">
        <h2 class="mb-1 text-sm font-semibold text-emerald-300">摘要</h2>
        <p class="text-sm text-slate-200">{{ report.summary }}</p>
      </section>

      <section v-if="report.news && report.news.length" class="mb-4 rounded border border-slate-800 bg-slate-900/40 p-3">
        <h2 class="mb-2 text-sm font-semibold text-emerald-300">
          相关新闻
          <span class="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">来源: {{ report.newsProvider || 'unknown' }}</span>
        </h2>
        <ul class="space-y-2">
          <li v-for="(n, i) in report.news" :key="i" class="text-sm">
            <a :href="n.url" target="_blank" rel="noopener" class="font-medium text-sky-300 hover:underline">{{ n.title }}</a>
            <p class="mt-0.5 text-slate-400">{{ n.snippet }}</p>
            <div class="mt-0.5 text-xs text-slate-500">
              <span v-if="n.source">{{ n.source }}</span>
              <span v-if="n.source && n.publishedDate"> · </span>
              <span v-if="n.publishedDate">{{ formatDate(n.publishedDate) }}</span>
            </div>
          </li>
        </ul>
      </section>

      <!-- Markdown 全文渲染（SSR） -->
      <div class="markdown-body" v-html="renderedMarkdown"></div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'

interface Report {
  queryId: string
  code: string
  name?: string
  model?: string
  score?: number
  action?: string
  summary?: string
  markdown?: string
  news?: Array<{ title: string; snippet: string; url: string; source?: string; publishedDate?: string }>
  newsProvider?: string
  createdAt?: string | Date
}

const route = useRoute()
const queryId = computed(() => route.params.queryId as string)

const { data, pending } = await useFetch<{ ok: boolean; report: Report }>(`/api/history/${queryId.value}`, { default: () => ({ ok: false, report: null as any }) })
const report = computed(() => data.value?.report)

const renderedMarkdown = computed(() => {
  const md = report.value?.markdown || ''
  return marked.parse(md, { async: false }) as string
})

function formatDate(d?: string | Date) {
  return d ? new Date(d).toLocaleString('zh-CN') : ''
}
function scoreColor(score?: number) {
  if (!score) return 'text-slate-400'
  if (score >= 70) return 'text-emerald-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}
</script>

<style>
.markdown-body {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgb(30, 41, 59);
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  line-height: 1.7;
  font-size: 0.9rem;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #34d399; margin: 0.75rem 0 0.5rem; }
.markdown-body code { background: #0f172a; padding: 0.1rem 0.3rem; border-radius: 0.25rem; }
.markdown-body pre { background: #0f172a; padding: 0.75rem; border-radius: 0.5rem; overflow-x: auto; }
.markdown-body blockquote { border-left: 3px solid #34d399; padding-left: 0.75rem; color: #94a3b8; }
</style>
