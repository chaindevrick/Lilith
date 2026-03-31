<template>
  <div class="settings-panel">
    <div class="section-title">主要推論引擎 (Primary LLM)</div>
    <div class="form-group">
      <label>Model (大腦皮層)</label>
      <select v-model="store.settings.llmModel" class="input-field">
        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (推薦)</option>
        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
        <option value="claude-3-opus-20240229">Claude 3 Opus</option>
        <option value="gpt-4o">GPT-4o</option>
        <option value="lm-studio">Local LLM (LM Studio / Ollama)</option>
      </select>
    </div>
    <div class="form-group">
      <label>API Key</label>
      <input type="password" v-model="store.settings.LLM_API_KEY" class="input-field" autocomplete="new-password" spellcheck="false" />
    </div>
    <div class="form-group">
      <label>API Base URL (自訂代理或本地端點)</label>
      <input type="text" v-model="store.settings.LLM_API_BASE_URL" class="input-field" placeholder="https://generativelanguage.googleapis.com/v1beta/openai/" />
    </div>

    <div class="section-title mt-4">高速反射引擎 (Fast Track & Embeddings)</div>
    <div class="form-group">
      <label>Subconscious Model (數位杏仁核)</label>
      <select v-model="store.settings.fastModel" class="input-field">
        <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite (推薦)</option>
        <option value="gpt-4o-mini">GPT-4o-Mini</option>
        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
        <option value="lm-studio">Local LLM</option>
      </select>
    </div>
    <div class="form-group">
      <label>API Key</label>
      <input type="password" v-model="store.settings.FAST_LLM_API_KEY" class="input-field" placeholder="若與 Primary 相同可留空" autocomplete="new-password" spellcheck="false" />
    </div>
    <div class="form-group">
      <label>API Base URL (自訂代理或本地端點)</label>
      <input type="text" v-model="store.settings.FAST_LLM_API_BASE_URL" class="input-field" placeholder="https://generativelanguage.googleapis.com/v1beta/openai/" />
    </div>

    <div class="section-title">長期記憶引擎 (Long-Term Memory)</div>
    <div class="form-group">
      <label>Vector Embedding Model (海馬迴記憶庫)</label>
      <select v-model="store.settings.vectorModel" class="input-field">
        <option value="gemini-embedding-2-preview">gemini-embedding-2-preview</option>
        <option value="text-embedding-3-small">text-embedding-3-small</option>
      </select>
    </div>
    <div class="form-group">
      <label>API Key</label>
      <input type="password" v-model="store.settings.LTM_LLM_API_KEY" class="input-field" placeholder="若與 Primary 相同可留空" autocomplete="new-password" spellcheck="false" />
    </div>
    <div class="form-group">
      <label>Vector DB Base URL</label>
      <input type="text" v-model="store.settings.LTM_LLM_API_BASE_URL" class="input-field" placeholder="若與 Primary 相同可留空" />
    </div>
  </div>
</template>

<script setup>
import { useConfigStore } from '@/stores/configStore';
const store = useConfigStore();
</script>

<style scoped>
.settings-panel { max-width: 650px; animation: fadeIn 0.3s ease; }
.section-title { font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px dashed var(--border-color); }
.form-group { margin-bottom: 1.5rem; }
.form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; }
.input-field { width: 100%; padding: 0.8rem 1rem; background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem; color: var(--text-primary); transition: all 0.2s; box-sizing: border-box; }
.input-field:focus { outline: none; border-color: var(--accent-primary); box-shadow: 0 0 5px var(--accent-glow); }
.mt-4 { margin-top: 1.5rem; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
</style>