<script setup lang="ts">
import { message } from 'ant-design-vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUser'
import { deleteUser, listUserVoByPage, userLogout } from '@/api/userController'
import defaultAvatar from '@/assets/logo.png'

const router = useRouter()
const route = useRoute()
const loginUserStore = useLoginUserStore()

const isDark = computed(() => document.documentElement.classList.contains('dark'))
const isAdmin = computed(() => loginUserStore.loginUser.userRole === 'admin')
const currentSection = computed<'home' | 'userManage' | 'about'>(() => {
  if (route.path === '/admin/userManage') {
    return 'userManage'
  }
  if (route.path === '/about') {
    return 'about'
  }
  return 'home'
})

const searchForm = reactive({
  userAccount: '',
  userName: '',
  userRole: '',
})
const users = ref<API.UserVO[]>([])
const loading = ref(false)
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const loadUsers = async () => {
  if (!isAdmin.value) {
    return
  }
  try {
    loading.value = true
    const res = await listUserVoByPage({
      pageNum: pagination.current,
      pageSize: pagination.pageSize,
      userAccount: searchForm.userAccount || undefined,
      userName: searchForm.userName || undefined,
      userRole: searchForm.userRole || undefined,
    })
    if (res.data.code === 0 && res.data.data) {
      users.value = res.data.data.records || []
      pagination.total = res.data.data.totalRow || 0
    } else {
      message.error(res.data.message || '获取用户列表失败')
    }
  } catch (error) {
    message.error('获取用户列表异常，请稍后重试')
  } finally {
    loading.value = false
  }
}

const handleDelete = async (id?: number) => {
  if (!id) {
    return
  }
  try {
    const res = await deleteUser({ id })
    if (res.data.code === 0) {
      message.success('删除成功')
      loadUsers()
    } else {
      message.error(res.data.message || '删除失败')
    }
  } catch (error) {
    message.error('删除异常，请稍后重试')
  }
}

const toggleTheme = () => {
  const nextDark = !document.documentElement.classList.contains('dark')
  document.documentElement.classList.toggle('dark', nextDark)
  localStorage.setItem('theme', nextDark ? 'dark' : 'light')
}

const handleAvatarMenuClick = async ({ key }: { key: string }) => {
  if (key === 'theme') {
    toggleTheme()
    return
  }
  if (key === 'logout') {
    try {
      const res = await userLogout()
      if (res.data.code === 0) {
        message.success('已注销')
        loginUserStore.setLoginUser({ userName: '未登录' } as any)
        router.push('/user/login')
      } else {
        message.error(res.data.message || '退出失败，请稍后重试')
      }
    } catch (error) {
      message.error('退出异常，请稍后重试')
    }
  }
}

const goTo = (path: '/' | '/about' | '/admin/userManage') => {
  router.push(path)
}

watch(
  () => route.path,
  (path) => {
    if (path === '/admin/userManage' && isAdmin.value) {
      loadUsers()
    }
  },
  { immediate: true },
)

onMounted(() => {
  const storedTheme = localStorage.getItem('theme')
  if (storedTheme === 'dark' || storedTheme === 'light') {
    document.documentElement.classList.toggle('dark', storedTheme === 'dark')
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#FFFFFF] text-neutral-900 transition-colors duration-200 dark:bg-[#0A0A0A] dark:text-neutral-100">
    <header
      class="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/75 backdrop-blur-sm transition-colors duration-200 dark:border-neutral-800 dark:bg-[#0A0A0A]/70"
    >
      <nav class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <div class="text-lg font-semibold tracking-tight">Qiao AI</div>
        <div class="flex items-center gap-6 text-sm text-neutral-600 dark:text-neutral-300">
          <button
            type="button"
            class="relative cursor-pointer pb-1 transition-colors duration-200 hover:text-[#3B82F6]"
            :class="currentSection === 'home' ? 'text-[#3B82F6] after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-[#3B82F6] after:content-[\'\']' : ''"
            @click="goTo('/')"
          >
            首页
          </button>
          <button
            v-if="isAdmin"
            type="button"
            class="relative cursor-pointer pb-1 transition-colors duration-200 hover:text-[#3B82F6]"
            :class="currentSection === 'userManage' ? 'text-[#3B82F6] after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-[#3B82F6] after:content-[\'\']' : ''"
            @click="goTo('/admin/userManage')"
          >
            用户管理
          </button>
          <button
            type="button"
            class="relative cursor-pointer pb-1 transition-colors duration-200 hover:text-[#3B82F6]"
            :class="currentSection === 'about' ? 'text-[#3B82F6] after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-[#3B82F6] after:content-[\'\']' : ''"
            @click="goTo('/about')"
          >
            关于
          </button>
        </div>
        <div class="flex items-center gap-3">
          <RouterLink
            v-if="!loginUserStore.loginUser.id"
            to="/user/login"
            class="rounded-2xl border border-neutral-200 bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-500 dark:border-neutral-800"
          >
            登录
          </RouterLink>
          <a-dropdown
            v-else
            :trigger="['hover']"
            placement="bottomRight"
            overlayClassName="home-avatar-dropdown"
          >
            <div
              class="flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 px-2 py-1 transition-colors duration-200 hover:border-[#3B82F6] dark:border-neutral-800"
            >
              <a-avatar :size="32" :src="loginUserStore.loginUser.userAvatar || defaultAvatar" />
              <span class="hidden text-sm md:inline">{{ loginUserStore.loginUser.userName || '用户' }}</span>
            </div>
            <template #overlay>
              <a-menu @click="handleAvatarMenuClick">
                <a-menu-item key="theme">{{ isDark ? '切换浅色主题' : '切换深色主题' }}</a-menu-item>
                <a-menu-item key="logout">注销</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </nav>
    </header>

    <main class="mx-auto w-full max-w-7xl px-6 py-12 md:px-10 md:py-16">
      <section
        v-if="currentSection === 'home'"
        class="min-h-[65vh] rounded-2xl border border-neutral-200 bg-white/50 p-8 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/30"
      >
        <h1 class="text-3xl font-bold md:text-5xl">首页</h1>
      </section>

      <section
        v-else-if="currentSection === 'about'"
        class="min-h-[65vh] rounded-2xl border border-neutral-200 bg-white/50 p-8 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/30"
      >
        <h1 class="text-3xl font-bold">关于</h1>
        <p class="mt-4 max-w-3xl text-neutral-600 dark:text-neutral-300">
          这是桥一瞧应用平台，你现在使用的是单页结构：顶部导航直接切换首页、用户管理和关于，整体界面风格统一为 Tailwind。
        </p>
      </section>

      <section
        v-else
        class="min-h-[65vh] rounded-2xl border border-neutral-200 bg-white/50 p-6 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/30 md:p-8"
      >
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold">用户管理</h1>
          <button
            type="button"
            class="rounded-2xl border border-neutral-200 px-4 py-2 text-sm transition-all duration-200 hover:border-[#3B82F6] hover:text-[#3B82F6] dark:border-neutral-800"
            @click="loadUsers"
          >
            刷新
          </button>
        </div>
        <div class="grid gap-3 md:grid-cols-4">
          <input
            v-model="searchForm.userAccount"
            class="rounded-2xl border border-neutral-200 bg-transparent px-4 py-2 text-sm outline-none transition-all duration-200 focus:border-[#3B82F6] dark:border-neutral-800"
            placeholder="账号"
          />
          <input
            v-model="searchForm.userName"
            class="rounded-2xl border border-neutral-200 bg-transparent px-4 py-2 text-sm outline-none transition-all duration-200 focus:border-[#3B82F6] dark:border-neutral-800"
            placeholder="用户名"
          />
          <select
            v-model="searchForm.userRole"
            class="rounded-2xl border border-neutral-200 bg-transparent px-4 py-2 text-sm outline-none transition-all duration-200 focus:border-[#3B82F6] dark:border-neutral-800"
          >
            <option value="">全部角色</option>
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
          <button
            type="button"
            class="rounded-2xl border border-neutral-200 bg-[#3B82F6] px-4 py-2 text-sm text-white transition-all duration-200 hover:bg-blue-500 dark:border-neutral-800"
            @click="pagination.current = 1; loadUsers()"
          >
            搜索
          </button>
        </div>

        <div class="mt-6 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-neutral-100/80 dark:bg-neutral-900/70">
              <tr>
                <th class="px-4 py-3">ID</th>
                <th class="px-4 py-3">账号</th>
                <th class="px-4 py-3">用户名</th>
                <th class="px-4 py-3">角色</th>
                <th class="px-4 py-3">创建时间</th>
                <th class="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td class="px-4 py-4 text-neutral-500 dark:text-neutral-400" colspan="6">加载中...</td>
              </tr>
              <tr
                v-for="item in users"
                v-else
                :key="item.id"
                class="border-t border-neutral-200 transition-colors duration-200 hover:bg-neutral-100/60 dark:border-neutral-800 dark:hover:bg-neutral-900/50"
              >
                <td class="px-4 py-3">{{ item.id }}</td>
                <td class="px-4 py-3">{{ item.userAccount }}</td>
                <td class="px-4 py-3">{{ item.userName }}</td>
                <td class="px-4 py-3">{{ item.userRole }}</td>
                <td class="px-4 py-3">{{ item.createTime }}</td>
                <td class="px-4 py-3">
                  <button
                    type="button"
                    class="text-red-500 transition-colors duration-200 hover:text-red-600"
                    @click="handleDelete(item.id)"
                  >
                    删除
                  </button>
                </td>
              </tr>
              <tr v-if="!loading && users.length === 0">
                <td class="px-4 py-4 text-neutral-500 dark:text-neutral-400" colspan="6">暂无数据</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            class="rounded-2xl border border-neutral-200 px-3 py-1.5 transition-all duration-200 disabled:opacity-40 dark:border-neutral-800"
            :disabled="pagination.current <= 1"
            @click="pagination.current -= 1; loadUsers()"
          >
            上一页
          </button>
          <span>{{ pagination.current }} / {{ Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) }}</span>
          <button
            type="button"
            class="rounded-2xl border border-neutral-200 px-3 py-1.5 transition-all duration-200 disabled:opacity-40 dark:border-neutral-800"
            :disabled="pagination.current >= Math.max(1, Math.ceil(pagination.total / pagination.pageSize))"
            @click="pagination.current += 1; loadUsers()"
          >
            下一页
          </button>
        </div>
      </section>
    </main>
  </div>
</template>
