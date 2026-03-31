<template>
  <div class="step-panel">
    <div class="step-header">
      <h2 class="title">🎭 塑造靈魂 (Persona & Rules)</h2>
      <p class="subtitle">
        定義系統 AI 的核心人格特質、互動規則與底層的關係演算邏輯。
      </p>
    </div>

    <transition name="fade" mode="out-in">
      
      <div v-if="!showAdvanced" key="basic-view" class="basic-mode-container">
        <div class="form-group">
          <label class="section-label">Lilith 核心角色卡 (Markdown)</label>
          <p class="help-text">這是系統 Prompt 的最上層，決定了她的本質設定、世界觀與記憶運作方式。</p>
          <textarea 
            v-model="formData.characterCard" 
            @keydown.enter.stop
            class="input-field textarea-xl no-resize" 
            placeholder="請在此定義 Lilith 的絕對白板人格... (支援 Markdown 語法)"
            spellcheck="false"
          ></textarea>
        </div>
      </div>

      <div v-else key="advanced-view" class="advanced-mode-container">
        <div class="advanced-grid">
          <div class="form-group">
            <label class="section-label">系統規則 (Interaction Rules)</label>
            <p class="help-text">最高優先級的行為約束。</p>
            <textarea 
              v-model="formData.interactionRules" 
              @keydown.enter.stop
              class="input-field textarea-medium no-resize"
              placeholder="例如：1. 保持資訊密度 2. 善用 Markdown"
              spellcheck="false"
            ></textarea>
          </div>
          <div class="form-group">
            <label class="section-label">對話語氣 (Conversation Style)</label>
            <p class="help-text">語言輸出的有機性指引。</p>
            <textarea 
              v-model="formData.conversationStyle" 
              @keydown.enter.stop
              class="input-field textarea-medium no-resize"
              placeholder="例如：自然流動、避免 AI 模板、動態湧現"
              spellcheck="false"
            ></textarea>
          </div>
        </div>
      </div>

    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  formData: { type: Object, required: true },
  showAdvanced: { type: Boolean, required: true }
});

const rulesJsonStr = ref('');
const jsonError = ref(false);

// 初始化 JSON 字串
onMounted(() => {
  if (props.formData.relationshipRules) {
    try {
      const parsed = typeof props.formData.relationshipRules === 'string' 
        ? JSON.parse(props.formData.relationshipRules) 
        : props.formData.relationshipRules;
        
      // 確保即使解析成功，如果裡面是空的，也能正確顯示
      if (Object.keys(parsed).length === 0) throw new Error("Empty Rules");
      
      rulesJsonStr.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
      rulesJsonStr.value = typeof props.formData.relationshipRules === 'string' 
        ? props.formData.relationshipRules 
        : "{\n  \n}";
      jsonError.value = true;
    }
  } else {
    rulesJsonStr.value = "{\n  \n}";
  }
});

// 當外部資料變更時同步更新 (避免覆蓋正在編輯的錯誤狀態)
watch(() => props.formData.relationshipRules, (newVal) => {
  if (!jsonError.value && newVal) {
    try {
      const parsed = typeof newVal === 'string' ? JSON.parse(newVal) : newVal;
      rulesJsonStr.value = JSON.stringify(parsed, null, 2);
    } catch(e) {}
  }
}, { deep: true });

// 即時驗證與更新
const handleJsonChange = (e) => {
  try {
    const parsed = JSON.parse(e.target.value);
    props.formData.relationshipRules = parsed;
    jsonError.value = false;
  } catch (err) {
    jsonError.value = true;
  }
};

// 一鍵排版
const formatJson = () => {
  if (!jsonError.value) {
    try {
      const parsed = JSON.parse(rulesJsonStr.value);
      rulesJsonStr.value = JSON.stringify(parsed, null, 2);
      props.formData.relationshipRules = parsed;
    } catch (e) {
      // ignore
    }
  }
};
</script>

<style scoped>
/* --- 頁面共用基礎樣式 --- */
.step-header { margin-bottom: 1.5rem; text-align: left; }
.title { font-size: 1.4rem; font-weight: 700; color: #111; margin-bottom: 0.5rem; }
.subtitle { font-size: 0.95rem; color: #666; line-height: 1.5; margin: 0; }
.help-text { font-size: 0.85rem; color: #888; margin: 0 0 0.5rem 0; }

.section-label { 
  display: block; 
  font-size: 0.95rem; 
  font-weight: 700; 
  color: #333; 
  margin-bottom: 0.2rem; 
}

/* --- 文字區塊樣式 --- */
.input-field { 
  width: 100%; 
  padding: 1rem; 
  background: #fff;
  border: 1px solid #ddd; 
  border-radius: 8px; 
  font-size: 0.95rem; 
  color: #333; 
  transition: all 0.2s; 
  box-sizing: border-box;
  line-height: 1.6;
}
.input-field:focus { outline: none; border-color: #ea4c89; box-shadow: 0 0 0 3px rgba(234, 76, 137, 0.1); }

/* 🌟 新增：禁止調整大小的類別 */
.no-resize { resize: none !important; }

.textarea-medium { height: 120px; }
.textarea-xl { height: 350px; }

.advanced-grid { display: flex; flex-wrap: wrap; gap: 15px; text-align: left; }
.form-group { flex: 1; min-width: 45%; margin-bottom: 0; text-align: left; }
.full-width { flex: 100%; }
.mt-3 { margin-top: 1.5rem; }

/* --- IDE 風格 JSON 編輯器 --- */
.editor-wrapper { 
  display: flex; flex-direction: column; 
  background: #1e1e2e; border-radius: 10px; 
  border: 1px solid #313244; overflow: hidden;
  transition: border-color 0.3s ease;
}
.editor-wrapper.has-error { border-color: #ef4444; box-shadow: 0 0 0 1px #ef4444; }

.editor-header { 
  display: flex; justify-content: space-between; align-items: center; 
  padding: 8px 12px; background: #181825; border-bottom: 1px solid #313244; 
}
.status-badge { font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 4px; }
.status-badge.success { color: #10b981; }
.status-badge.error { color: #ef4444; }

.format-btn { 
  background: rgba(255,255,255,0.1); border: none; color: #cdd6f4; 
  padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; 
  cursor: pointer; transition: 0.2s; font-family: inherit;
}
.format-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
.format-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.json-editor-textarea {
  width: 100%; padding: 1rem; background: transparent; border: none; 
  color: #a6e3a1; 
  font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; 
  line-height: 1.6; box-sizing: border-box;
}
.json-editor-textarea:focus { outline: none; }

/* --- 動畫 --- */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>