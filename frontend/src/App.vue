<template>
  <n-config-provider :theme="null">
    <div class="app-root">
      
      <transition name="fade">
        <div v-if="!isMobile && currentView === 'cockpit'" class="cockpit-viewport desktop-grid">
          <LeftStage 
            v-model:chatMode="chatMode"
            :currentSpeaker="currentSpeaker"
          />
          <CenterConsole 
            :currentTime="currentTime"
            :filteredHistory="filteredHistory"
            :displayedText="displayedText"
            :isTyping="isTyping"
            :isThinking="isThinking"
            :currentSpeaker="currentSpeaker"
            v-model:userInput="userInput"
            :emotion="emotion"
            :currentMood="currentMood"
            :currentAffection="currentAffection"
            :normalizeStat="normalizeStat"
            :moodColor="moodColor"
            @sendMessage="sendMessage"
            @setChatRef="(el) => { chatContainer = el }"
          />
          <n-message-provider>
            <RightIDE />
          </n-message-provider>
        </div>
      </transition>

      <transition name="fade">
        <div v-if="isMobile && currentView === 'cockpit'" class="cockpit-viewport mobile-flex">
          
          <div class="mobile-content">
            <LeftStage 
              v-show="activeTab === 'monitor'"
              v-model:chatMode="chatMode"
              :currentSpeaker="currentSpeaker"
              class="mobile-pane"
            />
            <CenterConsole 
              v-show="activeTab === 'comms'"
              :currentTime="currentTime"
              :filteredHistory="filteredHistory"
              :displayedText="displayedText"
              :isTyping="isTyping"
              :isThinking="isThinking"
              :currentSpeaker="currentSpeaker"
              v-model:userInput="userInput"
              :emotion="emotion"
              :currentMood="currentMood"
              :currentAffection="currentAffection"
              :normalizeStat="normalizeStat"
              :moodColor="moodColor"
              @sendMessage="sendMessage"
              @setChatRef="(el) => { chatContainer = el }"
              class="mobile-pane"
            />
            <n-message-provider>
              <RightIDE v-show="activeTab === 'sys'" class="mobile-pane" />
            </n-message-provider>
          </div>

          <div class="mobile-nav">
            <button :class="{ active: activeTab === 'monitor' }" @click="activeTab = 'monitor'">
              <span class="icon">😈</span>
              <span class="label">狀態</span>
            </button>
            <button :class="{ active: activeTab === 'comms' }" @click="activeTab = 'comms'">
              <span class="icon">💬</span>
              <span class="label">通訊</span>
            </button>
            <button :class="{ active: activeTab === 'sys' }" @click="activeTab = 'sys'">
              <span class="icon">💻</span>
              <span class="label">系統</span>
            </button>
          </div>
        </div>
      </transition>

      <transition name="slide-up">
        <SettingsView 
          v-if="currentView === 'settings'" 
          @back="currentView = 'cockpit'" 
        />
      </transition>

      <WelcomeModal />

      <div v-if="currentView === 'cockpit'" class="settings-trigger" @click="currentView = 'settings'" title="System Settings">
        ⚙️
      </div>

    </div>
  </n-config-provider>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { NConfigProvider, NMessageProvider } from 'naive-ui';
import LeftStage from './components/LeftStage.vue';
import CenterConsole from './components/CenterConsole.vue';
import RightIDE from './components/RightIDE.vue';
import SettingsView from './components/SettingsView.vue';
import WelcomeModal from './components/WelcomeModal.vue';

import { useGameSystem } from './composables/useGameSystem.js';
import { useChat } from './composables/useChat.js';

const currentView = ref('cockpit');

// --- RWD Logic ---
const isMobile = ref(false);
const activeTab = ref('comms'); // 預設顯示聊天

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});

// --- System Logic ---
const { 
  currentTime, chatMode, currentSpeaker, emotion, 
  currentMood, currentAffection, normalizeStat, moodColor 
} = useGameSystem();

const conversationId = 'local_master_v3';

const { 
  userInput, messageHistory, filteredHistory,
  displayedText, isTyping, isThinking, chatContainer, sendMessage 
} = useChat(conversationId, chatMode, currentSpeaker, emotion);
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.3s ease, opacity 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(20px); opacity: 0; }

@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Noto+Sans+TC:wght@400;700&display=swap');

.app-root { width: 100vw; height: 100dvh; background: #1a1a1a; overflow: hidden; position: relative; }

/* Desktop Grid */
.cockpit-viewport.desktop-grid {
  width: 100%; height: 100%;
  background-color: #1e1e1e;
  background-image: 
    radial-gradient(circle at 10% 20%, rgba(234, 76, 137, 0.05) 0%, transparent 40%),
    radial-gradient(circle at 90% 80%, rgba(77, 166, 255, 0.05) 0%, transparent 40%);
  display: grid;
  grid-template-columns: 28% 42% 30%;
  overflow: hidden;
  font-family: 'Noto Sans TC', sans-serif;
  color: #eee;
}

/* Mobile Flex */
.cockpit-viewport.mobile-flex {
  width: 100%; height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1e1e1e;
}

.mobile-content {
  flex-grow: 1;
  overflow: hidden;
  position: relative;
}

.mobile-pane {
  width: 100%;
  height: 100%;
}

/* Mobile Navigation Bar */
.mobile-nav {
  height: 60px;
  background: #151515;
  border-top: 1px solid #333;
  display: flex;
  justify-content: space-around;
  align-items: center;
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom); /* 適配 iPhone 底部橫條 */
}

.mobile-nav button {
  background: none; border: none;
  color: #666;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  height: 100%;
  justify-content: center;
  font-family: 'Noto Sans TC';
}

.mobile-nav button .icon { font-size: 1.4em; margin-bottom: 2px; }
.mobile-nav button .label { font-size: 0.7em; }

.mobile-nav button.active {
  color: #ea4c89;
  background: rgba(234, 76, 137, 0.05);
}
.mobile-nav button.active .icon { transform: scale(1.1); transition: transform 0.2s; }

.settings-trigger {
  position: absolute; bottom: 80px; right: 20px; z-index: 9999; /* 手機版位置稍微上調 */
  cursor: pointer; opacity: 0.6; font-size: 1.8em;
  transition: all 0.2s;
}
.settings-trigger:hover { opacity: 1; transform: rotate(90deg); }

@media (min-width: 769px) {
  .settings-trigger { bottom: 15px; right: 15px; }
}
</style>