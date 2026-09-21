import { createApp } from 'vue'
import UI from '@octans/ui'
import '@octans/ui/style.css'
import '@octans/ui/reset.css'
import './styles.css'
import App from './App.vue'
import { router } from './router'
import { boot } from './store'

const app = createApp(App)
app.use(UI)
app.use(router)
app.mount('#app')

void boot()
