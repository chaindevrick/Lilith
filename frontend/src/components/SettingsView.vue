<template>
  <div class="settings-container">
    <div class="settings-header">
      <h2 class="title">SYSTEM CONFIGURATION</h2>
      <n-button ghost type="warning" @click="$emit('back')">✖ CLOSE</n-button>
    </div>

    <div class="settings-content" v-if="!isLoading">
      
      <div class="section">
        <div class="section-title">🧠 GEMINI NEURAL LINK</div>
        <div class="form-item">
          <label>Primary API Key</label>
          <n-input type="password" show-password-on="click" v-model:value="config.GEMINI_API_KEY" placeholder="Used for main cognition" />
        </div>
        <div class="form-row">
          <div class="form-item half">
            <label>LTM API Key</label>
            <n-input type="password" show-password-on="click" v-model:value="config.LTM_GEMINI_API_KEY" placeholder="For Long-term Memory" />
          </div>
          <div class="form-item half">
            <label>Relationship API Key</label>
            <n-input type="password" show-password-on="click" v-model:value="config.RELATIONSHIP_GEMINI_API_KEY" placeholder="For Emotion Analysis" />
          </div>
        </div>
        <div class="form-item">
          <label>API Base URL (OpenAI SDK)</label>
          <n-input v-model:value="config.GEMINI_API_BASE_URL" placeholder="https://generativelanguage.googleapis.com/v1beta/openai/" />
        </div>
      </div>

      <div class="section">
        <div class="section-title">📡 DISCORD UPLINK</div>
        <div class="form-item">
          <label>Bot Token</label>
          <n-input type="password" show-password-on="click" v-model:value="config.DISCORD_TOKEN" placeholder="Bot Token" />
        </div>
        <div class="form-item">
          <label>Owner ID</label>
          <n-input v-model:value="config.DISCORD_OWNER_ID" placeholder="Your Discord User ID" />
        </div>
      </div>

      <div class="section">
        <div class="section-title">🌐 EXTERNAL KNOWLEDGE</div>
        <div class="form-row">
          <div class="form-item half">
            <label>Search API Key</label>
            <n-input type="password" show-password-on="click" v-model:value="config.GOOGLE_SEARCH_API_KEY" />
          </div>
          <div class="form-item half">
            <label>Search Engine ID (CX)</label>
            <n-input v-model:value="config.GOOGLE_SEARCH_CX" />
          </div>
        </div>
      </div>

    </div>

    <div class="loading-state" v-else>
      ACCESSING SECURE STORAGE...
    </div>

    <div class="settings-footer">
      <div class="warning-text">⚠️ Changes require a system restart to take effect.</div>
      <n-button type="primary" color="#ea4c89" size="large" :loading="isSaving" @click="saveSettings">
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
.settings-container {
  width: 100%;
  height: 100%;
  background-color: #1a1a1a;
  background-image: radial-gradient(circle at 50% 50%, rgba(20,20,20,0.8), #1a1a1a);
  color: #eee;
  display: flex;
  flex-direction: column;
  padding: 40px;
  font-family: 'JetBrains Mono', sans-serif;
  overflow: hidden;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  border-bottom: 2px solid #333;
  padding-bottom: 20px;
}

.title {
  font-size: 1.8em;
  color: #ea4c89;
  letter-spacing: 2px;
  margin: 0;
  text-shadow: 0 0 10px rgba(234, 76, 137, 0.3);
}

.settings-content {
  flex-grow: 1;
  overflow-y: auto;
  padding-right: 10px;
}

.section {
  background: rgba(255, 255, 255, 0.03);
  padding: 25px;
  border-radius: 10px;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.section-title {
  color: #888;
  font-weight: bold;
  margin-bottom: 15px;
  font-size: 0.9em;
  border-left: 3px solid #ea4c89;
  padding-left: 10px;
}

.form-item {
  margin-bottom: 15px;
}

.form-row {
  display: flex;
  gap: 20px;
}
.form-item.half {
  flex: 1;
}

label {
  display: block;
  font-size: 0.8em;
  color: #aaa;
  margin-bottom: 5px;
}

.loading-state {
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #666;
  font-style: italic;
}

.settings-footer {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.warning-text {
  color: #e6a23c;
  font-size: 0.8em;
}

/* Custom Scrollbar */
.settings-content::-webkit-scrollbar { width: 6px; }
.settings-content::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
</style>