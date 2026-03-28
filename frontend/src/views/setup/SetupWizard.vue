<template>
  <div class="wizard-container">
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: `${(currentStep / 7) * 100}%` }"></div>
    </div>

    <div class="wizard-content">
      <transition name="fade-slide" mode="out-in">
        <Step1Welcome v-if="currentStep === 1" key="step1" :formData="form" />
        <Step2Engine v-if="currentStep === 2" key="step2" :formData="form" />
        <Step3Persona v-if="currentStep === 3" key="step3" :formData="form" :showAdvanced="showAdvanced" />
        <Step4SocialBots v-if="currentStep === 4" key="step4" :botsData="bots" />
        <Step5Skills v-if="currentStep === 5" key="step5" :formData="form" :showAdvanced="showAdvanced" />
        
        <Step6GeneralSettings v-if="currentStep === 6" key="step6" :formData="form" />

        <Step7AgreementModal 
          v-if="currentStep === 7" 
          key="step7" 
          @agreed-change="handleAgreement" 
        />
      </transition>
    </div>

    <div class="wizard-footer">
      <button v-if="currentStep > 1" @click="prevStep" class="btn-secondary" :disabled="isSubmitting">上一步</button>
      <div class="spacer"></div>
      
      <div class="right-actions">
        <button v-if="currentStep === 3 || currentStep === 5" @click="showAdvanced = !showAdvanced" class="btn-text-link">
          <span v-if="currentStep === 3">{{ showAdvanced ? 'Character Card' : 'Advanced' }}</span>
          <span v-if="currentStep === 5">{{ showAdvanced ? 'Basic' : 'Advanced(JSON)' }}</span>
        </button>

        <button v-if="currentStep < 7" @click="nextStep" class="btn-primary">
          {{ currentStep === 1 ? '開始設定' : '下一步' }} ➔
        </button>
        
        <button v-if="currentStep === 7" @click="finishSetup" class="btn-primary" :disabled="isSubmitting || !isAgreed">
          {{ isSubmitting ? '系統啟動中...' : '完成啟動 ✨' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Step1Welcome from './components/Step1Welcome.vue';
import Step2Engine from './components/Step2Engine.vue';
import Step3Persona from './components/Step3Persona.vue';
import Step4SocialBots from './components/Step4SocialBots.vue';
import Step5Skills from './components/Step5Skills.vue';
import Step6GeneralSettings from './components/Step6GeneralSettings.vue';
import Step7AgreementModal from './components/Step7AgreementModal.vue';

const router = useRouter();
const currentStep = ref(1);
const showAdvanced = ref(false);
const isSubmitting = ref(false);
const isAgreed = ref(false);

const handleAgreement = (status) => {
  isAgreed.value = status;
};

const defaultRelationshipJSON = {
  "TIERS": [ { "level": 0, "range": [0, 20], "title": "陌生的過客", "behavior_guide": "心態：【生人勿近】。稍微冷淡的禮貌，回應簡短。" }, { "level": 1, "range": [21, 50], "title": "有趣的玩伴", "behavior_guide": "心態：【損友/朋友】。氛圍輕鬆，展現真實說話風格，試著捉弄對方。" }, { "level": 2, "range": [51, 80], "title": "曖昧的距離", "behavior_guide": "心態：【戀人未滿】。關鍵詞是矛盾。被誇獎時會掩飾開心，言語強勢但語氣變軟。" }, { "level": 3, "range": [81, 100], "title": "此生摯愛", "behavior_guide": "心態：【全心交付】。不再掩飾愛意，說話語氣溫柔黏人。極度依賴。" } ],
  "TRUST": [ { "min": 0, "max": 40, "label": "防備", "behavior_guide": "認知：【自我保護】。對話僅停留在表面。" }, { "min": 41, "max": 70, "label": "試探", "behavior_guide": "認知：【嘗試敞開】。試探性地聊一些深層話題。" }, { "min": 71, "max": 100, "label": "信賴", "behavior_guide": "認知：【毫無保留】。願意分享脆弱與秘密。" } ],
  "MOOD": [ { "min": -50, "max": -6, "label": "低落", "behavior_guide": "狀態：【情緒低氣壓】。回應簡短冷淡，需要被哄。" }, { "min": -5, "max": 5, "label": "平靜", "behavior_guide": "狀態：【日常模式】。情緒穩定，理性交流。" }, { "min": 6, "max": 50, "label": "愉悅", "behavior_guide": "狀態：【心情極佳】。話變多，願意主動互動。" } ]
};

const form = reactive({
  userName: '',             
  conversationId: 'web_user', 
  llmModel: 'gemini-3.1-pro-preview',
  vectorModel: 'gemini-embedding-2-preview',
  llmApiKey: '',
  vectorApiKey: '', 
  fastModel: 'gemini-3.1-flash-lite-preview',
  fastApiKey: '', 
  interactionRules: '1. 保持沉浸感。\n2. 善用 Markdown。',
  conversationStyle: '俐落、自然。',
  characterCard: '# Lilith\n妳是 Lilith。',
  relationshipRules: JSON.stringify(defaultRelationshipJSON, null, 2),
  skills: { allowBundled: [], entries: {} },
  generalSettings: {
    multiAgents: false,
    selfImprove: false,
    scheduledTasks: false,
    showTokenUsage: true
  }
});

const bots = reactive([
  { id: 'discord', name: 'Discord', enabled: false, apiKey: '' },
  { id: 'telegram', name: 'Telegram', enabled: false, apiKey: '' },
  { id: 'whatsapp', name: 'WhatsApp', enabled: false, apiKey: '' },
  { id: 'line', name: 'Line', enabled: false, apiKey: '' }
]);

onMounted(async () => {
  const savedUser = localStorage.getItem('lilith_user_name');
  const savedConId = localStorage.getItem('lilith_conversation_id');
  if (savedUser) form.userName = savedUser;
  if (savedConId) form.conversationId = savedConId;

  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      
      if (data.llmModel) form.llmModel = data.llmModel;
      if (data.vectorModel) form.vectorModel = data.vectorModel;
      if (data.fastModel) form.fastModel = data.fastModel;
      
      // 🌟 修改：讀取後端傳來的 LLM_ 變數
      if (data.LLM_API_KEY) form.llmApiKey = data.LLM_API_KEY;
      if (data.LTM_LLM_API_KEY) form.vectorApiKey = data.LTM_LLM_API_KEY;
      if (data.FAST_LLM_API_KEY) form.fastApiKey = data.FAST_LLM_API_KEY;
      if (data.characterCard) form.characterCard = data.characterCard;
      if (data.interactionRules) form.interactionRules = data.interactionRules;
      if (data.conversationStyle) form.conversationStyle = data.conversationStyle;
      if (data.skills) form.skills = data.skills;

      // 讀取通用設定
      if (data.generalSettings) {
        form.generalSettings = { ...form.generalSettings, ...data.generalSettings };
      }

      if (data.relationshipRules) {
        form.relationshipRules = JSON.stringify(data.relationshipRules, null, 2);
      }
      
      if (data.bots && Array.isArray(data.bots)) {
        data.bots.forEach(savedBot => {
          const target = bots.find(b => b.id === savedBot.id);
          if (target) {
            target.enabled = savedBot.enabled;
            target.apiKey = savedBot.apiKey;
          }
        });
      }
    }
  } catch (error) {
    console.warn("無法獲取現有設定，將使用預設值。");
  }
});

const nextStep = () => { 
  if (currentStep.value < 7) currentStep.value++; 
  showAdvanced.value = false;
};
const prevStep = () => { 
  if (currentStep.value > 1) currentStep.value--; 
  showAdvanced.value = false;
};

const finishSetup = async () => {
  isSubmitting.value = true;
  try {
    let parsedRules;
    try {
      parsedRules = JSON.parse(form.relationshipRules);
    } catch (e) {
      throw new Error("「關係數值引擎」的 JSON 格式錯誤，請檢查語法！");
    }

    const payload = {
      llmModel: form.llmModel,
      vectorModel: form.vectorModel,
      fastModel: form.fastModel,

      LLM_API_KEY: form.llmApiKey,
      LTM_LLM_API_KEY: form.vectorApiKey || form.llmApiKey,
      FAST_LLM_API_KEY: form.fastApiKey,

      interactionRules: form.interactionRules,
      conversationStyle: form.conversationStyle,
      characterCard: form.characterCard,
      relationshipRules: parsedRules,
      skills: form.skills,
      bots: bots,
      generalSettings: form.generalSettings // 儲存通用設定
    };

    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '伺服器發生錯誤');
    }

    localStorage.setItem('lilith_setup_completed', 'true');
    localStorage.setItem('lilith_user_name', form.userName);
    localStorage.setItem('lilith_conversation_id', form.conversationId || 'web_user');
    
    // 將設定同步寫入前端 Store (供 LeftStage 即時讀取)
    try {
        const configStore = (await import('../../stores/configStore')).useConfigStore();
        configStore.generalSettings = form.generalSettings;
    } catch(e) {}

    router.push('/chat'); 
  } catch (error) {
    console.error('Setup Error:', error);
    alert(`啟動失敗：${error.message}`);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.wizard-container { display: flex; flex-direction: column; height: 100vh; background-color: #fafafa; font-family: 'Inter', sans-serif; color: #333; }
.progress-bar { height: 6px; background-color: #fce7f3; width: 100%; }
.progress-fill { height: 100%; background-color: #ec4899; transition: width 0.4s ease-in-out; }
.wizard-content { flex: 1; display: flex; justify-content: center; align-items: center; padding: 2rem; overflow-y: auto; }

.wizard-footer { padding: 1.5rem 3rem; background: white; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
.spacer { flex: 1; }
.right-actions { display: flex; align-items: center; gap: 1.5rem; }

.btn-primary { background: #ec4899; color: white; border: none; padding: 0.8rem 2rem; border-radius: 8px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: 0.2s; }
.btn-primary:hover:not(:disabled) { background: #db2777; }
.btn-primary:disabled { background: #fbcfe8; cursor: not-allowed; }

.btn-secondary { background: white; color: #666; border: 1px solid #ddd; padding: 0.8rem 2rem; border-radius: 8px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: 0.2s; }
.btn-secondary:hover:not(:disabled) { background: #f5f5f5; color: #333; }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-text-link { background: none; border: none; color: #999; font-size: 0.95rem; font-weight: 600; cursor: pointer; padding: 0.5rem; transition: 0.2s; text-decoration: underline; text-underline-offset: 4px; }
.btn-text-link:hover { color: #ec4899; }

.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.3s ease; }
.fade-slide-enter-from { opacity: 0; transform: translateX(30px); }
.fade-slide-leave-to { opacity: 0; transform: translateX(-30px); }
</style>

<style>
.step-panel { background: white; padding: 3rem; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); width: 100%; max-width: 650px; min-height: 400px; }
.title { font-size: 1.8rem; font-weight: 700; color: #111; margin-bottom: 0.5rem; }
.subtitle { font-size: 1rem; color: #666; margin-bottom: 2rem; }
.form-group { margin-bottom: 1.5rem; }
.form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: #555; margin-bottom: 0.5rem; }
.input-field { width: 100%; padding: 0.8rem 1rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; color: #333; transition: 0.2s; box-sizing: border-box; }
.input-field:focus { outline: none; border-color: #ec4899; }
</style>