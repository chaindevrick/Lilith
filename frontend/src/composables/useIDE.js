import { ref, computed, onMounted } from 'vue';

export function useIDE() {
  const fileList = ref([]);
  const openFiles = ref([]); 
  const activeFilePath = ref(''); 
  const currentDir = ref('src/core');
  const isApplying = ref(false);
  
  const uploadProgress = ref({ total: 0, current: 0, uploading: false });

  const activeFile = computed(() => {
    return openFiles.value.find(f => f.path === activeFilePath.value) || null;
  });

  const getParentPath = (path) => {
    if (path === '.' || !path.includes('/')) return '.';
    return path.substring(0, path.lastIndexOf('/'));
  };

  const fetchFileList = async () => {
    try {
      const res = await fetch(`/api/fs/list?dir=${currentDir.value}`);
      const data = await res.json();
      fileList.value = data.filter(f => !['node_modules', '.git'].includes(f.name));
    } catch (e) { console.error(e); }
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

  const openFile = async (fileNode) => {
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
    } catch (e) { console.error(e); }
  };

  const closeFile = (path, event) => {
    if (event) event.stopPropagation();
    const idx = openFiles.value.findIndex(f => f.path === path);
    if (idx === -1) return;
    openFiles.value.splice(idx, 1);
    if (path === activeFilePath.value) {
      if (openFiles.value.length > 0) activeFilePath.value = openFiles.value[Math.max(0, idx - 1)].path;
      else activeFilePath.value = '';
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
    } catch (e) { alert("Save failed!"); }
  };

  // ==========================================
  // 核心上傳邏輯 (Queue & Zip Support)
  // ==========================================

  const uploadFile = async (path, content, encoding = 'utf-8') => {
    const res = await fetch('/api/fs/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content, encoding })
    });
    if (!res.ok) throw new Error("Upload API failed");
  };

  const extractZip = async (targetDir, contentBase64) => {
    const res = await fetch('/api/fs/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetDir, content: contentBase64 })
    });
    if (!res.ok) throw new Error("Extract API failed");
  };

  /**
   * 批次上傳處理器 (含 Zip 檢測)
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
        // [Feature] Zip 檢測
        if (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
            console.log(`[Upload] Detected Zip: ${file.name}, extracting...`);
            const base64Raw = await readFileAsBase64(file);
            const base64Data = base64Raw.split(',')[1];
            // 解壓到當前目錄
            await extractZip(currentDir.value, base64Data);
        } else {
            // 一般檔案上傳
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

    // 啟動併發
    for (let i = 0; i < CONCURRENCY; i++) {
        activePromises.push(processNext());
    }

    await Promise.all(activePromises);
    
    // 完成
    uploadProgress.value.uploading = false;
    await fetchFileList();
  };

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

  const applySystemChanges = async () => {
    if (isApplying.value) return;
    isApplying.value = true;
    
    try {
      const res = await fetch('/api/system/restart', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.success) {
        // 可以搭配 Naive UI 的 message，或簡單 alert
        console.log("System Restarted"); 
        return true;
      }
    } catch (e) {
      console.error("Restart failed:", e);
      alert("Failed to apply changes.");
    } finally {
      // 延遲一下讓動畫跑完
      setTimeout(() => { isApplying.value = false; }, 2000);
    }
  };

  onMounted(() => fetchFileList());

  return {
    fileList, currentDir, openFiles, activeFile, activeFilePath,
    uploadProgress,
    fetchFileList, goParentDir, selectNode, closeFile, updateContent, saveFile,
    handleFileUpload,
    uploadFileToCurrentDir: (name, content) => uploadFile(`${currentDir.value}/${name}`, content),
    applySystemChanges,
    isApplying
  };
}