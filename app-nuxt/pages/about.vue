<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="mb-4 text-2xl font-bold">关于</h1>
    <p class="text-slate-300">
      本项目是 daily_stock_analysis 的 Nuxt 3 重构版本，采用前后端不分离（SSR）架构，
      数据存储使用 MongoDB，可部署于 Vercel / Cloudflare。
    </p>
    <ul class="mt-4 list-disc space-y-1 pl-6 text-slate-400">
      <li>前端：Nuxt 3 (Vue 3) + Tailwind</li>
      <li>服务端：Nuxt Nitro server routes</li>
      <li>数据库：MongoDB (Atlas / 本地)</li>
      <li>定时分析：Vercel Cron → /api/cron/daily</li>
    </ul>
  </div>
</template>
