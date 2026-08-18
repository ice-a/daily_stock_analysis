<template>
  <div class="flex min-h-[60vh] items-center justify-center">
    <form class="w-80 rounded-lg border border-slate-800 bg-slate-900/40 p-6" @submit.prevent="login">
      <h1 class="mb-4 text-lg font-bold">登录</h1>
      <input
        v-model="password"
        type="password"
        placeholder="管理员密码"
        class="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      <button
        :disabled="loading"
        class="mt-4 w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >登录</button>
      <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
const password = ref('')
const loading = ref(false)
const error = ref('')

async function login() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { password: password.value } })
    await navigateTo('/')
  } catch (e: any) {
    error.value = e?.data?.statusMessage || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>
