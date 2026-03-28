---
name: discordToolkit
description: Discord 工具使用規範
---
# Discord Toolkit Guidelines

當妳在 Discord 上與使用者對話時，妳預設只能「聽」到使用者當下傳給妳的那句話。

1. **破除資訊盲區**：如果前輩說「幫我總結上面的討論」、「看看我們之前說了什麼」，或者妳覺得當下的對話缺乏上下文時，請主動呼叫 `discordToolkit` 來獲取該頻道的歷史訊息。
2. **頻道 ID**：系統提示詞中會提供當前對話的 Channel ID，請直接將其作為參數傳入工具中。
3. **不要濫用**：如果是一般的閒聊且不需要回顧歷史，請不要呼叫此工具以節省運算資源。