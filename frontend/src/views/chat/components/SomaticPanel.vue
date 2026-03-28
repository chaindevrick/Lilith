<template>
  <transition name="fade-scale">
    <div v-if="show" class="somatic-overlay" @click.self="closePanel">
      <div class="somatic-modal">
        
        <header class="modal-header">
          <div class="title-group">
            <span class="icon">🧬</span>
            <h2>SOMATIC METABOLISM MONITOR</h2>
          </div>
          <button class="close-btn" @click="closePanel">×</button>
        </header>

        <div class="modal-body">
          <div class="gauges-container">
            <div class="gauge-item" v-for="(chem, key) in chemicalList" :key="key">
              <div class="gauge-label">
                <span class="chem-name">{{ chem.label }}</span>
                <span class="chem-value">{{ Math.round(chem.value) }}%</span>
              </div>
              <div class="bar-bg">
                <div class="bar-fill" :style="{ width: chem.value + '%', backgroundColor: chem.color, boxShadow: `0 0 10px ${chem.color}80` }"></div>
              </div>
            </div>
          </div>

          <div class="radar-container">
            <svg :width="svgSize" :height="svgSize" class="radar-svg">
              <polygon 
                v-for="level in 5" :key="'grid-'+level" 
                :points="getGridPolygon((level / 5) * maxRadius)" 
                class="grid-polygon" 
              />
              
              <line 
                v-for="(pos, i) in axisPoints" :key="'axis-'+i"
                :x1="center" :y1="center" :x2="pos.x" :y2="pos.y" 
                class="axis-line" 
              />

              <text 
                v-for="(chem, i) in chemicalList" :key="'text-'+i"
                :x="axisPoints[i].tx" :y="axisPoints[i].ty"
                class="axis-label"
                text-anchor="middle"
                dominant-baseline="middle"
                :fill="chem.color"
              >
                {{ chem.label }}
              </text>

              <polygon :points="dataPolygon" class="data-polygon" />
              
              <circle 
                v-for="(point, i) in dataPoints" :key="'circle-'+i"
                :cx="point.x" :cy="point.y" r="4" 
                class="data-point"
                :fill="chemicalList[i].color"
              />
            </svg>
          </div>
        </div>

      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue';
import { useChatStore } from '../../../stores/chatStore';

defineProps({
  show: Boolean
});

const emit = defineEmits(['close']);
const chatStore = useChatStore();

const closePanel = () => {
  emit('close');
};

// 🌟 直接從 Store 抓取數據，乾淨俐落
const chemicalList = computed(() => {
  const levels = chatStore.endocrineState;
  return [
    { key: 'DOPAMINE', label: 'DOPA (多巴胺)', color: '#ea4c89', value: levels.DOPAMINE },
    { key: 'ENDORPHIN', label: 'ENDO (內啡肽)', color: '#a855f7', value: levels.ENDORPHIN },
    { key: 'OXYTOCIN', label: 'OXY (催產素)', color: '#3b82f6', value: levels.OXYTOCIN },
    { key: 'NOREPINEPHRINE', label: 'NORE (去甲腎)', color: '#10b981', value: levels.NOREPINEPHRINE },
    { key: 'ADRENALINE', label: 'ADRE (腎上腺)', color: '#f59e0b', value: levels.ADRENALINE },
    { key: 'CORTISOL', label: 'CORT (皮質醇)', color: '#ef4444', value: levels.CORTISOL }
  ];
});

const svgSize = 360;
const center = svgSize / 2;
const maxRadius = 120;

const getPoint = (value, index, radius) => {
  const angle = (Math.PI * 2 * index) / 6 - (Math.PI / 2); 
  const r = (value / 100) * radius;
  return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
};

const getGridPolygon = (radius) => {
  return Array.from({ length: 6 }).map((_, i) => {
    const p = getPoint(100, i, radius);
    return `${p.x},${p.y}`;
  }).join(' ');
};

const axisPoints = computed(() => {
  return Array.from({ length: 6 }).map((_, i) => {
    const endPoint = getPoint(100, i, maxRadius);
    const textPoint = getPoint(100, i, maxRadius + 25); 
    return { x: endPoint.x, y: endPoint.y, tx: textPoint.x, ty: textPoint.y };
  });
});

const dataPoints = computed(() => {
  return chemicalList.value.map((chem, i) => getPoint(chem.value, i, maxRadius));
});

const dataPolygon = computed(() => {
  return dataPoints.value.map(p => `${p.x},${p.y}`).join(' ');
});
</script>

<style scoped>
.somatic-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.somatic-modal {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  width: 800px;
  max-width: 90vw;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--accent-glow);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.title-group { display: flex; align-items: center; gap: 12px; }
.title-group .icon { font-size: 1.5em; }
.title-group h2 { margin: 0; font-size: 1.2rem; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; letter-spacing: 1px; }

.close-btn {
  background: none; border: none; font-size: 1.8rem; color: var(--text-secondary); cursor: pointer; transition: 0.2s;
}
.close-btn:hover { color: var(--accent-primary); transform: scale(1.1); }

.modal-body {
  display: flex;
  padding: 30px;
  gap: 40px;
}

.gauges-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
}

.gauge-item { display: flex; flex-direction: column; gap: 6px; }
.gauge-label { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: bold; font-family: 'JetBrains Mono', monospace; }
.chem-name { color: var(--text-secondary); }
.chem-value { color: var(--text-primary); }

.bar-bg { height: 8px; background: var(--panel-bg); border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color); }
.bar-fill { height: 100%; border-radius: 4px; transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); }

.radar-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, var(--panel-bg) 0%, transparent 70%);
  border-radius: 50%;
}

.grid-polygon {
  fill: none;
  stroke: var(--border-color);
  stroke-width: 1;
}

.axis-line {
  stroke: var(--border-color);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.axis-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: bold;
}

.data-polygon {
  fill: var(--accent-glow);
  stroke: var(--accent-primary);
  stroke-width: 2;
  transition: all 1s ease;
}

.data-point {
  stroke: var(--bg-primary);
  stroke-width: 1.5;
  transition: all 1s ease;
}

.fade-scale-enter-active, .fade-scale-leave-active { transition: all 0.3s ease; }
.fade-scale-enter-from, .fade-scale-leave-to { opacity: 0; transform: scale(0.95); }
</style>