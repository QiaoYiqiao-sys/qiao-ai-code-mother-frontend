<template>
  <a-layout-header class="header">
    <a-row :wrap="false">
      <!-- 左侧：Logo和标题 -->
      <a-col flex="200px">
        <RouterLink to="/">
          <div class="header-left">
            <img class="logo" src="@/assets/logo.png" alt="Logo" />
            <h1 class="site-title">桥一瞧应用生成</h1>
          </div>
        </RouterLink>
      </a-col>
      <!-- 中间：导航菜单 -->
      <a-col flex="auto">
        <a-menu
          v-model:selectedKeys="selectedKeys"
          mode="horizontal"
          :items="menuItems"
          @click="handleMenuClick"
        />
      </a-col>
      <!-- 右侧：用户操作区域 -->
      <a-col>
        <div class="user-login-status">
          <div v-if="loginUserStore.loginUser.id">
            <a-dropdown
              :trigger="['hover']"
              placement="bottomRight"
              overlayClassName="header-user-dropdown"
            >
              <div class="avatar-trigger">
                <a-avatar :src="loginUserStore.loginUser.userAvatar || defaultAvatar" />
                <span class="user-name">
                  {{ loginUserStore.loginUser.userName || '桥一瞧用户1' }}
                </span>
              </div>
              <template #overlay>
                <a-menu @click="handleUserMenuClick">
                  <a-menu-item key="theme">{{ isDark ? '切换浅色主题' : '切换深色主题' }}</a-menu-item>
                  <a-menu-item key="logout">注销</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
          <div v-else>
            <a-button type="primary" href="/user/login">登录</a-button>
          </div>
        </div>
      </a-col>
    </a-row>
  </a-layout-header>
</template>

<script setup lang="ts">
// 关键修复：导入 computed
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { MenuProps } from 'ant-design-vue'
import { message } from 'ant-design-vue'
import { useLoginUserStore } from '@/stores/loginUser'
import { userLogout } from '@/api/userController.ts'
import defaultAvatar from '@/assets/logo.png'

const loginUserStore = useLoginUserStore()

const router = useRouter()
// 当前选中菜单
const selectedKeys = ref<string[]>(['/'])

// 修复：router.afterEach 不接收 next 参数
router.afterEach((to) => {
  selectedKeys.value = [to.path]
})

// 菜单配置项
const originItems = ref<MenuProps['items']>([
  {
    key: '/',
    label: '首页',
    title: '首页',
  },
  {
    key: '/admin/userManage',
    label: '用户管理',
    title: '用户管理',
  },
  {
    key: '/about',
    label: '关于',
    title: '关于我们',
  },
])

// 过滤菜单项
const filterMenus = (menus: MenuProps['items'] = []) => {
  return menus.filter((menu) => {
    if (!menu) {
      return false
    }
    const menuKey = menu.key as string
    if (menuKey?.startsWith('/admin')) {
      const loginUser = loginUserStore.loginUser
      // 更严谨的权限判断
      if (!loginUser || !loginUser.id || loginUser.userRole !== 'admin') {
        return false
      }
    }
    return true
  })
}

// 修复：originItems 是 ref 对象，需要取 .value
const menuItems = computed<MenuProps['items']>(() => filterMenus(originItems.value))

// 处理菜单点击
const handleMenuClick: MenuProps['onClick'] = (e) => {
  const key = e.key as string
  selectedKeys.value = [key]
  // 跳转到对应页面
  if (key.startsWith('/')) {
    router.push(key)
  }
}

const handleLogout = async () => {
  try {
    const res = await userLogout()
    const { data } = res
    if (data.code === 0) {
      message.success('已注销')
      loginUserStore.setLoginUser({ userName: '未登录' } as any)
      router.push('/user/login')
    } else {
      message.error(data.message || '退出失败，请稍后重试')
    }
  } catch (e) {
    message.error('退出异常，请稍后重试')
  }
}

const isDark = computed(() => document.documentElement.classList.contains('dark'))

const handleUserMenuClick = async (info: { key: string }) => {
  if (info.key === 'theme') {
    const nextDark = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', nextDark)
    localStorage.setItem('theme', nextDark ? 'dark' : 'light')
    return
  }
  if (info.key === 'logout') {
    await handleLogout()
  }
}
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 0 28px;
  background: color-mix(in srgb, #ffffff 78%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-bottom: 1px solid #e5e5e5;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  height: 42px;
  width: 42px;
  border-radius: 14px;
  border: 1px solid #e5e5e5;
  object-fit: cover;
}

.site-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #171717;
}

.ant-menu-horizontal {
  border-bottom: none !important;
}

.user-login-status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.user-name {
  color: #171717;
  font-size: 14px;
}

.avatar-trigger {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: 8px;
}

.avatar-trigger:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #171717;
}

.user-login-status :deep(.ant-btn-primary) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  padding: 0 22px;
  height: 36px;
  font-weight: 500;
  border: 1px solid #e5e5e5;
  background: #3b82f6;
}

.user-login-status :deep(.ant-btn-primary:hover),
.user-login-status :deep(.ant-btn-primary:focus) {
  background: #2563eb;
}

:deep(.ant-menu) {
  background: transparent;
}

:deep(.ant-menu-horizontal) {
  border-bottom: none;
}

:deep(.ant-menu-item) {
  color: #525252;
  font-weight: 500;
}

:deep(.ant-menu-item:hover) {
  color: #171717;
}

:deep(.ant-menu-item-selected) {
  color: #3b82f6;
}

:deep(.ant-menu-item-selected::after) {
  border-bottom: 2px solid #3b82f6;
}

/* 头像下拉菜单样式（非 scoped 以作用于 overlay） */
:global(.header-user-dropdown .ant-dropdown-menu) {
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
}

:global(.header-user-dropdown .ant-dropdown-menu-item) {
  color: #171717;
}

:global(.header-user-dropdown .ant-dropdown-menu-item:hover) {
  background: rgba(59, 130, 246, 0.1);
  color: #171717;
}

:global(html.dark .header) {
  background: color-mix(in srgb, #0a0a0a 72%, transparent);
  border-bottom-color: #262626;
}

:global(html.dark .site-title),
:global(html.dark .user-name),
:global(html.dark .ant-menu-item),
:global(html.dark .ant-menu-item:hover) {
  color: #e5e5e5 !important;
}

:global(html.dark .logo),
:global(html.dark .user-login-status .ant-btn-primary) {
  border-color: #262626 !important;
}

:global(html.dark .header-user-dropdown .ant-dropdown-menu) {
  background: #0a0a0a;
  border-color: #262626;
}

:global(html.dark .header-user-dropdown .ant-dropdown-menu-item) {
  color: #e5e5e5;
}

:global(html.dark .header-user-dropdown .ant-dropdown-menu-item:hover) {
  background: rgba(59, 130, 246, 0.18);
  color: #ffffff;
}
</style>
