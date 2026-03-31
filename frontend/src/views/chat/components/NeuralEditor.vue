<template>
  <transition name="fade-scale">
    <div v-if="show" class="neural-editor-viewport-full" @click.self="$emit('close')">
      <div class="neural-core-console">
        
        <header class="console-header-mini">
          <div class="header-left">
            <span class="pulse-dot">🧬</span> 
            <span class="sys-title-mini">NEURAL CORE OVERRIDE</span>
          </div>
          
          <div class="header-tools">
            <n-button 
              v-if="activeFile && activeFile.isDirty" 
              size="tiny" 
              type="primary" 
              @click="handleSave" 
              class="save-btn-cyber"
              :loading="isApplying"
            >
              SAVE CHANGES
            </n-button>
            <button class="modal-close-btn-mini" @click="$emit('close')">×</button>
          </div>
        </header>

        <div class="vscode-layout-full">
          <aside class="vscode-sidebar">
            <div class="sidebar-header-title">
              <span>EXPLORER</span>
              <button class="nav-icon-btn" @click="reloadRoot" title="Refresh">↻</button>
            </div>
            <div class="vscode-file-tree">
              <div 
                v-for="(file, index) in flatFileTree" 
                :key="file.path" 
                class="vscode-tree-item" 
                :class="{ active: activeFilePath === file.path }"
                :style="{ paddingLeft: `${10 + file.depth * 15}px` }"
                @click="handleNodeClick(file, index)"
              >
                <span class="tree-chevron" v-if="file.type === 'folder'">
                  {{ expandedFolders.has(file.path) ? '▼' : '▶' }}
                </span>
                <span class="tree-chevron-empty" v-else></span>
                
                <span class="file-icon">{{ file.type === 'folder' ? (expandedFolders.has(file.path) ? '📂' : '📁') : '📄' }}</span> 
                <span class="file-name">{{ file.name }}</span>
              </div>
              <div v-if="flatFileTree.length === 0" class="empty-folder">(Empty)</div>
            </div>
          </aside>

          <div class="vscode-right-panel">
            <main class="vscode-main">
              <div class="monaco-editor-wrapper-full">
                <vue-monaco-editor
                  v-if="activeFile"
                  v-model:value="activeFile.content"
                  :language="inferLanguage(activeFile.name)"
                  :theme="'lilith-cyber-full'"
                  :options="monacoOptions"
                  @change="(val) => updateContent(val)"
                  @mount="handleEditorMount"
                  class="real-monaco-editor"
                />
                
                <div v-else class="empty-state-full">
                  <div class="watermark-cyber">LILITH</div>
                  <p>SELECT A FILE TO START NEURAL OVERRIDE</p>
                </div>
              </div>
            </main>

            <footer class="vscode-bottom-panel">
              <div class="panel-header">
                <span class="panel-tab active">TERMINAL</span>
                <button class="terminal-restart-btn" @click="initTerminal">↻ Restart Session</button>
              </div>
              <div class="xterm-container" ref="terminalRef"></div>
            </footer>
          </div>
        </div>

      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { NButton, useMessage } from 'naive-ui';
import { useIDE } from '../composables/useIDE.js'; 
import { VueMonacoEditor } from '@guolao/vue-monaco-editor';

// 🌟 引入 xterm 套件
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const props = defineProps({ show: Boolean });
defineEmits(['close']);
const message = useMessage();

// 從 useIDE 拿取邏輯
const { 
  activeFile, activeFilePath, isApplying, monacoOptions,
  selectNode, updateContent, saveFile, inferLanguage
} = useIDE();

// ==========================================================
// 🌟 真實終端機邏輯 (Xterm + WebSocket)
// ==========================================================
const terminalRef = ref(null);
let term = null;
let fitAddon = null;
let ws = null;

const initTerminal = async () => {
  if (term) term.dispose();
  if (ws) ws.close();

  await nextTick();

  // 1. 初始化 Xterm 賽博龐克主題
  term = new Terminal({
    theme: {
      background: '#11111b',
      foreground: '#cdd6f4',
      cursor: '#f38ba8',
      selection: '#585b7050',
      black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
      blue: '#89b4fa', magenta: '#cba6f7', cyan: '#94e2d5', white: '#bac2de'
    },
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    cursorBlink: true,
    convertEol: true
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalRef.value);
  fitAddon.fit();

  // 2. 建立 WebSocket 連線
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}/api/terminal`;
  
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    term.write('\x1b[35m[SYSTEM]\x1b[0m Neural Terminal Connected.\r\n');
  };

  // 3. 雙向資料串流
  ws.onmessage = (event) => {
    term.write(event.data);
  };

  term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  window.addEventListener('resize', handleResize);
};

const handleResize = () => {
  if (fitAddon) fitAddon.fit();
};

// 監聽視窗打開時啟動 Terminal
watch(() => props.show, (newVal) => {
  if (newVal) {
    setTimeout(initTerminal, 300); // 等待動畫展開
    if (flatFileTree.value.length === 0) reloadRoot();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  if (term) term.dispose();
  if (ws) ws.close();
});

// ==========================================================
// 🌟 VSCode 風格樹狀目錄邏輯 (Flat Tree)
// ==========================================================
const flatFileTree = ref([]);
const expandedFolders = ref(new Set());

const fetchDir = async (dirPath) => {
  const res = await fetch(`/api/fs/list?dir=${dirPath}`);
  const data = await res.json();
  return data.filter(f => !['node_modules', '.git', '.DS_Store'].includes(f.name));
};

const loadDirectory = async (dirPath, depth, insertIndex = -1) => {
  try {
    const items = await fetchDir(dirPath);
    const nodes = items.map(f => ({ ...f, depth }));
    
    nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });

    if (insertIndex === -1) {
      flatFileTree.value = nodes;
    } else {
      flatFileTree.value.splice(insertIndex, 0, ...nodes);
    }
  } catch(e) { console.error("Tree Load Error:", e) }
};

const toggleFolder = async (folder, index) => {
  if (expandedFolders.value.has(folder.path)) {
    expandedFolders.value.delete(folder.path);
    for (let path of expandedFolders.value) {
      if (path.startsWith(folder.path + '/')) expandedFolders.value.delete(path);
    }
    flatFileTree.value = flatFileTree.value.filter(f => !f.path.startsWith(folder.path + '/'));
  } else {
    expandedFolders.value.add(folder.path);
    await loadDirectory(folder.path, folder.depth + 1, index + 1);
  }
};

const handleNodeClick = (node, index) => {
  if (node.type === 'folder') {
    toggleFolder(node, index);
  } else {
    selectNode(node); 
  }
};

const reloadRoot = () => {
  expandedFolders.value.clear();
  loadDirectory('.', 0);
};

// ==========================================================
// Monaco 主題與存檔邏輯
// ==========================================================
const handleEditorMount = (editor, monaco) => {
  monaco.editor.defineTheme('lilith-cyber-full', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6c7086', fontStyle: 'italic' }, 
      { token: 'keyword', foreground: 'ea4c89', fontStyle: 'bold' },    
      { token: 'string', foreground: 'a6e3a1' },                        
      { token: 'number', foreground: 'fab387' },                        
      { token: 'identifier', foreground: 'cdd6f4' },                    
      { token: 'type', foreground: '89b4fa' },                          
    ],
    colors: {
      'editor.background': '#1e1e2e', 
      'editor.foreground': '#cdd6f4', 
      'editor.lineHighlightBackground': '#31324440', 
      'editorCursor.foreground': '#ea4c89', 
      'editorIndentGuide.background': '#313244', 
      'editor.selectionBackground': '#585b7050', 
    }
  });
  monaco.editor.setTheme('lilith-cyber-full');
};

const handleSave = async () => {
  message.loading("Saving override...");
  try {
    await saveFile();
    message.success("Memory override successful.");
  } catch (e) {
    message.error("Save failed.");
  }
};
</script>

<style scoped>
/* 全屏滿版遮罩 */
.neural-editor-viewport-full { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.95); backdrop-filter: blur(15px); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow: hidden; }

/* 核心容器 */
.neural-core-console { width: 100vw; height: 100vh; background: #1e1e2e; display: flex; flex-direction: column; border-radius: 0; overflow: hidden; box-shadow: 0 0 0 2px var(--accent-glow); }

/* Header */
.console-header-mini { height: 35px; background: #11111b; display: flex; justify-content: space-between; align-items: center; padding: 0 15px; font-size: 0.7em; color: #cdd6f4; flex-shrink: 0; border-bottom: 1px solid #313244; }
.header-left { display: flex; align-items: center; gap: 8px; }
.pulse-dot { color: var(--accent-primary); animation: pulse 1s infinite; font-size: 0.9em; }
.sys-title-mini { color: var(--accent-primary); font-weight: bold; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
.header-tools { display: flex; align-items: center; gap: 12px; }
.save-btn-cyber { font-family: 'JetBrains Mono', monospace; font-weight: bold; transform: scale(0.9); }
.modal-close-btn-mini { background: none; border: none; color: #666; cursor: pointer; font-size: 1.3rem; line-height: 1; transition: 0.2s; }
.modal-close-btn-mini:hover { color: #f38ba8; }

/* 版面排版：左右分流 */
.vscode-layout-full { display: flex; flex: 1; height: calc(100vh - 35px); overflow: hidden; }

/* 左側邊欄：滿高 100% */
.vscode-sidebar { width: 250px; height: 100%; background: #181825; display: flex; flex-direction: column; border-right: 1px solid #313244; flex-shrink: 0; }
.sidebar-header-title { padding: 10px 15px; font-size: 0.7em; font-weight: bold; color: #585b70; border-bottom: 1px solid #313244; font-family: 'JetBrains Mono', monospace; display: flex; justify-content: space-between; align-items: center; }
.nav-icon-btn { background: transparent; border: none; color: #999; cursor: pointer; transition: 0.2s; padding: 0; font-size: 1.2em;}
.nav-icon-btn:hover { color: #ea4c89; }

/* 階層樹狀列表 */
.vscode-file-tree { flex: 1; overflow-y: auto; padding: 10px 0; }
.vscode-file-tree::-webkit-scrollbar { width: 3px; }
.vscode-file-tree::-webkit-scrollbar-thumb { background: #313244; border-radius: 2px; }
.vscode-tree-item { padding: 5px 15px; font-size: 0.8em; cursor: pointer; color: #9499b0; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: 0.1s; font-family: 'JetBrains Mono', monospace; }
.vscode-tree-item:hover { background: rgba(234, 76, 137, 0.05); color: #cdd6f4; }
.vscode-tree-item.active { background: #313244; color: var(--accent-primary); font-weight: bold; }
.tree-chevron { font-size: 0.7em; opacity: 0.6; width: 12px; text-align: center; }
.tree-chevron-empty { width: 12px; }
.file-icon { font-size: 1.1em; }

/* 右側面板：包含 Editor 與 Terminal */
.vscode-right-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* Monaco 區域 */
.vscode-main { flex: 1; background: #1e1e2e; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.monaco-editor-wrapper-full { flex: 1; position: relative; height: 100%; width: 100%; overflow: hidden; }
.real-monaco-editor { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }

/* 空白狀態 */
.empty-state-full { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #45475a; background: #1e1e2e; }
.watermark-cyber { font-size: 4rem; font-weight: 900; opacity: 0.02; font-family: 'Inter', sans-serif; letter-spacing: -5px; }
.empty-state-full p { font-family: 'JetBrains Mono', monospace; font-size: 0.8em; }

/* 🌟 底部面板：Xterm 容器 */
.vscode-bottom-panel { height: 250px; background: #11111b; border-top: 1px solid #313244; display: flex; flex-direction: column; flex-shrink: 0; }
.panel-header { padding: 5px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #181825; }
.panel-tab { font-size: 0.7em; font-weight: bold; color: #585b70; cursor: pointer; text-transform: uppercase; padding: 2px 0; position: relative; font-family: 'JetBrains Mono', monospace; }
.panel-tab.active { color: #fab387; }
.panel-tab.active:after { content: ''; position: absolute; bottom: -6px; left: 0; width: 100%; height: 2px; background: #fab387; }
.terminal-restart-btn { background: none; border: none; color: #585b70; font-size: 0.7em; cursor: pointer; transition: 0.2s; font-family: 'JetBrains Mono', monospace; }
.terminal-restart-btn:hover { color: var(--accent-primary); }

.xterm-container { flex: 1; padding: 10px 15px; overflow: hidden; background: #11111b; }
:deep(.xterm-viewport::-webkit-scrollbar) { width: 4px; }
:deep(.xterm-viewport::-webkit-scrollbar-thumb) { background: #313244; border-radius: 2px; }

@keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
.fade-scale-enter-active, .fade-scale-leave-active { transition: all 0.25s ease-out; }
.fade-scale-enter-from, .fade-scale-leave-to { opacity: 0; transform: scale(0.98); blur: 5px; }
</style>