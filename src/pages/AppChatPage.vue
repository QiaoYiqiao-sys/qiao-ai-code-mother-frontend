<script setup lang="ts">
import { message } from 'ant-design-vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoginUserStore } from '@/stores/loginUser'
import { getAppVoById, deleteApp } from '@/api/appController'
import { listAppChatHistory } from '@/api/chatHistoryController'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'


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

  const url = `http://localhost:8888/api/app/chat/gen/code?appId=${appId.value}&message=${encodeURIComponent(text)}`
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
    const key = app.value.deployKey || appId.value
    previewUrl.value = `http://localhost:8888/api/static/${app.value.codeGenType}_${key}`
  }
}

const handleSend = () => {
  sendMessage(inputText.value)
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
  return user.id === app.value.userId || user.userRole === 'admin'
})

const handleDeploy = () => {
  message.info('部署功能即将上线')
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
  const blocks: { lang: string; code: string; highlighted: string }[] = []
  const aiContent = messages.value
    .filter((m) => m.role === 'ai')
    .map((m) => m.content)
    .join('\n\n')
  const regex = /```(\w*)\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(aiContent)) !== null) {
    const lang = match[1] || 'plaintext'
    const code = match[2].trimEnd()
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
    blocks.push({ lang, code, highlighted })
  }
  return blocks
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
  <div class="flex h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-[#0A0A0A] dark:text-neutral-100">

    <!-- ===== 顶部栏 ===== -->
    <header class="flex h-12 flex-shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-[#111]">
      <!-- 左侧：返回 + 应用名 + 状态 -->
      <div class="flex items-center gap-3">
        <button type="button" class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300" @click="router.push('/')">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" /></svg>
          <span>创作</span>
        </button>
        <div class="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
        <span class="max-w-[200px] truncate text-sm font-medium">{{ app.appName || '未命名应用' }}</span>
        <span v-if="streaming" class="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
          <span class="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          创作中
        </span>
      </div>

      <!-- 中间：模式切换 -->
      <div class="flex items-center gap-1 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs font-medium transition-all"
          :class="previewMode === 'preview' ? 'bg-white text-[#3B82F6] shadow-sm dark:bg-neutral-700 dark:text-blue-400' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
          @click="previewMode = 'preview'"
        >
          预览
        </button>
        <button
          type="button"
          class="rounded-md px-3 py-1 text-xs font-medium transition-all"
          :class="previewMode === 'code' ? 'bg-white text-[#3B82F6] shadow-sm dark:bg-neutral-700 dark:text-blue-400' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
          @click="previewMode = 'code'"
        >
          &lt;/&gt;
        </button>
      </div>

      <!-- 右侧：刷新 + 应用详情 + 部署 -->
      <div class="flex items-center gap-2">
        <button v-if="previewUrl" type="button" class="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800" @click="handleRefreshPreview" title="刷新预览">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" /></svg>
        </button>
        <!-- 应用详情 -->
        <div class="relative">
          <button
            type="button"
            class="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all hover:border-[#3B82F6] hover:text-[#3B82F6] dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
            @click="showAppDetail = !showAppDetail"
          >
            应用详情
          </button>
          <!-- 悬浮窗 -->
          <div v-if="showAppDetail" class="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <!-- 基础信息 -->
            <div class="space-y-3">
              <h4 class="text-sm font-semibold text-neutral-800 dark:text-neutral-200">应用信息</h4>
              <!-- 创建者 -->
              <div class="flex items-center gap-2">
                <span class="w-14 flex-shrink-0 text-xs text-neutral-400">创建者</span>
                <div class="flex items-center gap-2">
                  <img v-if="app.user?.userAvatar" :src="app.user.userAvatar" class="h-5 w-5 rounded-full object-cover" />
                  <div v-else class="flex h-5 w-5 items-center justify-center rounded-full bg-[#3B82F6] text-[10px] font-bold text-white">{{ (app.user?.userName || '?')[0] }}</div>
                  <span class="text-xs text-neutral-700 dark:text-neutral-300">{{ app.user?.userName || '未知' }}</span>
                </div>
              </div>
              <!-- 创建时间 -->
              <div class="flex items-center gap-2">
                <span class="w-14 flex-shrink-0 text-xs text-neutral-400">创建时间</span>
                <span class="text-xs text-neutral-700 dark:text-neutral-300">{{ app.createTime || '-' }}</span>
              </div>
            </div>
            <!-- 操作栏（仅本人或管理员） -->
            <div v-if="isOwnerOrAdmin" class="mt-4 flex gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <button
                type="button"
                class="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-all hover:border-[#3B82F6] hover:text-[#3B82F6] dark:border-neutral-700 dark:text-neutral-300"
                @click="router.push(`/app/edit/${appId}`); showAppDetail = false"
              >
                修改
              </button>
              <button
                type="button"
                class="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition-all hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                @click="handleDeleteApp"
              >
                删除
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="rounded-lg bg-[#3B82F6] px-4 py-1.5 text-xs font-medium text-white transition-all hover:bg-blue-500"
          @click="handleDeploy"
        >
          发布
        </button>
      </div>
    </header>

    <!-- ===== 主体区域 ===== -->
    <div class="flex flex-1 overflow-hidden">

      <!-- ===== 左侧对话面板 ===== -->
      <div class="flex w-[440px] flex-shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-[#111]">

        <!-- 消息列表 -->
        <div ref="messageListRef" class="flex-1 overflow-y-auto px-4 py-5 space-y-5" @scroll="handleMessageListScroll">
          <!-- 加载更多 -->
          <div v-if="hasMoreHistory && messages.length > 0" class="pb-2 text-center">
            <button
              type="button"
              class="rounded-lg px-4 py-1.5 text-xs text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
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
                <div class="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 dark:bg-neutral-200">
                  <span class="text-[10px] font-bold text-white dark:text-neutral-800">AI</span>
                </div>
                <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Qiao AI</span>
              </div>
              <div class="ml-8 rounded-xl bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300">
                <div v-if="msg.content" class="markdown-body" v-html="renderMarkdown(msg.content)" />
                <span v-else-if="streaming && i === messages.length - 1" class="text-neutral-400">思考中...</span>
              </div>
            </div>

            <!-- 用户消息 -->
            <div v-else class="flex justify-end">
              <div class="max-w-[85%] rounded-xl bg-[#3B82F6] px-4 py-3 text-sm leading-relaxed text-white">
                <pre class="whitespace-pre-wrap break-words font-sans">{{ msg.content }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入框 -->
        <div class="flex-shrink-0 border-t border-neutral-100 p-4 dark:border-neutral-800">
          <div class="rounded-xl border border-neutral-200 bg-neutral-50 transition-colors focus-within:border-[#3B82F6] dark:border-neutral-700 dark:bg-neutral-900">
            <textarea
              v-model="inputText"
              rows="4"
              class="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              placeholder="请描述你想生成的网站，越详细效果越好哦"
              :disabled="streaming"
              @keydown="handleKeydown"
            />
            <div class="flex items-center justify-between px-3 pb-2">
              <div />
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-full transition-all"
                :class="inputText.trim() && !streaming ? 'bg-[#3B82F6] text-white hover:bg-blue-500' : 'bg-neutral-200 text-neutral-400 dark:bg-neutral-700'"
                :disabled="streaming || !inputText.trim()"
                @click="handleSend"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 -rotate-90" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 右侧预览面板 ===== -->
      <div class="flex flex-1 flex-col bg-neutral-100 dark:bg-neutral-900">
        <!-- 预览模式 -->
        <template v-if="previewMode === 'preview'">
          <!-- 流式生成中：加载状态 -->
          <div v-if="streaming" class="relative flex flex-1 items-center justify-center overflow-hidden">
            <div class="checkerboard absolute inset-0" />
            <div class="relative z-10 text-center space-y-4">
              <div class="mx-auto flex h-16 w-16 items-center justify-center">
                <svg class="h-10 w-10 animate-spin text-neutral-300 dark:text-neutral-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              </div>
              <p class="text-sm text-neutral-500 dark:text-neutral-400">AI 正在生成代码，马上就好...</p>
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
              <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-16 w-16 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <p class="text-sm text-neutral-400 dark:text-neutral-500">发送消息后，生成的网页将在此预览</p>
            </div>
          </div>
        </template>

        <!-- 代码模式 -->
        <template v-else>
          <div v-if="extractedCodeBlocks.length > 0" class="flex-1 overflow-y-auto p-6 space-y-4">
            <div v-for="(block, idx) in extractedCodeBlocks" :key="idx" class="relative rounded-xl bg-neutral-800 overflow-hidden">
              <div class="flex items-center justify-between px-4 py-2 border-b border-neutral-700">
                <span class="text-xs text-neutral-400">{{ block.lang }}</span>
                <button
                  type="button"
                  class="flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
                  :class="copiedIndex === idx ? 'text-green-400' : 'text-neutral-400 hover:text-white hover:bg-neutral-700'"
                  @click="copyCode(block.code, idx)"
                >
                  <svg v-if="copiedIndex !== idx" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                  {{ copiedIndex === idx ? '已复制' : '复制' }}
                </button>
              </div>
              <pre class="overflow-x-auto p-4 text-xs leading-relaxed"><code class="hljs" v-html="block.highlighted"></code></pre>
            </div>
          </div>
          <div v-else class="flex flex-1 items-center justify-center">
            <p class="text-sm text-neutral-400">暂无代码输出</p>
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
  background: rgba(0,0,0,0.06);
  padding: 0.15em 0.4em;
  border-radius: 0.25em;
  font-size: 0.875em;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid #d1d5db;
  padding-left: 1em;
  margin: 0.75em 0;
  color: #6b7280;
}
.markdown-body :deep(a) {
  color: #3B82F6;
  text-decoration: underline;
}
.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 0.75em 0;
  width: 100%;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #d1d5db;
  padding: 0.4em 0.8em;
  text-align: left;
}

.checkerboard {
  background-image:
    linear-gradient(45deg, #e5e5e5 25%, transparent 25%),
    linear-gradient(-45deg, #e5e5e5 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e5e5e5 75%),
    linear-gradient(-45deg, transparent 75%, #e5e5e5 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
  opacity: 0.5;
}

:global(html.dark .checkerboard) {
  background-image:
    linear-gradient(45deg, #1a1a1a 25%, transparent 25%),
    linear-gradient(-45deg, #1a1a1a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1a1a1a 75%),
    linear-gradient(-45deg, transparent 75%, #1a1a1a 75%);
}
</style>
