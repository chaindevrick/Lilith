<template>
  <div class="step-panel">
    <div class="step-header">
      <h2 class="title">🧩 擴充技能與權限 (Skills)</h2>
      <p class="subtitle">
        系統已自動掃描 <code>backend/skills</code> 目錄。請在此為莉莉絲配置她能夠使用的外部工具與數位權能。
      </p>
    </div>

    <div v-if="!showAdvanced" class="basic-mode-container">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>正在掃描本地端技能矩陣...</p>
      </div>

      <div v-else class="skills-list">
        <div 
          v-for="skill in availableSkills" 
          :key="skill.id" 
          class="skill-item" 
          :class="{ 'is-system': skill.isSystem, 'clickable': !skill.isSystem }"
          @click="toggleSkill(skill)"
        >
          <div class="skill-info">
            <div class="skill-header">
              <span class="skill-name">{{ skill.name }}</span>
              <span v-if="skill.isSystem" class="badge system-badge" title="系統核心模組，無法關閉">核心必備</span>
            </div>
            <p class="skill-desc">{{ skill.desc }}</p>
            <p class="skill-id-hint">ID: {{ skill.id }}</p>
          </div>
          
          <div class="skill-toggle">
            <input 
              type="checkbox" 
              :id="'skill-' + skill.id"
              :checked="formData.skills.allowBundled.includes(skill.id)"
              :disabled="skill.isSystem"
            />
            <div class="toggle-switch"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="advanced-mode-container text-left">
      <div class="advanced-guide">
        <h4>⚠️ 進階參數設定</h4>
        <p>當您在上一頁勾選技能時，系統會自動將所需的金鑰欄位生成於此。請將 <code>&lt;請輸入...&gt;</code> 替換為您真實的 API Key。</p>
      </div>

      <div class="editor-wrapper" :class="{ 'has-error': jsonError }">
        <div class="editor-header">
          <span class="status-badge" :class="jsonError ? 'error' : 'success'">
            {{ jsonError ? '❌ 語法錯誤 (請檢查逗號或雙引號)' : '✅ 格式正確' }}
          </span>
          <button class="format-btn" @click="formatJson" :disabled="jsonError">
            ✨ 自動排版
          </button>
        </div>
        
        <textarea 
          v-model="skillsJsonStr" 
          @input="handleJsonChange"
          @keydown.enter.stop
          class="json-editor-textarea"
          rows="14"
          spellcheck="false"
          placeholder="在此輸入 JSON 配置..."
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  formData: { type: Object, required: true },
  showAdvanced: { type: Boolean, default: false }
});

const availableSkills = ref([]);
const loading = ref(true);
const skillsJsonStr = ref('');
const jsonError = ref(false);

const KNOWN_ENV_TEMPLATES = {
  "discordtoolkit": {
    "DISCORD_BOT_TOKEN": "<請輸入 Discord Bot Token>"
  },
  "webtoolkit": {
    "SERPAPI_API_KEY": "<請輸入 SERPAPI Key (用於 Google 搜尋)>",
    "TAVILY_API_KEY": "<或者輸入 TAVILY Key (兩者擇一即可)>"
  },
  "browsertoolkit": {
    "BROWSERLESS_WS_ENDPOINT": "<若使用雲端 Browserless 請填寫 WS 網址，本地可留空>"
  },
  "generateimage": {
    "NANO_API_KEY": "<請輸入 Nano Banana 對接金鑰>"
  }
};

onMounted(async () => {
  try {
    const res = await fetch('/api/skills/available');
    availableSkills.value = await res.json();
    
    if (!props.formData.skills) props.formData.skills = { allowBundled: [], entries: {} };
    if (!props.formData.skills.allowBundled) props.formData.skills.allowBundled = [];
    if (!props.formData.skills.entries) props.formData.skills.entries = {};

    availableSkills.value.forEach(skill => {
      if (skill.isSystem && !props.formData.skills.allowBundled.includes(skill.id)) {
        props.formData.skills.allowBundled.push(skill.id);
      }
    });

    skillsJsonStr.value = JSON.stringify(props.formData.skills, null, 2);

  } catch (error) {
    console.error("Failed to load skills:", error);
  } finally {
    loading.value = false;
  }
});

const toggleSkill = (skill) => {
  if (skill.isSystem) return; // 系統技能不可被關閉
  
  const allowed = props.formData.skills.allowBundled;
  const index = allowed.indexOf(skill.id);
  
  if (index > -1) {
    allowed.splice(index, 1); // 已經存在則移除
  } else {
    allowed.push(skill.id); // 不存在則加入
  }
};

watch(() => props.formData.skills.allowBundled, (newAllowList) => {
  if (!newAllowList) return;
  
  newAllowList.forEach(skillId => {
    if (KNOWN_ENV_TEMPLATES[skillId] && !props.formData.skills.entries[skillId]) {
      props.formData.skills.entries[skillId] = {
        skillEnv: { ...KNOWN_ENV_TEMPLATES[skillId] }
      };
    }
  });
  
  Object.keys(props.formData.skills.entries).forEach(skillId => {
      if (!newAllowList.includes(skillId)) {
        delete props.formData.skills.entries[skillId];
      }
    });
}, { deep: true, immediate: true });

watch(() => props.formData.skills, (newVal) => {
  if (!jsonError.value) {
    skillsJsonStr.value = JSON.stringify(newVal, null, 2);
  }
}, { deep: true });

const handleJsonChange = (e) => {
  try {
    const parsed = JSON.parse(e.target.value);
    props.formData.skills.allowBundled = parsed.allowBundled || [];
    props.formData.skills.entries = parsed.entries || {};
    jsonError.value = false;
  } catch (err) {
    jsonError.value = true;
  }
};

const formatJson = () => {
  if (!jsonError.value) {
    try {
      const parsed = JSON.parse(skillsJsonStr.value);
      skillsJsonStr.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
      // ignore
    }
  }
};
</script>

<style scoped>
/* 樣式保持不變，保留你之前要求的 IDE 質感與緊湊清單 */
.step-header { margin-bottom: 1.5rem; }
.title { font-size: 1.4rem; font-weight: 700; color: #111; margin-bottom: 0.5rem; }
.subtitle { font-size: 0.95rem; color: #666; line-height: 1.5; margin: 0; }
code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.85em; color: #db2777; }

.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 0; color: #ea4c89; }
.spinner { width: 30px; height: 30px; border: 3px solid rgba(234, 76, 137, 0.2); border-top-color: #ea4c89; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem; }
@keyframes spin { to { transform: rotate(360deg); } }

.skills-list { display: flex; flex-direction: column; gap: 0.6rem; max-height: 420px; overflow-y: auto; padding-right: 8px; }
.skills-list::-webkit-scrollbar { width: 6px; }
.skills-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

.skill-item { display: flex; justify-content: space-between; align-items: center; padding: 0.8rem 1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; transition: all 0.2s ease; }
.skill-item.clickable { cursor: pointer; }
.skill-item.clickable:hover { border-color: #fbcfe8; box-shadow: 0 4px 12px rgba(236,72,153,0.06); transform: translateY(-1px); }
.skill-item.is-system { background: #f8fafc; border-color: #e2e8f0; cursor: not-allowed; opacity: 0.85; }

.skill-info { flex: 1; text-align: left; padding-right: 12px; }
.skill-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.2rem; }
.skill-name { font-weight: 700; font-size: 1rem; color: #0f172a; font-family: 'JetBrains Mono', monospace; }
.skill-desc { font-size: 0.85rem; color: #64748b; line-height: 1.4; margin: 0; }
.skill-id-hint { font-size: 0.7rem; color: #94a3b8; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }

.badge { font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px; }
.system-badge { background: #334155; color: white; }

.skill-toggle { position: relative; width: 36px; height: 20px; flex-shrink: 0; pointer-events: none; /* 讓點擊穿透到外層 */ }
.skill-toggle input { opacity: 0; width: 0; height: 0; }
.toggle-switch { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .3s; border-radius: 20px; }
.toggle-switch:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.skill-toggle input:checked + .toggle-switch { background-color: #ea4c89; }
.skill-toggle input:checked + .toggle-switch:before { transform: translateX(16px); }
.skill-toggle input:disabled + .toggle-switch { background-color: #f1f5f9; opacity: 0.7; }
.skill-toggle input:disabled:checked + .toggle-switch { background-color: #fbcfe8; }

.advanced-mode-container { display: flex; flex-direction: column; gap: 1rem; height: 100%; }
.advanced-guide h4 { margin: 0 0 0.2rem 0; color: #b91c1c; font-size: 0.95rem; }
.advanced-guide p { margin: 0; font-size: 0.85rem; color: #475569; line-height: 1.4; }

.editor-wrapper { display: flex; flex-direction: column; background: #1e1e2e; border-radius: 10px; border: 1px solid #313244; overflow: hidden; transition: border-color 0.3s ease; }
.editor-wrapper.has-error { border-color: #ef4444; box-shadow: 0 0 0 1px #ef4444; }

.editor-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #181825; border-bottom: 1px solid #313244; }
.status-badge { font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 4px; }
.status-badge.success { color: #10b981; }
.status-badge.error { color: #ef4444; }

.format-btn { background: rgba(255,255,255,0.1); border: none; color: #cdd6f4; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: 0.2s; font-family: inherit; }
.format-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
.format-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.json-editor-textarea { width: 100%; padding: 1rem; background: transparent; border: none; color: #a6e3a1; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; line-height: 1.6; resize: vertical; box-sizing: border-box; }
.json-editor-textarea:focus { outline: none; }
</style>