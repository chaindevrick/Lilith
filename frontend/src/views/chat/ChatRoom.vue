<template>
  <div class="chat-layout">
    <LeftStage @open-aes="showAesPanel = true" />

    <main class="center-column">
      
      <header class="console-header">
        <div class="header-col left">
          <span class="sys-title">PROJECT: LILITH <span class="blink">_</span></span>
        </div>
        <div class="header-col center">
          <span v-if="currentConversationId" class="id-tag">ID: {{ currentConversationId }}</span>
        </div>
        <div class="header-col right">
          <div class="header-actions">
            <button 
              class="header-neural-btn" 
              @click="showNeuralEditor = true"
              title="開啟神經編輯器 (Full Screen)"
            >
              <span class="icon">🧬</span> Code
            </button>
            <span class="sys-time">{{ currentTime }}</span>
          </div>
        </div>
      </header>

      <div class="chat-content-wrapper">
        <CenterConsole
          :messages="messageHistory"
          :isThinking="isThinking"
        />

        <div v-if="pendingFiles.length > 0" class="pending-attachments-area">
          <div v-for="(file, index) in pendingFiles" :key="index" class="pending-file-tag">
            <span class="file-icon">📎</span>
            <span class="file-name">{{ file.name }}</span>
            <button class="remove-file-btn" @click="removePendingFile(index)" title="移除">×</button>
          </div>
        </div>

        <div class="input-wrapper">
          <input 
            type="file" 
            ref="fileInputRef" 
            multiple 
            style="display: none" 
            @change="handleFileChange" 
          />
          
          <button 
            class="upload-btn" 
            @click="triggerUpload" 
            :disabled="isThinking" 
            title="上傳檔案/圖片"
          >
            📎
          </button>

          <textarea 
            v-model="inputText" 
            @keydown.enter.prevent="handleInputSend"
            placeholder="輸入訊息或上傳檔案..."
            class="terminal-input"
          ></textarea>
          
          <button class="send-btn" @click="handleInputSend" :disabled="isThinking">
            SEND
          </button>
        </div>

        <footer class="console-footer">
          <div class="ai-disclaimer">
            Lilith is AI and can make mistakes.
          </div>
        </footer>
      </div>

    </main>

    <SomaticPanel :show="showAesPanel" @close="showAesPanel = false" />
    <NeuralEditor :show="showNeuralEditor" @close="showNeuralEditor = false" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

import LeftStage from './components/LeftStage.vue';
import CenterConsole from './components/CenterConsole.vue';
import NeuralEditor from './components/NeuralEditor.vue'; 
import SomaticPanel from './components/SomaticPanel.vue';
import { useChat } from './composables/useChat';

const showAesPanel = ref(false);
const showNeuralEditor = ref(false); 

const currentTime = ref('');
let timer;
const updateTime = () => {
  currentTime.value = new Date().toLocaleTimeString('en-US', { 
    hour12: false, hour: '2-digit', minute: '2-digit' 
  });
};

const savedConId = localStorage.getItem('lilith_conversation_id') || 'web_user';
// 🌟 假設 useChat 的 sendMessage 接收 (text, attachments)
const { messageHistory, isThinking, currentConversationId, sendMessage, loadHistory } = useChat(savedConId);

const inputText = ref('');

// 🌟 新增：上傳相關狀態
const fileInputRef = ref(null);
const pendingFiles = ref([]);

// 🌟 觸發檔案選擇
const triggerUpload = () => {
  fileInputRef.value.click();
};

// 🌟 處理檔案選擇變更
const handleFileChange = (event) => {
  const files = Array.from(event.target.files);
  if (files.length > 0) {
    pendingFiles.value = [...pendingFiles.value, ...files];
    // 重設 input value，允許連續選擇同一個檔案
    event.target.value = '';
  }
};

// 🌟 移除待上傳檔案
const removePendingFile = (index) => {
  pendingFiles.value.splice(index, 1);
};

// 修改：發送訊息處理
const handleInputSend = async () => {
  if (!inputText.value.trim() && pendingFiles.value.length === 0) return;
  
  const text = inputText.value;
  const files = pendingFiles.value; // 🌟 獲取待上傳檔案

  inputText.value = ''; 
  pendingFiles.value = []; // 🌟 清空待上傳列表

  // 🌟 發送文字與檔案
  await sendMessage(text, files); 
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
  position: relative;
}

/* 左側立繪寬度固定 */
.chat-layout > *:nth-child(1) { flex: 0 0 350px; } 

/* 右側主畫面容器佔滿剩餘空間 */
.center-column {
  flex: 1; 
  min-width: 500px;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

/* 置中且左右留白的內容包裝器 */
.chat-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1000px; 
  margin: 0 auto;    
  overflow: hidden; 
}

/* Header 樣式 */
.console-header { height: 40px; display: flex; align-items: center; padding: 0 20px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); font-size: 0.75em; color: var(--text-secondary); flex-shrink: 0;}
.header-col { flex: 1; display: flex; align-items: center; }
.header-col.center { justify-content: center; }
.header-col.right { justify-content: flex-end; }
.sys-title { color: var(--accent-primary); font-weight: bold; }
.id-tag { background: rgba(255, 255, 255, 0.05); padding: 2px 8px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; opacity: 0.6; }
.header-actions { display: flex; align-items: center; gap: 15px; }

.header-neural-btn {
  background: var(--btn-bg); border: 1px solid var(--border-color); color: var(--accent-primary);
  border-radius: 4px; padding: 2px 10px; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; font-weight: bold; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 5px;
}
.header-neural-btn:hover { background: var(--accent-glow); box-shadow: 0 0 10px var(--accent-glow); transform: translateY(-1px); }
.sys-time { font-family: 'JetBrains Mono', monospace; min-width: 45px; }
.blink { animation: blink 1s step-end infinite; }
@keyframes blink { 50% { opacity: 0; } }

/* 🌟 新增：待上傳附件區域樣式 */
/* 🌟 新增：待上傳附件區域樣式 (跟隨輸入框置中) */
.pending-attachments-area {
  padding: 10px 0; /* 配合 input 置中，移除多餘的左右 padding */
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  background: var(--bg-primary);
  flex-shrink: 0;
  
  /* 🌟 跟隨 input-wrapper 的寬度與置中邏輯 */
  width: calc(100% - 40px);
  max-width: 850px;
  align-self: center;
}

.pending-file-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--text-primary);
}

.pending-file-tag .file-icon { opacity: 0.7; }
.pending-file-tag .file-name { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'JetBrains Mono', monospace; }

.remove-file-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0;
  line-height: 1;
}

.remove-file-btn:hover { color: var(--accent-primary); }

/* 🌟 重構：Input 區塊樣式 (Gemini Web 風格) */
.input-wrapper { 
  display: flex; 
  gap: 10px; 
  background: var(--bg-secondary);
  border: 1px solid var(--border-color); 
  padding: 10px 15px; /* 微調內距 */
  border-radius: 16px; /* 🌟 稍微修圓一點，更有 Gemini 的現代感 */
  transition: border-color 0.3s ease, box-shadow 0.3s ease; 
  
  /* 🌟 核心修正：移除 margin，使用 align-self 置中，並限制最大寬度 */
  width: calc(100% - 40px); 
  max-width: 850px; 
  align-self: center; 
  
  box-sizing: border-box; 
  flex-shrink: 0;
  align-items: flex-end; /* 讓按鈕與 textarea 底部對齊 */
}

.input-wrapper:focus-within { border-color: var(--accent-primary); box-shadow: 0 0 5px var(--accent-glow); }

/* 🌟 新增：上傳按鈕樣式 */
.upload-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.3rem;
  cursor: pointer;
  padding: 0 5px 8px 5px; /* 微調位置 */
  transition: 0.2s;
  line-height: 1;
}
.upload-btn:hover:not(:disabled) { color: var(--accent-primary); transform: scale(1.1); }
.upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.terminal-input { flex: 1; background: transparent; border: none; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; outline: none; resize: none; height: 40px; }
.send-btn { background: var(--accent-primary); color: white; border: none; padding: 0 20px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; height: 40px;}
.send-btn:hover:not(:disabled) { opacity: 0.8; box-shadow: 0 0 10px var(--accent-glow); }
.send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Footer 樣式 */
.console-footer { 
  padding: 10px 0 15px 0; 
  background: var(--bg-primary); 
  display: flex; 
  justify-content: center; 
  flex-shrink: 0;
}

.ai-disclaimer { 
  font-size: 0.65rem; 
  color: var(--text-secondary); 
  opacity: 0.5; 
  letter-spacing: 0.3px; 
  user-select: none; 
}
</style>