import { API_BASE_URL, STATIC_BASE_URL } from '@/config'
import { CodeGenTypeEnum } from '@/enums'

/**
 * 获取静态资源预览URL（生成阶段，未部署）
 * Vue 项目需要访问 dist/index.html
 */
export function buildPreviewUrl(codeGenType: string, appId: string | number): string {
  const baseUrl = `${STATIC_BASE_URL}/${codeGenType}_${appId}/`
  if (codeGenType === CodeGenTypeEnum.VUE_PROJECT) {
    return `${baseUrl}dist/index.html`
  }
  return baseUrl
}

/**
 * 构建已部署作品的访问地址
 * 路径：/api/static/{deployKey}
 */
export function buildDeployUrl(deployKey: string): string {
  return `${STATIC_BASE_URL}/${deployKey}`
}

/**
 * 构建 SSE 流式代码生成请求地址
 */
export function buildSseUrl(appId: number, message: string): string {
  return `${API_BASE_URL}/app/chat/gen/code?appId=${appId}&message=${encodeURIComponent(message)}`
}
