<template>
  <div class="chat-layout">
    <LeftStage 
      :stats="stats" 
    />

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
  </div>
</template>

<script setup>
import { onMounted } from 'vue';

// 引入子元件
import LeftStage from './components/LeftStage.vue';
import CenterConsole from './components/CenterConsole.vue';
import RightIDE from './components/RightIDE.vue';

// 引入核心邏輯
import { useGameSystem } from './composables/useGameSystem';
import { useChat } from './composables/useChat';
import { useIDE } from './composables/useIDE';

// 1. 初始化狀態與系統時間
const { currentTime, stats, updateStats } = useGameSystem();
const savedConId = localStorage.getItem('lilith_conversation_id') || 'web_user';

// 2. 初始化對話系統 (將 updateStats 傳入，讓對話後自動更新好感度)
const { 
  messageHistory, 
  isThinking, 
  currentConversationId, 
  sendMessage, 
  loadHistory 
} = useChat(savedConId, updateStats);

// 3. 初始化 IDE 系統
const { 
  fileList, 
  currentDir, 
  activeFile, 
  isApplying,
  fetchFileList, 
  goParentDir, 
  openFile, 
  closeFile, 
  saveFile, 
  applySystemChanges 
} = useIDE();

// ============================================================
// 事件處理區 (Event Handlers)
// ============================================================

const handleSend = async (text) => {
  // 目前單 Agent 架構傳送純文字，若未來有需要附件功能可在此擴充
  await sendMessage(text, []); 
};

// 處理 IDE 中點擊檔案或資料夾的邏輯
const handleSelectFile = (item) => {
  if (item.type === 'folder') {
    currentDir.value = item.path;
    fetchFileList(); // 進入資料夾並重新拉取列表
  } else {
    openFile(item.path); // 開啟檔案進入編輯器
  }
};

const handleSaveFile = async (fileObj) => {
  await saveFile(fileObj.path, fileObj.content);
};

// ============================================================
// 生命週期 (Lifecycle)
// ============================================================

onMounted(() => {
  // 網頁載入時，自動去後端抓取歷史對話 (包含 Session Array 狀態)
  loadHistory();
});

</script>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: #000;
  color: #fff;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
}

/* 三欄式彈性佈局 */
.chat-layout > *:nth-child(1) { flex: 0 0 350px; }  /* 左側：人物面板固定寬度縮小一點點 */
.chat-layout > *:nth-child(2) { flex: 1; min-width: 400px; } /* 中間：對話框自適應延伸 */
.chat-layout > *:nth-child(3) { flex: 0 0 350px; }  /* 右側：IDE 區塊固定寬度 */
</style>