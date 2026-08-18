<template>
  <div class="flex min-h-screen">
    <!-- 侧边导航 -->
    <aside class="w-56 shrink-0 border-r border-slate-800 bg-slate-900/50 p-4">
      <div class="mb-6 text-lg font-semibold text-emerald-400">📈 DSA</div>
      <nav class="space-y-1 text-sm">
        <NuxtLink to="/" class="block rounded px-3 py-2 hover:bg-slate-800" active-class="bg-slate-800 text-emerald-300">首页 / 分析</NuxtLink>
        <NuxtLink to="/market-review" class="block rounded px-3 py-2 hover:bg-slate-800" active-class="bg-slate-800 text-emerald-300">大盘复盘</NuxtLink>
        <NuxtLink to="/signals" class="block rounded px-3 py-2 hover:bg-slate-800" active-class="bg-slate-800 text-emerald-300">决策信号</NuxtLink>
        <NuxtLink to="/backtest" class="block rounded px-3 py-2 hover:bg-slate-800" active-class="bg-slate-800 text-emerald-300">策略回测</NuxtLink>
        <NuxtLink to="/agent" class="block rounded px-3 py-2 hover:bg-slate-800" active-class="bg-slate-800 text-emerald-300">分析助手</NuxtLink>
        <NuxtLink to="/history" class="block rounded px-3 py-2 hover:bg-slate-800" active-class="bg-slate-800 text-emerald-300">历史报告</NuxtLink>
        <NuxtLink to="/about" class="block rounded px-3 py-2 hover:bg-slate-800" active-class="bg-slate-800 text-emerald-300">关于</NuxtLink>
      </nav>
    </aside>
    <main class="flex-1 p-6">
      <slot />
    </main>
  </div>
</template>
