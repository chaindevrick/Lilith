<template>
  <div class="settings-layout">
    <aside class="sidebar">
      <div class="brand">
        <h2>⚙️ Lilith 控制台</h2>
        <p>System Configuration</p>
      </div>
      <nav class="nav-menu">
        <button :class="{ active: activeTab === 'engine' }" @click="activeTab = 'engine'">🧠 大腦引擎 (Engine)</button>
        <button :class="{ active: activeTab === 'persona' }" @click="activeTab = 'persona'">🎭 人格與記憶 (Persona)</button>
        <button :class="{ active: activeTab === 'bots' }" @click="activeTab = 'bots'">🤖 社群載體 (Bots)</button>
        <button :class="{ active: activeTab === 'general' }" @click="activeTab = 'general'">🎛️ 通用設定 (General)</button>
      </nav>
      <div class="sidebar-footer">
        <button @click="goBack" class="btn-secondary w-full">返回聊天室</button>
        <button @click="goToSetup" class="btn-danger w-full mt-3">重新啟動精靈</button>
      </div>
    </aside>

    <main class="content">
      <div class="content-header">
        <h3>{{ tabTitle }}</h3>
        <button @click="saveSettings" class="btn-primary" :disabled="isSaving">
          {{ isSaving ? '儲存並重啟大腦中...' : '儲存設定 (Save & Restart)' }}
        </button>
      </div>

      <div class="scroll-area">
        <div v-show="activeTab === 'engine'" class="settings-panel">
          <div class="section-title">主要推論引擎 (Primary LLM)</div>
          <div class="form-group">
            <label>Model (大腦皮層)</label>
            <select v-model="form.llmModel" class="input-field">
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (推薦)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="claude-3-opus-20240229">Claude 3 Opus</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="lm-studio">Local LLM (LM Studio / Ollama)</option>
            </select>
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input type="password" v-model="form.LLM_API_KEY" class="input-field" autocomplete="new-password" spellcheck="false" />
          </div>
          <div class="form-group">
            <label>API Base URL (自訂代理或本地端點)</label>
            <input type="text" v-model="form.LLM_API_BASE_URL" class="input-field" placeholder="https://generativelanguage.googleapis.com/v1beta/openai/" />
          </div>

          <div class="section-title mt-4">高速反射引擎 (Fast Track & Embeddings)</div>
          <div class="form-group">
            <label>Subconscious Model (數位杏仁核)</label>
            <select v-model="form.fastModel" class="input-field">
              <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite (推薦)</option>
              <option value="gpt-4o-mini">GPT-4o-Mini</option>
              <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
              <option value="lm-studio">Local LLM</option>
            </select>
          </div>
          <div class="form-group">
            <label>Vector Embedding Model (海馬迴記憶庫)</label>
            <select v-model="form.vectorModel" class="input-field">
              <option value="gemini-embedding-2-preview">gemini-embedding-2-preview</option>
              <option value="text-embedding-3-small">text-embedding-3-small</option>
            </select>
          </div>
          <div class="form-group">
            <label>Subconscious & Vector API Key</label>
            <input type="password" v-model="form.FAST_LLM_API_KEY" class="input-field" placeholder="若與 Primary 相同可留空" autocomplete="new-password" spellcheck="false" />
          </div>
          <div class="form-group">
            <label>Vector DB Base URL</label>
            <input type="text" v-model="form.LTM_LLM_API_BASE_URL" class="input-field" placeholder="若與 Primary 相同可留空" />
          </div>
        </div>

        <div v-show="activeTab === 'persona'" class="settings-panel large-panel">
          <div class="form-group">
            <label>對話風格 (Conversation Style)</label>
            <input type="text" v-model="form.conversationStyle" class="input-field" placeholder="例如：俐落、自然、微傲嬌" />
          </div>
          <div class="form-group">
            <label>核心互動守則 (Interaction Rules)</label>
            <textarea v-model="form.interactionRules" class="input-field" rows="3"></textarea>
          </div>
          
          <div class="grid-2-col">
            <div class="form-group">
              <label>角色設定卡 (Character Card) 📝</label>
              <textarea v-model="form.characterCard" class="input-field code-font" rows="12"></textarea>
            </div>
            <div class="form-group">
              <label>使用者核心記憶 (User.md) 🧠</label>
              <textarea v-model="form.userMemory" class="input-field code-font" rows="12"></textarea>
            </div>
          </div>
        </div>

        <div v-show="activeTab === 'bots'" class="settings-panel">
          <p class="help-text mb-4">將 Lilith 的意識投射到不同的通訊軟體中。啟用後請填入對應的 Bot Token。</p>
          <div v-for="(bot, index) in form.bots" :key="index" class="bot-card">
            <div class="bot-header">
              <div class="bot-title">
                <span class="bot-icon">{{ getBotIcon(bot.platform) }}</span>
                <strong>{{ bot.name }}</strong>
              </div>
              <label class="switch">
                <input type="checkbox" v-model="bot.enabled" />
                <span class="slider round"></span>
              </label>
            </div>
            <div v-if="bot.enabled" class="bot-body">
              <input type="password" v-model="bot.apiKey" class="input-field" :placeholder="`請輸入 ${bot.platform} Token`" />
            </div>
          </div>
        </div>

        <div v-show="activeTab === 'general'" class="settings-panel">
          <div class="form-group toggle-group">
            <div class="toggle-info">
              <label>Telemetry: Token Usage</label>
              <span class="sub-text">在介面上顯示每次對話消耗的 Token 數量</span>
            </div>
            <input type="checkbox" v-model="form.generalSettings.showTokenUsage" />
          </div>
          <div class="form-group toggle-group">
            <div class="toggle-info">
              <label>Multi-Agents (多智能體協作)</label>
              <span class="sub-text">允許 Lilith 在背景召喚其他小型 AI 協助處理複雜任務</span>
            </div>
            <input type="checkbox" v-model="form.generalSettings.multiAgents" />
          </div>
          <div class="form-group toggle-group">
            <div class="toggle-info">
              <label>Self-Improve (自我進化)</label>
              <span class="sub-text">允許系統在閒置時自動反思並優化程式碼與記憶</span>
            </div>
            <input type="checkbox" v-model="form.generalSettings.selfImprove" />
          </div>
          <div class="form-group toggle-group">
            <div class="toggle-info">
              <label>Scheduled Tasks (背景排程)</label>
              <span class="sub-text">啟用時間感知與自動觸發的本能行為</span>
            </div>
            <input type="checkbox" v-model="form.generalSettings.scheduledTasks" />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useConfigStore } from '@/stores/configStore';

const router = useRouter();
const configStore = useConfigStore();
const activeTab = ref('engine');
const isSaving = ref(false);

const tabTitle = computed(() => {
  if (activeTab.value === 'engine') return '核心引擎與 API 設定';
  if (activeTab.value === 'persona') return '人格、記憶與行為規範';
  if (activeTab.value === 'bots') return '社群平台載體映射';
  return '系統通用設定';
});

const getBotIcon = (platform) => {
  const icons = { discord: '🎮', telegram: '✈️', whatsapp: '💬', line: '🟢' };
  return icons[platform.toLowerCase()] || '🤖';
};

// 🌟 直接將 Store 的 settings 作為響應式表單！
const form = computed(() => configStore.settings);

onMounted(async () => {
  await configStore.fetchSettings();
});

const saveSettings = async () => {
  isSaving.value = true;
  try {

    // 🌟 因為我們徹底統一了格式，直接把 form 丟給後端即可
    const payload = {
      ...form.value,
      relationshipRules: form.value.relationshipRules ? JSON.parse(form.value.relationshipRules) : null,
    };

    const response = await fetch('/api/system/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('儲存失敗');
    
    // 🌟 更新 Pinia 快取
    configStore.updateLocalSettings(payload);
    
    setTimeout(() => { router.push('/chat'); }, 1500);
  } catch (error) {
    alert(`儲存失敗: ${error.message}`);
    isSaving.value = false;
  }
};

const goBack = () => router.push('/chat');
const goToSetup = () => {
  if (confirm('確定要重新執行啟動精靈嗎？您現有的設定會被載入至精靈中。')) router.push('/setup');
};
</script>

<style scoped>
/* 基本佈局 */
.settings-layout { display: flex; height: 100vh; background-color: var(--bg-primary); color: var(--text-primary); font-family: 'Inter', sans-serif; transition: all 0.3s ease; }
.sidebar { width: 250px; background: var(--bg-secondary); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; transition: all 0.3s ease; }
.brand { padding: 2rem 1.5rem; }
.brand h2 { margin: 0; font-size: 1.2rem; color: var(--text-primary); }
.brand p { margin: 0; font-size: 0.8rem; color: var(--text-secondary); }

.nav-menu { flex: 1; display: flex; flex-direction: column; padding: 0 1rem; gap: 0.5rem; }
.nav-menu button { background: transparent; border: none; color: var(--text-secondary); text-align: left; padding: 12px 15px; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-size: 0.95rem; }
.nav-menu button:hover { background: var(--panel-bg); color: var(--text-primary); }
.nav-menu button.active { background: var(--accent-glow); color: var(--accent-primary); font-weight: 600; border-left: 3px solid var(--accent-primary); }

.sidebar-footer { padding: 1.5rem; }
.w-full { width: 100%; }

.content { flex: 1; display: flex; flex-direction: column; }
.content-header { padding: 2rem 3rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
.content-header h3 { margin: 0; font-size: 1.5rem; font-weight: 600; }
.scroll-area { flex: 1; padding: 2rem 3rem; overflow-y: auto; }

/* 表單區塊 */
.settings-panel { max-width: 650px; animation: fadeIn 0.3s ease; }
.settings-panel.large-panel { max-width: 900px; }

.section-title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px dashed var(--border-color); }
.help-text { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.8rem; opacity: 0.8; }
.sub-text { display: block; font-size: 0.75rem; color: var(--text-secondary); opacity: 0.7; margin-top: 4px; }

.form-group { margin-bottom: 1.5rem; }
.form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; }

.grid-2-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

.input-field { width: 100%; padding: 0.8rem 1rem; background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; color: var(--text-primary); transition: all 0.2s; box-sizing: border-box; }
.input-field:focus { outline: none; border-color: var(--accent-primary); box-shadow: 0 0 5px var(--accent-glow); }

.code-font { 
  font-family: 'JetBrains Mono', 'Fira Code', monospace; 
  font-size: 0.85rem; 
  line-height: 1.6; 
  tab-size: 2;
  white-space: pre-wrap;
  resize: vertical; 
}

.mt-3 { margin-top: 1rem; }
.mt-4 { margin-top: 1.5rem; }
.mb-4 { margin-bottom: 1.5rem; }

/* Toggle Group & Switch */
.toggle-group { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem; background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 1rem; }
.toggle-info label { margin: 0; font-size: 0.95rem; color: var(--text-primary); }

.switch { position: relative; display: inline-block; width: 46px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--border-color); transition: .4s; }
.slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; }
input:checked + .slider { background-color: var(--accent-primary); }
input:checked + .slider:before { transform: translateX(22px); }
.slider.round { border-radius: 24px; }
.slider.round:before { border-radius: 50%; }

/* Bot Cards */
.bot-card { background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.2rem; margin-bottom: 1rem; transition: border-color 0.3s; }
.bot-card:focus-within { border-color: var(--accent-primary); }
.bot-header { display: flex; justify-content: space-between; align-items: center; }
.bot-title { display: flex; align-items: center; gap: 10px; font-size: 1.1rem; }
.bot-icon { font-size: 1.5rem; }
.bot-body { margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border-color); animation: fadeIn 0.3s ease; }

/* 按鈕樣式 */
.btn-primary { background: var(--accent-primary); color: white; border: none; padding: 0.6rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.btn-primary:hover:not(:disabled) { opacity: 0.85; box-shadow: 0 0 10px var(--accent-glow); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary { background: var(--btn-bg); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.6rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.btn-secondary:hover { background: var(--panel-bg); border-color: var(--accent-primary); color: var(--accent-primary); }

.btn-danger { background: transparent; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); padding: 0.6rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s; }
.btn-danger:hover { background: rgba(239, 68, 68, 0.1); border-color: #ef4444; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>