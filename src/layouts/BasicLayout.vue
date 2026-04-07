<template>
  <a-layout class="basic-layout">
    <!-- 顶部导航栏 -->
    <GlobalHeader />

    <!-- 主要内容区域 -->
    <a-layout-content class="main-content">
      <router-view />
    </a-layout-content>

    <!-- 底部版权信息 -->
    <GlobalFooter />
  </a-layout>
</template>

<script setup lang="ts">
import GlobalHeader from '@/components/GlobalHeader.vue'
import GlobalFooter from '@/components/GlobalFooter.vue'
</script>

<style scoped>
.basic-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 0 0, rgba(94, 234, 212, 0.18), transparent 55%),
    radial-gradient(circle at 100% 0, rgba(129, 140, 248, 0.2), transparent 55%),
    linear-gradient(135deg, #020617, #020617 30%, #020617 55%, #020617 75%, #0b1120 100%);
  padding: 0 16px 24px;
  box-sizing: border-box;
}

.main-content {
  width: 100%;
  max-width: 1500px;
  margin: 96px auto 32px;
  padding: 32px 32px 40px;
  background: rgba(15, 23, 42, 0.78);
  border-radius: 24px;
  box-shadow:
    0 24px 60px rgba(15, 23, 42, 0.85),
    0 0 0 1px rgba(148, 163, 184, 0.35);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  box-sizing: border-box;
  color: #e5e7eb;
}

@media (max-width: 992px) {
  .main-content {
    margin: 88px auto 24px;
    padding: 24px 20px 32px;
    border-radius: 20px;
  }
}

@media (max-width: 640px) {
  .basic-layout {
    padding: 0 12px 20px;
  }

  .main-content {
    margin: 80px auto 20px;
    padding: 20px 16px 24px;
    border-radius: 18px;
  }
}
</style>
