import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/chat'
  },
  {
    path: '/chat',
    name: 'Chat',
    // 載入我們等一下要建立的主對話室
    component: () => import('../views/chat/ChatRoom.vue')
  },
  {
    path: '/setup',
    name: 'Setup',
    // 載入我們之前寫好的設定精靈
    component: () => import('../views/setup/SetupWizard.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 🌟 路由守衛：如果尚未完成設定，強制導向設定精靈
router.beforeEach((to, from, next) => {
  const isSetupCompleted = localStorage.getItem('lilith_setup_completed') === 'true';
  
  if (!isSetupCompleted && to.path !== '/setup') {
    next('/setup');
  } else {
    next();
  }
});

export default router