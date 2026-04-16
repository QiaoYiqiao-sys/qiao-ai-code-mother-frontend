<script setup lang="ts">
import { message } from 'ant-design-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUser'
import { getAppVoById, getAppVoByIdByAdmin, updateApp, updateAppByAdmin } from '@/api/appController'
import { UserRoleEnum, CodeGenTypeEnum, CodeGenTypeLabels } from '@/enums'

const route = useRoute()
const router = useRouter()
const loginUserStore = useLoginUserStore()
const appId = computed(() => Number(route.params.id))
const isAdmin = computed(() => loginUserStore.loginUser.userRole === UserRoleEnum.ADMIN)

const loading = ref(false)
const saving = ref(false)
const app = ref<API.AppVO>({})

const form = reactive({
  appName: '',
  cover: '',
  initPrompt: '',
  codeGenType: '',
  deployKey: '',
  priority: 0,
})

const loadApp = async () => {
  try {
    loading.value = true
    const res = isAdmin.value
      ? await getAppVoByIdByAdmin({ id: appId.value })
      : await getAppVoById({ id: appId.value })
    if (res.data.code === 0 && res.data.data) {
      app.value = res.data.data
      form.appName = res.data.data.appName || ''
      form.cover = res.data.data.cover || ''
      form.initPrompt = res.data.data.initPrompt || ''
      form.codeGenType = res.data.data.codeGenType || ''
      form.deployKey = res.data.data.deployKey || ''
      form.priority = res.data.data.priority || 0
    } else {
      message.error(res.data.message || '获取应用信息失败')
    }
  } catch {
    message.error('获取应用信息异常')
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  if (!form.appName.trim()) {
    message.warning('请输入应用名称')
    return
  }
  try {
    saving.value = true
    let res
    if (isAdmin.value) {
      res = await updateAppByAdmin({
        id: appId.value,
        appName: form.appName,
        cover: form.cover,
        initPrompt: form.initPrompt,
        codeGenType: form.codeGenType,
        deployKey: form.deployKey,
        priority: form.priority,
      })
    } else {
      res = await updateApp({
        id: appId.value,
        appName: form.appName,
      })
    }
    if (res.data.code === 0) {
      message.success('保存成功')
      router.back()
    } else {
      message.error(res.data.message || '保存失败')
    }
  } catch {
    message.error('保存异常')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadApp()
})
</script>

<template>
  <div class="min-h-screen bg-[#FBF8F5] text-[#2D2318] dark:bg-[#1A1714] dark:text-[#F0EAE3]">
    <!-- 顶部栏 -->
    <header class="sticky top-0 z-50 border-b border-[#E8E0D8] bg-[#FFFFFF]/75 backdrop-blur-sm dark:border-[#3D3630] dark:bg-[#1A1714]/70">
      <nav class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <button type="button" class="text-[#A89B8C] transition-colors hover:text-[#7A6E62] dark:hover:text-[#B5A899]" @click="router.back()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
            </svg>
          </button>
          <h1 class="text-sm font-medium">编辑应用</h1>
        </div>
      </nav>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-12">
      <div v-if="loading" class="py-16 text-center text-[#A89B8C]">加载中...</div>
      <div v-else class="rounded-2xl border border-[#E8E0D8] bg-[#FFFFFF]/50 p-8 backdrop-blur-sm dark:border-[#3D3630] dark:bg-[#1A1714]/30">
        <div class="space-y-6">
          <!-- 应用名称 -->
          <div>
            <label class="mb-2 block text-sm font-medium">应用名称</label>
            <input
              v-model="form.appName"
              class="w-full rounded-2xl border border-[#E8E0D8] bg-transparent px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-[#E8734A] dark:border-[#3D3630]"
              placeholder="请输入应用名称"
            />
          </div>

          <!-- 管理员额外字段 -->
          <template v-if="isAdmin">
            <div>
              <label class="mb-2 block text-sm font-medium">应用封面 URL</label>
              <input
                v-model="form.cover"
                class="w-full rounded-2xl border border-[#E8E0D8] bg-transparent px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-[#E8734A] dark:border-[#3D3630]"
                placeholder="请输入封面图片 URL"
              />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium">初始化 Prompt</label>
              <textarea
                v-model="form.initPrompt"
                rows="4"
                class="w-full rounded-2xl border border-[#E8E0D8] bg-transparent px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-[#E8734A] dark:border-[#3D3630]"
                placeholder="请输入初始化 Prompt"
              />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium">代码生成类型</label>
              <select
                v-model="form.codeGenType"
                class="w-full rounded-2xl border border-[#E8E0D8] bg-transparent px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-[#E8734A] dark:border-[#3D3630]"
              >
                <option v-for="(label, value) in CodeGenTypeLabels" :key="value" :value="value">{{ label }}</option>
              </select>
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium">部署标识</label>
              <input
                v-model="form.deployKey"
                class="w-full rounded-2xl border border-[#E8E0D8] bg-transparent px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-[#E8734A] dark:border-[#3D3630]"
                placeholder="请输入部署标识"
              />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium">优先级</label>
              <input
                v-model.number="form.priority"
                type="number"
                class="w-full rounded-2xl border border-[#E8E0D8] bg-transparent px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-[#E8734A] dark:border-[#3D3630]"
                placeholder="优先级数字，99 为精选"
              />
            </div>
          </template>

          <!-- 只读信息 -->
          <div class="rounded-xl bg-[#F5F0EB] p-4 text-sm text-[#A89B8C] dark:bg-[#2E2924]/50 dark:text-[#A89B8C]">
            <p>应用 ID: {{ app.id }}</p>
            <p v-if="!isAdmin" class="mt-1">代码类型: {{ CodeGenTypeLabels[app.codeGenType as CodeGenTypeEnum] || app.codeGenType || '-' }}</p>
            <p class="mt-1">部署时间: {{ app.deployedTime || '-' }}</p>
            <p class="mt-1">创建者 ID: {{ app.userId || '-' }}</p>
            <p class="mt-1">编辑时间: {{ app.editTime || '-' }}</p>
            <p class="mt-1">创建时间: {{ app.createTime || '-' }}</p>
            <p class="mt-1">更新时间: {{ app.updateTime || '-' }}</p>
          </div>

          <!-- 按钮 -->
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="rounded-xl bg-[#E8734A] px-6 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-[#D4623D] disabled:opacity-50"
              :disabled="saving"
              @click="handleSave"
            >
              {{ saving ? '保存中...' : '保存' }}
            </button>
            <button
              type="button"
              class="rounded-xl border border-[#E8E0D8] px-6 py-2.5 text-sm transition-all duration-200 hover:border-[#E8734A] hover:text-[#E8734A] dark:border-[#3D3630]"
              @click="router.back()"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
