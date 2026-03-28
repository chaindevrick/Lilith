<template>
  <section class="left-stage">
    <div class="sys-controls">
      <button class="settings-btn" @click="goToSettings" title="系統設定 (System Setup)">
        ⚙️ SETTINGS
      </button>

      <button class="theme-toggle-btn" @click="configStore.toggleTheme" :title="configStore.isDarkMode ? '切換至淺色模式' : '切換至深色模式'">
        {{ configStore.isDarkMode ? '🌙' : '☀️' }}
      </button>

      <span v-if="configStore.generalSettings?.showTokenUsage" class="token-text" title="累計消耗的 Token">
        Tokens: {{ formatNumber(chatStore.totalTokens || 0) }}
      </span>
    </div>

    <div class="character-wrapper">
      <div class="full-sprite active">
        <div class="sprite-body lilith-style">
          <transition name="sprite-fade" mode="out-in">
            <img 
              :src="currentPortrait" 
              :key="currentPortrait" 
              alt="Lilith" 
              class="character-cg" 
            />
          </transition>
        </div>
      </div>
    </div>

    <div class="aes-trigger-zone">
      <button class="aes-monitor-btn" @click="$emit('open-aes')">
        <span class="icon">🧬</span>
        <span class="text">SOMATIC SYSTEM (AES)</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'; 
import { useRouter } from 'vue-router';
import { useConfigStore } from '../../../stores/configStore';
import { useChatStore } from '../../../stores/chatStore';

defineEmits(['open-aes']);

const router = useRouter();
const configStore = useConfigStore();
const chatStore = useChatStore();

const currentPortrait = computed(() => {
  return configStore.isDarkMode 
    ? '/portraits/lilith-dark.png'
    : '/portraits/lilith-light.png';
});

const goToSettings = () => {
  router.push('/settings'); 
};

const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US').format(num);
};
</script>

<style scoped>
.left-stage { 
  position: relative; 
  display: flex; 
  flex-direction: column; 
  border-right: 1px solid var(--border-color); 
  background: var(--bg-secondary); 
  height: 100%; 
  overflow: hidden;
  transition: all 0.3s ease;
}

.sys-controls {
  position: absolute;
  top: 15px;
  left: 15px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-btn, .theme-toggle-btn {
  background: var(--btn-bg);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 32px; 
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.settings-btn { padding: 0 12px; font-size: 0.75em; }
.theme-toggle-btn { width: 32px; padding: 0; font-size: 1.1em; }

.settings-btn:hover, .theme-toggle-btn:hover {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  box-shadow: 0 0 10px var(--accent-glow);
}

.token-text {
  color: var(--token-text);
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.5px;
  user-select: none; 
  transition: color 0.3s ease;
}

.token-text:hover { color: var(--token-text-hover); }

.character-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.full-sprite {
  transition: all 0.4s ease;
  transform: scale(0.95);
  opacity: 0.8;
}

.full-sprite.active { transform: scale(1); opacity: 1; }

.sprite-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 320px;
  height: 500px;
  border-radius: 20px;
  overflow: hidden; 
}

.lilith-style { 
  border: 2px solid var(--accent-glow); 
  box-shadow: 0 0 25px var(--accent-glow);
  background: var(--bg-primary);
  transition: all 0.3s ease;
}

.character-cg {
  width: 100%;
  height: 100%;
  object-fit: cover; 
  object-position: top center; 
  display: block;
  user-select: none;
  pointer-events: none;
}

.sprite-fade-enter-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.sprite-fade-leave-active { transition: all 0.2s ease-in; }
.sprite-fade-enter-from { opacity: 0; transform: scale(0.9) translateY(20px); filter: blur(10px); }
.sprite-fade-leave-to { opacity: 0; transform: scale(1.05); filter: blur(5px); }

.aes-trigger-zone {
  padding: 20px;
  background: var(--panel-bg);
  border-top: 1px solid var(--border-color);
  transition: all 0.3s ease;
}

.aes-monitor-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--btn-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 12px;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: bold;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.3s ease;
}

.aes-monitor-btn:hover {
  background: var(--accent-glow);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  box-shadow: 0 0 15px var(--accent-glow);
}

.aes-monitor-btn .icon { font-size: 1.2em; }
</style>