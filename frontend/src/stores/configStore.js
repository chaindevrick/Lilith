import { defineStore } from 'pinia';

// 🌟 唯一真理來源：嚴格對齊後端 config.json 結構
const defaultSettings = {
  llmModel: 'gemini-3.1-pro-preview',
  fastModel: 'gemini-3.1-flash-lite-preview',
  vectorModel: 'gemini-embedding-2-preview',
  
  LLM_API_KEY: '',
  FAST_LLM_API_KEY: '',
  LTM_LLM_API_KEY: '',
  LLM_API_BASE_URL: '',
  FAST_LLM_API_BASE_URL: '',
  LTM_LLM_API_BASE_URL: '',
  
  interactionRules: '1. 保持沉浸感。\n2. 善用 Markdown。',
  conversationStyle: '俐落、自然。',
  characterCard: '# Lilith\n妳是 Lilith。',
  userMemory: '',
  
  generalSettings: {
    multiAgents: false,
    selfImprove: false,
    scheduledTasks: false,
    showTokenUsage: true
  },
  
  bots: [
    { id: 'discord', name: 'Discord', platform: 'discord', enabled: false, apiKey: '' },
    { id: 'telegram', name: 'Telegram', platform: 'telegram', enabled: false, apiKey: '' },
    { id: 'whatsapp', name: 'WhatsApp', platform: 'whatsapp', enabled: false, apiKey: '' },
    { id: 'line', name: 'Line', platform: 'line', enabled: false, apiKey: '' }
  ],
  skills: { allowBundled: [], entries: {} }
};

export const useConfigStore = defineStore('config', {
  state: () => ({
    // 深拷貝預設值，避免污染
    settings: JSON.parse(JSON.stringify(defaultSettings)),
    isLoaded: false
  }),

  actions: {
    async fetchSettings(force = false) {
      if (this.isLoaded && !force) return this.settings;

      try {
        const res = await fetch('/api/system/settings');
        if (res.ok) {
          const data = await res.json();
          this.updateLocalSettings(data);
          this.isLoaded = true;
          return this.settings;
        }
      } catch (error) {
        console.error("❌ 無法從後端獲取設定:", error);
      }
    },

    updateLocalSettings(newSettings) {
      if (!newSettings) return;

      const keys = Object.keys(defaultSettings);
      keys.forEach(key => {
        if (newSettings[key] !== undefined) {
          if (key === 'generalSettings') {
            this.settings.generalSettings = { ...this.settings.generalSettings, ...newSettings.generalSettings };
          } else if (key === 'bots' && Array.isArray(newSettings.bots)) {
            this.settings.bots = this.settings.bots.map(defaultBot => {
              const incomingBot = newSettings.bots.find(b => b.platform === defaultBot.platform);
              return incomingBot ? { ...defaultBot, ...incomingBot } : defaultBot;
            });
          } else if (key === 'relationshipRules') {
            this.settings[key] = typeof newSettings[key] === 'object' && newSettings[key] !== null
                ? JSON.stringify(newSettings[key], null, 2)
                : newSettings[key];
          } else {
            this.settings[key] = newSettings[key];
          }
        }
      });
    }
  }
});