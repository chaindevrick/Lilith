import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';

export function useGameSystem() {
  const currentTime = ref('');
  
  // 🌟 單一化數值系統
  const stats = reactive({
    affection: 40,
    trust: 20,
    mood: 0,
    tier: '目前的關係'
  });

  const normalizeStat = (val) => Math.min(100, Math.max(0, val || 0));

  const moodColor = computed(() => (stats.mood >= 0 ? '#18a058' : '#d03050'));

  // 接收後端 Emotion Module 的回傳並更新
  const updateStats = (newStats) => {
    if (!newStats) return;
    stats.affection = normalizeStat(newStats.affection ?? stats.affection);
    stats.trust = normalizeStat(newStats.trust ?? stats.trust);
    stats.mood = newStats.mood ?? stats.mood;
  };

  const updateTime = () => {
    const now = new Date();
    currentTime.value = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  let timer;
  onMounted(() => { 
    updateTime(); 
    timer = setInterval(updateTime, 1000); 
  });
  
  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return { 
    currentTime, 
    stats, 
    updateStats, 
    moodColor 
  };
}