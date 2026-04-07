<template>
  <main class="auth-page">
    <section class="auth-card">
      <header class="auth-header">
        <h1 class="auth-title">登录</h1>
        <p class="auth-subtitle">登录你的账号，继续构建你的应用</p>
      </header>

      <form class="auth-form">
        <a-form
          ref="formRef"
          layout="vertical"
          :model="formState"
          :rules="rules"
          name="loginForm"
          @finish="onFinish"
        >
          <a-form-item label="账号" name="userAccount">
            <a-input
              v-model:value="formState.userAccount"
              size="large"
              placeholder="请输入账号"
              autocomplete="username"
            />
          </a-form-item>
          <a-form-item label="密码" name="userPassword">
            <a-input-password
              v-model:value="formState.userPassword"
              size="large"
              placeholder="请输入密码"
              autocomplete="current-password"
            />
          </a-form-item>
          <div class="auth-extra">
            <a-checkbox>记住我</a-checkbox>
            <a-typography-link>忘记密码？</a-typography-link>
          </div>
          <a-button type="primary" block size="large" html-type="submit" :loading="loading">
            登录
          </a-button>
        </a-form>
      </form>

      <footer class="auth-footer">
        <span>还没有账号？</span>
        <RouterLink to="/user/register">立即注册</RouterLink>
      </footer>
    </section>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { userLogin } from '@/api/userController.ts'
import { useLoginUserStore } from '@/stores/loginUser'

const router = useRouter()
const route = useRoute()
const loginUserStore = useLoginUserStore()

const formRef = ref()

const formState = reactive<API.UserLoginRequest>({
  userAccount: '',
  userPassword: '',
})

const rules: Record<string, Rule[]> = {
  userAccount: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 4, message: '账号长度不能少于 4 位', trigger: 'blur' },
  ],
  userPassword: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 位', trigger: 'blur' },
  ],
}

const loading = ref(false)

const onFinish = async () => {
  try {
    loading.value = true
    const res = await userLogin(formState)
    const { data } = res
    if (data.code === 0) {
      message.success('登录成功')
      if (data.data) {
        loginUserStore.setLoginUser(data.data)
      } else {
        await loginUserStore.fetchLoginUser()
      }
      const redirect = (route.query.redirect as string) || '/'
      router.push(redirect)
    } else {
      message.error(data.message || '登录失败，请稍后重试')
    }
  } catch (e) {
    message.error('登录异常，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: calc(100vh - 140px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  padding: 32px 32px 28px;
  border-radius: 24px;
  background: color-mix(in srgb, #ffffff 72%, transparent);
  border: 1px solid #e5e5e5;
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  color: #171717;
  box-sizing: border-box;
}

.auth-card :deep(.ant-form-item-label > label) {
  color: #171717;
}

.auth-card :deep(.ant-checkbox-wrapper) {
  color: #171717;
}

.auth-card :deep(.ant-typography) {
  color: #171717;
}

.auth-header {
  margin-bottom: 24px;
}

.auth-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: #171717;
}

.auth-subtitle {
  margin: 0;
  font-size: 14px;
  color: #525252;
}

.auth-form {
  margin-bottom: 16px;
}

.auth-extra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.auth-footer {
  display: flex;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
}

.auth-footer a {
  color: #3b82f6;
}

:global(html.dark .auth-card) {
  background: color-mix(in srgb, #0a0a0a 72%, transparent);
  border-color: #262626;
  color: #e5e5e5;
}

:global(html.dark .auth-card .auth-title),
:global(html.dark .auth-card :where(.auth-footer, .ant-checkbox-wrapper, .ant-typography)),
:global(html.dark .auth-card :where(.ant-form-item-label > label)) {
  color: #e5e5e5 !important;
}

:global(html.dark .auth-card .auth-subtitle) {
  color: #a3a3a3;
}

@media (max-width: 640px) {
  .auth-card {
    padding: 24px 20px 22px;
    border-radius: 18px;
  }
}
</style>
