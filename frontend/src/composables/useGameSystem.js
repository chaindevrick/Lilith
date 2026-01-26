/**
 * src/composables/useGameSystem.js
 * 遊戲系統核心 (Game System Logic)
 * 職責：管理全域遊戲狀態 (時間、模式、數值計算)，提供 UI 顯示所需的響應式數據。
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';

export function useGameSystem() {
  
  // ============================================================
  // 1. State Definitions
  // ============================================================

  const currentTime = ref('');
  
  // 當前對話模式: 'demon' (惡魔), 'angel' (天使), 'group' (多人/群組)
  const chatMode = ref('demon'); 
  
  // 當前實際發話者 (用於 Group 模式下的數值切換)
  const currentSpeaker = ref('demon'); 
  
  // 核心數值 (Raw Data)
  // 預設值對應資料庫結構
  const emotion = ref({ 
    demon_affection: 20,
    demon_trust: 10,
    demon_mood: 0,
    angel_affection: 20,
    angel_trust: 10,
    angel_mood: 0
  });

  // ============================================================
  // 2. Helper Functions (Math & Formatting)
  // ============================================================

  /**
   * 數值標準化
   * 將原始數值 (通常為 -50 ~ +50 或類似區間) 轉換為 0~100 的進度條百分比。
   * 公式：50 + 原始值 (限制在 0-100)
   */
  const normalizeStat = (val) => Math.min(100, Math.max(0, 50 + (val || 0)));

  /**
   * 心情顏色計算
   * @param {number} val - 原始心情值
   */
  const moodColor = (val) => (val >= 20 ? '#18a058' : '#d03050');

  /**
   * [Internal] 動態數值解析器
   * 根據當前的 ChatMode 與 Speaker 自動決定要讀取 Angel 還是 Demon 的數值。
   * @param {string} statSuffix - 屬性後綴 (e.g., 'mood', 'affection', 'trust')
   */
  const resolveStat = (statSuffix) => {
    let targetPersona = 'demon'; // Default

    if (chatMode.value === 'angel') {
      targetPersona = 'angel';
    } else if (chatMode.value === 'demon') {
      targetPersona = 'demon';
    } else if (chatMode.value === 'group') {
      // Group 模式下，跟隨當前發話者 (Current Speaker)
      // 若發話者是 user，則預設顯示 demon (或根據需求調整)
      targetPersona = currentSpeaker.value === 'angel' ? 'angel' : 'demon';
    }

    const key = `${targetPersona}_${statSuffix}`;
    return emotion.value[key] || 0;
  };

  // ============================================================
  // 3. Computed Properties (Reactive Stats)
  // ============================================================

  // 當前顯示的心情值
  const currentMood = computed(() => resolveStat('mood'));

  // 當前顯示的好感度
  const currentAffection = computed(() => resolveStat('affection'));

  // 當前顯示的信任值
  const currentTrust = computed(() => resolveStat('trust'));

  // ============================================================
  // 4. Time Management
  // ============================================================

  const updateTime = () => {
    const now = new Date();
    // 格式：HH:mm (24小時制)
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
    // State
    currentTime,
    chatMode,
    currentSpeaker,
    emotion,
    
    // Computed Stats
    currentMood,
    currentAffection,
    currentTrust,
    
    // Helpers
    normalizeStat,
    moodColor
  };
}