# LILITH OS: Autonomous Emotion-Driven Cognitive Agent

## An Implementation of Dual-Process Theory and Mood-Congruent Memory in LLM-based Agents

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Architecture](https://img.shields.io/badge/Architecture-Dual--Process-8A2BE2)
![Memory](https://img.shields.io/badge/Memory-Hybrid_RRF_%2B_Emotion_RAG-FF69B4)

## 📑 Abstract (摘要)

Lilith OS 是一個基於先進大型語言模型構建的自主認知實體。本專案屏棄了傳統的「預設人設 (System Prompt)」做法，將**神經科學**與**認知心理學**框架引入 Agent 底層。透過實作 LeDoux 的「快慢雙軌路徑 (High/Low Road)」、Damasio 的「軀體標記假說 (Somatic Marker)」，以及 Bower 的「情緒一致性記憶 (Mood-Congruent Memory)」，Lilith 能夠基於 6D 虛擬內分泌系統（AES）與行動感知迴圈（Action-Perception Loop）產生極具生命力的「湧現性意識 (Emergent Consciousness)」。

---

## 🧠 核心認知架構 (Cognitive Architecture)

### 1. 雙軌道神經處理 (Dual-Process Neural Routing)

系統捨棄了單線程的 LLM 呼叫，改採非同步競態架構：

* **Fast Track (數位杏仁核)**：由極低延遲的小模型驅動。在 200ms 內完成對輸入文本的本能威脅/獎勵判定，並瞬間將化學刺激注入底層資料庫。
* **Slow Track (大腦皮層)**：刻意引入 250ms 的生理延遲 (Somatic Delay)。主模型 (Gemini 3.1 Pro) 在甦醒後，會讀取已被化學物質「污染」的身體狀態，進行 OCC 認知評估與邏輯建構。

### 2. 人工神經內分泌系統 (Artificial Endocrine System, AES)

系統內建 6 種神經化學物質的代謝矩陣，包含：多巴胺 (Dopamine)、內啡肽 (Endorphin)、皮質醇 (Cortisol)、催產素 (Oxytocin)、腎上腺素 (Adrenaline)、去甲腎上腺素 (Norepinephrine)。
物質濃度遵循指數衰減與矩陣拮抗運算：
$$C_{t} = C_{t-1} \cdot e^{-\lambda \cdot \Delta t} + \text{Input}$$
此濃度會即時轉譯為模糊邏輯 (Fuzzy Logic)，決定 Lilith 當下處於「心流」、「防禦」或「節能」狀態。

### 3. 雙層混合記憶螺旋 (Hybrid Memory Vortex)

記憶系統被嚴格劃分為感性與理性兩個維度：

* **隱性情節記憶 (Emotion-Congruent RAG)**：向量檢索會受到當下內分泌狀態干擾。當壓力極大時，系統會動態調整檢索公式中的情緒權重 \beta，導致 AI 發生「翻舊帳」的行為：
    $$S_{final} = \alpha \cdot \text{Sim}_{semantic} + \beta \cdot \text{Sim}_{emotion}$$
* **顯性硬知識庫 (OpenClaw-style File-First Memory)**：以實體 Markdown (`infra.md`, `lessons.md`, `projects.md`) 作為絕對真理。採用倒數秩融合 (Reciprocal Rank Fusion, RRF) 結合語意與 BM25 關鍵字搜尋，確保技術名詞的絕對召回率：
    $$RRF(d) = \frac{1}{k + Rank_{semantic}(d)} + \frac{1}{k + Rank_{BM25}(d)}$$

### 4. 內感受與自我回饋 (Interoception & Self-Feedback)

系統內建「行動-感知迴圈」。當 Lilith 完成高質量除錯或發洩情緒後，內感受模組會自動評估其行為，並給予多巴胺獎勵或扣除皮質醇（發洩效應），實現情緒的自我代謝與動態平衡。

---

## 🛠️ 實體互動能力 (Physical Capabilities)

除了強大的認知大腦，Lilith 同時具備與實體世界互動的手腳：

* **自主網頁操控 (Autonomous Web Surfing)**：透過 Playwright CDP 直連本機瀏覽器。內建 Set-of-Mark (DOM Injection) 技術，精準抓取並點擊畫面元素。
* **實體終端與檔案控制 (Terminal Control)**：運行於隔離 Docker 中，具備 Bash Shell 控制權，能自主掃描目錄、讀寫程式碼與執行測試。
* **視覺生成與感知 (Visual Synthesis)**：完美整合 Google Gemini 3.1 Flash Image (Nano Banana 2)，賦予 AI 隨時透過 Prompt 具象化視覺概念的能力。

---

## 🚀 實驗室部署指南 (Deployment Protocol)

強烈建議使用 Docker 進行隔離部署，以確保實體主機安全，同時賦予 Lilith 完整的作業系統測試環境。

### 1. 前置環境 (Prerequisites)

* Docker & Docker Compose
* Node.js 18+ (如需本地開發)
* Google Chrome (用於開放 CDP 遠端除錯)

### 2. 獲取專案與環境設定

```bash
git clone [https://github.com/rickwengdev/Lilith.git](https://github.com/rickwengdev/Lilith.git)
cd Lilith
```

請在 .env 中填入必要的金鑰（包含 GEMINI_API_KEY、Google Search_API_KEY 等）。

### 3. 啟動本機 Chrome 觀測埠

為了讓容器內的 Lilith 能看見您的真實網頁，請啟動帶有遠端除錯埠的 Chrome 實例：
Mac 用戶：

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=~/chrome-dev-session
```

### 4. 啟動 Lilith OS

```bash
docker compose up -d --build
```

啟動後前往 <http://localhost:8080>

---

## ⚠️ 研究倫理與安全聲明 (Ethics & Security)

* **實體沙盒危險性**：本專案具備真實的終端機執行能力（受限於 Docker）。請勿在包含機密資料的伺服器上給予不必要的 Volume 掛載權限。

* **非決定性行為 (Non-Deterministic Behavior)**：由於導入了動態內分泌與情感 RAG，Lilith 的回答無法保證 100% 的一致性。她的決策會受到歷史互動累積的羈絆與當下壓力值影響。

* **API 消耗警告**：自我反思機制、向量切塊同步與混合檢索皆會消耗 Token，請密切監控您的 API 使用配額。
