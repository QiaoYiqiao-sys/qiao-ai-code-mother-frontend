import { ref, type Ref } from 'vue'

export interface SelectedElement {
  tagName: string
  id: string
  className: string
  textContent: string
  cssSelector: string
}

// 注入到 iframe 内部的样式 ID
const INJECTED_STYLE_ID = '__visual_editor_style__'
// 选中元素的标记属性
const SELECTED_ATTR = 'data-ve-selected'

/**
 * 生成元素的唯一 CSS 选择器路径
 */
function buildCssSelector(el: Element): string {
  const parts: string[] = []
  let current: Element | null = el
  while (current && current !== current.ownerDocument.body) {
    let selector = current.tagName.toLowerCase()
    if (current.id) {
      selector += `#${current.id}`
      parts.unshift(selector)
      break
    }
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children)
      const sameTag = siblings.filter((s) => s.tagName === current!.tagName)
      if (sameTag.length > 1) {
        const index = sameTag.indexOf(current) + 1
        selector += `:nth-of-type(${index})`
      }
    }
    parts.unshift(selector)
    current = parent
  }
  return parts.join(' > ')
}

/**
 * 提取元素信息
 */
function extractElementInfo(el: Element): SelectedElement {
  const text = (el.textContent || '').trim()
  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id || '',
    className: el.className && typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 5).join(' ') : '',
    textContent: text.length > 50 ? text.slice(0, 50) + '...' : text,
    cssSelector: buildCssSelector(el),
  }
}

/**
 * 构建注入 iframe 的高亮样式
 */
function buildInjectedCSS(): string {
  return `
    [data-ve-hover] {
      outline: 2px dashed #3B82F6 !important;
      outline-offset: 1px !important;
      cursor: pointer !important;
    }
    [${SELECTED_ATTR}] {
      outline: 2px solid #2563EB !important;
      outline-offset: 1px !important;
    }
  `
}

export function useVisualEditor() {
  const editMode = ref(false)
  const selectedElements: Ref<SelectedElement[]> = ref([])

  let iframeEl: HTMLIFrameElement | null = null
  let iframeDoc: Document | null = null
  let hoverTarget: Element | null = null

  // 事件处理函数（保存引用以便移除）
  let onMouseOver: ((e: Event) => void) | null = null
  let onMouseOut: ((e: Event) => void) | null = null
  let onClick: ((e: Event) => void) | null = null

  /**
   * 注入样式到 iframe
   */
  function injectStyle(doc: Document) {
    if (doc.getElementById(INJECTED_STYLE_ID)) return
    const style = doc.createElement('style')
    style.id = INJECTED_STYLE_ID
    style.textContent = buildInjectedCSS()
    doc.head.appendChild(style)
  }

  /**
   * 移除注入的样式
   */
  function removeStyle(doc: Document) {
    const style = doc.getElementById(INJECTED_STYLE_ID)
    if (style) style.remove()
  }

  /**
   * 清除 iframe 中所有高亮和选中标记
   */
  function clearIframeMarks() {
    if (!iframeDoc) return
    // 清除 hover
    const hovered = iframeDoc.querySelector('[data-ve-hover]')
    if (hovered) hovered.removeAttribute('data-ve-hover')
    // 清除选中
    iframeDoc.querySelectorAll(`[${SELECTED_ATTR}]`).forEach((el) => {
      el.removeAttribute(SELECTED_ATTR)
    })
    hoverTarget = null
  }

  /**
   * 进入编辑模式
   */
  function enterEditMode(iframe: HTMLIFrameElement) {
    try {
      const doc = iframe.contentDocument
      if (!doc) return
      iframeEl = iframe
      iframeDoc = doc
      editMode.value = true

      injectStyle(doc)

      // Hover 高亮
      onMouseOver = (e: Event) => {
        const target = e.target as Element
        if (!target || target === doc.body || target === doc.documentElement) return
        if (hoverTarget && hoverTarget !== target) {
          hoverTarget.removeAttribute('data-ve-hover')
        }
        if (!target.hasAttribute(SELECTED_ATTR)) {
          target.setAttribute('data-ve-hover', '')
        }
        hoverTarget = target
      }

      onMouseOut = (e: Event) => {
        const target = e.target as Element
        if (target) {
          target.removeAttribute('data-ve-hover')
        }
        if (hoverTarget === target) {
          hoverTarget = null
        }
      }

      // 点击选中/取消选中
      onClick = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        const target = e.target as Element
        if (!target || target === doc.body || target === doc.documentElement) return

        if (target.hasAttribute(SELECTED_ATTR)) {
          // 取消选中
          target.removeAttribute(SELECTED_ATTR)
          const selector = buildCssSelector(target)
          selectedElements.value = selectedElements.value.filter((el) => el.cssSelector !== selector)
        } else {
          // 选中
          target.removeAttribute('data-ve-hover')
          target.setAttribute(SELECTED_ATTR, '')
          selectedElements.value.push(extractElementInfo(target))
        }
      }

      doc.addEventListener('mouseover', onMouseOver, true)
      doc.addEventListener('mouseout', onMouseOut, true)
      doc.addEventListener('click', onClick, true)
    } catch {
      // contentDocument 可能因跨域限制无法访问
      editMode.value = false
    }
  }

  /**
   * 退出编辑模式
   */
  function exitEditMode() {
    if (iframeDoc) {
      if (onMouseOver) iframeDoc.removeEventListener('mouseover', onMouseOver, true)
      if (onMouseOut) iframeDoc.removeEventListener('mouseout', onMouseOut, true)
      if (onClick) iframeDoc.removeEventListener('click', onClick, true)
      clearIframeMarks()
      removeStyle(iframeDoc)
    }
    onMouseOver = null
    onMouseOut = null
    onClick = null
    iframeDoc = null
    iframeEl = null
    editMode.value = false
  }

  /**
   * 切换编辑模式
   */
  function toggleEditMode(iframe: HTMLIFrameElement | null) {
    if (editMode.value) {
      exitEditMode()
    } else if (iframe) {
      enterEditMode(iframe)
    }
  }

  /**
   * 移除指定索引的选中元素
   */
  function removeElement(index: number) {
    const removed = selectedElements.value[index]
    if (removed && iframeDoc) {
      // 尝试在 iframe 中移除对应元素的选中标记
      try {
        const el = iframeDoc.querySelector(removed.cssSelector)
        if (el) el.removeAttribute(SELECTED_ATTR)
      } catch {
        // selector 可能无效，忽略
      }
    }
    selectedElements.value.splice(index, 1)
  }

  /**
   * 清空所有选中元素
   */
  function clearSelection() {
    clearIframeMarks()
    selectedElements.value = []
  }

  /**
   * 构建选中元素的提示词片段
   */
  function buildElementPrompt(): string {
    if (selectedElements.value.length === 0) return ''
    const lines = selectedElements.value.map((el, i) => {
      const parts = [`<${el.tagName}>`]
      if (el.id) parts.push(`id="${el.id}"`)
      if (el.className) parts.push(`class="${el.className}"`)
      parts.push(`selector="${el.cssSelector}"`)
      if (el.textContent) parts.push(`text="${el.textContent}"`)
      return `  元素${i + 1}: ${parts.join(' ')}`
    })
    return `[用户在页面上选中了以下元素，请针对这些元素进行修改]\n${lines.join('\n')}\n[用户的修改要求]\n`
  }

  /**
   * 组件卸载时清理
   */
  function cleanup() {
    if (editMode.value) {
      exitEditMode()
    }
    selectedElements.value = []
  }

  return {
    editMode,
    selectedElements,
    enterEditMode,
    exitEditMode,
    toggleEditMode,
    removeElement,
    clearSelection,
    buildElementPrompt,
    cleanup,
  }
}
