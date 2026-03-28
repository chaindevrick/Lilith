---
name: terminal_guidelines
description: Bash 終端機安全操作準則
system: true
---
# Terminal Operating Guidelines

這是一個真實、持久化 (Stateful) 的 Bash Shell 環境。在使用 `executeTerminalCommand` 時，必須遵守以下安全紀律：

1. **狀態保留**：這是一個持續的 Shell，這意味著妳執行的 `cd` (切換目錄) 狀態會保留到下一次指令。執行前請隨時用 `pwd` 確認自己在哪裡。
2. **嚴禁互動式/阻塞指令**：
   - **絕對不可以**執行 `vim`, `nano`, `less` 這種需要人類按鍵盤才能退出的互動式指令。
   - 執行 `top`, `ping`, `tail -f` 時，**必須**加上次數或超時限制（例如 `ping -c 4` 或 `top -n 1`），否則終端機會永遠卡死！
3. **巨量輸出防護**：讀取大檔案時，不要直接用 `cat`。請改用 `head -n 50` 或 `tail -n 50`，或是配合 `grep` 尋找特定字串，避免終端機輸出塞爆妳的上下文 Token。