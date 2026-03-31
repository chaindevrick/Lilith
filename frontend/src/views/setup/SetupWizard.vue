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
        <Step4SocialBots v-if="currentStep === 4" key="step4" :botsData="form.bots" />
        <Step5Skills v-if="currentStep === 5" key="step5" :formData="form" :showAdvanced="showAdvanced" />
        <Step6GeneralSettings v-if="currentStep === 6" key="step6" :formData="form" />
        <Step7AgreementModal v-if="currentStep === 7" key="step7" @agreed-change="handleAgreement" />
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
import { useConfigStore } from '@/stores/configStore';
import Step1Welcome from './components/Step1Welcome.vue';
import Step2Engine from './components/Step2Engine.vue';
import Step3Persona from './components/Step3Persona.vue';
import Step4SocialBots from './components/Step4SocialBots.vue';
import Step5Skills from './components/Step5Skills.vue';
import Step6GeneralSettings from './components/Step6GeneralSettings.vue';
import Step7AgreementModal from './components/Step7AgreementModal.vue';

const router = useRouter();
const configStore = useConfigStore();

const currentStep = ref(1);
const showAdvanced = ref(false);
const isSubmitting = ref(false);
const isAgreed = ref(false);

const handleAgreement = (status) => isAgreed.value = status;

const form = reactive({
  userName: '',             
  conversationId: 'web_user', 
  ...JSON.parse(JSON.stringify(configStore.settings))
});

onMounted(async () => {
  const savedUser = localStorage.getItem('lilith_user_name');
  const savedConId = localStorage.getItem('lilith_conversation_id');
  if (savedUser) form.userName = savedUser;
  if (savedConId) form.conversationId = savedConId;

  const data = await configStore.fetchSettings();
  if (data) {
    Object.keys(data).forEach(key => {
      if (form[key] !== undefined) {
        form[key] = data[key];
      }
    });
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
      ...form,
      relationshipRules: parsedRules
    };

    const response = await fetch('/api/system/settings', {
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
    
    // 更新 Store 快取
    configStore.updateLocalSettings(payload);

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
/* 原有樣式保持不變 */
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
/* 原有全域樣式保持不變 */
.step-panel { background: white; padding: 3rem; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); width: 100%; max-width: 650px; min-height: 400px; }
.title { font-size: 1.8rem; font-weight: 700; color: #111; margin-bottom: 0.5rem; }
.subtitle { font-size: 1rem; color: #666; margin-bottom: 2rem; }
.form-group { margin-bottom: 1.5rem; }
.form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: #555; margin-bottom: 0.5rem; }
.input-field { width: 100%; padding: 0.8rem 1rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; color: #333; transition: 0.2s; box-sizing: border-box; }
.input-field:focus { outline: none; border-color: #ec4899; }
</style>