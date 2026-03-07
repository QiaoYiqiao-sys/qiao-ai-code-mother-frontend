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
          <a-button type="primary">登录</a-button>
        </div>
      </a-col>
    </a-row>
  </a-layout-header>
</template>

<script setup lang="ts">
import { h, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { MenuProps } from 'ant-design-vue'

const router = useRouter()
// 当前选中菜单
const selectedKeys = ref<string[]>(['/'])
// 监听路由变化，更新当前选中菜单
router.afterEach((to, from, next) => {
  selectedKeys.value = [to.path]
})

// 菜单配置项
const menuItems = ref([
  {
    key: '/',
    label: '首页',
    title: '首页',
  },
  {
    key: '/about',
    label: '关于',
    title: '关于我们',
  },
])

// 处理菜单点击
const handleMenuClick: MenuProps['onClick'] = (e) => {
  const key = e.key as string
  selectedKeys.value = [key]
  // 跳转到对应页面
  if (key.startsWith('/')) {
    router.push(key)
  }
}
</script>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 0 28px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.32);
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
  box-shadow:
    0 12px 30px rgba(15, 23, 42, 0.7),
    0 0 0 1px rgba(148, 163, 184, 0.6);
  object-fit: cover;
}

.site-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #e5e7eb;
  text-shadow: 0 1px 3px rgba(15, 23, 42, 0.9);
}

.ant-menu-horizontal {
  border-bottom: none !important;
}

.user-login-status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.user-login-status :deep(.ant-btn-primary) {
  border-radius: 9999px;
  padding: 0 22px;
  height: 36px;
  font-weight: 500;
  border: none;
  background-image: linear-gradient(135deg, #22c55e, #4ade80);
  box-shadow:
    0 10px 25px rgba(22, 163, 74, 0.5),
    0 0 0 1px rgba(22, 163, 74, 0.6);
}

.user-login-status :deep(.ant-btn-primary:hover),
.user-login-status :deep(.ant-btn-primary:focus) {
  background-image: linear-gradient(135deg, #16a34a, #22c55e);
  box-shadow:
    0 14px 32px rgba(21, 128, 61, 0.7),
    0 0 0 1px rgba(22, 163, 74, 0.7);
}

:deep(.ant-menu) {
  background: transparent;
}

:deep(.ant-menu-horizontal) {
  border-bottom: none;
}

:deep(.ant-menu-item) {
  color: #9ca3af;
  font-weight: 500;
}

:deep(.ant-menu-item:hover) {
  color: #e5e7eb;
}

:deep(.ant-menu-item-selected) {
  color: #22c55e;
}

:deep(.ant-menu-item-selected::after) {
  border-bottom: 2px solid #22c55e;
}
</style>
