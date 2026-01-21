<template>
  <n-config-provider :theme="null">
    <div class="app-root">
      
      <transition name="fade">
        <div v-if="currentView === 'cockpit'" class="cockpit-viewport">
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
import { ref } from 'vue';
import { NConfigProvider, NMessageProvider } from 'naive-ui';
import LeftStage from './components/LeftStage.vue';
import CenterConsole from './components/CenterConsole.vue';
import RightIDE from './components/RightIDE.vue';
import SettingsView from './components/SettingsView.vue';
import WelcomeModal from './components/WelcomeModal.vue'; // [New] Import

import { useGameSystem } from './composables/useGameSystem.js';
import { useChat } from './composables/useChat.js';

const currentView = ref('cockpit');

const { 
  currentTime, chatMode, currentSpeaker, emotion, 
  currentMood, currentAffection, normalizeStat, moodColor 
} = useGameSystem();

// [Hint] 這裡如果是 Demo 站，conversationId 可能需要動態生成或固定
const conversationId = 'local_master_v3';

const { 
  userInput, messageHistory, filteredHistory,
  displayedText, isTyping, isThinking, chatContainer, sendMessage 
} = useChat(conversationId, chatMode, currentSpeaker, emotion);
</script>

<style scoped>
/* 保持原樣 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.3s ease, opacity 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(20px); opacity: 0; }

@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Noto+Sans+TC:wght@400;700&display=swap');

.app-root { width: 100vw; height: 100vh; background: #1a1a1a; overflow: hidden; position: relative; }

.cockpit-viewport {
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

.settings-trigger {
  position: absolute; bottom: 15px; right: 15px; z-index: 9999;
  cursor: pointer; opacity: 0.6; font-size: 1.8em;
  transition: all 0.2s;
}
.settings-trigger:hover { opacity: 1; transform: rotate(90deg); }
</style>