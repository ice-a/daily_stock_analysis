<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
// 全局样式：使用 Tailwind（在 nuxt.config 的 css 中引入）
useHead({
  htmlAttrs: { lang: 'zh-CN' },
})
</script>
