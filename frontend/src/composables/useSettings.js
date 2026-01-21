import { ref, onMounted } from 'vue';
import { useMessage } from 'naive-ui';

export function useSettings() {
  const config = ref({
    GEMINI_API_KEY: '',
    LTM_GEMINI_API_KEY: '',
    RELATIONSHIP_GEMINI_API_KEY: '',
    GEMINI_API_BASE_URL: '',
    DISCORD_OWNER_ID: '',
    DISCORD_TOKEN: '',
    GOOGLE_SEARCH_API_KEY: '',
    GOOGLE_SEARCH_CX: ''
  });

  const isLoading = ref(false);
  const isSaving = ref(false);

  // 載入設定
  const fetchSettings = async () => {
    isLoading.value = true;
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      // 合併資料，確保欄位存在
      config.value = { ...config.value, ...data };
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      isLoading.value = false;
    }
  };

  // 儲存設定
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
        // 這裡可以加入 toast 提示，如果有的話
        alert("設定已儲存！請重新啟動後端程式 (node main.js) 以套用變更。");
      } else {
        alert("儲存失敗：" + result.error);
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
      alert("儲存時發生錯誤");
    } finally {
      isSaving.value = false;
    }
  };

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