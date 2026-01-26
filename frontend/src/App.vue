<template>
  <n-config-provider :theme="darkTheme">
    <n-message-provider>
      <div class="app-root">
        
        <transition name="fade" mode="out-in">
          
          <div v-if="!isMobile && currentView === 'cockpit'" class="cockpit-viewport desktop-grid" key="desktop">
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
              :currentConversationId="currentConversationId"
            />
            <RightIDE />
          </div>

          <div v-else-if="isMobile && currentView === 'cockpit'" class="cockpit-viewport mobile-flex" key="mobile">
            
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
                :currentConversationId="currentConversationId"
                class="mobile-pane"
              />
              <RightIDE v-show="activeTab === 'sys'" class="mobile-pane" />
            </div>

            <div class="mobile-nav">
              <button :class="{ active: activeTab === 'monitor' }" @click="activeTab = 'monitor'">
                <span class="icon">😈</span>
                <span class="label">STATUS</span>
              </button>
              <button :class="{ active: activeTab === 'comms' }" @click="activeTab = 'comms'">
                <span class="icon">💬</span>
                <span class="label">COMMS</span>
              </button>
              <button :class="{ active: activeTab === 'sys' }" @click="activeTab = 'sys'">
                <span class="icon">💻</span>
                <span class="label">SYSTEM</span>
              </button>
            </div>
          </div>

        </transition>

        <transition name="slide-up">
          <SettingsView 
            v-if="currentView === 'settings'" 
            @back="currentView = 'cockpit'" 
            class="settings-overlay"
          />
        </transition>

        <WelcomeModal />

        <div 
          v-if="currentView === 'cockpit'" 
          class="settings-trigger" 
          @click="currentView = 'settings'" 
          title="System Settings"
        >
          ⚙️
        </div>

      </div>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { NConfigProvider, NMessageProvider, darkTheme } from 'naive-ui'; // 引入 Dark Theme

// Components
import LeftStage from './components/LeftStage.vue';
import CenterConsole from './components/CenterConsole.vue';
import RightIDE from './components/RightIDE.vue';
import SettingsView from './components/SettingsView.vue';
import WelcomeModal from './components/WelcomeModal.vue';

// Composables
import { useGameSystem } from './composables/useGameSystem.js';
import { useChat } from './composables/useChat.js';

// --- View State ---
const currentView = ref('cockpit'); // 'cockpit' | 'settings'

// --- RWD Logic ---
const isMobile = ref(false);
const activeTab = ref('comms'); // Mobile tab: 'monitor' | 'comms' | 'sys'

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

// --- System Core Initialization ---
const { 
  currentTime, chatMode, currentSpeaker, emotion, 
  currentMood, currentAffection, normalizeStat, moodColor 
} = useGameSystem();

// Default ID (will be overridden by useChat logic)
const defaultConversationId = 'Demo';

const { 
  userInput, filteredHistory, currentConversationId,
  displayedText, isTyping, isThinking, chatContainer, sendMessage 
} = useChat(defaultConversationId, chatMode, currentSpeaker, emotion);

// --- Lifecycle ---
onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});
</script>

<style>
/* Global Resets & Fonts */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Noto+Sans+TC:wght@400;700&display=swap');

body { margin: 0; padding: 0; background: #1a1a1a; }

.app-root { 
  width: 100vw; 
  height: 100dvh; /* dynamic viewport height for mobile */
  background: #1a1a1a; 
  overflow: hidden; 
  position: relative; 
  font-family: 'Noto Sans TC', sans-serif;
  color: #eee;
}

/* --- Layout: Desktop (Grid) --- */
.cockpit-viewport.desktop-grid {
  width: 100%; height: 100%;
  background-color: #1e1e1e;
  background-image: 
    radial-gradient(circle at 10% 20%, rgba(234, 76, 137, 0.05) 0%, transparent 40%),
    radial-gradient(circle at 90% 80%, rgba(77, 166, 255, 0.05) 0%, transparent 40%);
  display: grid;
  grid-template-columns: 28% 42% 30%;
  overflow: hidden;
}

/* --- Layout: Mobile (Flex Column) --- */
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

/* Mobile Bottom Navigation */
.mobile-nav {
  height: 60px;
  background: #151515;
  border-top: 1px solid #333;
  display: flex;
  justify-content: space-around;
  align-items: center;
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom);
}

.mobile-nav button {
  background: none; border: none;
  color: #666;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  height: 100%;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  transition: all 0.2s;
}

.mobile-nav button .icon { font-size: 1.4em; margin-bottom: 2px; }
.mobile-nav button .label { font-size: 0.6em; letter-spacing: 1px; }

.mobile-nav button.active {
  color: #ea4c89;
  background: rgba(234, 76, 137, 0.05);
}
.mobile-nav button.active .icon { transform: scale(1.1); }

/* --- Settings Overlay & Trigger --- */
.settings-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2000;
}

.settings-trigger {
  position: absolute; bottom: 80px; right: 20px; z-index: 1500;
  cursor: pointer; opacity: 0.6; font-size: 1.8em;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  filter: drop-shadow(0 0 5px rgba(0,0,0,0.5));
}
.settings-trigger:hover { opacity: 1; transform: rotate(90deg) scale(1.1); }

@media (min-width: 769px) {
  .settings-trigger { bottom: 20px; right: 20px; }
}

/* --- Transitions --- */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.3s ease, opacity 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(50px); opacity: 0; }
</style>