import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: '主页',
      component: HomePage,
    },
    {
      path: '/app/chat/:id',
      name: '应用对话',
      component: () => import('@/pages/AppChatPage.vue'),
    },
    {
      path: '/app/edit/:id',
      name: '应用编辑',
      component: () => import('@/pages/AppEditPage.vue'),
    },
    {
      path: '/admin/userManage',
      name: '用户管理',
      component: HomePage,
    },
    {
      path: '/admin/appManage',
      name: '应用管理',
      component: HomePage,
    },
    {
      path: '/about',
      name: '关于',
      component: HomePage,
    },
  ],
})

export default router
