<template>
  <div class="settings-container">
    
    <div class="settings-header">
      <div class="header-left">
        <h2 class="title">SYSTEM CONFIGURATION</h2>
        <div class="subtitle">Core parameters for Lilith Neural Network</div>
      </div>
      <n-button ghost type="warning" @click="$emit('back')" class="close-btn">
        ✖ CLOSE
      </n-button>
    </div>

    <div class="settings-content" v-if="!isLoading">
      
      <div class="section">
        <div class="section-title">🧠 GEMINI NEURAL LINK</div>
        
        <div class="form-item">
          <label>Primary API Key (Cognition)</label>
          <n-input 
            type="password" 
            show-password-on="click" 
            v-model:value="config.GEMINI_API_KEY" 
            placeholder="sk-..." 
          >
            <template #prefix>🔑</template>
          </n-input>
        </div>

        <div class="form-row">
          <div class="form-item half">
            <label>LTM API Key (Memory)</label>
            <n-input 
              type="password" 
              show-password-on="click" 
              v-model:value="config.LTM_GEMINI_API_KEY" 
              placeholder="sk-..."
            >
              <template #prefix>💾</template>
            </n-input>
          </div>
          <div class="form-item half">
            <label>Relationship API Key (Emotion)</label>
            <n-input 
              type="password" 
              show-password-on="click" 
              v-model:value="config.RELATIONSHIP_GEMINI_API_KEY" 
              placeholder="sk-..."
            >
              <template #prefix>❤️</template>
            </n-input>
          </div>
        </div>

        <div class="form-item">
          <label>API Base URL (OpenAI SDK Compatible)</label>
          <n-input 
            v-model:value="config.GEMINI_API_BASE_URL" 
            placeholder="https://generativelanguage.googleapis.com/v1beta/openai/" 
          >
            <template #prefix>🔗</template>
          </n-input>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🌐 EXTERNAL KNOWLEDGE</div>
        <div class="form-row">
          <div class="form-item half">
            <label>Google Search API Key</label>
            <n-input 
              type="password" 
              show-password-on="click" 
              v-model:value="config.GOOGLE_SEARCH_API_KEY" 
              placeholder="AIza..."
            >
              <template #prefix>🔍</template>
            </n-input>
          </div>
          <div class="form-item half">
            <label>Search Engine ID (CX)</label>
            <n-input 
              v-model:value="config.GOOGLE_SEARCH_CX" 
              placeholder="012345..."
            >
               <template #prefix>🆔</template>
            </n-input>
          </div>
        </div>
      </div>

    </div>

    <div class="loading-state" v-else>
      <div class="loader"></div>
      <span>ACCESSING SECURE STORAGE...</span>
    </div>

    <div class="settings-footer">
      <div class="warning-text">
        <span class="warn-icon">⚠️</span> 
        Changes require a system restart to take effect.
      </div>
      <n-button 
        type="primary" 
        color="#ea4c89" 
        size="large" 
        :loading="isSaving" 
        @click="saveSettings"
        class="save-btn"
      >
        SAVE CONFIGURATION
      </n-button>
    </div>
  </div>
</template>

<script setup>
import { NInput, NButton } from 'naive-ui';
import { useSettings } from '../composables/useSettings.js';

const emit = defineEmits(['back']);
const { config, isLoading, isSaving, saveSettings } = useSettings();
</script>

<style scoped>
/* Main Layout */
.settings-container {
  width: 100%;
  height: 100%;
  background-color: #1a1a1a;
  background-image: radial-gradient(circle at 50% 50%, rgba(30,30,30,1), #151515);
  color: #eee;
  display: flex;
  flex-direction: column;
  padding: 40px;
  font-family: 'JetBrains Mono', monospace;
  overflow: hidden;
  box-sizing: border-box;
}

/* Header */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  border-bottom: 1px solid #333;
  padding-bottom: 20px;
  flex-shrink: 0;
}

.title {
  font-size: 1.8em;
  color: #ea4c89;
  letter-spacing: 2px;
  margin: 0;
  text-shadow: 0 0 15px rgba(234, 76, 137, 0.4);
}
.subtitle {
  font-size: 0.8em;
  color: #666;
  margin-top: 5px;
}

/* Content Area */
.settings-content {
  flex-grow: 1;
  overflow-y: auto;
  padding-right: 10px; /* Space for scrollbar */
}

.section {
  background: rgba(255, 255, 255, 0.02);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: border-color 0.3s;
}
.section:hover {
  border-color: rgba(234, 76, 137, 0.3);
}

.section-title {
  color: #888;
  font-weight: bold;
  margin-bottom: 15px;
  font-size: 0.85em;
  border-left: 3px solid #ea4c89;
  padding-left: 10px;
  letter-spacing: 1px;
}

/* Form Elements */
.form-item { margin-bottom: 15px; }
.form-row { display: flex; gap: 20px; }
.form-item.half { flex: 1; }

label {
  display: block;
  font-size: 0.75em;
  color: #aaa;
  margin-bottom: 6px;
  font-weight: 500;
}

/* Loading State */
.loading-state {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #666;
  gap: 15px;
}
.loader {
  border: 3px solid #333;
  border-top: 3px solid #ea4c89;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
}

/* Footer */
.settings-footer {
  margin-top: 10px;
  padding-top: 20px;
  border-top: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.warning-text {
  color: #e6a23c;
  font-size: 0.8em;
  display: flex;
  align-items: center;
  gap: 8px;
}
.warn-icon { font-size: 1.2em; }

.save-btn { font-weight: bold; padding: 0 30px; }

/* Scrollbar Customization */
.settings-content::-webkit-scrollbar { width: 6px; }
.settings-content::-webkit-scrollbar-track { background: transparent; }
.settings-content::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
.settings-content::-webkit-scrollbar-thumb:hover { background: #555; }

/* Keyframe Animations */
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* Mobile Optimization */
@media (max-width: 768px) {
  .settings-container { padding: 20px; }
  .form-row { flex-direction: column; gap: 15px; }
  .settings-footer { flex-direction: column; gap: 15px; align-items: stretch; }
  .warning-text { justify-content: center; text-align: center; }
  .title { font-size: 1.4em; }
}
</style>