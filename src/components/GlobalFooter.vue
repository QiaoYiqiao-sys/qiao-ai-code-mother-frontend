<template>
  <a-layout-footer class="footer">
    <div class="footer-content">
      <p class="copyright">桥一瞧 AI 零代码应用生产平台</p>
    </div>
  </a-layout-footer>
</template>

<script setup lang="ts">
// 无需额外的响应式数据
</script>

<style scoped>
.footer {
  background: transparent;
  text-align: center;
  padding: 24px 16px 8px;
}

.copyright {
  margin: 0 auto;
  max-width: 1200px;
  padding-top: 16px;
  border-top: 1px solid rgba(148, 163, 184, 0.28);
  color: #9ca3af;
  font-size: 13px;
  letter-spacing: 0.04em;
}
</style>
