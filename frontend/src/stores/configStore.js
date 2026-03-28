import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useConfigStore = defineStore('config', () => {
  const generalSettings = ref({
    multiAgents: false,
    selfImprove: false,
    scheduledTasks: false,
    showTokenUsage: true 
  });

  return { generalSettings };
});