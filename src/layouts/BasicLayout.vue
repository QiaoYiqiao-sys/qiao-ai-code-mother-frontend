<template>
  <router-view v-if="isMainPage" />
  <a-layout v-else class="basic-layout">
    <GlobalHeader />
    <a-layout-content class="main-content">
      <router-view />
    </a-layout-content>
    <GlobalFooter />
  </a-layout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import GlobalHeader from '@/components/GlobalHeader.vue'
import GlobalFooter from '@/components/GlobalFooter.vue'

const route = useRoute()
const isMainPage = computed(() =>
  ['/', '/about', '/admin/userManage'].includes(route.path),
)
</script>

<style scoped>
.basic-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  padding: 0 16px 24px;
  box-sizing: border-box;
}

.main-content {
  width: 100%;
  max-width: 1500px;
  margin: 96px auto 32px;
  padding: 32px 32px 40px;
  background: color-mix(in srgb, #ffffff 72%, transparent);
  border-radius: 24px;
  border: 1px solid #e5e5e5;
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  box-sizing: border-box;
  color: #171717;
}

:global(html.dark .basic-layout) {
  background: #0a0a0a;
}

:global(html.dark .main-content) {
  background: color-mix(in srgb, #0a0a0a 68%, transparent);
  border-color: #262626;
  color: #e5e5e5;
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
