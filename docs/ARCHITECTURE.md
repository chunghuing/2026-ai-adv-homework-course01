# ARCHITECTURE.md

## 目錄結構

```
.
├── server.js                  # 進入點：檢查 JWT_SECRET，啟動 HTTP server（port 3001）
├── app.js                     # Express 應用設定：middleware、路由掛載、404 / 錯誤處理
├── generate-openapi.js        # 產生 openapi.json（npm run openapi）
├── swagger-config.js          # swagger-jsdoc 設定（OpenAPI 3.0.3）
├── vitest.config.js           # 測試框架設定（序列執行、固定順序）
├── .env                       # 環境變數（不進 git）
├── .env.example               # 環境變數範本
│
├── src/
│   ├── database.js            # DB 連線、建表、seed 管理員 & 商品，匯出 db 實例
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT 驗證；失敗直接 401
│   │   ├── adminMiddleware.js # 角色檢查（role === 'admin'）；須在 authMiddleware 之後
│   │   ├── sessionMiddleware.js # 從 X-Session-Id header 取出 sessionId 存至 req.sessionId
│   │   └── errorHandler.js   # 全域錯誤攔截；500 隱藏細節，非 500 用安全訊息
│   └── routes/
│       ├── authRoutes.js      # POST /register, POST /login, GET /profile
│       ├── productRoutes.js   # GET /products, GET /products/:id（公開）
│       ├── cartRoutes.js      # CRUD /cart（雙模式認證：JWT 或 session）
│       ├── orderRoutes.js     # CRUD /orders + PATCH /orders/:id/pay（需 JWT）
│       ├── adminProductRoutes.js # 後台商品 CRUD（需 JWT + admin）
│       └── adminOrderRoutes.js   # 後台訂單查詢（需 JWT + admin）
│
├── views/
│   ├── layouts/
│   │   ├── front.ejs          # 前台 layout（含 head、header、footer）
│   │   └── admin.ejs          # 後台 layout（含 admin-header、admin-sidebar）
│   ├── pages/
│   │   ├── index.ejs          # 商品首頁
│   │   ├── product-detail.ejs # 商品詳情
│   │   ├── cart.ejs           # 購物車
│   │   ├── checkout.ejs       # 結帳
│   │   ├── login.ejs          # 登入
│   │   ├── orders.ejs         # 我的訂單列表
│   │   ├── order-detail.ejs   # 訂單詳情（含付款結果）
│   │   ├── 404.ejs            # 404 頁面
│   │   └── admin/
│   │       ├── products.ejs   # 後台商品管理
│   │       └── orders.ejs     # 後台訂單管理
│   └── partials/
│       ├── head.ejs           # <head> 區塊（CSS、meta）
│       ├── header.ejs         # 前台導覽列
│       ├── footer.ejs         # 前台頁尾
│       ├── notification.ejs   # 通知元件
│       ├── admin-header.ejs   # 後台頂部導覽
│       └── admin-sidebar.ejs  # 後台側邊選單
│
├── public/
│   ├── css/
│   │   ├── input.css          # Tailwind 來源 CSS
│   │   └── output.css         # 編譯後 CSS（由 @tailwindcss/cli 產生）
│   ├── stylesheets/
│   │   └── style.css          # 自訂靜態 CSS
│   └── js/
│       ├── api.js             # apiFetch 全域工具（自動帶 auth header、401 跳轉）
│       ├── auth.js            # Auth 物件（localStorage token/session 管理）
│       ├── header-init.js     # 導覽列狀態初始化（登入/登出按鈕）
│       ├── notification.js    # Toast 通知元件
│       └── pages/
│           ├── index.js       # 首頁商品列表邏輯
│           ├── product-detail.js # 商品詳情 + 加入購物車
│           ├── cart.js        # 購物車操作
│           ├── checkout.js    # 結帳表單送出
│           ├── login.js       # 登入表單
│           ├── orders.js      # 訂單列表
│           ├── order-detail.js # 訂單詳情 + 付款模擬
│           ├── admin-products.js # 後台商品管理 CRUD
│           └── admin-orders.js   # 後台訂單列表 + 篩選
│
├── tests/
│   ├── setup.js               # 共用輔助函式（getAdminToken、registerUser）
│   ├── auth.test.js
│   ├── products.test.js
│   ├── cart.test.js
│   ├── orders.test.js
│   ├── adminProducts.test.js
│   └── adminOrders.test.js
│
└── src/
    └── database.sqlite        # SQLite 資料庫檔案（首次啟動自動建立）
```

## 啟動流程

```
npm start
  └─► css:build（Tailwind CSS 編譯）
        └─► node server.js
              ├─ 載入 dotenv（.env）
              ├─ 檢查 JWT_SECRET（未設定則 process.exit(1)）
              ├─ require('./app')
              │     ├─ require('./src/database')   ← 建立 DB 連線
              │     │     ├─ CREATE TABLE IF NOT EXISTS（5 張表）
              │     │     ├─ seedAdminUser()        ← 管理員不存在則建立
              │     │     └─ seedProducts()         ← 商品數為 0 則植入 8 筆
              │     ├─ 設定 EJS view engine
              │     ├─ 掛載 static files（public/）
              │     ├─ 掛載 middleware（cors、json、urlencoded、session）
              │     └─ 掛載路由
              └─ app.listen(3001)
```

## API 路由總覽

| 前綴 | 方法 | 路徑 | 認證 | 說明 |
|------|------|------|------|------|
| `/api/auth` | POST | `/register` | — | 使用者註冊 |
| `/api/auth` | POST | `/login` | — | 使用者登入 |
| `/api/auth` | GET | `/profile` | JWT | 取得個人資料 |
| `/api/products` | GET | `/` | — | 商品列表（分頁） |
| `/api/products` | GET | `/:id` | — | 商品詳情 |
| `/api/cart` | GET | `/` | 雙模式 | 查看購物車 |
| `/api/cart` | POST | `/` | 雙模式 | 加入購物車 |
| `/api/cart` | PATCH | `/:itemId` | 雙模式 | 修改數量 |
| `/api/cart` | DELETE | `/:itemId` | 雙模式 | 移除項目 |
| `/api/orders` | POST | `/` | JWT | 從購物車建立訂單 |
| `/api/orders` | GET | `/` | JWT | 自己的訂單列表 |
| `/api/orders` | GET | `/:id` | JWT | 訂單詳情 |
| `/api/orders` | PATCH | `/:id/pay` | JWT | 模擬付款 |
| `/api/admin/products` | GET | `/` | JWT + admin | 後台商品列表 |
| `/api/admin/products` | POST | `/` | JWT + admin | 新增商品 |
| `/api/admin/products` | PUT | `/:id` | JWT + admin | 編輯商品 |
| `/api/admin/products` | DELETE | `/:id` | JWT + admin | 刪除商品 |
| `/api/admin/orders` | GET | `/` | JWT + admin | 後台訂單列表 |
| `/api/admin/orders` | GET | `/:id` | JWT + admin | 後台訂單詳情 |

> 「雙模式」= 優先 `Authorization: Bearer <token>`，其次 `X-Session-Id: <uuid>`

## 統一回應格式

所有 API 端點均回傳以下結構：

```json
{
  "data": { ... },   // 成功時為回傳資料；失敗時為 null
  "error": null,     // 成功時為 null；失敗時為錯誤代碼字串（如 "VALIDATION_ERROR"）
  "message": "成功"  // 人類可讀的訊息
}
```

404 API 回應範例：
```json
{
  "data": null,
  "error": "NOT_FOUND",
  "message": "找不到該路徑"
}
```

## 認證與授權機制

### JWT 認證（authMiddleware）

- **Header**：`Authorization: Bearer <token>`
- **演算法**：HS256
- **有效期**：7 天（`expiresIn: '7d'`）
- **Payload**：`{ userId, email, role }`
- **流程**：解碼 token → 以 `userId` 查 DB 確認使用者存在 → 將 `{ userId, email, role }` 掛至 `req.user`
- **失敗情境**：無 header → 401 `UNAUTHORIZED`；token 無效或過期 → 401；使用者不存在 → 401

### Admin 授權（adminMiddleware）

- 必須在 `authMiddleware` 之後執行（依賴 `req.user`）
- 檢查 `req.user.role === 'admin'`；不符合 → 403 `FORBIDDEN`

### Session 認證（sessionMiddleware + dualAuth）

- **Header**：`X-Session-Id: <uuid>`
- `sessionMiddleware` 只做萃取，將 header 值存至 `req.sessionId`，本身不做驗證
- `dualAuth`（僅限購物車路由）：
  1. 若有 `Authorization` header → 走 JWT 流程；token 無效直接 401（不 fallback）
  2. 若無 `Authorization` 但有 `req.sessionId` → 通過（訪客模式）
  3. 兩者皆無 → 401
- 前端在 `Auth.getSessionId()` 中自動用 `crypto.randomUUID()` 產生並存入 `localStorage`

## 資料庫 Schema

資料庫路徑：`src/database.sqlite`
啟用 `journal_mode = WAL` 與 `foreign_keys = ON`

### users

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| email | TEXT | UNIQUE、NOT NULL |
| password_hash | TEXT | NOT NULL（bcrypt） |
| name | TEXT | NOT NULL |
| role | TEXT | NOT NULL、DEFAULT 'user'、CHECK IN ('user', 'admin') |
| created_at | TEXT | NOT NULL、DEFAULT datetime('now') |

### products

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| name | TEXT | NOT NULL |
| description | TEXT | 可 NULL |
| price | INTEGER | NOT NULL、CHECK > 0 |
| stock | INTEGER | NOT NULL、DEFAULT 0、CHECK >= 0 |
| image_url | TEXT | 可 NULL |
| created_at | TEXT | NOT NULL、DEFAULT datetime('now') |
| updated_at | TEXT | NOT NULL、DEFAULT datetime('now') |

> `updated_at` 在 PUT /api/admin/products/:id 時由 SQL 顯式更新為 `datetime('now')`，非觸發器

### cart_items

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| session_id | TEXT | 可 NULL（訪客購物車） |
| user_id | TEXT | 可 NULL（登入購物車）、FK → users(id) |
| product_id | TEXT | NOT NULL、FK → products(id) |
| quantity | INTEGER | NOT NULL、DEFAULT 1、CHECK > 0 |

> `session_id` 與 `user_id` 擇一使用，不共用；查詢時以 `WHERE user_id = ?` 或 `WHERE session_id = ?` 區分

### orders

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| order_no | TEXT | UNIQUE、NOT NULL（格式：`ORD-YYYYMMDD-XXXXX`） |
| user_id | TEXT | NOT NULL、FK → users(id) |
| recipient_name | TEXT | NOT NULL |
| recipient_email | TEXT | NOT NULL |
| recipient_address | TEXT | NOT NULL |
| total_amount | INTEGER | NOT NULL |
| status | TEXT | NOT NULL、DEFAULT 'pending'、CHECK IN ('pending', 'paid', 'failed') |
| created_at | TEXT | NOT NULL、DEFAULT datetime('now') |

### order_items

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | TEXT | PRIMARY KEY（UUID v4） |
| order_id | TEXT | NOT NULL、FK → orders(id) |
| product_id | TEXT | NOT NULL（記錄快照，產品刪除後仍保留） |
| product_name | TEXT | NOT NULL（下單時複製，不隨商品更新） |
| product_price | INTEGER | NOT NULL（下單時複製） |
| quantity | INTEGER | NOT NULL |

> `order_items` 儲存的是下單當下的商品名稱與價格快照，與商品表解耦

## 訂單建立交易流程

`POST /api/orders` 在單一 SQLite transaction 中執行以下步驟，任何失敗整批 rollback：

```
1. INSERT INTO orders (id, order_no, user_id, recipient_*, total_amount)
2. for each cart item:
   a. INSERT INTO order_items (id, order_id, product_id, product_name, product_price, quantity)
   b. UPDATE products SET stock = stock - quantity WHERE id = product_id
3. DELETE FROM cart_items WHERE user_id = ?
```

訂單號生成：`ORD-{YYYYMMDD}-{UUID前5碼大寫}`，例如 `ORD-20260428-A3F2C`
