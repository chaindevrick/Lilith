<template>
  <section class="right-ide" @dragover.prevent @drop.prevent="handleFileDrop">
    <div class="ide-header">
      <div class="ide-title">SYSTEM EXPLORER</div>
      <div v-if="uploadProgress.uploading" class="upload-status">
        UPLOADING: {{ uploadProgress.current }}/{{ uploadProgress.total }}
      </div>
      <div class="ide-controls">
        <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
      </div>
    </div>
    
    <div class="ide-file-tree">
      <div class="nav-bar">
        <button class="nav-btn" @click="goParentDir" :disabled="currentDir === '.'" title="Go Up">⬅</button>
        <span class="current-path">/{{ currentDir }}</span>
        
        <button class="nav-btn upload" @click="triggerUpload" title="Upload File/Zip">⬆</button>
        <input type="file" ref="ideFileRef" multiple style="display: none" @change="onFileChange" />

        <button class="nav-btn refresh" @click="fetchFileList" title="Refresh">↻</button>
      </div>
      
      <div class="file-list-content">
        <div v-for="file in fileList" :key="file.name" class="tree-item" @click="selectNode(file)">
          <span class="file-icon">{{ file.type === 'folder' ? '📂' : '📄' }}</span> 
          {{ file.name }}
        </div>
        <div v-if="fileList.length === 0" class="empty-folder">(Empty Folder)</div>
      </div>
    </div>
    
    <div class="ide-editor">
      <div class="editor-tabs">
        <div v-for="file in openFiles" :key="file.path" class="tab" :class="{ active: activeFilePath === file.path }" @click="activeFilePath = file.path">
          <span class="tab-name">{{ file.name }}</span>
          <span class="unsaved-dot" v-if="file.isDirty">●</span>
          <span class="close-tab" @click="(e) => closeFile(file.path, e)">×</span>
        </div>
      </div>

      <textarea v-if="activeFile" class="code-area" :value="activeFile.content" @input="(e) => updateContent(e.target.value)" spellcheck="false"></textarea>
      
      <div v-else class="empty-editor">
        <div class="logo-watermark">IDE READY</div>
        <div class="hint">Select a file from the explorer<br>or Drag & Drop (Supports .zip)</div>
      </div>
    </div>
    
    <div class="ide-footer">
      <div class="left-stat"><span v-if="activeFile">{{ activeFile.path }}</span></div>
      <div class="right-action">
        <span class="status-txt" v-if="activeFile">{{ activeFile.isDirty ? 'Unsaved' : 'Saved' }}</span>
        <n-button v-if="activeFile" size="tiny" color="#ffffff" text-color="#ea4c89" @click="saveFile" style="font-weight: bold; margin-left: 10px;">Save</n-button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { NButton } from 'naive-ui';
import { useIDE } from '../composables/useIDE.js';

const ideFileRef = ref(null);

const { 
  fileList, currentDir, openFiles, activeFile, activeFilePath,
  uploadProgress, // [New]
  fetchFileList, goParentDir, selectNode, closeFile, updateContent, saveFile,
  handleFileUpload 
} = useIDE();

const triggerUpload = () => ideFileRef.value.click();

const onFileChange = (event) => {
  const files = event.target.files;
  if (files.length > 0) {
    handleFileUpload(files); 
    event.target.value = '';
  }
};

const handleFileDrop = (event) => {
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    handleFileUpload(files); 
  }
};
</script>

<style scoped>
/* 原有 CSS 保持不變 */
.right-ide { background: #1e1e1e; display: flex; flex-direction: column; border-left: 1px solid #000; font-family: 'JetBrains Mono'; height: 100%; }
.ide-header { height: 40px; background: #252526; display: flex; justify-content: space-between; align-items: center; padding: 0 15px; font-size: 0.75em; color: #999; flex-shrink: 0; }
.upload-status { color: #ea4c89; font-weight: bold; animation: pulse 1.5s infinite; } /* [New] Status Style */
.ide-controls { display: flex; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; } .red { background: #ff5f56; } .yellow { background: #ffbd2e; } .green { background: #27c93f; }
.ide-file-tree { height: 200px; display: flex; flex-direction: column; background: #252526; border-bottom: 1px solid #333; flex-shrink: 0; }
.nav-bar { display: flex; align-items: center; padding: 5px 10px; background: #2d2d2d; border-bottom: 1px solid #383838; gap: 5px; }
.current-path { flex-grow: 1; font-size: 0.75em; color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 2px 6px; border-radius: 3px; font-size: 1em; }
.nav-btn:hover:not(:disabled) { background: #444; color: white; }
.nav-btn.upload { color: #4da6ff; }
.nav-btn.upload:hover { background: #4da6ff; color: white; }
.nav-btn:disabled { opacity: 0.3; cursor: default; }
.file-list-content { overflow-y: auto; padding: 5px 0; flex-grow: 1; font-size: 0.8em; color: #aaa; }
.tree-item { padding: 3px 10px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
.tree-item:hover { background: #2a2d2e; color: white; }
.empty-folder { text-align: center; padding: 20px; font-style: italic; opacity: 0.5; font-size: 0.8em; }
.ide-editor { flex-grow: 1; display: flex; flex-direction: column; background: #1e1e1e; overflow: hidden; position: relative; }
.editor-tabs { background: #252526; height: 35px; display: flex; overflow-x: auto; flex-shrink: 0; }
.editor-tabs::-webkit-scrollbar { height: 3px; }
.editor-tabs::-webkit-scrollbar-thumb { background: #444; }
.tab { padding: 0 10px; background: #2d2d2d; color: #888; font-size: 0.8em; display: flex; align-items: center; gap: 8px; cursor: pointer; border-right: 1px solid #1e1e1e; min-width: 100px; user-select: none; }
.tab:hover { background: #333; }
.tab.active { background: #1e1e1e; color: #d4d4d4; border-top: 2px solid #ea4c89; }
.tab-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.unsaved-dot { font-size: 1.2em; color: #ea4c89; }
.close-tab { border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.1em; }
.close-tab:hover { background: #444; color: white; }
.code-area { flex-grow: 1; background: #1e1e1e; color: #d4d4d4; border: none; padding: 15px; font-family: 'JetBrains Mono', monospace; font-size: 0.85em; line-height: 1.5; resize: none; outline: none; }
.empty-editor { flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #444; }
.logo-watermark { font-size: 2em; font-weight: bold; opacity: 0.2; }
.hint { font-size: 0.8em; margin-top: 10px; opacity: 0.5; }
.ide-footer { height: 25px; background: #ea4c89; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; font-size: 0.7em; color: white; flex-shrink: 0; }
.left-stat { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%; }
.right-action { display: flex; align-items: center; }

@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
</style>