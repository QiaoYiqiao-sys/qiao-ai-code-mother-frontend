/**
 * 代码生成类型枚举（与后端 CodeGenTypeEnum 对应）
 */
export enum CodeGenTypeEnum {
  HTML = 'html',
  MULTI_FILE = 'multi_file',
  VUE_PROJECT = 'vue_project',
}

/** 代码生成类型 label 映射 */
export const CodeGenTypeLabels: Record<CodeGenTypeEnum, string> = {
  [CodeGenTypeEnum.HTML]: '原生 HTML 模式',
  [CodeGenTypeEnum.MULTI_FILE]: '原生多文件模式',
  [CodeGenTypeEnum.VUE_PROJECT]: 'Vue 工程模式',
}

/**
 * 用户角色枚举
 */
export enum UserRoleEnum {
  USER = 'user',
  ADMIN = 'admin',
}

export const UserRoleLabels: Record<UserRoleEnum, string> = {
  [UserRoleEnum.USER]: '普通用户',
  [UserRoleEnum.ADMIN]: '管理员',
}

/**
 * 消息类型枚举
 */
export enum MessageTypeEnum {
  USER = 'user',
  AI = 'ai',
}

export const MessageTypeLabels: Record<MessageTypeEnum, string> = {
  [MessageTypeEnum.USER]: '用户消息',
  [MessageTypeEnum.AI]: 'AI 消息',
}
