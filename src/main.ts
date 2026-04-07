import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './assets/main.css'
import '@/assets/access'

const storedTheme = localStorage.getItem('theme')
if (storedTheme === 'dark' || storedTheme === 'light') {
  document.documentElement.classList.toggle('dark', storedTheme === 'dark')
}

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(Antd)
app.mount('#app')
