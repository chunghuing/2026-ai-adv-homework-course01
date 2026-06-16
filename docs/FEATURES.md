# FEATURES.md

## 功能清單與完成狀態

| 功能區塊 | 狀態 |
|----------|------|
| 使用者認證 | ✅ 完成 |
| 商品瀏覽 | ✅ 完成 |
| 購物車（雙模式） | ✅ 完成 |
| 訂單建立與查詢 | ✅ 完成 |
| 模擬付款 | ✅ 完成 |
| 後台商品管理 | ✅ 完成 |
| 後台訂單管理 | ✅ 完成 |
| 綠界金流整合（AIO） | ✅ 完成 |

---

## 1. 使用者認證

### 行為描述

**註冊**（`POST /api/auth/register`）：
- 必填：`email`（需通過正規表達式格式驗證）、`password`（至少 6 字元）、`name`
- 以 bcrypt（10 rounds）雜湊密碼後寫入 `users` 表，`role` 固定為 `'user'`
- 成功後立即簽發 JWT token（有效期 7 天），回傳 `{ user, token }`
- Email 重複則返回 409

**登入**（`POST /api/auth/login`）：
- 必填：`email`、`password`
- Email 不存在或密碼錯誤，一律返回 401（不透露哪個欄位錯誤，防止枚舉攻擊）
- 成功返回 `{ user: { id, email, name, role }, token }`

**個人資料**（`GET /api/auth/profile`）：
- 需 JWT；從 token 取出 `userId`，再查 DB 確認使用者存在
- 返回 `{ id, email, name, role, created_at }`（不含 `password_hash`）

### 錯誤碼

| 錯誤碼 | HTTP | 情境 |
|--------|------|------|
| `VALIDATION_ERROR` | 400 | 缺少必填欄位、Email 格式錯誤、密碼過短 |
| `CONFLICT` | 409 | Email 已被註冊 |
| `UNAUTHORIZED` | 401 | 密碼錯誤、Token 無效/過期、使用者不存在 |

---

## 2. 商品瀏覽（公開，不需認證）

### 行為描述

**商品列表**（`GET /api/products`）：
- 查詢參數：`page`（預設 1，最小 1）、`limit`（預設 10，最小 1，最大 100）
- 以 `created_at DESC` 排序（最新商品優先）
- 回傳 `{ products: [...], pagination: { total, page, limit, totalPages } }`

**商品詳情**（`GET /api/products/:id`）：
- 路徑參數：商品 UUID
- 商品不存在返回 404

### 錯誤碼

| 錯誤碼 | HTTP | 情境 |
|--------|------|------|
| `NOT_FOUND` | 404 | 商品 ID 不存在 |

---

## 3. 購物車（雙模式認證）

### 雙模式認證流程

購物車路由使用專屬 `dualAuth` middleware（非標準 `authMiddleware`）：

```
請求進入 dualAuth
  ├─ 有 Authorization header？
  │     ├─ JWT 有效 → req.user 設定，以 user_id 識別購物車
  │     └─ JWT 無效 → 直接 401（不 fallback 至 session）
  └─ 無 Authorization header
        ├─ 有 X-Session-Id → req.sessionId 已設定，以 session_id 識別購物車
        └─ 兩者皆無 → 401
```

### 行為描述

**查看購物車**（`GET /api/cart`）：
- JOIN products 表取得商品名稱、價格、庫存、圖片
- 計算並回傳 `total`（各項目 `price × quantity` 的總和）
- 同一使用者（或 session）的所有 cart_items 一次回傳

**加入購物車**（`POST /api/cart`）：
- 必填：`productId`；選填：`quantity`（預設 1，必須為正整數）
- **若商品已在購物車中**：累加數量（`existingQty + newQty`），而非覆蓋
- 累加後數量超過庫存 → 400 `STOCK_INSUFFICIENT`
- 商品不存在 → 404

**修改數量**（`PATCH /api/cart/:itemId`）：
- 必填：`quantity`（正整數），為**直接設定**而非相對增減
- 新數量超過庫存 → 400
- 項目不屬於該使用者/session → 404

**移除項目**（`DELETE /api/cart/:itemId`）：
- 驗證 ownership（確認 cart_item 屬於當前使用者/session）後刪除
- 回傳 `{ data: null, error: null, message: '已從購物車移除' }`

### 錯誤碼

| 錯誤碼 | HTTP | 情境 |
|--------|------|------|
| `VALIDATION_ERROR` | 400 | 缺少 productId 或 quantity 非正整數 |
| `STOCK_INSUFFICIENT` | 400 | 數量超過庫存（含累加） |
| `NOT_FOUND` | 404 | 商品不存在或 cart_item 不屬於當前使用者 |
| `UNAUTHORIZED` | 401 | 無有效 token 且無 X-Session-Id |

---

## 4. 訂單建立與查詢（需 JWT）

### 行為描述

**建立訂單**（`POST /api/orders`）：
- 必填：`recipientName`、`recipientEmail`（格式驗證）、`recipientAddress`
- 僅讀取 **登入使用者（user_id）** 的購物車，不支援 session 購物車
- 前置檢查：購物車為空 → 400；任一商品庫存不足 → 400（列出商品名稱）
- **原子交易**：建立訂單 → 複製商品快照至 order_items → 扣減庫存 → 清空購物車
- 成功後購物車自動清空（`DELETE FROM cart_items WHERE user_id = ?`）
- 返回包含 `items` 陣列的完整訂單資料

**訂單列表**（`GET /api/orders`）：
- 只回傳當前登入使用者自己的訂單（`WHERE user_id = ?`）
- 以 `created_at DESC` 排序，不分頁

**訂單詳情**（`GET /api/orders/:id`）：
- `WHERE id = ? AND user_id = ?` 確保使用者只能看自己的訂單
- 包含完整 `order_items` 陣列

**模擬付款**（`PATCH /api/orders/:id/pay`）：
- 必填：`action`，值為 `'success'` 或 `'fail'`
- 僅允許 `status = 'pending'` 的訂單付款；已 paid 或 failed 返回 400
- `action: 'success'` → status 更新為 `'paid'`
- `action: 'fail'` → status 更新為 `'failed'`
- 庫存在建立訂單時已扣減，付款失敗**不**回補庫存

### 訂單號格式

```
ORD-{YYYYMMDD}-{UUID v4 前 5 碼大寫}
範例：ORD-20260428-A3F2C
```

### 錯誤碼

| 錯誤碼 | HTTP | 情境 |
|--------|------|------|
| `VALIDATION_ERROR` | 400 | 缺少收件資訊或 Email 格式錯誤 |
| `CART_EMPTY` | 400 | 購物車為空 |
| `STOCK_INSUFFICIENT` | 400 | 結帳時庫存不足 |
| `INVALID_STATUS` | 400 | 訂單非 pending 狀態，無法付款 |
| `VALIDATION_ERROR` | 400 | action 不是 success 或 fail |
| `NOT_FOUND` | 404 | 訂單不存在（或不屬於當前使用者） |
| `UNAUTHORIZED` | 401 | 未登入 |

---

## 5. 後台商品管理（需 JWT + admin role）

所有路由掛載 `authMiddleware → adminMiddleware`，非 admin 返回 403。

### 行為描述

**商品列表**（`GET /api/admin/products`）：
- 查詢參數：`page`（預設 1）、`limit`（預設 10，最大 100）
- 與前台 `/api/products` 邏輯相同，但需認證

**新增商品**（`POST /api/admin/products`）：
- 必填：`name`（非空字串）、`price`（正整數）、`stock`（非負整數）
- 選填：`description`（字串）、`image_url`（字串）
- 省略選填欄位時存入 `NULL`

**編輯商品**（`PUT /api/admin/products/:id`）：
- 全部欄位皆為選填（partial update），未提供的欄位保持原值
- 提供但值無效（如 `price = 0`）會被拒絕
- 更新時自動設 `updated_at = datetime('now')`

**刪除商品**（`DELETE /api/admin/products/:id`）：
- 刪除前檢查是否有 `status = 'pending'` 的訂單包含此商品
- 有 pending 訂單 → 409 `CONFLICT`（防止刪除進行中訂單的商品）
- 商品對應的 `order_items` 紀錄不隨商品刪除（已是快照，不受影響）

### 錯誤碼

| 錯誤碼 | HTTP | 情境 |
|--------|------|------|
| `VALIDATION_ERROR` | 400 | 必填欄位缺失或格式錯誤 |
| `NOT_FOUND` | 404 | 商品不存在 |
| `CONFLICT` | 409 | 商品存在 pending 訂單，無法刪除 |
| `UNAUTHORIZED` | 401 | 未登入 |
| `FORBIDDEN` | 403 | 非 admin |

---

## 6. 綠界金流整合（AIO）

### 行為描述

**取得付款參數**（`POST /payment/ecpay/:orderId/params`）：
- 需 JWT；確認訂單屬於當前使用者且 `status = 'pending'`
- 回傳 ECPay AIO 所需的 `paymentUrl`（URL）與 `params`（含 CheckMacValue 的表單欄位）
- 前端收到後自動建立 form 並 submit，瀏覽器跳轉至綠界付款頁

**付款方式**：
- `ChoosePayment: 'ALL'` — 綠界付款頁同時顯示所有已開通方式，由消費者選擇
- 支援項目（依代收付模式合約）：信用卡、ATM 轉帳、超商代碼、超商條碼、WebATM 等

**付款結果接收**：
- `POST /payment/notify`（ReturnURL）：接收綠界 S2S 通知，必須在 10 秒內回應 `1|OK`
- `GET|POST /payment/result`（OrderResultURL）：消費者付款後瀏覽器導向，渲染付款結果頁

**付款狀態查詢**（`POST /api/orders/:id/verify`）：
- 呼叫 ECPay `QueryTradeInfo` API 查詢最新付款狀態
- `TradeStatus=1` → 訂單更新為 `paid`；`TradeStatus=10200095` → 更新為 `failed`
- 訂單已非 `pending` 時直接回傳現有狀態，不再查詢

### CheckMacValue 簽章

使用 SHA-256 + ECPay 專屬 URL encode 規則（`ecpayUrlEncode`）：
- 參數按鍵名小寫字母排序後串接
- 前後分別加 `HashKey=...` 與 `HashIV=...`
- 整串 URL encode 後取 SHA-256，結果轉大寫

### 環境變數

| 變數 | 說明 | 預設值（測試） |
|------|------|--------------|
| `ECPAY_MERCHANT_ID` | 特店編號 | `3002607` |
| `ECPAY_HASH_KEY` | HashKey | `pwFHCqoQZGmho4w6` |
| `ECPAY_HASH_IV` | HashIV | `EkRm7iFT261dpevs` |
| `ECPAY_ENV` | 設為 `production` 切換正式環境 | （空，使用 stage） |
| `BASE_URL` | ReturnURL / OrderResultURL 的 domain | `http://localhost:3001` |

---

## 7. 後台訂單管理（需 JWT + admin role）

### 行為描述

**訂單列表**（`GET /api/admin/orders`）：
- 查詢參數：`page`（預設 1）、`limit`（預設 10，最大 100）、`status`（可選，enum: `pending`、`paid`、`failed`）
- 提供無效 `status` 值時忽略過濾（不報錯），回傳全部訂單
- 回傳 pagination

**訂單詳情**（`GET /api/admin/orders/:id`）：
- 可查看任何使用者的訂單（無 user_id 過濾）
- 回傳包含 `items` 陣列及 `user: { name, email }` 的完整資料
- 使用者已刪除時，`user` 為 `null`

### 錯誤碼

| 錯誤碼 | HTTP | 情境 |
|--------|------|------|
| `NOT_FOUND` | 404 | 訂單不存在 |
| `UNAUTHORIZED` | 401 | 未登入 |
| `FORBIDDEN` | 403 | 非 admin |
