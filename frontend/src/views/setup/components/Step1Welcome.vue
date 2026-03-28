<template>
  <div class="step-panel text-center mt-10">
    <h1 class="title">Welcome to Lilith OS</h1>
    <p class="subtitle">讓我們花一分鐘，為您配置專屬的 AI 助理。</p>
    <div class="hero-graphic">❤️</div>

    <div class="form-container">
      <div class="form-group text-left">
        <label>您的名字 (Name)</label>
        <input 
          v-model="formData.userName" 
          @input="handleNameInput"
          type="text" 
          class="input-field text-center" 
          placeholder="輸入您的稱呼"
        />
      </div>
      
      <div class="form-group text-left">
        <label>專屬對話 ID (Conversation ID)</label>
        <p class="help-text">基於名字生成的唯一識別碼。若需切換/恢復歷史紀錄可手動修改。</p>
        <input 
          v-model="formData.conversationId" 
          @input="handleManualIdInput"
          type="text" 
          class="input-field text-center id-input" 
          placeholder="例如: user_a1b2c3"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  formData: { type: Object, required: true }
});

const isManualOverride = ref(false);

// 簡單安全的字串 Hash 函數
const generateHash = (str) => {
  if (!str) return 'web_user';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // 轉為 32bit 整數
  }
  // 加上前綴與字串長度增加辨識度與唯一性
  return 'user_' + Math.abs(hash).toString(16) + str.length;
};

// 處理名字輸入：若尚未手動覆蓋，則自動生成 Hash
const handleNameInput = () => {
  if (!isManualOverride.value && props.formData.userName) {
    props.formData.conversationId = generateHash(props.formData.userName);
  } else if (!props.formData.userName && !isManualOverride.value) {
    props.formData.conversationId = 'web_user';
  }
};

// 處理手動輸入：標記為手動覆蓋，停止自動 Hash
const handleManualIdInput = () => {
  isManualOverride.value = true;
};
</script>

<style scoped>
.text-center { text-align: center; }
.text-left { text-align: left; }
.mt-10 { margin-top: 2rem; }
.hero-graphic { font-size: 4rem; margin-top: 1rem; margin-bottom: 2rem; animation: float 3s ease-in-out infinite; }
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}

.form-container { 
  margin-top: 1rem; 
  max-width: 320px; 
  margin-left: auto; 
  margin-right: auto; 
}
.help-text { 
  font-size: 0.75rem; 
  color: #888; 
  margin-top: -4px; 
  margin-bottom: 8px; 
  line-height: 1.4; 
}
.id-input {
  font-family: 'JetBrains Mono', monospace;
  color: #ec4899;
  font-weight: bold;
}
</style>