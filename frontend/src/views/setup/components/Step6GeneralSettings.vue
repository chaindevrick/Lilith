<template>
  <div class="step-panel">
    <div class="title">Step 6: 通用核心設定</div>
    <div class="subtitle">配置 Lilith OS 的進階行為模式與遙測顯示。</div>

    <div class="form-group">
      <label>Multi-Agents (多智能體協作)</label>
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" v-model="formData.generalSettings.multiAgents" />
        <span style="font-size: 0.9rem; color: #666;">允許系統生成子 Agent 來處理複雜的分解任務。</span>
      </div>
    </div>

    <div class="form-group">
      <label>Self-Improve (自我進化)</label>
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" v-model="formData.generalSettings.selfImprove" />
        <span style="font-size: 0.9rem; color: #666;">開啟午夜反思機制，系統將自動從過去對話中萃取開發守則。</span>
      </div>
    </div>

    <div class="form-group">
      <label>Scheduled Tasks (背景排程)</label>
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" v-model="formData.generalSettings.scheduledTasks" />
        <span style="font-size: 0.9rem; color: #666;">允許系統在閒置時主動執行系統監控、日誌清理等任務。</span>
      </div>
    </div>

    <div class="form-group" style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee;">
      <label style="color: #ea4c89;">Telemetry: Token Usage (顯示運算消耗)</label>
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" v-model="formData.generalSettings.showTokenUsage" />
        <span style="font-size: 0.9rem; color: #666;">在主介面左上方即時顯示當前對話已消耗的 LLM 運算 Token 數量。</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  formData: { type: Object, required: true }
});
</script>