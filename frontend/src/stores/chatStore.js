/**
 * src/stores/chatStore.js
 * 用於管理對話期間的全域狀態 (例如 Token 消耗)
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useChatStore = defineStore('chat', () => {
  // 記錄當前對話週期消耗的總 Token 數
  const totalTokens = ref(0);

  return { 
    totalTokens 
  };
});