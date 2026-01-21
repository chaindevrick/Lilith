import { ref, computed, onMounted, onUnmounted } from 'vue';

export function useGameSystem() {
  const currentTime = ref('');
  const chatMode = ref('demon'); // demon, angel, group
  const currentSpeaker = ref('demon'); // 僅用於控制打字時的立繪顯示
  
  // 情緒狀態 (從後端同步)
  const emotion = ref({ 
    mood_offset: 0, 
    base_affection: 20, 
    trust: 10,
    angel_affection: 0, 
    angel_mood: 0 
  });

  const normalizeStat = (val) => Math.min(100, Math.max(0, 50 + (val || 0)));
  const moodColor = (val) => (val >= 0 ? '#18a058' : '#d03050');
  
  /**
   * [Update] 數值顯示邏輯：綁定分頁 (Tab)
   */
  const currentMood = computed(() => {
    // 切換到 Angel 分頁 -> 顯示 Angel 心情
    if (chatMode.value === 'angel') return emotion.value.angel_mood;
    
    // 切換到 Demon 分頁 -> 顯示 Demon 心情
    if (chatMode.value === 'demon') return emotion.value.mood_offset;

    // 切換到 Group 分頁 -> 這裡我們需要一個策略
    // 策略 A: 顯示 "當前正在說話的人" 的心情 (動態)
    // 策略 B: 顯示 Demon (主要人格) 的心情
    // 這裡採用策略 A，讓 Group 模式更生動
    if (chatMode.value === 'group') {
       return currentSpeaker.value === 'angel' ? emotion.value.angel_mood : emotion.value.mood_offset;
    }
    
    return emotion.value.mood_offset;
  });

  const currentAffection = computed(() => {
    if (chatMode.value === 'angel') return emotion.value.angel_affection;
    if (chatMode.value === 'demon') return emotion.value.base_affection;
    
    // Group 模式下同樣採用動態顯示
    if (chatMode.value === 'group') {
       return currentSpeaker.value === 'angel' ? emotion.value.angel_affection : emotion.value.base_affection;
    }

    return emotion.value.base_affection;
  });

  // 時間更新
  const updateTime = () => {
    const now = new Date();
    currentTime.value = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  let timer;
  onMounted(() => { updateTime(); timer = setInterval(updateTime, 1000); });
  onUnmounted(() => clearInterval(timer));

  return {
    currentTime,
    chatMode,
    currentSpeaker,
    emotion,
    currentMood,
    currentAffection,
    normalizeStat,
    moodColor
  };
}