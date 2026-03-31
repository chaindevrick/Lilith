<template>
  <n-config-provider :theme="isDark ? darkTheme : null">
    <n-message-provider>
      <div class="app-root">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { NConfigProvider, NMessageProvider, darkTheme } from 'naive-ui';
import { isDark } from './views/useTheme.js';
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Noto+Sans+TC:wght@400;700&display=swap');

.app-root { 
  width: 100vw; 
  height: 100dvh; 
  background: var(--bg-primary); /* 套用變數 */
  color: var(--text-primary);   /* 套用變數 */
  overflow: hidden; 
  position: relative; 
  font-family: 'Noto Sans TC', sans-serif;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>