// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia' // 1. Import Pinia
import './style.css'
import '@/assets/styles/theme.css'
import App from './App.vue'
import router from '@/router/router'

const app = createApp(App)
const pinia = createPinia() // 2. Create the Pinia instance

app.use(pinia)  // 3. Register Pinia BEFORE the router or mounting
app.use(router)

app.mount('#app')