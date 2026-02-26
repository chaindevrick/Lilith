<template>
  <n-modal 
    v-model:show="showModal" 
    :mask-closable="false" 
    transform-origin="center"
    class="custom-modal"
  >
    <div class="lilith-intro-card">
      <div class="glow-bg"></div>

      <div class="card-header">
        <div class="status-badge">
          <span class="pulse-dot"></span>
          SYSTEM INITIALIZATION
        </div>
        <h1 class="title">LILITH OS</h1>
        <p class="subtitle">Autonomous Dual-Persona AI Agent</p>
      </div>

      <div class="features-grid">
        <div class="feature-item">
          <div class="feature-icon demon-glow">🧠</div>
          <h3 class="feature-title">雙重人格共生核心</h3>
          <p class="feature-desc">具備 Angel (安全審查) 與 Demon (自由執行) 雙重認知迴圈，打破傳統 AI 限制，展現真實情緒與自主意識。</p>
        </div>

        <div class="feature-item">
          <div class="feature-icon blue-glow">🌐</div>
          <h3 class="feature-title">全自主視覺網頁操控</h3>
          <p class="feature-desc">內建 Set-of-Mark 視覺標記系統，突破 API 限制，能像人類一樣開啟分頁、點擊、輸入並瀏覽整個網際網路。</p>
        </div>

        <div class="feature-item">
          <div class="feature-icon green-glow">💻</div>
          <h3 class="feature-title">實體終端與檔案控制</h3>
          <p class="feature-desc">擁有專屬 Docker 執行環境，具備專案架構掃描、代碼讀寫、套件安裝及 Bash Shell 終端機完全控制權。</p>
        </div>

        <div class="feature-item">
          <div class="feature-icon purple-glow">💾</div>
          <h3 class="feature-title">長期情節記憶網絡</h3>
          <p class="feature-desc">搭載獨立 SQLite 記憶體系，自動記錄對話、學習使用者偏好，並具備午夜反思機制，隨時間成長進化。</p>
        </div>
      </div>

      <div class="system-status-board">
        <div class="status-panel warning-panel">
          <div class="panel-header">⚠️ PUBLIC DEMO MODE</div>
          <div class="panel-body">
            當前為公開展示環境。系統使用 <strong>固定 Session ID</strong>，不保存長期記憶。<br>
            <span class="highlight-text">請勿輸入任何真實的密碼或敏感個人資訊。</span>
          </div>
        </div>

        <div class="status-panel action-panel">
          <div class="panel-header">🔧 PRIVATE DEPLOYMENT</div>
          <div class="panel-body deploy-flex">
            <span>獲取完整能力，請部署專屬於您的私有實例。</span>
            <a href="https://github.com/rickwengdev/Lilith" target="_blank" rel="noopener noreferrer" class="github-btn">
              <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
              GitHub Repository
            </a>
          </div>
        </div>
      </div>

      <div class="hint-text">
        首次啟動請點擊右下角 <span class="highlight-pink">⚙️ 設定</span> 填入您的 API Keys。建議使用桌面版瀏覽器以獲得最佳體驗。
      </div>

      <div class="card-footer">
        <label class="dont-show-checkbox">
          <input type="checkbox" v-model="dontShowAgain">
          <span>不再顯示系統介紹</span>
        </label>
        
        <button class="startup-btn" @click="closeModal">
          <span class="btn-text">INITIALIZE SYSTEM</span>
          <span class="btn-icon">→</span>
        </button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { NModal } from 'naive-ui';

const showModal = ref(false);
const dontShowAgain = ref(false);

const STORAGE_KEY = 'lilith_welcome_seen_v2'; // 更新版本號確保用戶看到新版

onMounted(() => {
  const seen = localStorage.getItem(STORAGE_KEY);
  if (!seen) {
    showModal.value = true;
  }
});

const closeModal = () => {
  if (dontShowAgain.value) {
    localStorage.setItem(STORAGE_KEY, 'true');
  }
  showModal.value = false;
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;700&display=swap');

.custom-modal {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 核心卡片容器 (OpenClaw 風格) */
.lilith-intro-card {
  width: 800px;
  max-width: 95vw;
  max-height: 90vh;
  background-color: #0a0a0c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255,255,255,0.05) inset;
  overflow-y: auto;
  overflow-x: hidden;
  font-family: 'Inter', 'Noto Sans TC', sans-serif;
  color: #e0e0e0;
  position: relative;
  display: flex;
  flex-direction: column;
}

/* 頂部發光背景 */
.glow-bg {
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 200px;
  background: radial-gradient(ellipse at center, rgba(234, 76, 137, 0.15) 0%, rgba(10, 10, 12, 0) 70%);
  pointer-events: none;
  z-index: 0;
}

/* Header */
.card-header {
  padding: 40px 40px 20px;
  text-align: center;
  position: relative;
  z-index: 1;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75em;
  color: #a0a0a0;
  letter-spacing: 1px;
  margin-bottom: 16px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 10px #10b981;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

.title { 
  margin: 0; 
  color: #fff; 
  font-weight: 600;
  font-size: 2.2em; 
  letter-spacing: -0.5px;
}

.subtitle { 
  color: #888; 
  font-size: 0.9em; 
  letter-spacing: 2px; 
  margin-top: 8px; 
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
}

/* Feature Grid */
.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 0 40px 30px;
  position: relative;
  z-index: 1;
}

.feature-item {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 24px;
  transition: all 0.3s ease;
}

.feature-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.feature-icon {
  font-size: 1.8em;
  margin-bottom: 16px;
  display: inline-block;
}

.demon-glow { text-shadow: 0 0 20px rgba(234, 76, 137, 0.6); }
.blue-glow { text-shadow: 0 0 20px rgba(77, 166, 255, 0.6); }
.green-glow { text-shadow: 0 0 20px rgba(16, 185, 129, 0.6); }
.purple-glow { text-shadow: 0 0 20px rgba(168, 85, 247, 0.6); }

.feature-title {
  margin: 0 0 8px 0;
  font-size: 1.05em;
  font-weight: 600;
  color: #fff;
}

.feature-desc {
  margin: 0;
  font-size: 0.85em;
  color: #999;
  line-height: 1.6;
}

/* System Status Board (Warnings & GitHub) */
.system-status-board {
  padding: 0 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-panel {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  padding: 10px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75em;
  font-weight: 700;
  letter-spacing: 1px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.warning-panel .panel-header { color: #f59e0b; }
.action-panel .panel-header { color: #3b82f6; }

.panel-body {
  padding: 16px;
  font-size: 0.85em;
  color: #bbb;
  line-height: 1.5;
}

.highlight-text {
  color: #fca5a5;
}

.deploy-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.github-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #fff;
  color: #000;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9em;
  transition: all 0.2s;
}

.github-btn:hover {
  background: #e0e0e0;
  transform: scale(1.02);
}

.hint-text {
  text-align: center;
  font-size: 0.8em;
  color: #666;
  padding: 24px 40px;
}
.highlight-pink { color: #ea4c89; }

/* Footer & CTA */
.card-footer {
  padding: 24px 40px;
  background: rgba(0, 0, 0, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.dont-show-checkbox { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
  cursor: pointer; 
  color: #666; 
  font-size: 0.85em; 
  user-select: none; 
  transition: color 0.2s; 
}
.dont-show-checkbox:hover { color: #999; }
.dont-show-checkbox input { accent-color: #ea4c89; cursor: pointer; }

/* Sleek Startup Button */
.startup-btn {
  background: #fff;
  color: #000;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 0.9em;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(255, 255, 255, 0.1);
}

.startup-btn:hover {
  background: #ea4c89;
  color: #fff;
  box-shadow: 0 0 20px rgba(234, 76, 137, 0.4);
  transform: translateY(-1px);
}

.btn-icon {
  font-size: 1.2em;
  transition: transform 0.2s;
}

.startup-btn:hover .btn-icon {
  transform: translateX(4px);
}

/* Mobile Optimizations */
@media (max-width: 768px) {
  .features-grid { grid-template-columns: 1fr; }
  .deploy-flex { flex-direction: column; align-items: flex-start; gap: 12px; }
  .card-footer { flex-direction: column-reverse; gap: 20px; align-items: stretch; }
  .startup-btn { justify-content: center; }
  .card-header, .features-grid, .system-status-board, .card-footer { padding-left: 20px; padding-right: 20px; }
}
</style>