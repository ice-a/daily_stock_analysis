/**
 * 全局鉴权中间件。
 * 对应原 Python ADMIN_AUTH_ENABLED + cookie 登录。
 * 通过 useRuntimeConfig().adminAuthEnabled 控制是否启用；
 * 启用时未登录访问受保护页面跳转 /login。
 */
export default defineNuxtRouteMiddleware((to) => {
  const cfg = useRuntimeConfig().adminAuthEnabled
  if (!cfg) return

  // 登录页本身不拦截
  if (to.path === '/login') return

  const cookie = useCookie('dsa_auth', { readonly: true })
  if (cookie.value !== '1') {
    return navigateTo('/login')
  }
})
