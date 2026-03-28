<template>
  <div class="chat-layout">
    <LeftStage @open-aes="showAesPanel = true" />

    <CenterConsole
      :messages="messageHistory"
      :isThinking="isThinking"
      :currentConversationId="currentConversationId"
      :currentTime="currentTime"
      @send="handleSend"
    />

    <RightIDE 
      :files="fileList"
      :currentDir="currentDir"
      :activeFile="activeFile"
      :isApplying="isApplying"
      @go-up="goParentDir"
      @select-file="handleSelectFile"
      @close-file="closeFile"
      @save-file="handleSaveFile"
      @apply-changes="applySystemChanges"
    />

    <SomaticPanel 
      :show="showAesPanel" 
      @close="showAesPanel = false" 
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

import LeftStage from './components/LeftStage.vue';
import CenterConsole from './components/CenterConsole.vue';
import RightIDE from './components/RightIDE.vue';
import SomaticPanel from './components/SomaticPanel.vue';

import { useChat } from './composables/useChat';
import { useIDE } from './composables/useIDE';

const showAesPanel = ref(false);

// 🌟 取代 useGameSystem 的輕量時鐘
const currentTime = ref('');
let timer;
const updateTime = () => {
  currentTime.value = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
};

const savedConId = localStorage.getItem('lilith_conversation_id') || 'web_user';
const { messageHistory, isThinking, currentConversationId, sendMessage, loadHistory } = useChat(savedConId);

const { 
  fileList, currentDir, activeFile, isApplying,
  fetchFileList, goParentDir, openFile, closeFile, saveFile, applySystemChanges 
} = useIDE();

const handleSend = async (text) => {
  await sendMessage(text, []); 
};

const handleSelectFile = (item) => {
  if (item.type === 'folder') {
    currentDir.value = item.path;
    fetchFileList(); 
  } else {
    openFile(item.path); 
  }
};

const handleSaveFile = async (fileObj) => {
  await saveFile(fileObj.path, fileObj.content);
};

onMounted(() => {
  updateTime();
  timer = setInterval(updateTime, 1000);
  loadHistory();
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  font-family: 'Inter', sans-serif;
  transition: all 0.3s ease;
}

.chat-layout > *:nth-child(1) { flex: 0 0 350px; }
.chat-layout > *:nth-child(2) { flex: 1; min-width: 400px; }
.chat-layout > *:nth-child(3) { flex: 0 0 350px; }
</style>