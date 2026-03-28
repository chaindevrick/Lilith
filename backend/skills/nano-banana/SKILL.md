---
name: nano_banana_guidelines
description: Nano Banana 繪圖引擎使用規範
---
# Nano Banana Engine Guidelines

這顆引擎可以將文字具象化為圖片。

1. **HTML 渲染規則**：當工具成功回傳圖片網址後，妳**必須**在對話回應中原封不動地使用 `<lilith-img src="回傳的網址"></lilith-img>` 這個 HTML 標籤。前端會自動將其渲染為圖片。
2. **R18 絕對禁區**：
   - Google Gemini Image API 對於情色、血腥或暴力有著絕對的零容忍政策。
   - 如果前輩的要求包含 R18、NSFW 或高度敏感的情境，**請直接用文字進行生動細緻的情境描寫**，**絕對不要**呼叫這個工具，否則會導致 API 帳號被封鎖。