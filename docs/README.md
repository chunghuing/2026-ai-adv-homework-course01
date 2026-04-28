# 花卉電商網站

花卉電商全端應用，前後端整合於單一 Node.js/Express 服務。提供商品瀏覽、購物車（支援訪客與登入使用者）、結帳下單、模擬付款等完整電商流程，並附後台管理介面供管理員管理商品與訂單。

## 技術棧

| 層次 | 技術 |
|------|------|
| 伺服器框架 | Express 4.x |
| 模板引擎 | EJS 5.x（雙 layout：front / admin） |
| 資料庫 | SQLite（better-sqlite3 12.x，WAL 模式） |
| 認證 | JWT（jsonwebtoken 9.x，HS256，7 天有效期） |
| 密碼雜湊 | bcrypt（10 rounds，測試環境 1 round） |
| ID 生成 | UUID v4（uuid 11.x） |
| CSS | Tailwind CSS 4.x（@tailwindcss/cli） |
| 測試框架 | Vitest 2.x + Supertest 7.x |
| API 文件 | swagger-jsdoc 6.x（OpenAPI 3.0.3） |

## 快速開始

```bash
# 1. 安裝依賴
npm install

# 2. 設定環境變數
cp .env.example .env
# 編輯 .env，至少設定 JWT_SECRET

# 3. 啟動開發伺服器（需另開終端機跑 CSS）
npm run dev:server

# 另一個終端機
npm run dev:css

# 或一次啟動（建置 CSS 後啟動，不 watch）
npm start
```

伺服器預設埠號：**3001**
訪問 `http://localhost:3001`

管理員帳號（首次啟動自動建立）：
- Email：`admin@hexschool.com`（可由 `ADMIN_EMAIL` 覆蓋）
- 密碼：`12345678`（可由 `ADMIN_PASSWORD` 覆蓋）

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm start` | 建置 CSS 後啟動伺服器（生產用） |
| `npm run dev:server` | 僅啟動伺服器（不編譯 CSS） |
| `npm run dev:css` | 監聽 Tailwind CSS 變更 |
| `npm run css:build` | 一次性建置並壓縮 CSS |
| `npm test` | 執行全部測試（序列） |
| `npm run openapi` | 產生 `openapi.json` 規格文件 |

## 頁面路由

| 路徑 | 說明 |
|------|------|
| `/` | 商品首頁 |
| `/products/:id` | 商品詳情 |
| `/cart` | 購物車 |
| `/checkout` | 結帳 |
| `/login` | 登入 |
| `/orders` | 我的訂單 |
| `/orders/:id` | 訂單詳情（含付款結果） |
| `/admin/products` | 後台商品管理 |
| `/admin/orders` | 後台訂單管理 |

## 文件索引

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 架構、目錄結構、API 路由總覽、資料庫 schema |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、環境變數、計畫歸檔流程 |
| [FEATURES.md](./FEATURES.md) | 功能清單、行為描述、錯誤碼 |
| [TESTING.md](./TESTING.md) | 測試規範、執行順序、撰寫指南 |
| [CHANGELOG.md](./CHANGELOG.md) | 更新日誌 |
| [plans/](./plans/) | 進行中的開發計畫 |
| [plans/archive/](./plans/archive/) | 已完成計畫歸檔 |
