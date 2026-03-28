<template>
  <n-config-provider :theme="darkTheme">
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
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Noto+Sans+TC:wght@400;700&display=swap');

body { margin: 0; padding: 0; background: #1a1a1a; }

.app-root { 
  width: 100vw; 
  height: 100dvh; 
  background: #1a1a1a; 
  overflow: hidden; 
  position: relative; 
  font-family: 'Noto Sans TC', sans-serif;
  color: #eee;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>