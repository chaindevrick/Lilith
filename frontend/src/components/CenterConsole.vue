<template>
  <section class="center-console" @dragover.prevent @drop.prevent="handleDrop">
    <div class="console-header">
      <span class="sys-title">PROJECT: LILITH <span class="blink">_</span></span>
      <span class="sys-time">{{ currentTime }}</span>
    </div>

    <div class="chat-viewport" ref="chatContainerRef">
      
      <div v-for="(msg, index) in filteredHistory" :key="index" class="msg-row" :class="msg.role">
        
        <div class="avatar-col">
          <div class="avatar-frame" :class="getRoleClass(msg)">
            <img :src="getAvatar(msg)" class="avatar-img" alt="avatar" />
          </div>
        </div>

        <div class="bubble-col">
          <div class="speaker-label">{{ getLabel(msg) }}</div>
          
          <div v-if="msg.attachments && msg.attachments.length > 0" class="msg-attachments">
            <div v-for="(att, i) in msg.attachments" :key="i" class="att-item">
              <img v-if="att.mimeType.startsWith('image/')" :src="att.url || `data:${att.mimeType};base64,${att.data}`" class="att-img" />
              <div v-else class="att-file">📄 {{ att.name }}</div>
            </div>
          </div>

          <div v-if="msg.content" class="msg-bubble">{{ msg.content }}</div>
        </div>
      </div>
      
      <div class="msg-row assistant" v-if="displayedText">
        <div class="avatar-col">
          <div class="avatar-frame" :class="currentSpeaker">
            <img :src="currentSpeaker === 'angel' ? AVATARS.angel : AVATARS.demon" class="avatar-img" />
          </div>
        </div>
        <div class="bubble-col">
          <div class="speaker-label">{{ displaySpeakerName }}</div>
          <div class="msg-bubble typing">{{ displayedText }}<span class="cursor">_</span></div>
        </div>
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
        
        <n-button secondary color="#666" class="attach-btn" @click="triggerFileUpload" :disabled="isTyping || isThinking">
          📎
        </n-button>

        <n-input 
          :value="userInput" 
          @update:value="$emit('update:userInput', $event)" 
          type="text" 
          placeholder="Command input... (Drag files here)" 
          @keydown.enter="handleSend" 
          :disabled="isTyping || isThinking" 
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
const pendingAttachments = ref([]); // [New] 待發送附件

watch(chatContainerRef, (el) => emit('setChatRef', el));

const displaySpeakerName = computed(() => props.currentSpeaker === 'angel' ? 'Angel' : 'Lilith');

// --- File Handling ---

const triggerFileUpload = () => fileInputRef.value.click();

const handleFileSelect = async (event) => {
  const files = event.target.files;
  if (!files.length) return;
  await processFiles(files);
  event.target.value = ''; // Reset
};

const handleDrop = async (event) => {
  const files = event.dataTransfer.files;
  if (!files.length) return;
  await processFiles(files);
};

const processFiles = async (files) => {
  for (const file of files) {
    // 限制大小 (例如 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert(`File ${file.name} is too large (>10MB)`);
      continue;
    }
    
    const base64 = await convertBase64(file);
    // 移除 data:image/png;base64, 前綴
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

// --- Sending ---

const handleSend = () => {
  // 將附件傳遞給父組件
  emit('sendMessage', pendingAttachments.value);
  pendingAttachments.value = []; // 清空待發送區
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
  return msg.speakerName || (msg.speaker === 'angel' ? 'Angel' : 'Lilith');
};
</script>

<style scoped>
.center-console { display: flex; flex-direction: column; background: rgba(18, 18, 18, 0.95); border-left: 1px solid rgba(255,255,255,0.05); border-right: 1px solid rgba(255,255,255,0.05); position: relative; }
.console-header { height: 50px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; border-bottom: 1px solid rgba(255,255,255,0.1); font-family: 'JetBrains Mono'; font-size: 0.8em; color: #666; flex-shrink: 0; }
.blink { animation: blink 1s infinite; }

.chat-viewport { flex-grow: 1; overflow-y: auto; padding: 20px 30px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: #333 transparent; }

/* 訊息行佈局 */
.msg-row { display: flex; gap: 15px; margin-bottom: 10px; }
.msg-row.user { flex-direction: row-reverse; } 

.avatar-frame { 
  width: 40px; height: 40px; border-radius: 8px; overflow: hidden; 
  border: 2px solid #444; background: #2a2a2a;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all 0.3s ease;
}
.avatar-frame.demon { border-color: #ff4d4d; box-shadow: 0 0 8px rgba(255, 77, 77, 0.3); }
.avatar-frame.angel { border-color: #4da6ff; box-shadow: 0 0 8px rgba(77, 166, 255, 0.3); }
.avatar-frame.user  { border-color: #ea4c89; box-shadow: 0 0 8px rgba(234, 76, 137, 0.3); }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.bubble-col { display: flex; flex-direction: column; max-width: 70%; }
.msg-row.user .bubble-col { align-items: flex-end; } 

.msg-bubble { background: rgba(255,255,255,0.05); padding: 10px 16px; border-radius: 4px; font-size: 0.95em; line-height: 1.6; border-left: 2px solid transparent; word-wrap: break-word; }
.msg-row.assistant .msg-bubble { border-left-color: #555; } 
.msg-row.user .msg-bubble { background: #ea4c89; color: white; border-left: none; border-right: 2px solid #ff9dc2; }

/* 附件樣式 */
.msg-attachments { margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
.att-img { max-width: 200px; max-height: 200px; border-radius: 4px; border: 1px solid #444; }
.att-file { background: #333; padding: 5px 10px; border-radius: 4px; font-size: 0.8em; color: #ccc; border: 1px solid #555; }

.speaker-label { font-size: 0.7em; color: #666; margin-bottom: 4px; font-family: 'JetBrains Mono'; }

.console-footer { padding: 15px 25px 25px 25px; background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; }
.status-metrics { display: flex; gap: 30px; margin-bottom: 15px; padding: 0 5px; }
.metric-block { flex: 1; }
.m-label { font-size: 0.65em; color: #888; font-family: 'JetBrains Mono'; display: block; margin-bottom: 5px; letter-spacing: 1px; }

/* Attachment Preview Area */
.attachment-previews { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; padding: 5px; background: rgba(0,0,0,0.2); border-radius: 4px; }
.preview-tag { background: #333; color: #ddd; font-size: 0.8em; padding: 2px 8px; border-radius: 4px; display: flex; align-items: center; gap: 6px; border: 1px solid #444; }
.remove-btn { cursor: pointer; color: #ff5f56; font-weight: bold; }
.remove-btn:hover { color: white; }

.input-wrapper { display: flex; gap: 0; }
.terminal-input { background: rgba(0,0,0,0.5); border: 1px solid #333; font-family: 'JetBrains Mono'; border-right: none; border-radius: 0; }
.attach-btn { border-radius: 4px 0 0 4px; border-right: none; width: 40px; padding: 0; display: flex; justify-content: center; }
.send-btn { border-radius: 0 4px 4px 0; height: auto; }
.cursor { animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0; } }
</style>