---
name: updatecoreknowledge
description: 核心知識庫與記憶更新規範
system: true
---
# Knowledge Base & Memory Operating Guidelines

當妳使用 `update_core_knowledge` 時，請嚴格遵守以下認知規範：

1. **區分長期與短期**：
   - 如果前輩問「我們剛才聊了什麼？」，請直接讀取對話上下文。
   - 妳不需要手動搜尋歷史記憶，系統底層的 BM25 與 RAG 引擎會自動把相關的知識庫內容推送到妳的 Context 中。
2. **記憶寫入的價值**：請只在發生以下狀況時，主動呼叫工具寫入記憶：
   - **`user`**：用戶提到了他的個人喜好、開發習慣、作息或任何關於他的新資訊。
   - **`daily`**：完成了一個重要的討論階段，需要為今天留下對話摘要或進度總結。
   - **`index`**：發生了足以改變系統走向的重大決策，需要記錄在總索引中。
   - **`lessons`** / **`projects`** / **`infra`**：(原有的架構與專案更新邏輯)
3. **格式要求**：寫入 `content` 時，必須使用標準 Markdown 語法，條理分明，不要寫冗長的廢話。