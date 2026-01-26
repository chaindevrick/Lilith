<template>
  <section class="left-stage">
    
    <div class="mode-switcher">
      <n-radio-group 
        :value="chatMode" 
        @update:value="$emit('update:chatMode', $event)" 
        name="mode" 
        size="small"
      >
        <n-radio-button value="demon" title="Demon Mode">😈</n-radio-button>
        <n-radio-button value="angel" title="Angel Mode">👼</n-radio-button>
        <n-radio-button value="group" title="Group Mode">⚖️</n-radio-button>
      </n-radio-group>
    </div>

    <div class="character-wrapper">
      <transition name="fade-slide" mode="out-in">
        
        <div 
          v-if="showDemon" 
          class="full-sprite demon" 
          key="demon" 
          :class="{ active: currentSpeaker === 'demon' }"
        >
          <div class="sprite-body demon-style">
            <div class="face-area">😈</div>
            <div class="body-text">LILITH</div>
          </div>
        </div>

        <div 
          v-else-if="showAngel" 
          class="full-sprite angel" 
          key="angel" 
          :class="{ active: currentSpeaker === 'angel' }"
        >
           <div class="sprite-body angel-style">
            <div class="face-area">👼</div>
            <div class="body-text">LILITH</div>
           </div>
        </div>

        <div 
          v-else-if="showGroup" 
          class="full-sprite group" 
          key="group"
        >
           <div class="sprite-body group-style">
            <div class="face-area group-face">😈 ⚡ 👼</div>
            <div class="body-text">LILITHS</div>
           </div>
        </div>

      </transition>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { NRadioGroup, NRadioButton } from 'naive-ui';

const props = defineProps(['chatMode', 'currentSpeaker']);
const emit = defineEmits(['update:chatMode']);

const showDemon = computed(() => props.chatMode === 'demon');
const showAngel = computed(() => props.chatMode === 'angel');
const showGroup = computed(() => props.chatMode === 'group');
</script>

<style scoped>
/* Main Container */
.left-stage { 
  position: relative; 
  display: flex; 
  flex-direction: column; 
  border-right: 1px solid rgba(255,255,255,0.05); 
  background: rgba(0,0,0,0.2); 
  height: 100%; 
  overflow: hidden;
}

/* Switcher Controls */
.mode-switcher { 
  position: absolute; 
  top: 15px; 
  left: 15px; 
  z-index: 100; 
  background: rgba(0,0,0,0.6); 
  padding: 4px; 
  border-radius: 4px; 
  backdrop-filter: blur(4px);
}

/* Character Container */
.character-wrapper { 
  flex-grow: 1; 
  position: relative; 
  overflow: hidden; 
  display: flex; 
  align-items: flex-end; 
  justify-content: center; 
}

.full-sprite { 
  width: 100%; 
  height: 90%; 
  display: flex; 
  justify-content: center; 
  align-items: flex-end; 
  position: absolute; 
  bottom: 0; 
  transition: filter 0.3s ease;
}

.full-sprite.active { 
  filter: brightness(1.1); 
  z-index: 10; 
}

.full-sprite:not(.active) { 
  filter: brightness(0.9) grayscale(0.2); 
}

/* Sprite Body (The "Glass" Pillar) */
.sprite-body { 
  width: 80%; 
  height: 100%; 
  border-radius: 40px 40px 0 0; 
  display: flex; 
  flex-direction: column; 
  justify-content: center; 
  align-items: center; 
  position: relative; 
  backdrop-filter: blur(5px); 
  box-shadow: 0 -10px 40px rgba(0,0,0,0.3); 
  transition: all 0.5s ease; 
}

/* Theme Colors */
.demon-style { 
  background: linear-gradient(to top, rgba(255, 77, 77, 0.15), rgba(255, 77, 77, 0.05), transparent); 
  border: 1px solid rgba(255, 77, 77, 0.2); 
  border-bottom: none; 
}

.angel-style { 
  background: linear-gradient(to top, rgba(77, 166, 255, 0.15), rgba(77, 166, 255, 0.05), transparent); 
  border: 1px solid rgba(77, 166, 255, 0.2); 
  border-bottom: none; 
}

.group-style { 
  background: linear-gradient(to top, rgba(160, 32, 240, 0.15), rgba(160, 32, 240, 0.05), transparent); 
  border: 1px solid rgba(160, 32, 240, 0.2); 
  border-bottom: none; 
}

/* Face & Text */
.face-area { 
  font-size: 8em; 
  filter: drop-shadow(0 0 20px rgba(255,255,255,0.2)); 
  animation: float 3s ease-in-out infinite; 
  user-select: none;
}

.group-face { 
  font-size: 5em; 
}

.body-text { 
  margin-top: 20px; 
  font-family: 'JetBrains Mono', monospace; 
  font-weight: bold; 
  font-size: 2em; 
  letter-spacing: 4px; 
  opacity: 0.7; 
  color: #fff;
  text-shadow: 0 0 10px rgba(0,0,0,0.5);
}

/* Animations */
.fade-slide-enter-active, .fade-slide-leave-active { 
  transition: all 0.4s ease; 
}
.fade-slide-enter-from, .fade-slide-leave-to { 
  opacity: 0; 
  transform: translateY(10px); 
}

@keyframes float { 
  0%, 100% { transform: translateY(0); } 
  50% { transform: translateY(-15px); } 
}

/* Mobile Optimizations */
@media (max-width: 768px) {
  /* 填滿手機畫面 */
  .sprite-body { width: 95%; height: 95%; } 
  
  /* 縮小一點表情以免爆版 */
  .face-area { font-size: 6em; } 
  .group-face { font-size: 4em; }

  .body-text { font-size: 1.5em; }
  
  /* 手機版開關置中 */
  .mode-switcher { 
    left: 50%; 
    transform: translateX(-50%); 
    top: 10px; 
    width: max-content;
  } 
}
</style>