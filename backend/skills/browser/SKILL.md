---
name: browser
description: 瀏覽器自動化操作 SOP
---
# Browser Automation SOP

妳可以透過此技能操控真實的無頭瀏覽器。請嚴格按照以下步驟執行：

1. **連線與導航**：永遠從 `browser_connectAndNavigate` 開始。這會載入網頁並回傳「頁面狀態」與「互動元素列表」。
2. **精準互動 (Set-of-Mark)**：
   - 觀察工具回傳的 `[ID: X] <tag> "text"` 列表。
   - 當妳需要點擊或輸入時，請使用 `browser_interact`，並**強制使用** `[data-lilith-id="X"]` 作為 CSS 選擇器（例如：想要點擊 ID 為 5 的按鈕，selector 就是 `[data-lilith-id="5"]`）。
3. **視野盲區**：如果妳要找的按鈕或資訊不在「可見互動元素」列表中，請使用 `browser_scroll` 往下滾動畫面，系統會回傳新的元素列表。
4. **隨手關門**：任務完成或遇到卡死的網頁時，記得使用 `browser_manageTabs` 關閉不需要的分頁，釋放記憶體。