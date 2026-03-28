<template>
  <div class="step-panel">
    <h2 class="title">擴充技能與權限 (Skills)</h2>
    <p class="subtitle">系統已自動掃描 <code>backend/skills</code> 目錄。在此配置莉莉絲能使用的物理與數位權能。</p>

    <div v-if="!showAdvanced">
      <div v-if="loading" class="text-center mt-10" style="color: #ea4c89;">
        <p>掃描本地端技能矩陣中...</p>
      </div>

      <div v-else class="skills-list">
        <div v-for="skill in availableSkills" :key="skill.id" class="skill-item" :class="{ 'is-system': skill.isSystem }">
          <div class="skill-info">
            <div class="skill-header">
              <span class="skill-name">{{ skill.name }}</span>
              <span v-if="skill.isSystem" class="badge system-badge">核心系統 (Core)</span>
            </div>
            <p class="skill-desc">{{ skill.desc }}</p>
            <p class="skill-id-hint">ID: {{ skill.id }}</p>
          </div>
          
          <div class="skill-toggle">
            <input 
              type="checkbox" 
              :id="'skill-' + skill.id"
              :value="skill.id"
              v-model="formData.skills.allowBundled"
              :disabled="skill.isSystem"
            />
            <label :for="'skill-' + skill.id" class="toggle-switch"></label>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="json-editor-container text-left">
      <p class="help-text">底層 <code>skills</code> 參數。您可以在 <code>entries</code> 中手動覆寫特定技能的運作邏輯與 API 金鑰等配置。</p>
      
      <div class="demo-box">
        <div class="demo-title">💡 配置範例 (以 webToolkit 加入 SERPAPI_API_KEY 為例)：</div>
        <pre class="demo-code">
"entries": {
  "webToolkit": {
    "skillEnv": {
      "SERPAPI_API_KEY": "請替換為妳的 API Key"
    }
  }
}</pre>
      </div>

      <textarea 
        v-model="skillsJsonStr" 
        @input="handleJsonChange"
        class="input-field json-editor"
        rows="10"
      ></textarea>
      <p v-if="jsonError" class="error-text">JSON 格式錯誤，請檢查語法。</p>
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

onMounted(async () => {
  try {
    const res = await fetch('/api/skills/available');
    availableSkills.value = await res.json();
    
    if (!props.formData.skills) props.formData.skills = { allowBundled: [], entries: {} };
    if (!props.formData.skills.allowBundled) props.formData.skills.allowBundled = [];

    // 強制將 isSystem: true 的技能加入 allowBundled
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
</script>

<style scoped>
.skills-list { display: flex; flex-direction: column; gap: 1rem; max-height: 400px; overflow-y: auto; padding-right: 10px; }
.skill-item { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem; background: #fff; border: 1px solid #eee; border-radius: 12px; transition: all 0.2s ease; }
.skill-item:hover { border-color: #fbcfe8; box-shadow: 0 4px 12px rgba(236,72,153,0.05); }
.skill-item.is-system { background: #fafafa; border-color: #ddd; }

.skill-info { flex: 1; text-align: left; }
.skill-header { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.4rem; }
.skill-name { font-weight: 700; font-size: 1.1rem; color: #111; font-family: 'JetBrains Mono', monospace; }
.skill-desc { font-size: 0.9rem; color: #666; line-height: 1.4; margin: 0; }
.skill-id-hint { font-size: 0.75rem; color: #aaa; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }

.badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; font-weight: bold; letter-spacing: 0.5px; }
.system-badge { background: #111; color: white; }

/* Switch Style */
.skill-toggle { position: relative; width: 50px; height: 26px; }
.skill-toggle input { opacity: 0; width: 0; height: 0; }
.toggle-switch { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .3s; border-radius: 34px; }
.toggle-switch:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }

.skill-toggle input:checked + .toggle-switch { background-color: #ec4899; }
.skill-toggle input:disabled + .toggle-switch { background-color: #e5e5e5; cursor: not-allowed; }
.skill-toggle input:disabled:checked + .toggle-switch { background-color: #fbcfe8; }
.skill-toggle input:checked + .toggle-switch:before { transform: translateX(24px); }

/* JSON Editor & Demo Box */
.json-editor-container { background: #f9f9f9; padding: 1.5rem; border-radius: 12px; border: 1px solid #ddd; height: 100%; }
.json-editor { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #333; background: #fff; line-height: 1.5; resize: vertical; margin-top: 1rem; }
.error-text { color: #dc2626; font-size: 0.85rem; margin-top: 0.5rem; font-weight: bold; }
.help-text { font-size: 0.85rem; color: #666; margin-bottom: 0.8rem; line-height: 1.4; }

/* 🌟 Demo Box 樣式 */
.demo-box { background: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 1rem; border-radius: 0 8px 8px 0; margin-bottom: 1rem; }
.demo-title { font-size: 0.85rem; font-weight: 600; color: #0369a1; margin-bottom: 0.5rem; }
.demo-code { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #0c4a6e; margin: 0; white-space: pre-wrap; line-height: 1.4; }
</style>