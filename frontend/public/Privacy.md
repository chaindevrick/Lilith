# 隱私權政策 / Privacy Policy

本政策旨在符合《歐盟一般資料保護規則》(GDPR) 及《加州消費者隱私法》(CCPA) 等相關隱私法規，保護您的個人資料。
This policy aims to comply with privacy regulations such as the GDPR and CCPA to protect your personal data.

## 1. 資料收集與目的 (Data Collection and Purpose)

* 為提供系統的核心功能（包括連續記憶與動態人格演化），我們會收集您的**對話歷史、金鑰設定 (API Keys)、以及透過編輯器修改的檔案內容**。
  To provide core features (including continuous memory and dynamic personality evolution), we collect your **chat history, API Keys, and file contents modified via the editor**.
* **本機端優先 (Local-First):** 上述資料預設皆儲存於您部署本系統的伺服器或本機端 (SQLite/JSON)。除非您主動啟用雲端同步或特定的外部技能 (如 Web Search)，否則資料不會離開您的主機。
  The aforementioned data is stored by default on your local or deployed server (SQLite/JSON). Unless you actively enable cloud sync or specific external skills, your data does not leave your host.

## 2. 第三方 API 與資料傳輸 (Third-Party APIs and Data Transfer)

* 當您填入並使用第三方模型 API (如 OpenAI, Anthropic, Gemini, Nano Banana) 時，您的對話內容將被傳送至這些服務商。您應自行參閱並同意該服務商之隱私政策。
  When you input and use third-party model APIs, your chat content will be transmitted to these providers. You should review and agree to their respective privacy policies.

## 3. 資料不出售聲明 (Do Not Sell My Info)

* 開發者保證，絕對不會將您的個人資料、API 金鑰或對話紀錄出售給任何第三方資料代理商或廣告商。
  The developer guarantees that your personal data, API keys, or chat logs will never be sold to any third-party data brokers or advertisers.

## 4. 您的權利 (Your Rights)

* 您可以隨時透過系統介面或刪除本地端之資料庫檔案，行使您的**被遺忘權 (刪除權)**。
  You can exercise your **Right to Erasure** at any time via the system interface or by deleting the local database files.

> ⚠️ **嚴格安全警告 (STRICT SAFETY WARNING)：** > 儘管資料儲存於本地，但由於對話會經過雲端 LLM 處理，請**絕對不要**在對話中輸入您的真實姓名、身分證字號、信用卡號、密碼或醫療紀錄 (PHI)。
> Although data is stored locally, since chats are processed by cloud LLMs, **ABSOLUTELY DO NOT** input your real name, SSN, credit card numbers, passwords, or medical records (PHI) in the chat.