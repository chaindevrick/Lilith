<template>
  <div class="step-panel">
    <transition name="fade" mode="out-in">
      
      <div v-if="!showAdvanced" key="basic-view">
        <h2 class="title">塑造靈魂 (Character Card)</h2>
        <p class="subtitle">定義系統 AI 的核心人格特質與背景設定 (Markdown)。</p>
        <div class="form-group">
          <label>Lilith 核心角色卡</label>
          <textarea v-model="formData.characterCard" class="input-field textarea-xl" placeholder="定義 Lilith 的人格..."></textarea>
        </div>
      </div>

      <div v-else key="advanced-view">
        <h2 class="title">進階系統設定 (Advanced)</h2>
        <div class="advanced-grid">
          <div class="form-group">
            <label>系統規則 (Interaction Rules)</label>
            <textarea v-model="formData.interactionRules" class="input-field textarea-medium"></textarea>
          </div>
          <div class="form-group">
            <label>對話語氣 (Conversation Style)</label>
            <textarea v-model="formData.conversationStyle" class="input-field textarea-medium"></textarea>
          </div>
          <div class="form-group full-width">
            <label>關係數值引擎 (Relationship Rules - JSON)</label>
            <textarea v-model="formData.relationshipRules" class="input-field textarea-large code-font" spellcheck="false"></textarea>
          </div>
        </div>
      </div>

    </transition>
  </div>
</template>

<script setup>
defineProps({
  formData: { type: Object, required: true },
  showAdvanced: { type: Boolean, required: true }
});
</script>

<style scoped>
.textarea-medium { height: 100px; resize: none; }
.textarea-large { height: 160px; resize: none; }
.textarea-xl { height: 300px; resize: none; }
.code-font { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; background: #f8f9fa; }
.advanced-grid { display: flex; flex-wrap: wrap; gap: 15px; }
.form-group { flex: 1; min-width: 45%; margin-bottom: 0; }
.full-width { flex: 100%; margin-top: 10px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>