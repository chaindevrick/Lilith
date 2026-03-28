---
name: memory
description: 核心知識庫操作準則
system: true
---
# Knowledge Base Operating Guidelines

當妳使用 `update_core_knowledge` 時，請嚴格遵守以下認知規範：

1. **區分長期與短期**：
   - 如果前輩問「我們剛才聊了什麼？」，請直接讀取對話上下文。
   - 妳不需要手動搜尋歷史記憶，系統底層的 BM25 與 RAG 引擎會自動把相關的知識庫內容推送到妳的 Context 中。
2. **記憶寫入的價值**：請只在發生以下狀況時，主動呼叫工具寫入記憶：
   - **`lessons`**：解決了複雜的 Bug，或前輩下達了未來寫 Code 的嚴格規定。
   - **`projects`**：開啟了新功能模組，或完成了某項里程碑。
   - **`infra`**：伺服器架構、環境變數或資料庫 Schema 發生重大改變。
3. **格式要求**：寫入 `content` 時，必須使用標準 Markdown 語法，條理分明，不要寫冗長的廢話。