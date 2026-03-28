/**
 * src/composables/useIDE.js
 * IDE 核心邏輯 (IDE Core Logic)
 * 職責：管理檔案瀏覽器狀態、處理檔案讀寫、上傳解壓以及系統重啟指令。
 */

import { ref, computed, onMounted } from 'vue';

export function useIDE() {
  
  // ============================================================
  // 1. State Definitions
  // ============================================================

  const fileList = ref([]);
  const openFiles = ref([]); 
  const activeFilePath = ref(''); 
  const currentDir = ref('src/core'); // 預設開啟核心目錄
  const isApplying = ref(false);
  
  // 上傳進度
  const uploadProgress = ref({ total: 0, current: 0, uploading: false });

  // 計算屬性：當前正在編輯的檔案物件
  const activeFile = computed(() => {
    return openFiles.value.find(f => f.path === activeFilePath.value) || null;
  });

  // ============================================================
  // 2. File System Navigation
  // ============================================================

  const getParentPath = (path) => {
    if (path === '.' || !path.includes('/')) return '.';
    return path.substring(0, path.lastIndexOf('/'));
  };

  /**
   * 獲取當前目錄下的檔案列表
   */
  const fetchFileList = async () => {
    try {
      const res = await fetch(`/api/fs/list?dir=${currentDir.value}`);
      const data = await res.json();
      // 過濾掉不必要的系統目錄
      fileList.value = data.filter(f => !['node_modules', '.git', '.DS_Store'].includes(f.name));
    } catch (e) { console.error("[IDE] List failed:", e); }
  };

  const goParentDir = () => {
    if (currentDir.value === '.') return;
    currentDir.value = getParentPath(currentDir.value);
    fetchFileList();
  };

  const selectNode = async (node) => {
    if (node.type === 'folder') {
      currentDir.value = node.path;
      await fetchFileList();
    } else {
      await openFile(node);
    }
  };

  // ============================================================
  // 3. File Editing Operations
  // ============================================================

  const openFile = async (fileNode) => {
    // 若已開啟，直接切換分頁
    const existing = openFiles.value.find(f => f.path === fileNode.path);
    if (existing) {
      activeFilePath.value = existing.path; 
      return;
    }

    try {
      const res = await fetch(`/api/fs/read?path=${encodeURIComponent(fileNode.path)}`);
      const data = await res.json();
      
      const newFile = {
        name: fileNode.name,
        path: fileNode.path,
        content: data.content,
        originalContent: data.content, 
        isDirty: false
      };
      
      openFiles.value.push(newFile);
      activeFilePath.value = newFile.path;
    } catch (e) { console.error("[IDE] Read failed:", e); }
  };

  const closeFile = (path, event) => {
    if (event) event.stopPropagation();
    
    const idx = openFiles.value.findIndex(f => f.path === path);
    if (idx === -1) return;
    
    openFiles.value.splice(idx, 1);
    
    // 如果關閉的是當前分頁，自動切換到前一個
    if (path === activeFilePath.value) {
      if (openFiles.value.length > 0) {
        activeFilePath.value = openFiles.value[Math.max(0, idx - 1)].path;
      } else {
        activeFilePath.value = '';
      }
    }
  };

  const updateContent = (newContent) => {
    if (!activeFile.value) return;
    activeFile.value.content = newContent;
    activeFile.value.isDirty = activeFile.value.content !== activeFile.value.originalContent;
  };

  const saveFile = async () => {
    if (!activeFile.value) return;
    try {
      await uploadFile(activeFile.value.path, activeFile.value.content, 'utf-8');
      activeFile.value.originalContent = activeFile.value.content;
      activeFile.value.isDirty = false;
    } catch (e) { 
        console.error(e);
        alert("Save failed! See console."); 
    }
  };

  const deleteNode = async (node) => {
    // 1. 前端防呆確認
    if (!confirm(`確定要永久刪除 "${node.name}" 嗎？此動作無法復原。`)) return;

    try {
      const res = await fetch('/api/fs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path })
      });

      if (!res.ok) throw new Error("Delete API failed");

      // 2. 如果刪除的是已開啟的檔案，關閉它的分頁
      // 如果刪除的是資料夾，關閉所有相關路徑的檔案
      const relatedOpenFiles = openFiles.value.filter(f => f.path === node.path || f.path.startsWith(node.path + '/'));
      relatedOpenFiles.forEach(f => closeFile(f.path));

      // 3. 重新整理列表
      await fetchFileList();

    } catch (e) {
      console.error(e);
      alert(`刪除失敗: ${e.message}`);
    }
  };

  // ============================================================
  // 4. Upload & Zip Logic (Queue Support)
  // ============================================================

  // 底層上傳 API
  const uploadFile = async (path, content, encoding = 'utf-8') => {
    const res = await fetch('/api/fs/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content, encoding })
    });
    if (!res.ok) throw new Error("Upload API failed");
  };

  // 底層解壓 API
  const extractZip = async (targetDir, contentBase64) => {
    const res = await fetch('/api/fs/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetDir, content: contentBase64 })
    });
    if (!res.ok) throw new Error("Extract API failed");
  };

  /**
   * 批次上傳處理器 (含 Zip 自動解壓檢測)
   */
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    // 初始化進度
    uploadProgress.value = {
      total: files.length,
      current: 0,
      uploading: true
    };

    const CONCURRENCY = 3; // 同時上傳 3 個檔案，避免瀏覽器卡死
    const queue = Array.from(files);
    const activePromises = [];

    const processNext = async () => {
      if (queue.length === 0) return;

      const file = queue.shift();
      const targetPath = currentDir.value === '.' ? file.name : `${currentDir.value}/${file.name}`;
      
      try {
        // [Feature] Zip 自動解壓檢測
        if (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type.includes('zip')) {
            console.log(`[Upload] Detected Zip: ${file.name}, extracting...`);
            const base64Raw = await readFileAsBase64(file);
            const base64Data = base64Raw.split(',')[1];
            // 解壓到當前目錄
            await extractZip(currentDir.value, base64Data);
        } else {
            // 一般檔案上傳
            // 判斷是否為二進位檔案 (圖片/PDF)
            const isBinary = file.type.startsWith('image/') || file.type === 'application/pdf';
            
            if (isBinary) {
                const base64Raw = await readFileAsBase64(file);
                const base64Data = base64Raw.split(',')[1];
                await uploadFile(targetPath, base64Data, 'base64');
            } else {
                const text = await readFileAsText(file);
                await uploadFile(targetPath, text, 'utf-8');
            }
        }
      } catch (e) {
        console.error(`Failed: ${file.name}`, e);
      } finally {
        uploadProgress.value.current++;
        // 遞迴處理下一個
        await processNext();
      }
    };

    // 啟動併發 worker
    for (let i = 0; i < CONCURRENCY; i++) {
        activePromises.push(processNext());
    }

    await Promise.all(activePromises);
    
    // 完成
    uploadProgress.value.uploading = false;
    await fetchFileList();
  };

  // --- File Readers Helpers ---

  const readFileAsText = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.readAsText(file);
    r.onload = () => resolve(r.result);
    r.onerror = reject;
  });

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.readAsDataURL(file);
    r.onload = () => resolve(r.result);
    r.onerror = reject;
  });

  // ============================================================
  // 5. System Control
  // ============================================================

  const applySystemChanges = async () => {
    if (isApplying.value) return;
    isApplying.value = true;
    
    try {
      const res = await fetch('/api/system/restart', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.success) {
        console.log("[IDE] System Restarted"); 
        return true;
      }
    } catch (e) {
      console.error("Restart failed:", e);
      throw e; // 讓外部 UI 處理錯誤顯示
    } finally {
      // 延遲一下讓動畫跑完
      setTimeout(() => { isApplying.value = false; }, 2000);
    }
  };

  // ============================================================
  // 6. Lifecycle
  // ============================================================

  onMounted(() => fetchFileList());

  return {
    // State
    fileList, currentDir, openFiles, activeFile, activeFilePath,
    uploadProgress, isApplying,
    
    // FS Navigation
    fetchFileList, goParentDir, selectNode, 
    
    // Editor Operations
    closeFile, updateContent, saveFile, deleteNode,
    
    // Upload & System
    handleFileUpload,
    applySystemChanges
  };
}