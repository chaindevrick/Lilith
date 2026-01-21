# ==========================================
# 階段 1: 建置前端 (Frontend Builder)
# ==========================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# 1. 安裝前端依賴
COPY frontend/package*.json ./
RUN npm install

# 2. 複製前端源碼並打包 (Vite Build)
COPY frontend/ ./
RUN npm run build

# ==========================================
# 階段 2: 設定後端並運行 (Backend Runtime)
# ==========================================
FROM node:22-alpine

# 我們將容器內的工作目錄設為 /app，這裡將會對應到您的代碼邏輯中的 PROJECT_ROOT
WORKDIR /app

# 1. 安裝後端依賴
COPY backend/package*.json ./
RUN npm install

# 2. 複製後端程式碼
# 將本機 backend/ 資料夾內的所有內容，複製到容器的 /app/
COPY backend/ ./

# 3. 整合前端靜態檔案
COPY --from=frontend-builder /app/frontend/dist ./public

# 4. 建立必要的資料夾 (對應 Volume 掛載點)
RUN mkdir -p logs data backups share

# 5. 開放埠號
EXPOSE 8080

# 6. 啟動 Lilith
CMD ["node", "main.js"]