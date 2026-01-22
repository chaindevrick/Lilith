<template>
  <section class="center-console" @dragover.prevent @drop.prevent="handleDrop">
    <div class="console-header">
      <span class="sys-title">PROJECT: LILITH <span class="blink">_</span></span>
      <span class="sys-time">{{ currentTime }}</span>
    </div>

    <div class="chat-viewport" ref="chatContainerRef">
      
      <div v-for="(msg, index) in filteredHistory" :key="index" class="msg-row" :class="[msg.role, msg.contentType]">
        
        <div class="avatar-col" v-if="msg.contentType === 'text' || !msg.contentType">
          <div class="avatar-frame" :class="getRoleClass(msg)">
            <img :src="getAvatar(msg)" class="avatar-img" alt="avatar" />
          </div>
        </div>
        <div class="avatar-col placeholder" v-else-if="msg.role !== 'user' && msg.contentType === 'action'"></div>

        <div class="bubble-col">
          
          <div v-if="msg.attachments && msg.attachments.length > 0" class="msg-attachments">
            <div v-for="(att, i) in msg.attachments" :key="i" class="att-item">
              <img v-if="att.mimeType.startsWith('image/')" :src="att.url || `data:${att.mimeType};base64,${att.data}`" class="att-img" />
              <div v-else class="att-file">📄 {{ att.name }}</div>
            </div>
          </div>

          <div class="msg-content-wrapper">
             <div v-if="(msg.contentType === 'text' || !msg.contentType) && msg.role !== 'user'" class="speaker-label">
                {{ getLabel(msg) }}
             </div>

             <div v-if="msg.contentType === 'scene'" class="msg-scene">
               {{ msg.content }}
             </div>

             <div v-else-if="msg.contentType === 'action'" class="msg-action">
               {{ msg.content }}
             </div>

             <div v-else class="msg-bubble">
               {{ msg.content }}
             </div>
          </div>
        </div>
      </div>
      
      <div class="thinking-indicator" v-if="isThinking">
        <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
      </div>

    </div>

    <div class="console-footer">
      <div class="status-metrics">
        <div class="metric-block">
           <span class="m-label">SYNC (Mood)</span>
           <n-progress type="line" :percentage="normalizeStat(currentMood)" :color="moodColor(currentMood)" :height="4" :show-indicator="false" processing />
        </div>
        <div class="metric-block">
           <span class="m-label">LINK (Affection)</span>
           <n-progress type="line" :percentage="currentAffection" color="#ea4c89" :height="4" :show-indicator="false" />
        </div>
        <div class="metric-block">
           <span class="m-label">PROTOCOL (Trust)</span>
           <n-progress type="line" :percentage="emotion.trust || 10" color="#ffaa00" :height="4" :show-indicator="false" />
        </div>
      </div>

      <div v-if="pendingAttachments.length > 0" class="attachment-previews">
        <div v-for="(file, index) in pendingAttachments" :key="index" class="preview-tag">
          <span class="file-name">{{ file.name }}</span>
          <span class="remove-btn" @click="removeAttachment(index)">×</span>
        </div>
      </div>

      <div class="input-wrapper">
        <input type="file" ref="fileInputRef" multiple style="display: none" @change="handleFileSelect" />
        
        <n-button secondary color="#666" class="attach-btn" @click="triggerFileUpload" :disabled="isThinking">
          📎
        </n-button>

        <n-input 
          :value="userInput" 
          @update:value="$emit('update:userInput', $event)" 
          type="text" 
          placeholder="Command..." 
          @keydown.enter="handleSend" 
          :disabled="isThinking" 
          class="terminal-input"
        />
        
        <n-button type="primary" color="#ea4c89" @click="handleSend" :loading="isThinking" class="send-btn">
          SEND
        </n-button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, watch, ref } from 'vue';
import { NProgress, NInput, NButton } from 'naive-ui';

const props = defineProps([
  'currentTime', 'filteredHistory', 'displayedText', 'isTyping', 'isThinking', 
  'currentSpeaker', 'userInput', 'emotion', 'currentMood', 'currentAffection', 
  'normalizeStat', 'moodColor'
]);
const emit = defineEmits(['update:userInput', 'sendMessage', 'setChatRef']);

const chatContainerRef = ref(null);
const fileInputRef = ref(null);
const pendingAttachments = ref([]);

watch(chatContainerRef, (el) => emit('setChatRef', el));
const displaySpeakerName = computed(() => 'Lilith'); // 統一顯示名

// --- File Handling ---
const triggerFileUpload = () => fileInputRef.value.click();

const handleFileSelect = async (event) => {
  const files = event.target.files;
  if (!files.length) return;
  await processFiles(files);
  event.target.value = '';
};

const handleDrop = async (event) => {
  const files = event.dataTransfer.files;
  if (!files.length) return;
  await processFiles(files);
};

const processFiles = async (files) => {
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      alert(`File ${file.name} is too large (>10MB)`);
      continue;
    }
    const base64 = await convertBase64(file);
    const data = base64.split(',')[1];
    pendingAttachments.value.push({
      name: file.name,
      mimeType: file.type,
      data: data
    });
  }
};

const convertBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

const removeAttachment = (index) => {
  pendingAttachments.value.splice(index, 1);
};

const handleSend = () => {
  emit('sendMessage', pendingAttachments.value);
  pendingAttachments.value = [];
};

// --- Avatars ---
const AVATARS = {
  demon: '/lilith.png', 
  angel: '/lilith.png',  
  user:  'https://api.dicebear.com/7.x/micah/svg?seed=User&backgroundColor=e0e0e0'
};

const getAvatar = (msg) => {
  if (msg.role === 'user') return AVATARS.user;
  return msg.speaker === 'angel' ? AVATARS.angel : AVATARS.demon;
};

const getRoleClass = (msg) => {
  if (msg.role === 'user') return 'user';
  return msg.speaker === 'angel' ? 'angel' : 'demon';
};

const getLabel = (msg) => {
  if (msg.role === 'user') return 'Commander'; 
  return 'Lilith';
};
</script>

<style scoped>
.center-console { 
  display: flex; 
  flex-direction: column; 
  background: rgba(18, 18, 18, 0.95); 
  border-left: 1px solid rgba(255,255,255,0.05); 
  border-right: 1px solid rgba(255,255,255,0.05); 
  position: relative; 
  height: 100%; 
  overflow: hidden; 
}

.console-header { 
  height: 50px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 0 20px; 
  border-bottom: 1px solid rgba(255,255,255,0.1); 
  font-family: 'JetBrains Mono'; 
  font-size: 0.8em; 
  color: #666; 
  flex-shrink: 0; 
}
.blink { animation: blink 1s infinite; }

/* [Fix Scrolling]
  1. flex-grow: 1 佔滿剩餘空間
  2. min-height: 0 關鍵修正：允許 Flex 子項目縮小以顯示捲軸
  3. overflow-y: auto 啟用垂直捲動
*/
.chat-viewport { 
  flex-grow: 1; 
  min-height: 0; 
  overflow-y: auto; 
  padding: 20px 30px; 
  display: flex; 
  flex-direction: column; 
  gap: 8px; 
}

/* 訊息行佈局 */
.msg-row { display: flex; gap: 15px; margin-bottom: 2px; }
.msg-row.user { flex-direction: row-reverse; } 

.avatar-col { width: 40px; flex-shrink: 0; display: flex; align-items: flex-end; }
.placeholder { width: 40px; } 

.avatar-frame { width: 40px; height: 40px; border-radius: 8px; overflow: hidden; border: 2px solid #444; background: #2a2a2a; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
.avatar-frame.demon { border-color: #ff4d4d; box-shadow: 0 0 8px rgba(255, 77, 77, 0.3); }
.avatar-frame.angel { border-color: #4da6ff; box-shadow: 0 0 8px rgba(77, 166, 255, 0.3); }
.avatar-frame.user  { border-color: #ea4c89; box-shadow: 0 0 8px rgba(234, 76, 137, 0.3); }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.bubble-col { display: flex; flex-direction: column; max-width: 75%; }
.msg-row.user .bubble-col { align-items: flex-end; } 

.speaker-label { font-size: 0.7em; color: #666; margin-bottom: 2px; font-family: 'JetBrains Mono'; }

/* --- Attachments --- */
.msg-attachments { margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
.att-img { max-width: 200px; max-height: 200px; border-radius: 4px; border: 1px solid #444; }
.att-file { background: #333; padding: 5px 10px; border-radius: 4px; font-size: 0.8em; color: #ccc; border: 1px solid #555; }

/* --- Galgame Styles --- */
.msg-bubble { 
  background: rgba(255,255,255,0.08); 
  padding: 8px 14px; 
  border-radius: 4px; 
  font-size: 0.95em; 
  line-height: 1.5; 
  border-left: 2px solid #555; 
  color: #ddd;
  word-wrap: break-word;
}
.msg-row.user .msg-bubble { 
  background: #ea4c89; 
  color: white; 
  border-left: none; 
  border-right: 2px solid #ff9dc2; 
}

.msg-row.scene { justify-content: center; margin: 10px 0; }
.msg-row.scene .bubble-col { max-width: 90%; align-items: center; }
.msg-scene {
  color: #888;
  font-size: 0.85em;
  font-family: 'JetBrains Mono';
  background: rgba(0,0,0,0.3);
  padding: 4px 10px;
  border-radius: 10px;
  border: 1px dashed #444;
}

.msg-action {
  color: #aaa;
  font-style: italic;
  font-size: 0.9em;
  padding: 2px 0;
  margin-left: 5px;
}
.msg-row.action { margin-bottom: 0; }

/* --- Footer --- */
.console-footer { 
  padding: 15px 25px 25px 25px; 
  background: rgba(0,0,0,0.3); 
  border-top: 1px solid rgba(255,255,255,0.05); 
  flex-shrink: 0; /* 禁止 Footer 被擠壓 */
}
.status-metrics { display: flex; gap: 30px; margin-bottom: 15px; padding: 0 5px; }
.metric-block { flex: 1; }
.m-label { font-size: 0.65em; color: #888; font-family: 'JetBrains Mono'; display: block; margin-bottom: 5px; letter-spacing: 1px; }

.attachment-previews { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; padding: 5px; background: rgba(0,0,0,0.2); border-radius: 4px; }
.preview-tag { background: #333; color: #ddd; font-size: 0.8em; padding: 2px 8px; border-radius: 4px; display: flex; align-items: center; gap: 6px; border: 1px solid #444; }
.remove-btn { cursor: pointer; color: #ff5f56; font-weight: bold; }

.input-wrapper { display: flex; gap: 0; }
.terminal-input { background: rgba(0,0,0,0.5); border: 1px solid #333; font-family: 'JetBrains Mono'; border-right: none; border-radius: 0; }
.attach-btn { border-radius: 4px 0 0 4px; border-right: none; width: 40px; padding: 0; display: flex; justify-content: center; }
.send-btn { border-radius: 0 4px 4px 0; height: auto; }

/* Thinking Animation */
.thinking-indicator { padding: 20px; color: #666; font-family: monospace; }
.dot { animation: blink 1.4s infinite both; }
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }

/* Mobile Optimizations */
@media (max-width: 768px) {
  .sys-title { display: none; }
  .console-header { justify-content: flex-end; height: 40px; padding: 0 10px; }
  .chat-viewport { padding: 10px; gap: 8px; }
  .avatar-frame { width: 32px; height: 32px; }
  .avatar-col { width: 32px; }
  .placeholder { width: 32px; }
  .bubble-col { max-width: 85%; }
  .status-metrics { display: none; }
  .console-footer { padding: 10px; }
  .terminal-input { font-size: 16px; }
}
</style>