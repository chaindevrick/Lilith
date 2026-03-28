@echo off
chcp 65001 > nul
:: 設定終端機顏色為淺紫色 (Light Magenta)
color 0D

echo ========================================================
echo                 ✨ Lilith OS Boot Sequence ✨
echo ========================================================
echo.
echo [System] 正在檢查環境依賴 (Checking environment dependencies)...

:: 檢查 Node.js 是否已安裝
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [Warning] 系統未偵測到 Node.js。
    echo [System] 正在嘗試使用 Windows 內建套件管理員 (winget) 自動安裝...
    echo [System] (若畫面跳出管理員權限請求，請點選「是」)
    winget install OpenJS.NodeJS -e --source winget
    
    if %ERRORLEVEL% neq 0 (
        echo [Error] 自動安裝失敗，請手動前往 https://nodejs.org/ 安裝 Node.js 後再重試。
        pause
        exit /b
    )
    
    echo [System] ✅ Node.js 安裝完成！
    echo [System] ⚠️ 請重新啟動此批次檔以完成環境設定。
    pause
    exit /b
)

echo [System] ✅ 環境檢查通過：Node.js 已就緒。
echo.

echo [System] 1/4 正在下載套件並編譯前端 (Download ^& Build Frontend)...
cd frontend
call npm install
call npm run build
cd ..

echo.
echo [System] 2/4 正在整合前端靜態檔案至後端 (Copy Static Files)...
:: 先清空舊的 public 資料夾，避免殘留舊檔案
if exist "backend\public" rmdir /s /q "backend\public"
mkdir "backend\public"
:: 將前端打包好的 dist 內容安靜地複製過去 (>nul 隱藏長串複製訊息)
xcopy /E /I /Y "frontend\dist\*" "backend\public\" >nul
echo [System] ✅ 前端檔案複製完成。

echo.
echo [System] 3/4 正在準備後端與外掛套件 (Backend Setup)...
cd backend
call npm install

echo.
echo [System] 4/4 正在啟動 Lilith...
node main.js

pause