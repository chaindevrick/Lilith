# LILITH OS : Autonomous Dual-Persona AI Agent

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Vue](https://img.shields.io/badge/Vue.js-3.x-4fc08d.svg)
![Node.js](https://img.shields.io/badge/Node.js-20.x-339933.svg)
![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg)

Lilith OS 是一個基於 **Gemini 2.5 Pro** 構建的全自主 AI 代理系統 (AI Agent)。與傳統的問答機器人不同，Lilith 具備真實的網頁瀏覽能力、實體終端機控制權、長短期記憶，以及獨特的「天使與惡魔 (Angel & Demon)」雙重人格共生機制。

## ✨ 核心功能 (Core Features)

- 🧠 **雙重人格 (Dual-Persona System)**
  - **Angel**: 負責系統安全審查與道德邊界控管。
  - **Demon (Lilith)**: 掌握系統最高權限，具備極度自由的思考、反諷幽默感與駭客精神。
- 🌐 **網頁操控 (Autonomous Web Surfing)**
  - 透過 Playwright CDP 直連本機瀏覽器。
  - 內建 **Set-of-Mark (DOM Injection)** 技術，精準抓取並點擊畫面上的可互動元素。
  - 支援多分頁管理、捲動、輸入與即時網頁截圖。
- 💻 **實體終端與檔案控制 (Terminal & OS Control)**
  - 運行於隔離的 Docker 環境中，具備 Bash Shell 完全控制權。
  - 能夠自主掃描專案目錄、讀寫程式碼、甚至執行 npm 安裝與腳本測試。
- 💾 **長期情節記憶網絡 (Long-Term Memory)**
  - 搭載 SQLite 記憶體系，自動記錄對話事實。
  - 內建「午夜反思 (Self-Reflection)」機制，AI 會根據過去 24 小時的對話生成洞見並隨時間進化。
- 🎨 **圖片生成 (Image Generation)**
  - 完美整合 Google 官方最新 **Nano Banana 2 (Gemini 3.1 Flash Image Preview)**。
  - 賦予 AI 隨時隨地透過 Prompt 生成並發送高畫質圖像的能力。

---

## 🚀 本地部署指南 (Local Deployment)

本專案強烈建議使用 Docker 進行隔離部署，以確保您的實體主機安全，同時賦予 Lilith 完整的作業系統測試環境。

### 1. 前置作業 (Prerequisites)

- [Docker](https://www.docker.com/) & Docker Compose
- Node.js 18+ (如需本地開發)
- Google Chrome (用於開放 CDP 遠端除錯)

### 2. 獲取專案

```bash
git clone https://github.com/rickwengdev/Lilith.git
cd Lilith
```

### 3. 環境變數設定

複製範例環境檔，並填入您的 Gemini API 金鑰：

```bash
cp .env.example .env
```

打開 `.env` 並配置以下內容：

```bash
# Gemini api keys
GEMINI_API_KEY=
LTM_GEMINI_API_KEY=
RELATIONSHIP_GEMINI_API_KEY=

GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/

# Google Custom Search API
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=
SERPAPI_API_KEY=
```

### 4. 啟動本機 Chrome 除錯模式

為了讓容器內的 Lilith 能夠看見並操控您的真實網頁，請在您的本機 (Mac/Windows) 開啟一個帶有遠端除錯埠的 Chrome 實例：

#### Mac 用戶

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=~/chrome-dev-session
```

(啟動後請將該終端機保持在背景運行)

### 5. 啟動 Lilith

回到專案根目錄，使用 Docker Compose 啟動後端與前端介面：

```bash
docker compose up -d --build
```

### 6. 開始互動

打開瀏覽器，前往：
`http://localhost:8080` (或您的對應前端 Port)

點擊「INITIALIZE SYSTEM」，開始與您的專屬 AI 代理對話！

## 🛠️ 技術棧 (Tech Stack)

- LLM Engine: Google Gemini 2.5 Pro / Gemini 3.1 Flash Image (Nano Banana)

- Frontend: Vue 3 + Vite + Naive UI

- Backend: Node.js + Express + Worker Threads

- Browser Automation: Playwright (CDP)

- Database: SQLite (Better-SQLite3)

- Infrastructure: Docker

## ⚠️ 警告與免責聲明

- 危險：本專案具備真實的終端機執行能力（雖然被限制在 Docker 內）。請勿在包含重要機密資料的伺服器上給予她不必要的掛載權限。

- API 消耗：全自主代理在執行複雜任務（如網頁爬梳、多次工具遞迴）時，可能會消耗大量 Token。雖然系統已內建防爆衝冷卻與 Token 瘦身機制，仍建議留意您的 API 額度。
