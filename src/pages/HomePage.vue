<script setup lang="ts">
import { message } from 'ant-design-vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUser'
import { deleteUser, listUserVoByPage, updateUser, userLogout, userLogin, userRegister } from '@/api/userController'
import {
  addApp,
  listMyAppVoByPage,
  listGoodAppVoByPage,
  deleteApp,
  deleteAppByAdmin,
  updateAppByAdmin,
} from '@/api/appController'
import { listAllChatHistoryByPageForAdmin } from '@/api/chatHistoryController'
import defaultAvatar from '@/assets/logo.png'
import type { Rule } from 'ant-design-vue/es/form'

const router = useRouter()
const route = useRoute()
const loginUserStore = useLoginUserStore()

const isDark = computed(() => document.documentElement.classList.contains('dark'))
const isAdmin = computed(() => loginUserStore.loginUser.userRole === 'admin')
const isLoggedIn = computed(() => !!loginUserStore.loginUser.id)
const currentSection = computed<'home' | 'userManage' | 'appManage' | 'chatManage' | 'about'>(() => {
  if (route.path === '/admin/userManage') return 'userManage'
  if (route.path === '/admin/appManage') return 'appManage'
  if (route.path === '/admin/chatManage') return 'chatManage'
  if (route.path === '/about') return 'about'
  return 'home'
})

// ========== 提示词创建应用 ==========
const promptText = ref('')
const creating = ref(false)

// ========== 快捷提示词 ==========
const quickPrompts = [
  {
    title: '个人博客网站',
    prompt: '帮我创建一个现代风格的个人博客网站，包含首页文章列表、文章详情页、关于我页面。首页展示文章标题、摘要和发布日期，支持按分类筛选。整体采用简洁的黑白灰配色，左侧固定导航栏，响应式布局适配移动端。',
  },
  {
    title: '企业官网',
    prompt: '帮我创建一个科技公司的企业官网，包含首页轮播大图、公司简介、核心产品展示、团队介绍、新闻动态和联系我们页面。设计风格专业大气，主色调为深蓝色，配合白色背景。首页要有数据统计动画效果，产品区域用卡片式布局。',
  },
  {
    title: '在线简历',
    prompt: '帮我创建一个创意在线简历网站，单页滚动式设计，包含个人头像与简介、工作经历时间轴、技能雷达图、项目作品展示画廊和联系方式表单。采用渐变色背景，深色主题，每个模块有滚动进入动画，整体风格现代有设计感。',
  },
  {
    title: '活动落地页',
    prompt: '帮我创建一个产品发布会的活动落地页，顶部全屏倒计时英雄区、活动亮点介绍（三列图标卡片）、嘉宾阵容展示、活动日程时间表、往期精彩回顾图片墙和底部报名表单。设计风格科技感十足，深色背景搭配霓虹渐变高亮色。',
  },
]

const handleQuickPrompt = (prompt: string) => {
  promptText.value = prompt
}

const gradientColors = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
  ['#fccb90', '#d57eeb'],
  ['#e0c3fc', '#8ec5fc'],
  ['#f5576c', '#ff9a9e'],
  ['#667eea', '#43e97b'],
  ['#48c6ef', '#6f86d6'],
  ['#feada6', '#f5efef'],
]

const getAppCover = (appId: number | string | undefined) => {
  const id = Number(appId) || 0
  const pair = gradientColors[id % gradientColors.length]
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`
}

const handleCreateApp = async () => {
  if (!promptText.value.trim()) {
    message.warning('请输入你的需求或想法')
    return
  }
  if (!isLoggedIn.value) {
    openAuthModal('login')
    return
  }
  try {
    creating.value = true
    const res = await addApp({ initPrompt: promptText.value.trim() })
    if (res.data.code === 0 && res.data.data) {
      const appId = res.data.data
      promptText.value = ''
      router.push(`/app/chat/${appId}`)
    } else {
      message.error(res.data.message || '创建应用失败')
    }
  } catch {
    message.error('创建应用异常，请稍后重试')
  } finally {
    creating.value = false
  }
}

const handlePromptKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && e.metaKey) {
    e.preventDefault()
    handleCreateApp()
  }
}

// ========== 我的应用列表 ==========
const myApps = ref<API.AppVO[]>([])
const myAppsLoading = ref(false)
const myAppSearch = ref('')
const myAppPagination = reactive({ current: 1, pageSize: 8, total: 0 })

const loadMyApps = async () => {
  if (!isLoggedIn.value) return
  try {
    myAppsLoading.value = true
    const res = await listMyAppVoByPage({
      pageNum: myAppPagination.current,
      pageSize: myAppPagination.pageSize,
      appName: myAppSearch.value || undefined,
    })
    if (res.data.code === 0 && res.data.data) {
      myApps.value = res.data.data.records || []
      myAppPagination.total = res.data.data.totalRow || 0
    }
  } catch {
    message.error('获取应用列表异常')
  } finally {
    myAppsLoading.value = false
  }
}

const handleDeleteMyApp = async (id?: number) => {
  if (!id) return
  try {
    const res = await deleteApp({ id })
    if (res.data.code === 0) {
      message.success('删除成功')
      loadMyApps()
    } else {
      message.error(res.data.message || '删除失败')
    }
  } catch {
    message.error('删除异常')
  }
}

// ========== 精选应用列表 ==========
const goodApps = ref<API.AppVO[]>([])
const goodAppsLoading = ref(false)
const goodAppSearch = ref('')
const goodAppPagination = reactive({ current: 1, pageSize: 8, total: 0 })

const loadGoodApps = async () => {
  try {
    goodAppsLoading.value = true
    const res = await listGoodAppVoByPage({
      pageNum: goodAppPagination.current,
      pageSize: goodAppPagination.pageSize,
      sortField: 'createTime',
      sortOrder: 'desc',
      appName: goodAppSearch.value || undefined,
    })
    if (res.data.code === 0 && res.data.data) {
      goodApps.value = res.data.data.records || []
      goodAppPagination.total = res.data.data.totalRow || 0
    }
  } catch {
    message.error('获取精选应用异常')
  } finally {
    goodAppsLoading.value = false
  }
}

// ========== 用户管理 ==========
const searchForm = reactive({ userAccount: '', userName: '', userRole: '' })
const users = ref<API.UserVO[]>([])
const userLoading = ref(false)
const userPagination = reactive({ current: 1, pageSize: 10, total: 0 })

const loadUsers = async () => {
  if (!isAdmin.value) return
  try {
    userLoading.value = true
    const res = await listUserVoByPage({
      pageNum: userPagination.current,
      pageSize: userPagination.pageSize,
      userAccount: searchForm.userAccount || undefined,
      userName: searchForm.userName || undefined,
      userRole: searchForm.userRole || undefined,
    })
    if (res.data.code === 0 && res.data.data) {
      users.value = res.data.data.records || []
      userPagination.total = res.data.data.totalRow || 0
    } else {
      message.error(res.data.message || '获取用户列表失败')
    }
  } catch {
    message.error('获取用户列表异常')
  } finally {
    userLoading.value = false
  }
}

const handleDeleteUser = async (id?: number) => {
  if (!id) return
  try {
    const res = await deleteUser({ id })
    if (res.data.code === 0) {
      message.success('删除成功')
      loadUsers()
    } else {
      message.error(res.data.message || '删除失败')
    }
  } catch {
    message.error('删除异常')
  }
}

// ========== 用户编辑弹窗 ==========
const userEditVisible = ref(false)
const userEditSaving = ref(false)
const userEditForm = reactive<API.UserUpdateRequest>({
  id: undefined,
  userName: '',
  userAvatar: '',
  userProfile: '',
  userRole: '',
})

const openUserEdit = (item: API.UserVO) => {
  userEditForm.id = item.id
  userEditForm.userName = item.userName || ''
  userEditForm.userAvatar = item.userAvatar || ''
  userEditForm.userProfile = item.userProfile || ''
  userEditForm.userRole = item.userRole || ''
  userEditVisible.value = true
}

const handleUserEditSave = async () => {
  if (!userEditForm.id) return
  try {
    userEditSaving.value = true
    const res = await updateUser({ ...userEditForm })
    if (res.data.code === 0) {
      message.success('更新成功')
      userEditVisible.value = false
      loadUsers()
    } else {
      message.error(res.data.message || '更新失败')
    }
  } catch {
    message.error('更新异常')
  } finally {
    userEditSaving.value = false
  }
}

// ========== 应用管理（管理员） ==========
const adminApps = ref<API.AppVO[]>([])
const adminAppsLoading = ref(false)
const adminAppSearch = reactive({ appName: '', codeGenType: '' })
const adminAppPagination = reactive({ current: 1, pageSize: 10, total: 0 })

const loadAdminApps = async () => {
  if (!isAdmin.value) return
  try {
    adminAppsLoading.value = true
    const res = await listMyAppVoByPage({
      pageNum: adminAppPagination.current,
      pageSize: adminAppPagination.pageSize,
      appName: adminAppSearch.appName || undefined,
      codeGenType: adminAppSearch.codeGenType || undefined,
    })
    if (res.data.code === 0 && res.data.data) {
      adminApps.value = res.data.data.records || []
      adminAppPagination.total = res.data.data.totalRow || 0
    }
  } catch {
    message.error('获取应用列表异常')
  } finally {
    adminAppsLoading.value = false
  }
}

const handleAdminDeleteApp = async (id?: number) => {
  if (!id) return
  try {
    const res = await deleteAppByAdmin({ id })
    if (res.data.code === 0) {
      message.success('删除成功')
      loadAdminApps()
    } else {
      message.error(res.data.message || '删除失败')
    }
  } catch {
    message.error('删除异常')
  }
}

const handleSetFeatured = async (id?: number) => {
  if (!id) return
  try {
    const res = await updateAppByAdmin({ id, priority: 99 })
    if (res.data.code === 0) {
      message.success('已设为精选')
      loadAdminApps()
    } else {
      message.error(res.data.message || '设置失败')
    }
  } catch {
    message.error('操作异常')
  }
}

// ========== 对话管理（管理员） ==========
const adminChats = ref<API.ChatHistory[]>([])
const adminChatsLoading = ref(false)
const adminChatSearch = reactive({ appId: '', messageType: '' })
const adminChatPagination = reactive({ current: 1, pageSize: 10, total: 0 })

const loadAdminChats = async () => {
  if (!isAdmin.value) return
  try {
    adminChatsLoading.value = true
    const res = await listAllChatHistoryByPageForAdmin({
      pageNum: adminChatPagination.current,
      pageSize: adminChatPagination.pageSize,
      appId: adminChatSearch.appId ? Number(adminChatSearch.appId) : undefined,
      messageType: adminChatSearch.messageType || undefined,
    })
    if (res.data.code === 0 && res.data.data) {
      adminChats.value = res.data.data.records || []
      adminChatPagination.total = res.data.data.totalRow || 0
    }
  } catch {
    message.error('获取对话列表异常')
  } finally {
    adminChatsLoading.value = false
  }
}

// ========== 主题 ==========
const gradientTheme = ref(localStorage.getItem('gradientTheme') !== 'off')

const toggleTheme = () => {
  const nextDark = !document.documentElement.classList.contains('dark')
  document.documentElement.classList.toggle('dark', nextDark)
  localStorage.setItem('theme', nextDark ? 'dark' : 'light')
}

const toggleGradientTheme = () => {
  gradientTheme.value = !gradientTheme.value
  localStorage.setItem('gradientTheme', gradientTheme.value ? 'on' : 'off')
}

// ========== 头像下拉菜单 ==========
const handleAvatarMenuClick = async ({ key }: { key: string }) => {
  if (key === 'theme') {
    toggleTheme()
    return
  }
  if (key === 'gradient') {
    toggleGradientTheme()
    return
  }
  if (key === 'logout') {
    try {
      const res = await userLogout()
      if (res.data.code === 0) {
        message.success('已注销')
        loginUserStore.setLoginUser({ userName: '未登录' } as any)
        openAuthModal('login')
      } else {
        message.error(res.data.message || '退出失败')
      }
    } catch {
      message.error('退出异常')
    }
  }
}

const goTo = (path: string) => {
  router.push(path)
}

// ========== 登录/注册弹窗 ==========
const authModalVisible = ref(false)
const authMode = ref<'login' | 'register'>('login')
const authLoading = ref(false)
const loginFormRef = ref()
const registerFormRef = ref()

const loginForm = reactive<API.UserLoginRequest>({ userAccount: '', userPassword: '' })
const registerForm = reactive<API.UserRegisterRequest & { userName?: string }>({
  userName: '',
  userAccount: '',
  userPassword: '',
  checkPassword: '',
})

const loginRules: Record<string, Rule[]> = {
  userAccount: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 4, message: '账号长度不能少于 4 位', trigger: 'blur' },
  ],
  userPassword: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 位', trigger: 'blur' },
  ],
}

const registerRules: Record<string, Rule[]> = {
  userName: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  userAccount: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 4, message: '账号长度不能少于 4 位', trigger: 'blur' },
  ],
  userPassword: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 位', trigger: 'blur' },
  ],
  checkPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value) => {
        if (!value || value === registerForm.userPassword) return Promise.resolve()
        return Promise.reject('两次输入的密码不一致')
      },
      trigger: 'blur',
    },
  ],
}

const openAuthModal = (mode: 'login' | 'register' = 'login') => {
  authMode.value = mode
  authModalVisible.value = true
}

const handleAuthModeChange = (key: string) => {
  authMode.value = key as 'login' | 'register'
}

const onLoginFinish = async () => {
  try {
    authLoading.value = true
    const res = await userLogin(loginForm)
    if (res.data.code === 0) {
      message.success('登录成功')
      if (res.data.data) loginUserStore.setLoginUser(res.data.data)
      else await loginUserStore.fetchLoginUser()
      authModalVisible.value = false
      loginForm.userAccount = ''
      loginForm.userPassword = ''
      const redirect = route.query.redirect as string
      if (redirect) router.push(redirect)
      // 登录后加载我的应用
      loadMyApps()
    } else {
      message.error(res.data.message || '登录失败')
    }
  } catch {
    message.error('登录异常')
  } finally {
    authLoading.value = false
  }
}

const onRegisterFinish = async () => {
  try {
    authLoading.value = true
    const res = await userRegister({
      userAccount: registerForm.userAccount,
      userPassword: registerForm.userPassword,
      checkPassword: registerForm.checkPassword,
    })
    if (res.data.code === 0) {
      message.success('注册成功，请登录')
      authMode.value = 'login'
      registerForm.userName = ''
      registerForm.userAccount = ''
      registerForm.userPassword = ''
      registerForm.checkPassword = ''
    } else {
      message.error(res.data.message || '注册失败')
    }
  } catch {
    message.error('注册异常')
  } finally {
    authLoading.value = false
  }
}

// ========== 生命周期 ==========
watch(
  () => route.path,
  (path) => {
    if (path === '/admin/userManage' && isAdmin.value) loadUsers()
    if (path === '/admin/appManage' && isAdmin.value) loadAdminApps()
    if (path === '/admin/chatManage' && isAdmin.value) loadAdminChats()
    if (path === '/') {
      if (isLoggedIn.value) loadMyApps()
      loadGoodApps()
    }
  },
  { immediate: true },
)

watch(
  () => route.query.showLogin,
  (val) => {
    if (val === 'true' && !loginUserStore.loginUser.id) {
      openAuthModal('login')
      router.replace({ query: { ...route.query, showLogin: undefined } })
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
  <div class="min-h-screen text-neutral-900 transition-colors duration-300 dark:text-neutral-100" :class="gradientTheme ? 'hero-gradient' : 'bg-[#FFFFFF] dark:bg-[#0A0A0A]'">
    <div v-if="gradientTheme" class="hero-glow"></div>
    <div v-if="gradientTheme" class="hero-grid"></div>
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b transition-colors duration-200" :class="gradientTheme ? 'border-neutral-800/10 bg-white/40 backdrop-blur-md' : 'border-neutral-200/80 bg-white/75 backdrop-blur-sm dark:border-neutral-800 dark:bg-[#0A0A0A]/70'">
      <nav class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <div class="text-lg font-semibold tracking-tight cursor-pointer" @click="goTo('/')">Qiao AI</div>
        <div class="flex items-center gap-6 text-sm text-neutral-600 dark:text-neutral-300">
          <button type="button" class="nav-link" :class="currentSection === 'home' ? 'nav-active' : ''" @click="goTo('/')">首页</button>
          <button v-if="isAdmin" type="button" class="nav-link" :class="currentSection === 'appManage' ? 'nav-active' : ''" @click="goTo('/admin/appManage')">应用管理</button>
          <button v-if="isAdmin" type="button" class="nav-link" :class="currentSection === 'chatManage' ? 'nav-active' : ''" @click="goTo('/admin/chatManage')">对话管理</button>
          <button v-if="isAdmin" type="button" class="nav-link" :class="currentSection === 'userManage' ? 'nav-active' : ''" @click="goTo('/admin/userManage')">用户管理</button>
          <button type="button" class="nav-link" :class="currentSection === 'about' ? 'nav-active' : ''" @click="goTo('/about')">关于</button>
        </div>
        <div class="flex items-center gap-3">
          <button v-if="!isLoggedIn" type="button" class="rounded-2xl border border-neutral-200 bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-500 dark:border-neutral-800" @click="openAuthModal('login')">登录</button>
          <a-dropdown v-else :trigger="['hover']" placement="bottomRight" overlayClassName="home-avatar-dropdown">
            <div class="flex cursor-pointer items-center gap-2 rounded-2xl border border-neutral-200 px-2 py-1 transition-colors duration-200 hover:border-[#3B82F6] dark:border-neutral-800">
              <a-avatar :size="32" :src="loginUserStore.loginUser.userAvatar || defaultAvatar" />
              <span class="hidden text-sm md:inline">{{ loginUserStore.loginUser.userName || '用户' }}</span>
            </div>
            <template #overlay>
              <a-menu @click="handleAvatarMenuClick">
                <a-menu-item key="theme">{{ isDark ? '切换浅色主题' : '切换深色主题' }}</a-menu-item>
                <a-menu-item key="gradient">{{ gradientTheme ? '关闭渐变主题' : '开启渐变主题' }}</a-menu-item>
                <a-menu-item key="logout">注销</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </nav>
    </header>

    <!-- ========== 首页 Hero 区域 ========== -->
    <div v-if="currentSection === 'home'" class="relative z-10 mx-auto max-w-3xl px-6 pt-20 pb-16 text-center md:pt-28 md:pb-20">
      <h1 class="text-4xl font-bold tracking-tight text-neutral-800 md:text-6xl">
        AI 应用生成平台
      </h1>
      <p class="mt-4 text-lg text-neutral-600">一句话轻松创建网站应用</p>

      <!-- 提示词输入 -->
      <div class="mx-auto mt-10 max-w-3xl">
        <div class="rounded-3xl p-6 shadow-xl backdrop-blur-xl" :class="gradientTheme ? 'bg-white/70 shadow-black/5 ring-1 ring-white/60' : 'bg-neutral-50 shadow-neutral-200/60 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:shadow-neutral-900/40 dark:ring-neutral-700'">
          <textarea
            v-model="promptText"
            rows="5"
            class="w-full resize-none bg-transparent text-base leading-relaxed text-neutral-800 outline-none placeholder:text-neutral-400"
            placeholder="帮我创建个人博客网站，⌘+Enter"
            @keydown="handlePromptKeydown"
          />
          <div class="flex items-center justify-end pt-2">
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-full bg-[#3B82F6] text-white transition-all duration-200 hover:bg-blue-500 disabled:opacity-50"
              :disabled="creating || !promptText.trim()"
              @click="handleCreateApp"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 快捷提示词 -->
      <div class="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
        <button
          v-for="(item, idx) in quickPrompts"
          :key="idx"
          type="button"
          class="group rounded-xl border border-neutral-800/10 bg-white/40 px-3 py-2.5 text-left backdrop-blur-sm transition-all duration-200 hover:border-neutral-800/20 hover:bg-white/60"
          @click="handleQuickPrompt(item.prompt)"
        >
          <span class="block text-xs font-medium text-neutral-700 group-hover:text-neutral-900">{{ item.title }}</span>
        </button>
      </div>
    </div>

    <main class="relative z-10 mx-auto w-full max-w-7xl px-6 py-12 md:px-10 md:py-16">

      <!-- ========== 首页应用列表 ========== -->
      <template v-if="currentSection === 'home'">
        <!-- 我的应用 -->
        <section v-if="isLoggedIn" class="mb-16">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-xl font-bold">我的应用</h2>
            <div class="flex items-center gap-3">
              <input
                v-model="myAppSearch"
                class="rounded-2xl border border-neutral-200 bg-transparent px-4 py-1.5 text-sm outline-none transition-all duration-200 focus:border-[#3B82F6] dark:border-neutral-800"
                placeholder="搜索应用名称"
                @keydown.enter="myAppPagination.current = 1; loadMyApps()"
              />
              <button type="button" class="rounded-2xl border border-neutral-200 px-3 py-1.5 text-sm transition-all duration-200 hover:border-[#3B82F6] hover:text-[#3B82F6] dark:border-neutral-800" @click="myAppPagination.current = 1; loadMyApps()">搜索</button>
            </div>
          </div>
          <div v-if="myAppsLoading" class="py-8 text-center text-neutral-400">加载中...</div>
          <div v-else-if="myApps.length === 0" class="py-8 text-center text-neutral-400">暂无应用，输入提示词创建你的第一个应用</div>
          <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="app in myApps"
              :key="app.id"
              class="group cursor-pointer overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all duration-200 hover:border-[#3B82F6] hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div class="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                <img v-if="app.cover" :src="app.cover" class="h-full w-full object-cover" />
                <div v-else class="flex h-full items-center justify-center text-3xl font-bold text-white" :style="{ background: getAppCover(app.id) }">{{ (app.appName || 'App')[0] }}</div>
                <div class="absolute inset-0 flex items-center justify-center gap-3 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <button type="button" class="rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white shadow transition-all hover:bg-blue-600" @click="goTo(`/app/chat/${app.id}`)">查看对话</button>
                  <a v-if="app.deployKey" :href="`/${app.deployKey}`" target="_blank" class="rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white shadow transition-all hover:bg-emerald-600" @click.stop>查看作品</a>
                </div>
              </div>
              <div class="flex items-center gap-2.5 p-3">
                <img v-if="app.user?.userAvatar" :src="app.user.userAvatar" class="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                <div v-else class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#3B82F6] text-xs font-bold text-white">{{ (app.user?.userName || '?')[0] }}</div>
                <div class="min-w-0 flex-1">
                  <h3 class="truncate text-sm font-medium">{{ app.appName || '未命名应用' }}</h3>
                  <p class="truncate text-xs text-neutral-400">{{ app.user?.userName || '未知用户' }}</p>
                </div>
              </div>
            </div>
          </div>
          <!-- 分页 -->
          <div v-if="myAppPagination.total > myAppPagination.pageSize" class="mt-4 flex items-center justify-end gap-2 text-sm">
            <button type="button" class="page-btn" :disabled="myAppPagination.current <= 1" @click="myAppPagination.current -= 1; loadMyApps()">上一页</button>
            <span>{{ myAppPagination.current }} / {{ Math.max(1, Math.ceil(myAppPagination.total / myAppPagination.pageSize)) }}</span>
            <button type="button" class="page-btn" :disabled="myAppPagination.current >= Math.ceil(myAppPagination.total / myAppPagination.pageSize)" @click="myAppPagination.current += 1; loadMyApps()">下一页</button>
          </div>
        </section>

        <!-- 精选应用 -->
        <section>
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-xl font-bold">精选应用</h2>
            <div class="flex items-center gap-3">
              <input
                v-model="goodAppSearch"
                class="rounded-2xl border border-neutral-200 bg-transparent px-4 py-1.5 text-sm outline-none transition-all duration-200 focus:border-[#3B82F6] dark:border-neutral-800"
                placeholder="搜索应用名称"
                @keydown.enter="goodAppPagination.current = 1; loadGoodApps()"
              />
              <button type="button" class="rounded-2xl border border-neutral-200 px-3 py-1.5 text-sm transition-all duration-200 hover:border-[#3B82F6] hover:text-[#3B82F6] dark:border-neutral-800" @click="goodAppPagination.current = 1; loadGoodApps()">搜索</button>
            </div>
          </div>
          <div v-if="goodAppsLoading" class="py-8 text-center text-neutral-400">加载中...</div>
          <div v-else-if="goodApps.length === 0" class="py-8 text-center text-neutral-400">暂无精选应用</div>
          <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="app in goodApps"
              :key="app.id"
              class="group cursor-pointer overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all duration-200 hover:border-[#3B82F6] hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div class="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                <img v-if="app.cover" :src="app.cover" class="h-full w-full object-cover" />
                <div v-else class="flex h-full items-center justify-center text-3xl font-bold text-white" :style="{ background: getAppCover(app.id) }">{{ (app.appName || 'App')[0] }}</div>
                <div class="absolute inset-0 flex items-center justify-center gap-3 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <button type="button" class="rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white shadow transition-all hover:bg-blue-600" @click="goTo(`/app/chat/${app.id}`)">查看对话</button>
                  <a v-if="app.deployKey" :href="`/${app.deployKey}`" target="_blank" class="rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white shadow transition-all hover:bg-emerald-600" @click.stop>查看作品</a>
                </div>
              </div>
              <div class="flex items-center gap-2.5 p-3">
                <img v-if="app.user?.userAvatar" :src="app.user.userAvatar" class="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                <div v-else class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#3B82F6] text-xs font-bold text-white">{{ (app.user?.userName || '?')[0] }}</div>
                <div class="min-w-0 flex-1">
                  <h3 class="truncate text-sm font-medium">{{ app.appName || '未命名应用' }}</h3>
                  <p class="truncate text-xs text-neutral-400">{{ app.user?.userName || '未知用户' }}</p>
                </div>
              </div>
            </div>
          </div>
          <div v-if="goodAppPagination.total > goodAppPagination.pageSize" class="mt-4 flex items-center justify-end gap-2 text-sm">
            <button type="button" class="page-btn" :disabled="goodAppPagination.current <= 1" @click="goodAppPagination.current -= 1; loadGoodApps()">上一页</button>
            <span>{{ goodAppPagination.current }} / {{ Math.max(1, Math.ceil(goodAppPagination.total / goodAppPagination.pageSize)) }}</span>
            <button type="button" class="page-btn" :disabled="goodAppPagination.current >= Math.ceil(goodAppPagination.total / goodAppPagination.pageSize)" @click="goodAppPagination.current += 1; loadGoodApps()">下一页</button>
          </div>
        </section>
      </template>

      <!-- ========== 应用管理（管理员） ========== -->
      <section v-else-if="currentSection === 'appManage'" class="min-h-[65vh] rounded-2xl border border-neutral-200 bg-white/50 p-6 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/30 md:p-8">
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold">应用管理</h1>
          <button type="button" class="rounded-2xl border border-neutral-200 px-4 py-2 text-sm transition-all duration-200 hover:border-[#3B82F6] hover:text-[#3B82F6] dark:border-neutral-800" @click="loadAdminApps">刷新</button>
        </div>
        <div class="grid gap-3 md:grid-cols-3">
          <input v-model="adminAppSearch.appName" class="table-input" placeholder="应用名称" />
          <input v-model="adminAppSearch.codeGenType" class="table-input" placeholder="代码类型" />
          <button type="button" class="rounded-2xl border border-neutral-200 bg-[#3B82F6] px-4 py-2 text-sm text-white transition-all duration-200 hover:bg-blue-500 dark:border-neutral-800" @click="adminAppPagination.current = 1; loadAdminApps()">搜索</button>
        </div>
        <div class="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table class="w-max min-w-full text-left text-sm whitespace-nowrap">
            <thead class="bg-neutral-100/80 dark:bg-neutral-900/70">
              <tr>
                <th class="px-4 py-3">ID</th>
                <th class="px-4 py-3">应用名称</th>
                <th class="px-4 py-3">应用封面</th>
                <th class="px-4 py-3">初始化Prompt</th>
                <th class="px-4 py-3">代码类型</th>
                <th class="px-4 py-3">部署标识</th>
                <th class="px-4 py-3">部署时间</th>
                <th class="px-4 py-3">优先级</th>
                <th class="px-4 py-3">创建者</th>
                <th class="px-4 py-3">编辑时间</th>
                <th class="px-4 py-3">创建时间</th>
                <th class="px-4 py-3">更新时间</th>
                <th class="sticky right-0 bg-neutral-100/80 px-4 py-3 dark:bg-neutral-900/70">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="adminAppsLoading"><td class="px-4 py-4 text-neutral-500" colspan="13">加载中...</td></tr>
              <tr v-for="app in adminApps" v-else :key="app.id" class="border-t border-neutral-200 transition-colors duration-200 hover:bg-neutral-100/60 dark:border-neutral-800 dark:hover:bg-neutral-900/50">
                <td class="px-4 py-3">{{ app.id }}</td>
                <td class="px-4 py-3">{{ app.appName || '-' }}</td>
                <td class="px-4 py-3">
                  <img v-if="app.cover" :src="app.cover" class="h-8 w-8 rounded object-cover" />
                  <span v-else>-</span>
                </td>
                <td class="max-w-[300px] truncate px-4 py-3" :title="app.initPrompt">{{ app.initPrompt || '-' }}</td>
                <td class="px-4 py-3">{{ app.codeGenType || '-' }}</td>
                <td class="px-4 py-3">{{ app.deployKey || '-' }}</td>
                <td class="px-4 py-3">{{ app.deployedTime || '-' }}</td>
                <td class="px-4 py-3">{{ app.priority ?? 0 }}</td>
                <td class="px-4 py-3">{{ app.user?.userName || '-' }}</td>
                <td class="px-4 py-3">{{ app.editTime || '-' }}</td>
                <td class="px-4 py-3">{{ app.createTime || '-' }}</td>
                <td class="px-4 py-3">{{ app.updateTime || '-' }}</td>
                <td class="sticky right-0 bg-white px-4 py-3 dark:bg-[#0A0A0A]">
                  <div class="flex items-center gap-2">
                    <button type="button" class="rounded-lg bg-[#3B82F6] px-3 py-1 text-xs text-white transition-all hover:bg-blue-600" @click="goTo(`/app/edit/${app.id}`)">编辑</button>
                    <button type="button" class="rounded-lg bg-[#10B981] px-3 py-1 text-xs text-white transition-all hover:bg-emerald-600" @click="handleSetFeatured(app.id)">精选</button>
                    <button type="button" class="rounded-lg bg-[#EF4444] px-3 py-1 text-xs text-white transition-all hover:bg-red-600" @click="handleAdminDeleteApp(app.id)">删除</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!adminAppsLoading && adminApps.length === 0"><td class="px-4 py-4 text-neutral-500" colspan="13">暂无数据</td></tr>
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex items-center justify-end gap-2 text-sm">
          <button type="button" class="page-btn" :disabled="adminAppPagination.current <= 1" @click="adminAppPagination.current -= 1; loadAdminApps()">上一页</button>
          <span>{{ adminAppPagination.current }} / {{ Math.max(1, Math.ceil(adminAppPagination.total / adminAppPagination.pageSize)) }}</span>
          <button type="button" class="page-btn" :disabled="adminAppPagination.current >= Math.max(1, Math.ceil(adminAppPagination.total / adminAppPagination.pageSize))" @click="adminAppPagination.current += 1; loadAdminApps()">下一页</button>
        </div>
      </section>

      <!-- ========== 用户管理 ========== -->
      <section v-else-if="currentSection === 'userManage'" class="min-h-[65vh] rounded-2xl border border-neutral-200 bg-white/50 p-6 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/30 md:p-8">
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold">用户管理</h1>
          <button type="button" class="rounded-2xl border border-neutral-200 px-4 py-2 text-sm transition-all duration-200 hover:border-[#3B82F6] hover:text-[#3B82F6] dark:border-neutral-800" @click="loadUsers">刷新</button>
        </div>
        <div class="grid gap-3 md:grid-cols-4">
          <input v-model="searchForm.userAccount" class="table-input" placeholder="账号" />
          <input v-model="searchForm.userName" class="table-input" placeholder="用户名" />
          <select v-model="searchForm.userRole" class="table-input">
            <option value="">全部角色</option>
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
          <button type="button" class="rounded-2xl border border-neutral-200 bg-[#3B82F6] px-4 py-2 text-sm text-white transition-all duration-200 hover:bg-blue-500 dark:border-neutral-800" @click="userPagination.current = 1; loadUsers()">搜索</button>
        </div>
        <div class="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table class="w-max min-w-full text-left text-sm whitespace-nowrap">
            <thead class="bg-neutral-100/80 dark:bg-neutral-900/70">
              <tr>
                <th class="px-4 py-3">ID</th>
                <th class="px-4 py-3">账号</th>
                <th class="px-4 py-3">用户名</th>
                <th class="px-4 py-3">头像</th>
                <th class="px-4 py-3">简介</th>
                <th class="px-4 py-3">角色</th>
                <th class="px-4 py-3">编辑时间</th>
                <th class="px-4 py-3">创建时间</th>
                <th class="px-4 py-3">更新时间</th>
                <th class="sticky right-0 bg-neutral-100/80 px-4 py-3 dark:bg-neutral-900/70">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="userLoading"><td class="px-4 py-4 text-neutral-500" colspan="10">加载中...</td></tr>
              <tr v-for="item in users" v-else :key="item.id" class="border-t border-neutral-200 transition-colors duration-200 hover:bg-neutral-100/60 dark:border-neutral-800 dark:hover:bg-neutral-900/50">
                <td class="px-4 py-3">{{ item.id }}</td>
                <td class="px-4 py-3">{{ item.userAccount }}</td>
                <td class="px-4 py-3">{{ item.userName }}</td>
                <td class="px-4 py-3">
                  <img v-if="item.userAvatar" :src="item.userAvatar" class="h-8 w-8 rounded-full object-cover" />
                  <span v-else>-</span>
                </td>
                <td class="max-w-[200px] truncate px-4 py-3" :title="item.userProfile">{{ item.userProfile || '-' }}</td>
                <td class="px-4 py-3">{{ item.userRole }}</td>
                <td class="px-4 py-3">{{ item.editTime || '-' }}</td>
                <td class="px-4 py-3">{{ item.createTime }}</td>
                <td class="px-4 py-3">{{ item.updateTime || '-' }}</td>
                <td class="sticky right-0 bg-white px-4 py-3 dark:bg-[#0A0A0A]">
                  <div class="flex items-center gap-2">
                    <button type="button" class="rounded-lg bg-[#3B82F6] px-3 py-1 text-xs text-white transition-all hover:bg-blue-600" @click="openUserEdit(item)">编辑</button>
                    <button type="button" class="rounded-lg bg-[#EF4444] px-3 py-1 text-xs text-white transition-all hover:bg-red-600" @click="handleDeleteUser(item.id)">删除</button>
                  </div>
                </td>
              </tr>
              <tr v-if="!userLoading && users.length === 0"><td class="px-4 py-4 text-neutral-500" colspan="10">暂无数据</td></tr>
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex items-center justify-end gap-2 text-sm">
          <button type="button" class="page-btn" :disabled="userPagination.current <= 1" @click="userPagination.current -= 1; loadUsers()">上一页</button>
          <span>{{ userPagination.current }} / {{ Math.max(1, Math.ceil(userPagination.total / userPagination.pageSize)) }}</span>
          <button type="button" class="page-btn" :disabled="userPagination.current >= Math.max(1, Math.ceil(userPagination.total / userPagination.pageSize))" @click="userPagination.current += 1; loadUsers()">下一页</button>
        </div>
      </section>

      <!-- ========== 对话管理 ========== -->
      <section v-else-if="currentSection === 'chatManage'" class="min-h-[65vh] rounded-2xl border border-neutral-200 bg-white/50 p-6 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/30 md:p-8">
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-bold">对话管理</h1>
          <button type="button" class="rounded-2xl border border-neutral-200 px-4 py-2 text-sm transition-all duration-200 hover:border-[#3B82F6] hover:text-[#3B82F6] dark:border-neutral-800" @click="loadAdminChats">刷新</button>
        </div>
        <div class="grid gap-3 md:grid-cols-3">
          <input v-model="adminChatSearch.appId" class="table-input" placeholder="应用 ID" />
          <select v-model="adminChatSearch.messageType" class="table-input">
            <option value="">全部类型</option>
            <option value="user">用户消息</option>
            <option value="ai">AI 消息</option>
          </select>
          <button type="button" class="rounded-2xl border border-neutral-200 bg-[#3B82F6] px-4 py-2 text-sm text-white transition-all duration-200 hover:bg-blue-500 dark:border-neutral-800" @click="adminChatPagination.current = 1; loadAdminChats()">搜索</button>
        </div>
        <div class="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table class="w-max min-w-full text-left text-sm whitespace-nowrap">
            <thead class="bg-neutral-100/80 dark:bg-neutral-900/70">
              <tr>
                <th class="px-4 py-3">ID</th>
                <th class="px-4 py-3">消息内容</th>
                <th class="px-4 py-3">消息类型</th>
                <th class="px-4 py-3">应用ID</th>
                <th class="px-4 py-3">用户ID</th>
                <th class="px-4 py-3">创建时间</th>
                <th class="px-4 py-3">更新时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="adminChatsLoading"><td class="px-4 py-4 text-neutral-500" colspan="7">加载中...</td></tr>
              <tr v-for="chat in adminChats" v-else :key="chat.id" class="border-t border-neutral-200 transition-colors duration-200 hover:bg-neutral-100/60 dark:border-neutral-800 dark:hover:bg-neutral-900/50">
                <td class="px-4 py-3">{{ chat.id }}</td>
                <td class="max-w-[400px] truncate px-4 py-3" :title="chat.message">{{ chat.message || '-' }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs" :class="chat.messageType === 'ai' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'">{{ chat.messageType === 'ai' ? 'AI' : '用户' }}</span>
                </td>
                <td class="px-4 py-3">{{ chat.appId || '-' }}</td>
                <td class="px-4 py-3">{{ chat.userId || '-' }}</td>
                <td class="px-4 py-3">{{ chat.createTime || '-' }}</td>
                <td class="px-4 py-3">{{ chat.updateTime || '-' }}</td>
              </tr>
              <tr v-if="!adminChatsLoading && adminChats.length === 0"><td class="px-4 py-4 text-neutral-500" colspan="7">暂无数据</td></tr>
            </tbody>
          </table>
        </div>
        <div class="mt-4 flex items-center justify-end gap-2 text-sm">
          <button type="button" class="page-btn" :disabled="adminChatPagination.current <= 1" @click="adminChatPagination.current -= 1; loadAdminChats()">上一页</button>
          <span>{{ adminChatPagination.current }} / {{ Math.max(1, Math.ceil(adminChatPagination.total / adminChatPagination.pageSize)) }}</span>
          <button type="button" class="page-btn" :disabled="adminChatPagination.current >= Math.max(1, Math.ceil(adminChatPagination.total / adminChatPagination.pageSize))" @click="adminChatPagination.current += 1; loadAdminChats()">下一页</button>
        </div>
      </section>

      <!-- ========== 关于 ========== -->
      <section v-else-if="currentSection === 'about'" class="min-h-[65vh] rounded-2xl border border-neutral-200 bg-white/50 p-8 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/30">
        <h1 class="text-3xl font-bold">关于</h1>
        <p class="mt-4 max-w-3xl text-neutral-600 dark:text-neutral-300">
          桥一瞧 AI 零代码应用生产平台，通过 AI 对话即可生成网站应用，让需求极速上线。
        </p>
      </section>
    </main>

    <!-- 登录/注册弹窗 -->
    <a-modal v-model:open="authModalVisible" :footer="null" :width="420" centered destroyOnClose>
      <a-tabs :activeKey="authMode" @change="handleAuthModeChange" centered>
        <a-tab-pane key="login" tab="登录">
          <p class="auth-subtitle">登录你的账号，继续构建你的应用</p>
          <a-form ref="loginFormRef" layout="vertical" :model="loginForm" :rules="loginRules" @finish="onLoginFinish">
            <a-form-item label="账号" name="userAccount">
              <a-input v-model:value="loginForm.userAccount" size="large" placeholder="请输入账号" autocomplete="username" />
            </a-form-item>
            <a-form-item label="密码" name="userPassword">
              <a-input-password v-model:value="loginForm.userPassword" size="large" placeholder="请输入密码" autocomplete="current-password" />
            </a-form-item>
            <a-button type="primary" block size="large" html-type="submit" :loading="authLoading">登录</a-button>
          </a-form>
        </a-tab-pane>
        <a-tab-pane key="register" tab="注册">
          <p class="auth-subtitle">几秒钟完成注册，开启你的 AI 应用生成之旅</p>
          <a-form ref="registerFormRef" layout="vertical" :model="registerForm" :rules="registerRules" @finish="onRegisterFinish">
            <a-form-item label="用户名" name="userName">
              <a-input v-model:value="registerForm.userName" size="large" placeholder="请输入用户名" autocomplete="nickname" />
            </a-form-item>
            <a-form-item label="账号" name="userAccount">
              <a-input v-model:value="registerForm.userAccount" size="large" placeholder="请输入账号" autocomplete="username" />
            </a-form-item>
            <a-form-item label="密码" name="userPassword">
              <a-input-password v-model:value="registerForm.userPassword" size="large" placeholder="请输入密码" autocomplete="new-password" />
            </a-form-item>
            <a-form-item label="确认密码" name="checkPassword">
              <a-input-password v-model:value="registerForm.checkPassword" size="large" placeholder="请再次输入密码" autocomplete="new-password" />
            </a-form-item>
            <a-button type="primary" block size="large" html-type="submit" :loading="authLoading">注册</a-button>
          </a-form>
        </a-tab-pane>
      </a-tabs>
    </a-modal>

    <!-- 用户编辑弹窗 -->
    <a-modal v-model:open="userEditVisible" title="编辑用户" :footer="null" :width="480" centered destroyOnClose>
      <div class="space-y-4 pt-4">
        <div>
          <label class="mb-1 block text-sm font-medium">用户名</label>
          <a-input v-model:value="userEditForm.userName" placeholder="请输入用户名" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">头像 URL</label>
          <a-input v-model:value="userEditForm.userAvatar" placeholder="请输入头像图片 URL" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">简介</label>
          <a-textarea v-model:value="userEditForm.userProfile" :rows="3" placeholder="请输入用户简介" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">角色</label>
          <a-select v-model:value="userEditForm.userRole" class="w-full">
            <a-select-option value="user">普通用户</a-select-option>
            <a-select-option value="admin">管理员</a-select-option>
          </a-select>
        </div>
        <div class="flex items-center gap-3 pt-2">
          <a-button type="primary" :loading="userEditSaving" @click="handleUserEditSave">保存</a-button>
          <a-button @click="userEditVisible = false">取消</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.hero-gradient {
  background-image: linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%);
}
.hero-glow {
  position: absolute;
  top: -40%;
  left: 50%;
  width: 120%;
  height: 120%;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center, rgba(150, 230, 161, 0.2) 0%, transparent 70%);
  pointer-events: none;
}
.hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
}
.nav-link {
  position: relative;
  cursor: pointer;
  padding-bottom: 4px;
  transition: color 0.2s;
}
.nav-link:hover {
  color: #3B82F6;
}
.nav-active {
  color: #3B82F6;
}
.nav-active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 2px;
  border-radius: 9999px;
  background: #3B82F6;
}
.page-btn {
  border-radius: 16px;
  border: 1px solid #e5e5e5;
  padding: 4px 12px;
  transition: all 0.2s;
}
.page-btn:disabled {
  opacity: 0.4;
}
.table-input {
  border-radius: 16px;
  border: 1px solid #e5e5e5;
  background: transparent;
  padding: 8px 16px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}
.table-input:focus {
  border-color: #3B82F6;
}
.auth-subtitle {
  margin: 0 0 16px;
  font-size: 14px;
  color: #525252;
}

:global(html.dark .page-btn) {
  border-color: #262626;
}
:global(html.dark .table-input) {
  border-color: #262626;
}
:global(html.dark .auth-subtitle) {
  color: #a3a3a3;
}
</style>
