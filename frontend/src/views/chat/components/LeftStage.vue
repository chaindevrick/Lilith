<template>
  <section class="left-stage">
    
    <div class="sys-controls">
      <button class="settings-btn" @click="goToSettings" title="系統設定 (System Setup)">
        ⚙️ SETUP
      </button>

      <span v-if="configStore.generalSettings?.showTokenUsage" class="token-text" title="累計消耗的 Token">
        Tokens: {{ formatNumber(chatStore.totalTokens || 0) }}
      </span>
    </div>

    <div class="character-wrapper">
      <div class="full-sprite active">
        <div class="sprite-body lilith-style">
          <img src="/lilith-portrait.png" alt="Lilith" class="character-cg" />
        </div>
      </div>
    </div>

    <div class="status-metrics">
      <div class="metric-item">
        <span class="label">AFFECTION (好感度)</span>
        <div class="bar-bg">
          <div class="bar-fill pink" :style="{ width: stats.affection + '%' }"></div>
        </div>
      </div>
      <div class="metric-item">
        <span class="label">TRUST (信賴度)</span>
        <div class="bar-bg">
          <div class="bar-fill blue" :style="{ width: stats.trust + '%' }"></div>
        </div>
      </div>
    </div>

  </section>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useConfigStore } from '../../../stores/configStore';
import { useChatStore } from '../../../stores/chatStore';

defineProps({
  stats: { type: Object, required: true }
});

const router = useRouter();
const configStore = useConfigStore();
const chatStore = useChatStore();

const goToSettings = () => {
  router.push('/setup');
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
  border-right: 1px solid rgba(255,255,255,0.05); 
  background: rgba(0,0,0,0.2); 
  height: 100%; 
  overflow: hidden;
}

/* 控制列樣式，按鈕跟 Token 橫向並排並垂直置中 */
.sys-controls {
  position: absolute;
  top: 15px;
  left: 15px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-btn {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #888;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75em;
  font-family: 'JetBrains Mono', monospace;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}

.settings-btn:hover {
  background: rgba(234, 76, 137, 0.2);
  border-color: rgba(234, 76, 137, 0.5);
  color: #ea4c89;
  box-shadow: 0 0 10px rgba(234, 76, 137, 0.2);
}

/* 🌟 小灰字 Token 樣式 */
.token-text {
  color: rgba(255, 255, 255, 0.25); /* 極低調的半透明灰白色 */
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.5px;
  user-select: none; /* 避免反白干擾 */
  transition: color 0.3s ease;
}

.token-text:hover {
  color: rgba(255, 255, 255, 0.6); /* 滑鼠游標移過去時稍微變亮 */
}

/* 人物立繪容器 */
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

.full-sprite.active {
  transform: scale(1);
  opacity: 1;
}

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
  border: 2px solid rgba(234, 76, 137, 0.3); 
  box-shadow: 0 0 25px rgba(234, 76, 137, 0.15);
  background: #111;
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

.status-metrics { 
  padding: 20px; 
  background: rgba(255,255,255,0.02); 
  border-top: 1px solid rgba(255,255,255,0.05); 
}

.metric-item { margin-bottom: 15px; }
.metric-item .label { 
  font-size: 0.75em; 
  font-weight: bold; 
  color: #888; 
  display: block; 
  margin-bottom: 6px; 
}
.bar-bg { 
  height: 6px; 
  background: rgba(255,255,255,0.1); 
  border-radius: 3px; 
}
.bar-fill { 
  height: 100%; 
  border-radius: 3px; 
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); 
}
.bar-fill.pink { background: #ea4c89; box-shadow: 0 0 10px rgba(234,76,137,0.5); }
.bar-fill.blue { background: #0095ff; box-shadow: 0 0 10px rgba(0,149,255,0.5); }
</style>