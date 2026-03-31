<template>
  <div class="step-panel">
    <h2 class="title">大腦設定</h2>
    <p class="subtitle">請設定系統的核心運算引擎與潛意識迴路。</p>
    
    <div class="form-group">
      <label>
        Primary Model (大腦皮層)
        <span class="hint-text">(負責複雜邏輯與主對話)</span>
      </label>
      <select v-model="formData.llmModel" class="input-field">
        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (推薦)</option>
        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
        <option value="claude-opus-4-6">Claude Opus 4.6</option>
        <option value="gpt-5.4">gpt-5.4</option>
        <option value="lm-studio">Local LLM (LM Studio)</option>
      </select>
    </div>

    <div class="form-group">
      <label>
        Subconscious Model (數位杏仁核)
        <span class="hint-text">(負責低延遲的情緒反射與內感受)</span>
      </label>
      <select v-model="formData.fastModel" class="input-field">
        <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite (推薦)</option>
        <option value="gpt-4o-mini">GPT-4o-Mini</option>
        <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
        <option value="lm-studio">Local LLM (LM Studio)</option>
      </select>
    </div>

    <div class="form-group">
      <label>
        Vector Embedding Model (海馬迴)
        <span class="hint-text">(負責記憶切塊與檢索)</span>
      </label>
      <select v-model="formData.vectorModel" class="input-field">
        <option value="gemini-embedding-2-preview">gemini-embedding-2-preview</option>
        <option value="text-embedding-3-small">text-embedding-3-small</option>
      </select>
    </div>

    <div class="form-group mt-6">
      <label>Primary LLM API Key</label>
      <input type="password" v-model="formData.LLM_API_KEY" class="input-field" placeholder="sk-..." />
    </div>

    <div class="form-group">
      <label>Subconscious API Key (若與 Primary 相同可留空)</label>
      <input type="password" v-model="formData.FAST_LLM_API_KEY" class="input-field" placeholder="sk-..." />
    </div>

    <div class="form-group">
      <label>Vector DB API Key (若與 Primary 相同可留空)</label>
      <input type="password" v-model="formData.LTM_LLM_API_KEY" class="input-field" placeholder="sk-..." />
    </div>
  </div>
</template>

<script setup>
defineProps({
  formData: { type: Object, required: true }
});
</script>

<style scoped>
.mt-6 { 
  margin-top: 2rem; 
}

.hint-text {
  color: #999;
  font-size: 0.85em;
  font-weight: 400; 
  margin-left: 6px;
}
</style>