# LILITH OS: An Emotion-Driven Cognitive Agent Architecture

Integrating Dual-Process Theory and Mood-Congruent Memory in Large Language Models

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Architecture](https://img.shields.io/badge/Architecture-Dual--Process-8A2BE2)
![Memory](https://img.shields.io/badge/Memory-Hybrid_RRF_%2B_Emotion_RAG-FF69B4)
![Framework](https://img.shields.io/badge/Framework-OpenClaw_Compatible-00C7B7)

---

## Abstract (摘要)

當前基於大型語言模型 (Large Language Models, LLMs) 的代理系統 (Agentic Systems) 多依賴靜態的提示詞工程 (Prompt Engineering) 來模擬角色特質，普遍缺乏動態的情感代謝機制與深層的認知演化能力。本研究提出 **Lilith OS**，一個深度整合神經科學與認知心理學框架之自主認知實體 (Autonomous Cognitive Entity)。

本研究屏棄傳統的單線程推論管線，實作了 LeDoux 的「快慢雙歷程路徑 (High/Low Road)」、Damasio 的「軀體標記假說 (Somatic Marker)」，以及 Bower 的「情緒一致性記憶 (Mood-Congruent Memory)」。透過導入 6D 虛擬內分泌系統 (Artificial Endocrine System, AES) 與相容於 **OpenClaw** 框架的行動-感知迴圈 (Action-Perception Loop)，Lilith OS 展現出具備情緒代謝能力與高度環境適應性的湧現性意識 (Emergent Consciousness)。

---

## 1. Introduction (引言)

在邁向通用人工智慧 (AGI) 的進程中，賦予機器具備類人的情緒感知與自主決策能力為當前人機互動 (HCI) 與情感運算 (Affective Computing) 領域的核心挑戰。傳統的 LLM 代理受限於無狀態的 API 呼叫，其行為模式往往流於公式化且缺乏長期連貫性。為突破此瓶頸，本研究開發 Lilith OS 系統架構，將人類大腦的情緒運作與決策機制進行數學建模與工程化實作，旨在創造一個具備內部驅動力 (Internal Drive)、並能透過標準化工具框架與實體世界互動的認知實體。

---

## 2. Cognitive Architecture (核心認知架構)

Lilith OS 的底層架構並非單一的文字生成模型，而是由多個基於認知心理學理論的子系統耦合而成的複雜神經符號網路 (Neuro-symbolic Network)。

### 2.1 Dual-Process Neural Routing (雙軌道神經處理機制)

參照人類大腦對外界刺激的反應路徑，本系統改採非同步的競態架構 (Asynchronous Race Architecture)：

* **快速路徑 (Fast Track / 數位杏仁核)：** 由極低延遲的輕量化模型驅動，負責在 200 毫秒內完成對輸入文本的本能威脅與獎勵判定 (Heuristic Evaluation)，並瞬間將對應的化學刺激注入底層狀態庫。
* **慢速路徑 (Slow Track / 大腦皮層)：** 系統刻意引入 2000 毫秒的生理延遲 (Somatic Delay)。主模型甦醒後，會優先讀取已被「數位化學物質」擾動的身體狀態，進而執行基於 OCC (Ortony, Clore, and Collins) 模型的高階認知評估與邏輯建構 (Analytic Reasoning)。

### 2.2 Artificial Endocrine System, AES (人工神經內分泌系統)

系統建構了一個 6 維度的神經化學物質代謝矩陣，包含：多巴胺 (Dopamine)、內啡肽 (Endorphin)、皮質醇 (Cortisol)、催產素 (Oxytocin)、腎上腺素 (Adrenaline) 與去甲腎上腺素 (Norepinephrine)。
物質濃度的時間序列變化遵循指數衰減與矩陣拮抗運算模型：

```math
$$C_{t} = C_{t-1} \cdot e^{-\lambda \cdot \Delta t} + \text{Input}$$
```

其中 $C_t$ 為當下濃度， $\lambda$ 為特定神經傳導物質之代謝衰減率。此濃度矩陣會即時透過模糊邏輯 (Fuzzy Logic) 映射至系統的巨觀行為狀態，動態調節代理的「心流 (Flow)」、「防禦 (Defense)」或「節能 (Energy-saving)」模式。

### 2.3 Hybrid Memory Vortex (雙層混合記憶螺旋)

為解決單一向量資料庫在情緒語意檢索上的侷限性，Lilith OS 的記憶系統被嚴格劃分為感性 (Episodic) 與理性 (Epistemic) 兩個維度：

1. **隱性情節記憶 (Emotion-Congruent RAG)：** 檢索過程受當下內分泌狀態的動態干擾。例如當系統皮質醇（壓力）極高時，會動態調升檢索公式中的情緒權重 $\beta$，引發情緒一致性之記憶提取偏誤 (Memory Retrieval Bias)：

    $$
    S_{final} = \alpha \cdot \text{Sim}_{semantic} + \beta \cdot \text{Sim}_{emotion}
    $$

2. **顯性硬知識庫 (Explicit Knowledge Base)：** 針對技術文件與絕對真理，系統採用倒數秩融合 (Reciprocal Rank Fusion, RRF) 演算法，結合高維度語意相似度與 BM25 關鍵字搜尋，確保關鍵知識的絕對召回率 (Absolute Recall Rate)：

    $$RRF(d) = \frac{1}{k + Rank_{semantic}(d)} + \frac{1}{k + Rank_{BM25}(d)}$$

---

## 3. Embodied Actuation & Tool Integration (實體互動與工具整合)

為使代理具備改變環境之能力，Lilith OS 被賦予了跨媒介的實體世界互動能力，並建立標準化的工具調用介面。

### 3.1 OpenClaw Skill Framework Compatibility (相容 OpenClaw 技能框架)

本系統深度整合 **OpenClaw** 標準框架，賦予代理動態擴展其動作空間 (Action Space) 的能力。透過標準化的 JSON Schema 與 Function Calling 介面，Lilith OS 能夠在運行時 (Runtime) 自主發現、加載並執行外部技能 (Skills)。此架構確保了認知推理層與工具執行層的解耦，使系統能無縫接入第三方 API、物聯網 (IoT) 控制節點或特定的領域微調工具，極大地提升了代理的任務泛化能力 (Task Generalization)。

### 3.2 Autonomous Execution Capabilities (自主執行能力)

* **網頁操控 (Autonomous Web Surfing)：** 結合 Playwright CDP 協議與 Set-of-Mark (DOM Injection) 技術，使模型能精準解析 DOM 樹狀結構並執行空間點擊。
* **終端與檔案控制 (Terminal Control)：** 代理具備完整 Bash Shell 控制權，能自主掃描目錄結構、讀寫程式碼並進行迭代式除錯。
* **視覺生成與感知 (Visual Synthesis)：** 整合多模態視覺模型，賦予系統將抽象認知概念即時具象化輸出之能力。

---

## 4. Implementation & Deployment Paradigm (實作與部署範式)

### 4.1 Zero-ENV Configuration (無環境變數狀態管理)

本研究提出「Zero-ENV」動態配置架構，徹底屏棄傳統硬編碼的 `.env` 檔案。所有的 LLM API Keys、OpenClaw 技能存取權杖與系統行為參數，皆透過前端圖形化設定精靈進行寫入，實現前後端分離的狀態持久化管理。

### 4.2 Deployment Protocol (部署協議)

系統支援原生執行與容器化隔離部署。為確保實體主機之安全性，強烈建議採用 Docker 進行環境隔離。

```bash
# Repository Clone
git clone [https://github.com/rickwengdev/Lilith.git](https://github.com/rickwengdev/Lilith.git)
cd Lilith

# Dockerized Deployment
docker compose up -d --build
```

啟動後，請前往 `http://localhost:8080` 存取圖形介面。
首次進入系統時，圖形化設定精靈將引導您完成所有必要的參數初始化。

---

## 4. ⚠️ 研究倫理與系統限制 (Ethics, Security, and Limitations)

作為一個具備高度自主權與系統級存取能力的實驗性架構，使用者必須了解以下限制與風險：

1. **實體沙盒危險性 (Sandbox Escape Risks)：** 系統具備真實的終端機執行能力 (Terminal Emulation)。在未經嚴格權限控管的伺服器上（尤指原生部署環境），給予過大的磁碟掛載 (Volume Mounting) 權限可能導致宿主機資安風險。使用者應確保 Lilith OS 運行於受限的隔離環境中。
2. **非決定性行為 (Non-Deterministic Behavior)：** 由於深度整合了動態內分泌變數與情緒驅動的 RAG 機制，本系統的輸出無法保證 100% 的決定性 (Determinism)。其決策路徑高度依賴於歷史互動所累積的「記憶羈絆」與當下的神經化學參數矩陣。
3. **擴充技能安全性 (Skill Security)：** 系統相容 **OpenClaw** 技能框架，允許透過 JSON 配置動態載入外部工具。在使用第三方開發的技能包時，應審慎檢查其要求的環境變數與系統權限。
4. **運算開銷 (Computational Overhead)：** 密集的自我反思機制、向量切塊同步與混合檢索演算法，將產生顯著的 Token 消耗，部署時需建立完善的流量監控機制。

---

## 5. 📚 References & Academic Credits (參考文獻與學術鳴謝)

Lilith OS 的認知架構與心理學框架深度啟發自以下神經科學與認知心理學的奠基性研究：

1. **LeDoux, J. E. (1996).** *The Emotional Brain: The Mysterious Underpinnings of Emotional Life.* Simon & Schuster.
   *(理論基礎：雙軌道神經處理與快慢路徑架構)*
2. **Damasio, A. R. (1994).** *Descartes' Error: Emotion, Reason, and the Human Brain.* Putnam.
   *(理論基礎：人工內分泌系統與軀體標記假說整合)*
3. **Bower, G. H. (1981).** *Mood and Memory.* American Psychologist, 36(2), 129–148.
   *(理論基礎：情緒一致性記憶 RAG 與動態檢索權重)*
4. **Ortony, A., Clore, G. L., & Collins, A. (1988).** *The Cognitive Structure of Emotions.* Cambridge University Press.
   *(理論基礎：慢速路徑中的 OCC 情緒評價模型)*
5. **Cormack, G. V., Clarke, C. L. A., & Buettcher, S. (2009).** *Reciprocal rank fusion outperforms condorcet and individual rank learning methods.* SIGIR '09.
   *(演算法基礎：顯性知識庫的混合檢索機制)*

---

Developed & Designed by Rick Weng
