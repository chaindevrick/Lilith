#!/bin/bash

# 定義粉紅色與重置顏色
PINK='\033[1;35m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo -e "${PINK}========================================================${NC}"
echo -e "${PINK}                ✨ Lilith OS Boot Sequence ✨          ${NC}"
echo -e "${PINK}========================================================${NC}"
echo ""
echo -e "${CYAN}[System] 正在檢查環境依賴 (Checking environment dependencies)...${NC}"

# 檢查 Node.js 是否已安裝
if ! command -v node &> /dev/null; then
    echo -e "${RED}[Warning] 系統未偵測到 Node.js。${NC}"
    echo -e "${CYAN}[System] 準備自動安裝 Node.js，請在下方輸入您的電腦密碼授權：${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS 偵測
        if ! command -v brew &> /dev/null; then
            echo -e "${RED}[Error] 找不到 Homebrew，無法自動安裝。請手動前往 https://nodejs.org/ 下載。${NC}"
            exit 1
        fi
        brew install node
    elif command -v apt-get &> /dev/null; then
        # Debian/Ubuntu 偵測
        sudo apt-get update
        sudo apt-get install -y nodejs npm
    elif command -v pacman &> /dev/null; then
        # Arch Linux 偵測
        sudo pacman -S --noconfirm nodejs npm
    elif command -v dnf &> /dev/null; then
        # Fedora/RHEL 偵測
        sudo dnf install -y nodejs npm
    else
        echo -e "${RED}[Error] 找不到支援的套件管理工具。請手動安裝 Node.js。${NC}"
        exit 1
    fi
    
    echo -e "${PINK}[System] ✅ Node.js 自動安裝完成！${NC}"
fi

echo -e "${PINK}[System] ✅ 環境檢查通過：Node.js 已就緒。${NC}"
echo ""

echo -e "${CYAN}[System] 1/4 正在下載套件並編譯前端 (Download & Build Frontend)...${NC}"
cd frontend || exit
npm install
npm run build
cd ..

echo ""
echo -e "${CYAN}[System] 2/4 正在整合前端靜態檔案至後端 (Copy Static Files)...${NC}"
# 清空舊資料，建立新目錄並複製檔案
rm -rf backend/public
mkdir -p backend/public
cp -r frontend/dist/* backend/public/
echo -e "${PINK}[System] ✅ 前端檔案複製完成。${NC}"

echo ""
echo -e "${CYAN}[System] 3/4 正在準備後端與外掛套件 (Backend Setup)...${NC}"
cd backend || exit
npm install

echo ""
echo -e "${PINK}[System] 4/4 正在啟動 Lilith...${NC}"
node main.js