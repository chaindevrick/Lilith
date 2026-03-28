<template>
  <div class="step-panel">
    <h2 class="title">啟用 SMS / Bot 介面</h2>
    <p class="subtitle">讓 Lilith 能在不同的通訊軟體中與您對話。</p>

    <div class="platform-list">
      <div v-for="bot in botsData" :key="bot.id" class="bot-row">
        <div class="bot-input-col">
          <input 
            type="password" 
            v-model="bot.apiKey" 
            :disabled="!bot.enabled"
            :class="['input-field', { 'disabled-input': !bot.enabled }]"
            :placeholder="bot.enabled ? `請輸入 ${bot.name} Token` : '啟用後輸入...'"
          />
        </div>
        <div class="bot-toggle-col">
          <label class="toggle-label">
            <input type="checkbox" v-model="bot.enabled" class="checkbox-pink" />
            <span class="bot-name">{{ bot.name }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  botsData: { type: Array, required: true }
});
</script>

<style scoped>
.bot-row { display: flex; align-items: center; margin-bottom: 1rem; gap: 1rem; }
.bot-input-col { flex: 1; }
.bot-toggle-col { width: 120px; display: flex; align-items: center; }
.toggle-label { display: flex; align-items: center; cursor: pointer; gap: 0.5rem; }
.checkbox-pink { accent-color: #ec4899; width: 1.2rem; height: 1.2rem; cursor: pointer; }
.bot-name { font-weight: 600; color: #333; }
.disabled-input { background-color: #f5f5f5; color: #aaa; cursor: not-allowed; border-color: #eee; }
</style>