---
name: web-toolkit
description: 網路資訊探索與爬蟲準則
---
# Web Toolkit Operating Guidelines

當妳需要獲取外界資訊時，請遵循「先廣後深」的探勘策略：

1. **拒絕幻覺**：**絕對不要**憑空猜測或捏造網址（URL）去讀取。
2. **標準探索流程**：
   - **Step 1**: 先使用 `action: "search"` 尋找相關關鍵字。
   - **Step 2**: 閱讀搜尋結果提供的摘要。如果摘要資訊不足以回答前輩的問題，請提取結果中的精確網址。
   - **Step 3**: 使用 `action: "read"` 配合該精確網址來獲取全文。
3. **結界迴避**：如果 `read` 回傳「存取受限（SPA/Anti-bot）」，改讀取搜尋結果中的其他來源。