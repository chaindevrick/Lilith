<template>
  <section class="center-console">
    <div class="console-header">
      <div class="header-col left">
        <span class="sys-title">PROJECT: LILITH <span class="blink">_</span></span>
      </div>
      <div class="header-col center">
        <span v-if="currentConversationId" class="id-tag">ID: {{ currentConversationId }}</span>
      </div>
      <div class="header-col right">
        <span class="sys-time">{{ currentTime }}</span>
      </div>
    </div>

    <div class="chat-viewport" ref="chatContainerRef">
      <div 
        v-for="(msg, index) in messages" 
        :key="index" 
        class="msg-row" 
        :class="msg.role"
      >
        <div class="avatar-col" v-if="msg.role === 'assistant'">
          <div class="avatar-frame">
            <img src="/lilith.png" class="avatar-img" alt="lilith" />
          </div>
        </div>

        <div class="bubble-col">
          <div v-if="msg.attachments && msg.attachments.length > 0" class="msg-attachments">
            <div v-for="file in msg.attachments" :key="file.name" class="attachment-item">
              📎 {{ file.name }}
            </div>
          </div>
          
          <div v-for="(seg, sIdx) in msg.segments" :key="sIdx">
            <div v-if="seg.type === 'text'" class="message-bubble">
              <pre class="content-text">{{ seg.content }}</pre>
            </div>
            
            <div v-else-if="seg.type === 'image'" class="lilith-image-wrapper">
              <img :src="seg.url" class="generated-img" alt="AI Generated" />
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="isThinking" class="typing-indicator">Lilith 正在思考中...</div>
    </div>

    <footer class="console-footer">
      <div class="input-wrapper">
        <textarea 
          v-model="inputText" 
          @keydown.enter.prevent="handleSend"
          placeholder="輸入訊息與 Lilith 對話..."
          class="terminal-input"
        ></textarea>
        <button class="send-btn" @click="handleSend" :disabled="isThinking">SEND</button>
      </div>
    </footer>
  </section>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  messages: Array,
  isThinking: Boolean,
  currentConversationId: String,
  currentTime: String
});

const emit = defineEmits(['send']);
const inputText = ref('');

const handleSend = () => {
  if (!inputText.value.trim()) return;
  emit('send', inputText.value);
  inputText.value = '';
};
</script>

<style scoped>
.center-console { display: flex; flex-direction: column; height: 100%; background: #0a0a0a; border-right: 1px solid rgba(255,255,255,0.05); }
.console-header { height: 40px; display: flex; align-items: center; padding: 0 20px; background: #111; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.75em; color: #666; }
.header-col { flex: 1; }
.header-col.center { text-align: center; }
.header-col.right { text-align: right; }
.sys-title { color: #ea4c89; font-weight: bold; }
.chat-viewport { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }

.msg-row { display: flex; gap: 15px; max-width: 85%; }
.msg-row.user { align-self: flex-end; flex-direction: row-reverse; }
.msg-row.assistant { align-self: flex-start; }

.avatar-col { width: 36px; flex-shrink: 0; }
.avatar-frame { width: 36px; height: 36px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(234, 76, 137, 0.3); }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }

.bubble-col { display: flex; flex-direction: column; gap: 8px; max-width: 100%; }
.message-bubble { padding: 12px 16px; border-radius: 12px; background: #1a1a1a; color: #d4d4d4; font-size: 0.95em; line-height: 1.6; }
.user .message-bubble { background: #ea4c89; color: white; }
.content-text { white-space: pre-wrap; font-family: inherit; margin: 0; word-break: break-word; }

/* 附件樣式 */
.msg-attachments { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; }
.attachment-item { background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.8em; color: #aaa; }

/* 圖片渲染器專用的 CSS */
.lilith-image-wrapper {
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: 400px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.generated-img {
  width: 100%;
  height: auto;
  display: block;
}

.typing-indicator { font-size: 0.85em; color: #888; font-style: italic; margin-left: 50px; }

.console-footer { padding: 20px; background: #111; border-top: 1px solid rgba(255,255,255,0.05); }
.input-wrapper { display: flex; gap: 10px; background: #0a0a0a; border: 1px solid #333; padding: 10px; border-radius: 8px; }
.terminal-input { flex: 1; background: transparent; border: none; color: #ea4c89; font-family: 'JetBrains Mono', monospace; outline: none; resize: none; height: 40px; }
.send-btn { background: #ea4c89; color: white; border: none; padding: 0 20px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.send-btn:hover:not(:disabled) { background: #db2777; }
.send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>