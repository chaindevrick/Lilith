/**
 * src/composables/useIDE.js
 * IDE 核心邏輯 (IDE Core Logic)
 */

import { ref, computed, onMounted } from 'vue';

export function useIDE() {
  // ============================================================
  // 1. FS State Definitions
  // ============================================================
  const fileList = ref([]);
  const openFiles = ref([]); 
  const activeFilePath = ref(''); 
  const currentDir = ref('.'); 
  const isApplying = ref(false);

  const activeFile = computed(() => {
    return openFiles.value.find(f => f.path === activeFilePath.value) || null;
  });

  // ============================================================
  // 2. Editor & Monaco Logic
  // ============================================================
  const monacoOptions = ref({
    automaticLayout: true,      
    formatOnPaste: true,       
    formatOnType: true,        
    fontSize: 13,              
    fontFamily: "'JetBrains Mono', monospace", 
    lineNumbers: 'on',         
    minimap: { enabled: true, scale: 0.75 }, 
    scrollBeyondLastLine: false, 
    tabSize: 4,                
    cursorBlinking: 'smooth',   
    contextmenu: true,         
    quickSuggestions: true,    
    wordWrap: 'on',            
    padding: { top: 10, bottom: 10 }, 
  });

  const inferLanguage = (fileName) => {
    if (!fileName) return 'plaintext';
    const ext = fileName.split('.').pop().toLowerCase();
    const langMap = {
      js: 'javascript', ts: 'typescript', json: 'json', md: 'markdown', 
      html: 'html', css: 'css', vue: 'html', py: 'python', sh: 'shell',
    };
    return langMap[ext] || 'plaintext';
  };

  const updateContent = (newContent) => {
    if (!activeFile.value) return;
    activeFile.value.content = newContent;
    activeFile.value.isDirty = activeFile.value.content !== activeFile.value.originalContent;
  };

  // ============================================================
  // 3. System Control Logic
  // ============================================================
  const applySystemChanges = async () => {
    if (isApplying.value) return;
    isApplying.value = true;
    try {
      const res = await fetch('/api/system/restart', { method: 'POST' });
      const data = await res.json();
      if (data.success) return true;
    } catch (e) {
      console.error("Restart failed:", e);
      throw e; 
    } finally {
      setTimeout(() => { isApplying.value = false; }, 2000);
    }
  };

  // ============================================================
  // 4. File System Navigation (給予 Editor 開啟使用)
  // ============================================================
  const openFile = async (fileNode) => {
    const existing = openFiles.value.find(f => f.path === fileNode.path);
    if (existing) {
      activeFilePath.value = existing.path; return;
    }
    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(fileNode.path)}`);
      const data = await res.json();
      const newFile = { name: fileNode.name, path: fileNode.path, content: data.content, originalContent: data.content, isDirty: false };
      openFiles.value.push(newFile);
      activeFilePath.value = newFile.path;
    } catch (e) { console.error("[IDE] Read failed:", e); }
  };

  const selectNode = async (node) => {
    if (node.type !== 'folder') {
      await openFile(node);
    }
  };

  const saveFile = async () => {
    if (!activeFile.value) return;
    try {
      await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFile.value.path, content: activeFile.value.content, encoding: 'utf-8' })
      });
      activeFile.value.originalContent = activeFile.value.content;
      activeFile.value.isDirty = false;
    } catch (e) { 
      console.error("[ERR] Save failed:", e);
      throw e;
    }
  };

  return {
    openFiles, activeFile, activeFilePath, isApplying, monacoOptions,
    selectNode, updateContent, saveFile, applySystemChanges, inferLanguage
  };
}