/**
 * src/composables/useSettings.js
 * 設定管理邏輯 (Settings Composable)
 * 職責：負責讀取與寫入系統環境變數 (.env)，並處理載入狀態與錯誤提示。
 */

import { ref, onMounted } from 'vue';
import { useMessage } from 'naive-ui';

export function useSettings() {
  const message = useMessage();

  // ============================================================
  // 1. State Definitions
  // ============================================================

  const config = ref({
    // Core (Cognition)
    GEMINI_API_KEY: '',
    LTM_GEMINI_API_KEY: '',
    RELATIONSHIP_GEMINI_API_KEY: '',
    GEMINI_API_BASE_URL: '',
    
    // Tools (Search)
    GOOGLE_SEARCH_API_KEY: '',
    GOOGLE_SEARCH_CX: ''
  });

  const isLoading = ref(false);
  const isSaving = ref(false);

  // ============================================================
  // 2. API Interactions
  // ============================================================

  /**
   * 載入設定 (GET /api/settings)
   */
  const fetchSettings = async () => {
    isLoading.value = true;
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error("API Connection Failed");

      const data = await res.json();
      
      // 合併資料，保留預設鍵值結構
      config.value = { ...config.value, ...data };
    } catch (e) {
      console.error('[Settings] Load failed:', e);
      message.error("無法讀取設定檔，請檢查後端服務是否執行中。");
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 儲存設定 (POST /api/settings)
   */
  const saveSettings = async () => {
    isSaving.value = true;
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.value)
      });
      
      const result = await res.json();
      
      if (res.ok) {
        message.success("設定已儲存！請記得重啟系統以套用變更。", { duration: 5000 });
      } else {
        throw new Error(result.error || "Unknown Error");
      }
    } catch (e) {
      console.error('[Settings] Save failed:', e);
      message.error(`儲存失敗：${e.message}`);
    } finally {
      isSaving.value = false;
    }
  };

  // ============================================================
  // 3. Lifecycle
  // ============================================================

  onMounted(() => {
    fetchSettings();
  });

  return {
    config,
    isLoading,
    isSaving,
    fetchSettings,
    saveSettings
  };
}