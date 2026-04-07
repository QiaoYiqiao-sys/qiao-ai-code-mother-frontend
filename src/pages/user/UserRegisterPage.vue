<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { userRegister } from '@/api/userController.ts'

const router = useRouter()

const formRef = ref()

const formState = reactive<API.UserRegisterRequest & { userName?: string }>({
  userName: '',
  userAccount: '',
  userPassword: '',
  checkPassword: '',
})

const rules: Record<string, Rule[]> = {
  userName: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  userAccount: [
    { required: true, message: '请输入账号（可为邮箱）', trigger: 'blur' },
    { min: 4, message: '账号长度不能少于 4 位', trigger: 'blur' },
  ],
  userPassword: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于 6 位', trigger: 'blur' },
  ],
  checkPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value) => {
        if (!value || value === formState.userPassword) {
          return Promise.resolve()
        }
        return Promise.reject('两次输入的密码不一致')
      },
      trigger: 'blur',
    },
  ],
}

const loading = ref(false)

const onFinish = async () => {
  try {
    loading.value = true
    const payload: API.UserRegisterRequest = {
      userAccount: formState.userAccount,
      userPassword: formState.userPassword,
      checkPassword: formState.checkPassword,
    }
    const res = await userRegister(payload)
    const { data } = res
    if (data.code === 0) {
      message.success('注册成功，请登录')
      router.push('/user/login')
    } else {
      message.error(data.message || '注册失败，请稍后重试')
    }
  } catch (e) {
    message.error('注册异常，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <header class="auth-header">
        <h1 class="auth-title">创建新账号</h1>
        <p class="auth-subtitle">几秒钟完成注册，开启你的 AI 应用生成之旅</p>
      </header>

      <form class="auth-form">
        <a-form
          ref="formRef"
          layout="vertical"
          :model="formState"
          :rules="rules"
          name="registerForm"
          @finish="onFinish"
        >
          <a-form-item label="用户名" name="userName">
            <a-input
              v-model:value="formState.userName"
              size="large"
              placeholder="请输入用户名"
              autocomplete="nickname"
            />
          </a-form-item>
          <a-form-item label="账号" name="userAccount">
            <a-input
              v-model:value="formState.userAccount"
              size="large"
              placeholder="请输入账号（可为邮箱）"
              autocomplete="username"
            />
          </a-form-item>
          <a-form-item label="密码" name="userPassword">
            <a-input-password
              v-model:value="formState.userPassword"
              size="large"
              placeholder="请输入密码"
              autocomplete="new-password"
            />
          </a-form-item>
          <a-form-item label="确认密码" name="checkPassword">
            <a-input-password
              v-model:value="formState.checkPassword"
              size="large"
              placeholder="请再次输入密码"
              autocomplete="new-password"
            />
          </a-form-item>
          <div class="auth-extra">
            <a-checkbox>我已阅读并同意服务条款</a-checkbox>
          </div>
          <a-button type="primary" block size="large" html-type="submit" :loading="loading">
            注册
          </a-button>
        </a-form>
      </form>

      <footer class="auth-footer">
        <span>已经有账号？</span>
        <RouterLink to="/user/login">直接登录</RouterLink>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: calc(100vh - 140px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-card {
  width: 100%;
  max-width: 480px;
  padding: 32px 32px 28px;
  border-radius: 24px;
  background:
    radial-gradient(circle at 0 0, rgba(59, 130, 246, 0.16), transparent 55%),
    radial-gradient(circle at 100% 100%, rgba(244, 114, 182, 0.18), transparent 55%),
    rgba(15, 23, 42, 0.9);
  box-shadow:
    0 24px 60px rgba(15, 23, 42, 0.9),
    0 0 0 1px rgba(148, 163, 184, 0.45);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  color: #fff;
  box-sizing: border-box;
}

.auth-card :deep(.ant-form-item-label > label) {
  color: #fff;
}

.auth-card :deep(.ant-checkbox-wrapper) {
  color: #fff;
}

.auth-header {
  margin-bottom: 24px;
}

.auth-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
}

.auth-subtitle {
  margin: 0;
  font-size: 14px;
  color: #fff;
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
  color: #fff;
}

.auth-footer a {
  color: #22c55e;
}

@media (max-width: 640px) {
  .auth-card {
    padding: 24px 20px 22px;
    border-radius: 18px;
  }
}
</style>
