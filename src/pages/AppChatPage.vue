<script setup lang="ts">
import { message } from 'ant-design-vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUser'
import { getAppVoById, deleteApp, deployApp } from '@/api/appController'
import { listAppChatHistory } from '@/api/chatHistoryController'
import { buildSseUrl, buildPreviewUrl } from '@/utils'
import { UserRoleEnum } from '@/enums'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

// 注册 vue 语言别名（Vue SFC 本质上是 XML/HTML）
if (!hljs.getLanguage('vue')) {
  hljs.registerAliases('vue', { languageName: 'xml' })
}


interface ChatMessage {
  role: 'user' | 'ai'
  content: string
}

const route = useRoute()
const router = useRouter()
const loginUserStore = useLoginUserStore()
const appId = computed(() => Number(route.params.id))

const app = ref<API.AppVO>({})
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const sending = ref(false)
const streaming = ref(false)
const previewUrl = ref('')
const previewMode = ref<'preview' | 'code'>('preview')
const messageListRef = ref<HTMLElement>()
const userScrolledUp = ref(false)
let sseAbortController: AbortController | null = null

const handleMessageListScroll = () => {
  const el = messageListRef.value
  if (!el) return
  // If user is within 80px of the bottom, consider them "at bottom"
  userScrolledUp.value = el.scrollTop + el.clientHeight < el.scrollHeight - 80
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
})

const renderMarkdown = (content: string) => {
  if (!content) return ''
  return md.render(content)
}

// ========== 对话历史游标分页 ==========
const historyLoading = ref(false)
const hasMoreHistory = ref(true)
const oldestCreateTime = ref<string | undefined>(undefined)
const historyLoadedOnce = ref(false) // 标记是否已成功加载过一次历史

/**
 * 加载对话历史
 * @param isFirstLoad 是否为首次加载（首次加载后滚动到底部）
 * @returns 本次加载的消息数量，失败返回 -1
 */
const loadChatHistory = async (isFirstLoad = false): Promise<number> => {
  if (historyLoading.value || !hasMoreHistory.value) return 0
  try {
    historyLoading.value = true
    const el = messageListRef.value
    const prevScrollHeight = el?.scrollHeight || 0

    const res = await listAppChatHistory({
      appId: appId.value,
      pageSize: 10,
      lastCreateTime: oldestCreateTime.value,
    })
    if (res.data.code === 0 && res.data.data) {
      const records = res.data.data.records || []
      if (records.length < 10) {
        hasMoreHistory.value = false
      }
      historyLoadedOnce.value = true
      if (records.length > 0) {
        // records 按 createTime 升序排列
        const sorted = [...records].sort(
          (a, b) => new Date(a.createTime || 0).getTime() - new Date(b.createTime || 0).getTime(),
        )
        // 更新游标为最早一条的 createTime
        oldestCreateTime.value = sorted[0].createTime
        // 转换为 ChatMessage 格式，插入到头部
        const historyMessages: ChatMessage[] = sorted.map((r) => ({
          role: (r.messageType as 'user' | 'ai') || 'ai',
          content: r.message || '',
        }))
        messages.value.unshift(...historyMessages)

        if (isFirstLoad) {
          // 首次加载：滚动到底部
          scrollToBottom(true)
        } else {
          // 加载更多：保持滚动位置
          nextTick(() => {
            if (el) {
              el.scrollTop = el.scrollHeight - prevScrollHeight
            }
          })
        }
      }
      return records.length
    }
    return -1
  } catch {
    message.error('加载对话历史异常')
    return -1
  } finally {
    historyLoading.value = false
  }
}

const scrollToBottom = (force = false) => {
  nextTick(() => {
    if (messageListRef.value && (force || !userScrolledUp.value)) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

const loadApp = async () => {
  try {
    const res = await getAppVoById({ id: appId.value })
    if (res.data.code === 0 && res.data.data) {
      app.value = res.data.data

      // 1. 从后端加载对话历史
      const loadedCount = await loadChatHistory(true)

      // 2. 有对话记录且已生成过代码 → 展示预览
      if (messages.value.length >= 2 && app.value.codeGenType) {
        updatePreview()
      }

      // 3. 仅当：历史接口成功返回 0 条 + 自己的 app + 有 initPrompt → 自动触发
      if (loadedCount === 0 && historyLoadedOnce.value) {
        const isOwner = loginUserStore.loginUser.id === app.value.userId
        if (isOwner && app.value.initPrompt) {
          sendMessage(app.value.initPrompt, true)
        }
      }
    } else {
      message.error(res.data.message || '获取应用信息失败')
    }
  } catch {
    message.error('获取应用信息异常')
  }
}

const sendMessage = (text: string, isInit = false) => {
  if (!text.trim() || streaming.value) return

  messages.value.push({ role: 'user', content: text })
  userScrolledUp.value = false
  scrollToBottom(true)

  messages.value.push({ role: 'ai', content: '' })
  streaming.value = true
  sending.value = true

  const url = buildSseUrl(appId.value, text)
  const abortController = new AbortController()
  sseAbortController = abortController

  fetch(url, { credentials: 'include', signal: abortController.signal })
    .then(async (response) => {
      if (!response.ok || !response.body) {
        message.error('请求失败')
        streaming.value = false
        sending.value = false
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:') && line.trim() === 'event:done') {
            break
          }
          const dataPrefix = "data:"
          if (line.startsWith(dataPrefix)) {
            const data = line.slice(dataPrefix.length).trim()
            if (!data) continue
            const aiMsgIndex = messages.value.length - 1
            if (aiMsgIndex >= 0 && messages.value[aiMsgIndex].role === 'ai') {
              try {
                const parsed = JSON.parse(data)
                messages.value[aiMsgIndex].content += parsed.d ?? ''
              } catch {
                messages.value[aiMsgIndex].content += data
              }
            }
            scrollToBottom()
          }
        }
      }
    })
    .catch(() => {})
    .finally(async () => {
      streaming.value = false
      sending.value = false
      sseAbortController = null
      // 重新获取应用信息以拿到最新的 deployKey
      try {
        const res = await getAppVoById({ id: appId.value })
        if (res.data.code === 0 && res.data.data) {
          app.value = res.data.data
        }
      } catch {}
      updatePreview()
    })

  if (!isInit) {
    inputText.value = ''
  }
}

const updatePreview = () => {
  if (app.value.codeGenType && appId.value) {
    previewUrl.value = buildPreviewUrl(app.value.codeGenType, appId.value)
  }
}

const handleSend = () => {
  sendMessage(inputText.value)
}

const handleStop = () => {
  if (sseAbortController) {
    sseAbortController.abort()
    sseAbortController = null
  }
  streaming.value = false
  sending.value = false
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && e.metaKey) {
    e.preventDefault()
    handleSend()
  }
}

const showAppDetail = ref(false)

const isOwnerOrAdmin = computed(() => {
  const user = loginUserStore.loginUser
  return user.id === app.value.userId || user.userRole === UserRoleEnum.ADMIN
})

const deploying = ref(false)
const deployProgress = ref(0)
let deployProgressTimer: ReturnType<typeof setInterval> | null = null

const startDeployProgress = () => {
  deployProgress.value = 0
  deployProgressTimer = setInterval(() => {
    // 模拟进度：快速到 30%，然后减速，最高到 90%
    if (deployProgress.value < 30) {
      deployProgress.value += 3
    } else if (deployProgress.value < 60) {
      deployProgress.value += 2
    } else if (deployProgress.value < 90) {
      deployProgress.value += 0.5
    }
  }, 300)
}

const stopDeployProgress = (success: boolean) => {
  if (deployProgressTimer) {
    clearInterval(deployProgressTimer)
    deployProgressTimer = null
  }
  if (success) {
    deployProgress.value = 100
    setTimeout(() => { deployProgress.value = 0 }, 600)
  } else {
    deployProgress.value = 0
  }
}

const handleDeploy = async () => {
  if (deploying.value || streaming.value) return
  try {
    deploying.value = true
    startDeployProgress()
    const res = await deployApp({ appId: appId.value })
    if (res.data.code === 0) {
      stopDeployProgress(true)
      message.success('部署成功')
      const appRes = await getAppVoById({ id: appId.value })
      if (appRes.data.code === 0 && appRes.data.data) {
        app.value = appRes.data.data
      }
      updatePreview()
      handleRefreshPreview()
    } else {
      stopDeployProgress(false)
      message.error(res.data.message || '部署失败')
    }
  } catch {
    stopDeployProgress(false)
    message.error('部署异常')
  } finally {
    deploying.value = false
  }
}

const handleDeleteApp = async () => {
  try {
    const res = await deleteApp({ id: appId.value })
    if (res.data.code === 0) {
      message.success('删除成功')
      router.push('/')
    } else {
      message.error(res.data.message || '删除失败')
    }
  } catch {
    message.error('删除异常')
  }
}

// ========== 代码提取与复制 ==========
const extractedCodeBlocks = computed(() => {
  const blocks: { lang: string; code: string; highlighted: string; filePath: string }[] = []
  const aiContent = messages.value
    .filter((m) => m.role === 'ai')
    .map((m) => m.content)
    .join('\n\n')
  // 匹配 [工具调用] 写入文件 xxx 后面跟着的代码块
  const regex = /(?:\[工具调用\]\s*写入文件\s+(\S+)\s*\n)?```(\w*)\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(aiContent)) !== null) {
    const filePath = match[1] || ''
    const lang = match[2] || 'plaintext'
    const code = match[3].trimEnd()
    let highlighted: string
    if (hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(code, { language: lang }).value
      } catch {
        highlighted = md.utils.escapeHtml(code)
      }
    } else {
      highlighted = md.utils.escapeHtml(code)
    }
    blocks.push({ lang, code, highlighted, filePath })
  }
  return blocks
})

// ========== 文件树结构（扁平化用于渲染） ==========
interface FlatFileNode {
  name: string
  path: string
  isDir: boolean
  depth: number
}

const flatFileTree = computed(() => {
  const paths = extractedCodeBlocks.value
    .map((b) => b.filePath)
    .filter(Boolean)
  if (paths.length === 0) return []

  // 先构建树
  interface TreeNode { name: string; path: string; isDir: boolean; children: TreeNode[] }
  const root: TreeNode[] = []
  for (const filePath of paths) {
    const parts = filePath.split('/')
    let current = root
    let currentPath = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isLast = i === parts.length - 1
      let node = current.find((n) => n.name === part)
      if (!node) {
        node = { name: part, path: currentPath, isDir: !isLast, children: [] }
        current.push(node)
      }
      current = node.children
    }
  }

  // 递归扁平化
  const flat: FlatFileNode[] = []
  const walk = (nodes: TreeNode[], depth: number) => {
    // 文件夹在前，文件在后
    const sorted = [...nodes].sort((a, b) => (a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1))
    for (const n of sorted) {
      flat.push({ name: n.name, path: n.path, isDir: n.isDir, depth })
      if (n.isDir) walk(n.children, depth + 1)
    }
  }
  walk(root, 0)
  return flat
})

const selectedFilePath = ref('')

const selectedCodeBlock = computed(() => {
  if (!selectedFilePath.value) return null
  return extractedCodeBlocks.value.find((b) => b.filePath === selectedFilePath.value) || null
})

const copiedIndex = ref<number | null>(null)
const copyCode = async (code: string, index: number) => {
  try {
    await navigator.clipboard.writeText(code)
    copiedIndex.value = index
    setTimeout(() => { copiedIndex.value = null }, 2000)
  } catch {
    message.error('复制失败')
  }
}

const handleRefreshPreview = () => {
  if (previewUrl.value) {
    previewUrl.value = previewUrl.value.replace(/[?&]t=\d+/, '') + `?t=${Date.now()}`
  }
}

const handleClickOutside = (e: MouseEvent) => {
  if (showAppDetail.value && !(e.target as HTMLElement).closest('.relative')) {
    showAppDetail.value = false
  }
}

onMounted(() => {
  loadApp()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  if (sseAbortController) {
    sseAbortController.abort()
    sseAbortController = null
  }
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="flex h-screen flex-col bg-[#F5F0EB] text-[#2D2318] dark:bg-[#1A1714] dark:text-[#F0EAE3]">

    <!-- ===== 顶部栏 ===== -->
    <header class="flex h-12 flex-shrink-0 items-center justify-between border-b border-[#E8E0D8] bg-[#FFFFFF] px-4 dark:border-[#3D3630] dark:bg-[#231F1B]">
      <!-- 左侧：返回 + 应用名 + 状态 -->
      <div class="flex items-center gap-3">
        <button type="button" class="flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm text-[#A89B8C] transition-colors hover:bg-[#F5F0EB] hover:text-[#7A6E62] dark:hover:bg-[#2E2924] dark:hover:text-[#B5A899]" @click="router.push('/')">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" /></svg>
          <span>创作</span>
        </button>
        <div class="h-4 w-px bg-[#E8E0D8] dark:bg-[#3D3630]" />
        <span class="max-w-[200px] truncate text-sm font-medium">{{ app.appName || '未命名应用' }}</span>
        <span v-if="streaming" class="flex items-center gap-1 rounded-full bg-[#FEF6E7] px-2 py-0.5 text-xs text-[#E5A84B] dark:bg-[#E5A84B]/15 dark:text-[#E5A84B]">
          <span class="h-1.5 w-1.5 rounded-full bg-[#E5A84B] animate-pulse" />
          创作中
        </span>
      </div>

      <!-- 中间：模式切换 -->
      <div class="flex items-center gap-1 rounded-xl bg-[#EDE7E0] p-0.5 dark:bg-[#2E2924]">
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs font-medium transition-all"
          :class="previewMode === 'preview' ? 'bg-[#FFFFFF] text-[#E8734A] shadow-[0_1px_3px_rgba(45,35,24,0.04)] dark:bg-[#3D3630] dark:text-[#E8734A]' : 'text-[#A89B8C] hover:text-[#7A6E62] dark:hover:text-[#B5A899]'"
          @click="previewMode = 'preview'"
        >
          预览
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs font-medium transition-all"
          :class="previewMode === 'code' ? 'bg-[#FFFFFF] text-[#E8734A] shadow-[0_1px_3px_rgba(45,35,24,0.04)] dark:bg-[#3D3630] dark:text-[#E8734A]' : 'text-[#A89B8C] hover:text-[#7A6E62] dark:hover:text-[#B5A899]'"
          @click="previewMode = 'code'"
        >
          &lt;/&gt;
        </button>
      </div>

      <!-- 右侧：刷新 + 应用详情 + 部署 -->
      <div class="flex items-center gap-2">
        <button v-if="previewUrl" type="button" class="rounded-xl p-1.5 text-[#A89B8C] transition-colors hover:bg-[#F5F0EB] hover:text-[#7A6E62] dark:hover:bg-[#2E2924]" @click="handleRefreshPreview" title="刷新预览">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" /></svg>
        </button>
        <!-- 应用详情 -->
        <div class="relative">
          <button
            type="button"
            class="rounded-xl border border-[#E8E0D8] px-3 py-1.5 text-xs font-medium text-[#7A6E62] transition-all hover:border-[#E8734A] hover:text-[#E8734A] dark:border-[#3D3630] dark:text-[#B5A899] dark:hover:border-[#E8734A] dark:hover:text-[#E8734A]"
            @click="showAppDetail = !showAppDetail"
          >
            应用详情
          </button>
          <!-- 悬浮窗 -->
          <div v-if="showAppDetail" class="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[#E8E0D8] bg-[#FFFFFF] p-4 shadow-[0_4px_20px_rgba(45,35,24,0.1)] dark:border-[#3D3630] dark:bg-[#1A1714]">
            <!-- 基础信息 -->
            <div class="space-y-3">
              <h4 class="text-sm font-semibold text-[#2D2318] dark:text-[#F0EAE3]">应用信息</h4>
              <!-- 创建者 -->
              <div class="flex items-center gap-2">
                <span class="w-14 flex-shrink-0 text-xs text-[#A89B8C]">创建者</span>
                <div class="flex items-center gap-2">
                  <img v-if="app.user?.userAvatar" :src="app.user.userAvatar" class="h-5 w-5 rounded-full object-cover" />
                  <div v-else class="flex h-5 w-5 items-center justify-center rounded-full bg-[#E8734A] text-[10px] font-bold text-white">{{ (app.user?.userName || '?')[0] }}</div>
                  <span class="text-xs text-[#7A6E62] dark:text-[#B5A899]">{{ app.user?.userName || '未知' }}</span>
                </div>
              </div>
              <!-- 创建时间 -->
              <div class="flex items-center gap-2">
                <span class="w-14 flex-shrink-0 text-xs text-[#A89B8C]">创建时间</span>
                <span class="text-xs text-[#7A6E62] dark:text-[#B5A899]">{{ app.createTime || '-' }}</span>
              </div>
            </div>
            <!-- 操作栏（仅本人或管理员） -->
            <div v-if="isOwnerOrAdmin" class="mt-4 flex gap-2 border-t border-[#F0EAE3] pt-3 dark:border-[#3D3630]">
              <button
                type="button"
                class="flex-1 rounded-xl border border-[#E8E0D8] px-3 py-1.5 text-xs font-medium text-[#7A6E62] transition-all hover:border-[#E8734A] hover:text-[#E8734A] dark:border-[#3D3630] dark:text-[#B5A899]"
                @click="router.push(`/app/edit/${appId}`); showAppDetail = false"
              >
                修改
              </button>
              <button
                type="button"
                class="flex-1 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition-all hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                @click="handleDeleteApp"
              >
                删除
              </button>
            </div>
          </div>
        </div>
        <div class="relative">
          <button
            type="button"
            class="relative overflow-hidden rounded-xl bg-[#E8734A] px-4 py-1.5 text-xs font-medium text-white transition-all hover:bg-[#D4623D] disabled:cursor-not-allowed"
            :disabled="deploying || streaming"
            @click="handleDeploy"
          >
            <!-- 进度条背景 -->
            <div
              v-if="deploying"
              class="absolute inset-0 bg-[#E8734A]/40 transition-all duration-300 ease-out"
              :style="{ width: deployProgress + '%' }"
            />
            <span v-if="deploying" class="relative flex items-center gap-1.5">
              <svg class="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {{ Math.round(deployProgress) }}%
            </span>
            <span v-else class="relative">发布</span>
          </button>
        </div>
      </div>
    </header>

    <!-- ===== 主体区域 ===== -->
    <div class="flex flex-1 overflow-hidden">

      <!-- ===== 左侧对话面板 ===== -->
      <div class="flex w-[440px] flex-shrink-0 flex-col border-r border-[#E8E0D8] bg-[#FFFFFF] dark:border-[#3D3630] dark:bg-[#231F1B]">

        <!-- 消息列表 -->
        <div ref="messageListRef" class="flex-1 overflow-y-auto px-4 py-5 space-y-5" @scroll="handleMessageListScroll">
          <!-- 加载更多 -->
          <div v-if="hasMoreHistory && messages.length > 0" class="pb-2 text-center">
            <button
              type="button"
              class="rounded-xl px-4 py-1.5 text-xs text-[#A89B8C] transition-colors hover:bg-[#F5F0EB] hover:text-[#7A6E62] dark:hover:bg-[#2E2924] dark:hover:text-[#B5A899]"
              :disabled="historyLoading"
              @click="loadChatHistory"
            >
              {{ historyLoading ? '加载中...' : '加载更多历史消息' }}
            </button>
          </div>
          <div v-for="(msg, i) in messages" :key="i">
            <!-- AI 消息 -->
            <div v-if="msg.role === 'ai'" class="space-y-2">
              <div class="flex items-center gap-2">
                <div class="flex h-6 w-6 items-center justify-center rounded-full bg-[#2D2318] dark:bg-[#F0EAE3]">
                  <span class="text-[10px] font-bold text-white dark:text-[#2D2318]">AI</span>
                </div>
                <span class="text-sm font-medium text-[#7A6E62] dark:text-[#B5A899]">Qiao AI</span>
              </div>
              <div class="ml-8 rounded-xl bg-[#F5F0EB] px-4 py-3 text-sm leading-relaxed text-[#7A6E62] dark:bg-[#2E2924]/60 dark:text-[#B5A899]">
                <div v-if="msg.content" class="markdown-body" v-html="renderMarkdown(msg.content)" />
                <span v-else-if="streaming && i === messages.length - 1" class="text-[#A89B8C]">思考中...</span>
              </div>
            </div>

            <!-- 用户消息 -->
            <div v-else class="flex justify-end">
              <div class="max-w-[85%] rounded-xl bg-[#E8734A] px-4 py-3 text-sm leading-relaxed text-white">
                <pre class="whitespace-pre-wrap break-words font-sans">{{ msg.content }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入框 -->
        <div class="flex-shrink-0 border-t border-[#F0EAE3] p-4 dark:border-[#3D3630]">
          <div class="rounded-xl border border-[#E8E0D8] bg-[#F5F0EB] transition-colors focus-within:border-[#E8734A] dark:border-[#3D3630] dark:bg-[#1A1714]">
            <textarea
              v-model="inputText"
              rows="4"
              class="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm outline-none placeholder:text-[#A89B8C] dark:placeholder:text-[#A89B8C]"
              placeholder="请描述你想生成的网站，越详细效果越好哦"
              :disabled="streaming"
              @keydown="handleKeydown"
            />
            <div class="flex items-center justify-between px-3 pb-2">
              <div />
              <!-- 生成中：暂停按钮 -->
              <button
                v-if="streaming"
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-full bg-[#E05454] text-white transition-all hover:bg-[#CC4545]"
                title="停止生成"
                @click="handleStop"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><rect x="5" y="5" width="10" height="10" rx="1" /></svg>
              </button>
              <!-- 空闲：发送按钮 -->
              <button
                v-else
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-full transition-all"
                :class="inputText.trim() ? 'bg-[#E8734A] text-white hover:bg-[#D4623D]' : 'bg-[#E8E0D8] text-[#A89B8C] dark:bg-[#3D3630]'"
                :disabled="!inputText.trim()"
                @click="handleSend"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 -rotate-90" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 右侧预览面板 ===== -->
      <div class="flex flex-1 flex-col bg-[#EDE7E0] dark:bg-[#1A1714]">
        <!-- 预览模式 -->
        <template v-if="previewMode === 'preview'">
          <!-- 流式生成中：加载状态 -->
          <div v-if="streaming" class="relative flex flex-1 items-center justify-center overflow-hidden">
            <div class="checkerboard absolute inset-0" />
            <div class="relative z-10 text-center space-y-4">
              <div class="mx-auto flex h-16 w-16 items-center justify-center">
                <svg class="h-10 w-10 animate-spin text-[#B5A899] dark:text-[#7A6E62]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              </div>
              <p class="text-sm text-[#A89B8C] dark:text-[#A89B8C]">AI 正在生成代码，马上就好...</p>
            </div>
          </div>
          <!-- 有预览内容 -->
          <iframe
            v-else-if="previewUrl"
            :src="previewUrl"
            class="flex-1 border-none bg-white"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
          <!-- 空状态 -->
          <div v-else class="relative flex flex-1 items-center justify-center overflow-hidden">
            <div class="checkerboard absolute inset-0" />
            <div class="relative z-10 text-center space-y-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-16 w-16 text-[#B5A899] dark:text-[#7A6E62]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <p class="text-sm text-[#A89B8C] dark:text-[#A89B8C]">发送消息后，生成的网页将在此预览</p>
            </div>
          </div>
        </template>

        <!-- 代码模式 -->
        <template v-else>
          <div v-if="extractedCodeBlocks.length > 0" class="flex flex-1 overflow-hidden">
            <!-- 左侧文件树 -->
            <div v-if="flatFileTree.length > 0" class="w-56 flex-shrink-0 overflow-y-auto border-r border-[#E8E0D8] bg-[#F5F0EB] dark:border-[#3D3630] dark:bg-[#231F1B]">
              <div class="px-3 py-2 text-xs font-semibold text-[#A89B8C] uppercase tracking-wider">文件结构</div>
              <div class="pb-2">
                <button
                  v-for="node in flatFileTree"
                  :key="node.path"
                  type="button"
                  class="flex w-full items-center gap-1.5 py-1 text-xs transition-colors"
                  :style="{ paddingLeft: (node.depth * 12 + 12) + 'px' }"
                  :class="!node.isDir && selectedFilePath === node.path
                    ? 'bg-[#FDF0EC] text-[#D4623D] dark:bg-[#E8734A]/15 dark:text-[#E8734A]'
                    : node.isDir
                      ? 'text-[#A89B8C] cursor-default'
                      : 'text-[#7A6E62] hover:bg-[#F5F0EB] dark:text-[#A89B8C] dark:hover:bg-[#2E2924]'"
                  @click="!node.isDir && (selectedFilePath = node.path)"
                >
                  <svg v-if="node.isDir" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 flex-shrink-0 text-[#E5A84B]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1H8a3 3 0 00-3 3v1.5a1.5 1.5 0 01-3 0V6z" clip-rule="evenodd" /><path d="M6 12a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H2h2a2 2 0 002-2v-2z" /></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 flex-shrink-0 text-[#A89B8C]" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" /></svg>
                  <span class="truncate">{{ node.name }}</span>
                </button>
              </div>
            </div>

            <!-- 右侧代码显示 -->
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
              <!-- 选中了某个文件 -->
              <template v-if="selectedCodeBlock">
                <div class="relative rounded-xl bg-neutral-800 overflow-hidden">
                  <div class="flex items-center justify-between px-4 py-2 border-b border-[#3D3630]">
                    <span class="text-xs text-[#A89B8C] font-mono">{{ selectedCodeBlock.filePath }}</span>
                    <button
                      type="button"
                      class="flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
                      :class="copiedIndex === -1 ? 'text-[#2DB87F]' : 'text-[#A89B8C] hover:text-white hover:bg-[#3D3630]'"
                      @click="copyCode(selectedCodeBlock.code, -1)"
                    >
                      {{ copiedIndex === -1 ? '已复制' : '复制' }}
                    </button>
                  </div>
                  <pre class="overflow-x-auto p-4 text-xs leading-relaxed"><code class="hljs" v-html="selectedCodeBlock.highlighted"></code></pre>
                </div>
              </template>
              <!-- 未选中文件：显示所有代码块 -->
              <template v-else>
                <div v-for="(block, idx) in extractedCodeBlocks" :key="idx" class="relative rounded-xl bg-neutral-800 overflow-hidden">
                  <div class="flex items-center justify-between px-4 py-2 border-b border-[#3D3630]">
                    <span class="text-xs text-[#A89B8C] font-mono">{{ block.filePath || block.lang }}</span>
                    <button
                      type="button"
                      class="flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
                      :class="copiedIndex === idx ? 'text-[#2DB87F]' : 'text-[#A89B8C] hover:text-white hover:bg-[#3D3630]'"
                      @click="copyCode(block.code, idx)"
                    >
                      <svg v-if="copiedIndex !== idx" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                      {{ copiedIndex === idx ? '已复制' : '复制' }}
                    </button>
                  </div>
                  <pre class="overflow-x-auto p-4 text-xs leading-relaxed"><code class="hljs" v-html="block.highlighted"></code></pre>
                </div>
              </template>
            </div>
          </div>
          <div v-else class="flex flex-1 items-center justify-center">
            <p class="text-sm text-[#A89B8C]">暂无代码输出</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  font-weight: 600;
  margin: 0.8em 0 0.4em;
  line-height: 1.4;
}
.markdown-body :deep(h1) { font-size: 1.25em; }
.markdown-body :deep(h2) { font-size: 1.125em; }
.markdown-body :deep(h3) { font-size: 1em; }
.markdown-body :deep(p) { margin: 0.5em 0; }
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.markdown-body :deep(li) { margin: 0.25em 0; }
.markdown-body :deep(pre.hljs) {
  border-radius: 0.75rem;
  padding: 1em;
  margin: 0.75em 0;
  overflow-x: auto;
  font-size: 0.8em;
  line-height: 1.6;
}
.markdown-body :deep(code) {
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
}
.markdown-body :deep(:not(pre) > code) {
  background: rgba(45,35,24,0.06);
  padding: 0.15em 0.4em;
  border-radius: 0.25em;
  font-size: 0.875em;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid #E8E0D8;
  padding-left: 1em;
  margin: 0.75em 0;
  color: #7A6E62;
}
.markdown-body :deep(a) {
  color: #E8734A;
  text-decoration: underline;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 0.75em 0;
  width: 100%;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #E8E0D8;
  padding: 0.4em 0.8em;
  text-align: left;
}

.checkerboard {
  background-image:
    linear-gradient(45deg, #E8E0D8 25%, transparent 25%),
    linear-gradient(-45deg, #E8E0D8 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #E8E0D8 75%),
    linear-gradient(-45deg, transparent 75%, #E8E0D8 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  opacity: 0.5;
}

:global(html.dark .checkerboard) {
  background-image:
    linear-gradient(45deg, #2E2924 25%, transparent 25%),
    linear-gradient(-45deg, #2E2924 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2E2924 75%),
    linear-gradient(-45deg, transparent 75%, #2E2924 75%);
}
</style>
