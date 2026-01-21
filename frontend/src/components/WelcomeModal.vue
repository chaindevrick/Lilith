<template>
  <n-modal v-model:show="showModal" :mask-closable="false" transform-origin="center">
    <div class="welcome-card">
      
      <div class="card-header">
        <h2 class="title">🚀 SYSTEM INITIALIZATION</h2>
        <div class="subtitle">PROJECT: LILITH</div>
      </div>

      <div class="card-content">
        
        <div class="alert-box warning">
          <div class="alert-title">⚠️ PUBLIC DEMO MODE</div>
          <p>如果您正在瀏覽演示網站 (Demo Site)：</p>
          <ul>
            <li>系統將使用 <strong>固定 Session ID</strong> (多人共用)。</li>
            <li><strong>不會保存</strong> 您的長期記憶與對話紀錄。</li>
            <li>請勿輸入任何敏感個人資訊。</li>
          </ul>
        </div>

        <div class="alert-box info">
          <div class="alert-title">🔧 PRIVATE DEPLOYMENT</div>
          <p>請前往 GitHub 下載並部署您自己的實例：</p>
          
          <a href="https://github.com/rickwengdev/Lilith" target="_blank" class="github-btn">
            <span class="icon">🔗</span>
            <span>GitHub Repository</span>
          </a>
        </div>

        <p class="hint-text">
          首次啟動請點擊右下角的 <span class="highlight">⚙️ 設定</span> 按鈕，填入您的 API Keys。<br> 使用電腦版體驗最佳。
        </p>

      </div>

      <div class="card-footer">
        <label class="dont-show">
          <input type="checkbox" v-model="dontShowAgain">
          <span>不再顯示此訊息</span>
        </label>
        
        <button class="confirm-btn" @click="closeModal">
          <span>START</span>
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
const STORAGE_KEY = 'lilith_welcome_seen_v1';

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
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Noto+Sans+TC:wght@400;700&display=swap');

.welcome-card {
  width: 600px;
  max-width: 90vw;
  background-color: #1a1a1a;
  background-image: radial-gradient(circle at 50% 0%, rgba(234, 76, 137, 0.1), transparent 70%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
  padding: 0;
  overflow: hidden;
  font-family: 'Noto Sans TC', sans-serif;
  color: #eee;
}

.card-header {
  padding: 30px 30px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  text-align: center;
}
.title { margin: 0; color: #ea4c89; font-family: 'JetBrains Mono'; letter-spacing: 2px; font-size: 1.5em; text-shadow: 0 0 15px rgba(234, 76, 137, 0.4); }
.subtitle { color: #666; font-size: 0.8em; letter-spacing: 5px; margin-top: 5px; }

.card-content { padding: 30px; }

.alert-box {
  background: rgba(255,255,255,0.03);
  border-left: 4px solid #666;
  padding: 15px 20px;
  margin-bottom: 20px;
  border-radius: 4px;
}
.alert-box.warning { border-color: #e6a23c; background: rgba(230, 162, 60, 0.05); }
.alert-box.info { border-color: #4da6ff; background: rgba(77, 166, 255, 0.05); }

.alert-title { font-weight: bold; font-family: 'JetBrains Mono'; margin-bottom: 10px; font-size: 0.9em; letter-spacing: 1px; }
.warning .alert-title { color: #e6a23c; }
.info .alert-title { color: #4da6ff; }

ul { margin: 5px 0 0 20px; padding: 0; font-size: 0.9em; color: #ccc; }
li { margin-bottom: 5px; }

.github-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  margin-top: 15px; padding: 10px;
  background: rgba(0,0,0,0.3); border: 1px solid #4da6ff;
  color: #4da6ff; text-decoration: none; border-radius: 6px;
  font-weight: bold; font-size: 0.9em; transition: all 0.2s;
}
.github-btn:hover { background: #4da6ff; color: #1a1a1a; }

.hint-text { text-align: center; font-size: 0.9em; color: #888; margin-top: 25px; }
.highlight { color: #ea4c89; font-weight: bold; }

.card-footer {
  padding: 20px 30px;
  background: rgba(0,0,0,0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(255,255,255,0.05);
}

.dont-show { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #888; font-size: 0.9em; user-select: none; }
.dont-show input { accent-color: #ea4c89; }

.confirm-btn {
  background: #ea4c89; color: white; border: none;
  padding: 10px 30px; border-radius: 4px;
  font-family: 'JetBrains Mono'; font-weight: bold;
  cursor: pointer; transition: all 0.2s;
  box-shadow: 0 0 15px rgba(234, 76, 137, 0.4);
}
.confirm-btn:hover { background: #ff6b9d; transform: translateY(-1px); }
</style>