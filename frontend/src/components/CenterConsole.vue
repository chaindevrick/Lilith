<template>
  <section class="center-console" @dragover.prevent @drop.prevent="handleDrop">
    <div class="console-header">
      <div class="header-col left">
        <span class="sys-title">PROJECT: LILITH <span class="blink">_</span></span>
      </div>
      
      <div class="header-col center">
        <span v-if="currentConversationId" class="id-tag" title="Current Connection ID">
          ID: {{ currentConversationId }}
        </span>
      </div>

      <div class="header-col right">
        <span class="sys-time">{{ currentTime }}</span>
      </div>
    </div>

    <div class="chat-viewport" ref="chatContainerRef">
      
      <div 
        v-for="(msg, index) in filteredHistory" 
        :key="index" 
        class="msg-row" 
        :class="[getRoleClass(msg), msg.contentType]"
      >
        
        <div class="avatar-col" v-if="msg.contentType === 'text' || !msg.contentType">
          <div class="avatar-frame" :class="getRoleClass(msg)">
            <img :src="getAvatar(msg)" class="avatar-img" alt="avatar" />
          </div>
        </div>
        <div class="avatar-col placeholder" v-else-if="msg.role !== 'user' && msg.contentType === 'action'"></div>

        <div class="bubble-col">
          
          <div v-if="msg.attachments && msg.attachments.length > 0" class="msg-attachments">
            <div v-for="(att, i) in msg.attachments" :key="i" class="att-item">
              <img 
                v-if="att.mimeType && att.mimeType.startsWith('image/')" 
                :src="att.url || `data:${att.mimeType};base64,${att.data}`" 
                class="att-img" 
              />
              <div v-else class="att-file">📄 {{ att.name }}</div>
            </div>
          </div>

          <div class="msg-content-wrapper">
             <div v-if="(msg.contentType === 'text' || !msg.contentType) && msg.role !== 'user'" class="speaker-label">
                {{ getLabel(msg) }}
             </div>

             <div v-if="msg.contentType === 'scene'" class="msg-scene" v-html="formatMessage(msg.content)"></div>
             <div v-else-if="msg.contentType === 'action'" class="msg-action" v-html="formatMessage(msg.content)"></div>
             <div v-else class="msg-bubble" v-html="formatMessage(msg.content)"></div>
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
           <div class="m-label-row">
             <span class="m-label">Mood</span>
             <span class="m-value">{{ normalizeStat(currentMood) }}%</span>
           </div>
           <n-progress type="line" :percentage="normalizeStat(currentMood)" :color="moodColor(currentMood)" :height="4" :show-indicator="false" processing />
        </div>
        
        <div class="metric-block">
           <div class="m-label-row">
             <span class="m-label">Affection</span>
             <span class="m-value">{{ currentAffection }}%</span>
           </div>
           <n-progress type="line" :percentage="currentAffection" color="#ea4c89" :height="4" :show-indicator="false" processing />
        </div>
        
        <div class="metric-block">
           <div class="m-label-row">
             <span class="m-label">Trust</span>
             <span class="m-value">{{ currentTrust }}%</span>
           </div>
           <n-progress type="line" :percentage="currentTrust" color="#ffaa00" :height="4" :show-indicator="false" processing />
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
import { watch, ref } from 'vue';
import { NProgress, NInput, NButton } from 'naive-ui';
import DOMPurify from 'dompurify'; // 建議安裝 dompurify 來防止 XSS
import { marked } from 'marked';   // 建議安裝 marked 來解析 Markdown

const props = defineProps([
  'currentTime', 
  'filteredHistory', 
  'isThinking', 
  'userInput', 
  'currentTrust', 
  'currentMood', 
  'currentAffection', 
  'normalizeStat', 
  'moodColor', 
  'currentConversationId'
]);

const emit = defineEmits(['update:userInput', 'sendMessage', 'setChatRef']);

const chatContainerRef = ref(null);
const fileInputRef = ref(null);
const pendingAttachments = ref([]);

watch(chatContainerRef, (el) => emit('setChatRef', el));

// --- Markdown 與圖片解析邏輯 ---
const formatMessage = (text) => {
  if (!text) return '';
  
  const urlRegex = /(?:!\[[^\]]*\]\()?\(?(https:\/\/(?:files\.catbox\.moe|tmpfiles\.org\/dl)\/[a-zA-Z0-9_.-]+)\)?/g;
  
  let processedText = text.replace(urlRegex, (match, cleanUrl) => {
    return `\n\n<lilith-img src="${cleanUrl}"></lilith-img>\n\n`;
  });

  // Markdown 解析
  let html = marked.parse(processedText);

  // 轉換圖片框
  html = html.replace(
    /<lilith-img src="([^"]+)"><\/lilith-img>/g, 
    `<div class="lilith-image-wrapper">
       <img 
         src="$1" 
         alt="Generated Memory" 
         class="generated-img"
         onload="this.parentElement.classList.add('loaded')"
         onerror="
           this.onerror=null; 
           this.style.display='none'; 
           this.nextElementSibling.style.display='flex';
         "
       />
       <div class="expired-placeholder" style="display: none;">
         <span class="icon">💔</span>
         <span class="text">這份視覺記憶已隨時間消散 (圖片已過期)</span>
       </div>
     </div>`
  );
  
  return DOMPurify.sanitize(html, { ADD_TAGS: ['lilith-img'], ADD_ATTR: ['onerror', 'onload'] });
};

// --- File Handling Logic ---
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
    try {
      const base64 = await convertBase64(file);
      const data = base64.split(',')[1];
      pendingAttachments.value.push({
        name: file.name,
        mimeType: file.type,
        data: data
      });
    } catch (e) {
      console.error("File processing failed", e);
    }
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
  if (!props.userInput.trim() && pendingAttachments.value.length === 0) return;
  emit('sendMessage', pendingAttachments.value);
  pendingAttachments.value = [];
};

// --- Avatar & Display Logic ---
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
/* Main Layout */
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

/* Header */
.console-header { 
  height: 50px; 
  display: flex; 
  align-items: center; 
  padding: 0 20px; 
  border-bottom: 1px solid rgba(255,255,255,0.1); 
  font-family: 'JetBrains Mono', monospace; 
  font-size: 0.8em; 
  color: #666; 
  flex-shrink: 0; 
}

.header-col {
  flex: 1;
  display: flex;
  align-items: center;
}
.header-col.left { justify-content: flex-start; }
.header-col.center { justify-content: center; }
.header-col.right { justify-content: flex-end; }

.sys-title { font-weight: bold; color: #888; }
.id-tag {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  color: #888;
  font-size: 0.9em;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.blink { animation: blink 1s infinite; }

/* Chat Viewport */
.chat-viewport { 
  flex: 1; 
  min-height: 0; 
  overflow-y: auto; 
  padding: 20px 30px; 
  display: flex; 
  flex-direction: column; 
  gap: 8px; 
  scroll-behavior: smooth; 
}

/* Message Rows */
.msg-row { display: flex; gap: 15px; margin-bottom: 2px; flex-shrink: 0; }
.msg-row.user { flex-direction: row-reverse; } 

.avatar-col { width: 40px; flex-shrink: 0; display: flex; align-items: flex-end; }
.placeholder { width: 40px; flex-shrink: 0; } 

.avatar-frame { 
  width: 40px; height: 40px; 
  border-radius: 8px; 
  overflow: hidden; 
  border: 2px solid #444; 
  background: #2a2a2a; 
  display: flex; align-items: center; justify-content: center; 
  transition: all 0.3s ease; 
}

.avatar-frame.demon { border-color: #ff4d4d; box-shadow: 0 0 8px rgba(255, 77, 77, 0.3); }
.avatar-frame.angel { border-color: #4da6ff; box-shadow: 0 0 8px rgba(77, 166, 255, 0.3); }
.avatar-frame.user  { border-color: #ea4c89; box-shadow: 0 0 8px rgba(234, 76, 137, 0.3); }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.bubble-col { display: flex; flex-direction: column; max-width: 75%; }
.msg-row.user .bubble-col { align-items: flex-end; } 

.speaker-label { font-size: 0.7em; color: #666; margin-bottom: 2px; font-family: 'JetBrains Mono', monospace; }

/* Attachments */
.msg-attachments { margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
.att-img { max-width: 200px; max-height: 200px; border-radius: 4px; border: 1px solid #444; }
.att-file { background: #333; padding: 5px 10px; border-radius: 4px; font-size: 0.8em; color: #ccc; border: 1px solid #555; }

/* Bubbles */
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

/* Scene & Action */
.msg-row.scene { justify-content: center; margin: 10px 0; }
.msg-row.scene .bubble-col { max-width: 90%; align-items: center; }
.msg-scene {
  color: #888;
  font-size: 0.85em;
  font-family: 'JetBrains Mono', monospace;
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

/* Footer */
.console-footer { 
  padding: 15px 25px 25px 25px; 
  background: rgba(0,0,0,0.3); 
  border-top: 1px solid rgba(255,255,255,0.05); 
  flex-shrink: 0; 
}

.status-metrics { display: flex; gap: 30px; margin-bottom: 15px; padding: 0 5px; }
.metric-block { flex: 1; }

.m-label-row { 
  display: flex; 
  justify-content: space-between; 
  align-items: flex-end; 
  margin-bottom: 5px; 
}

.m-label { 
  font-size: 0.65em; 
  color: #888; 
  font-family: 'JetBrains Mono', monospace; 
  letter-spacing: 1px; 
}

.m-value { 
  font-size: 0.75em; 
  color: #ddd; 
  font-family: 'JetBrains Mono', monospace; 
  font-weight: bold;
}

/* Pending Attachments */
.attachment-previews { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; padding: 5px; background: rgba(0,0,0,0.2); border-radius: 4px; }
.preview-tag { background: #333; color: #ddd; font-size: 0.8em; padding: 2px 8px; border-radius: 4px; display: flex; align-items: center; gap: 6px; border: 1px solid #444; }
.remove-btn { cursor: pointer; color: #ff5f56; font-weight: bold; }

/* Input Bar */
.input-wrapper { display: flex; gap: 0; }
.terminal-input { background: rgba(0,0,0,0.5); border: 1px solid #333; font-family: 'JetBrains Mono', monospace; border-right: none; border-radius: 0; }
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
  .header-col.center { display: none; }
  
  .chat-viewport { padding: 10px; gap: 8px; }
  .avatar-frame { width: 32px; height: 32px; }
  .avatar-col, .placeholder { width: 32px; }
  
  .bubble-col { max-width: 85%; }
  .status-metrics { display: none; }
  
  .console-footer { padding: 10px; }
  .terminal-input { font-size: 16px; }
}

/* 🌟 加入圖片渲染器專用的 CSS */
:deep(.lilith-image-wrapper) {
  margin: 15px 0;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: 400px;
  position: relative;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

:deep(.generated-img) {
  width: 100%;
  height: auto;
  display: block;
  transition: opacity 0.5s ease;
  opacity: 0; 
}

:deep(.lilith-image-wrapper.loaded .generated-img) {
  opacity: 1; 
}

:deep(.expired-placeholder) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: repeating-linear-gradient(45deg, rgba(255,255,255,0.02), rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px);
  color: #888;
  font-family: 'JetBrains Mono', monospace;
  text-align: center;
}

:deep(.expired-placeholder .icon) { font-size: 2em; margin-bottom: 10px; filter: grayscale(100%); }
:deep(.expired-placeholder .text) { font-size: 0.9em; letter-spacing: 1px; }

/* 防止 Markdown 的 P 標籤破壞 Scene 和 Action 的行內排版 */
:deep(.msg-scene p), 
:deep(.msg-action p) { 
  margin: 0; 
  display: inline; 
}
</style>