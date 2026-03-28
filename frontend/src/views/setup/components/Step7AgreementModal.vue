<template>
  <div class="step-panel">
    <h2 class="title">最後一步：條款與聲明</h2>
    <p class="subtitle">在喚醒系統之前，請確認您已了解以下規範。</p>

    <div class="checkbox-group">
      <label class="checkbox-label">
        <input type="checkbox" v-model="agreements.tos" />
        <span class="custom-checkbox"></span>
        我已閱讀並同意 <a href="#" @click.prevent="openModal('tos')">《使用者協議》</a>
      </label>

      <label class="checkbox-label">
        <input type="checkbox" v-model="agreements.privacy" />
        <span class="custom-checkbox"></span>
        我已閱讀並同意 <a href="#" @click.prevent="openModal('privacy')">《隱私權政策》</a>
      </label>

      <label class="checkbox-label">
        <input type="checkbox" v-model="agreements.disclaimer" />
        <span class="custom-checkbox"></span>
        我已了解並同意 <a href="#" @click.prevent="openModal('disclaimer')">《免責聲明》</a>
      </label>
    </div>

    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h2 class="modal-title">{{ currentContent.title }}</h2>
        
        <div class="modal-body">
          <div v-if="isLoading" class="loading-text">資料載入中...</div>
          <div v-else class="markdown-content" v-html="currentContent.text"></div>
        </div>

        <div class="modal-footer">
          <button class="close-btn" @click="closeModal" :disabled="isLoading">我已瞭解</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { marked } from 'marked';

const emit = defineEmits(['agreed-change']);

const agreements = ref({
  tos: false,
  privacy: false,
  disclaimer: false
});

const isAllAgreed = computed(() => {
  return agreements.value.tos && agreements.value.privacy && agreements.value.disclaimer;
});

// 當同意狀態改變時，通知 SetupWizard 
watch(isAllAgreed, (newVal) => {
  emit('agreed-change', newVal);
}, { immediate: true });

// 彈窗與文本載入邏輯
const isModalOpen = ref(false);
const currentModalType = ref('tos');
const isLoading = ref(true);

const contentDictionary = ref({
  tos: { title: '使用者協議 (Terms of Service)', text: '' },
  privacy: { title: '隱私權政策 (Privacy Policy)', text: '' },
  disclaimer: { title: '免責聲明 (Disclaimer)', text: '' }
});

const openModal = (type) => {
  currentModalType.value = type;
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};

const currentContent = computed(() => {
  return contentDictionary.value[currentModalType.value] || { title: '未知的條款', text: '' };
});

onMounted(async () => {
  try {
    isLoading.value = true;
    const [tosRes, privRes, dnllRes] = await Promise.all([
      fetch('/ToS.md'), fetch('/Privacy.md'), fetch('/Disclaimer.md')
    ]);

    const tosText = await tosRes.text();
    const privText = await privRes.text();
    const dnllText = await dnllRes.text();

    contentDictionary.value.tos.text = marked.parse(tosText);
    contentDictionary.value.privacy.text = marked.parse(privText);
    contentDictionary.value.disclaimer.text = marked.parse(dnllText);
  } catch (error) {
    console.error('讀取協議檔案失敗:', error);
    contentDictionary.value[currentModalType.value].text = '<p style="color:#ff4d6d;">載入文本失敗，請檢查網路連線或檔案路徑。</p>';
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
/* ========================
   Checkbox 群組樣式
======================== */
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 15px;
  background: #fff0f3; 
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #ffe3e8;
  margin-top: 10px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  color: #555555;
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #ff4d6d; 
}

.checkbox-label a {
  color: #ff758f;
  text-decoration: none;
  font-weight: bold;
  transition: color 0.2s;
}

.checkbox-label a:hover {
  color: #ff4d6d;
  text-decoration: underline;
}

/* ========================
   Modal 彈窗樣式
======================== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.modal-content {
  background: #ffffff;
  border: 1px solid #ffe3e8;
  border-radius: 16px;
  width: 90%;
  max-width: 550px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(255, 143, 163, 0.15);
  animation: modalFadeIn 0.3s ease-out forwards;
}

.modal-title {
  margin: 0;
  padding: 20px 24px;
  font-size: 20px;
  color: #ff4d6d; 
  border-bottom: 1px solid #ffe3e8;
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  color: #555555;
  font-size: 15px;
  line-height: 1.6;
}

.loading-text {
  text-align: center;
  color: #ff758f;
  padding: 20px 0;
}

.markdown-content :deep(p) { margin-bottom: 12px; }
.markdown-content :deep(ul) { padding-left: 20px; margin-bottom: 12px; }
.markdown-content :deep(li) { margin-bottom: 8px; }
.markdown-content :deep(strong) { color: #333333; }
.markdown-content :deep(blockquote) {
  margin: 10px 0;
  padding: 10px 15px;
  background-color: #fff0f3;
  border-left: 4px solid #ff4d6d;
  color: #d81b60;
  border-radius: 0 4px 4px 0;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #ffe3e8;
  display: flex;
  justify-content: flex-end;
}

.close-btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: bold;
  color: white;
  background-color: #ff758f;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover:not(:disabled) {
  background-color: #ff4d6d;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(255, 77, 109, 0.3);
}

.close-btn:disabled {
  background-color: #f0f0f0;
  color: #bbbbbb;
  cursor: not-allowed;
}

@keyframes modalFadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>