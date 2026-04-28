# ECPay 綠界金流串接計畫

## Context

花卉電商網站目前使用「模擬付款」（假的付款成功/失敗按鈕）。本次目標是串接綠界 AIO 全方位金流（信用卡），讓使用者能實際前往綠界付款頁面付款。

由於專案僅在本地端運行（localhost:3001），無法接收綠界伺服器主動回推的 ReturnURL（S2S callback）。因此**付款狀態確認改為由前端觸發、後端主動呼叫 ECPay QueryTradeInfo API** 查詢並更新訂單狀態。

---

## 架構說明

```
使用者 → 訂單詳情頁 → 點「前往付款」
       → GET /payment/ecpay/:orderId
       → 伺服器產生 ECPay form 參數 + CheckMacValue
       → views/pages/payment-redirect.ejs（自動 submit）
       → ECPay 測試付款頁（payment-stage.ecpay.com.tw）
       → 使用者完成付款
       → ECPay 導回 GET /payment/result（OrderResultURL）
       → 顯示查詢中畫面 + 自動呼叫 POST /api/orders/:id/verify
       → 伺服器呼叫 ECPay QueryTradeInfo
       → 更新 DB orders.status = 'paid' or 'failed'
       → 導回訂單詳情頁
```

ReturnURL（S2S）雖然實作但本地開發不依賴它，永遠回覆 `1|OK`。

---

## 測試帳號（Staging）

| 欄位 | 值 |
|------|-----|
| MerchantID | `3002607` |
| HashKey | `pwFHCqoQZGmho4w6` |
| HashIV | `EkRm7iFT261dpevs` |
| 付款頁（測試）| `https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5` |
| 查詢（測試）| `https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5` |
| 測試信用卡 | `4311-9522-2222-2222`，安全碼任意三位，3D SMS: `1234` |

---

## 關於 Port 限制

SKILL 文件指出 ReturnURL / OrderResultURL 僅支援 port 80/443。實際經驗是：
- **Staging 環境**通常對非標準 port 較寬鬆（可測試）
- **正式環境**嚴格要求 port 80/443

本地開發建議在 `.env` 設定 `BASE_URL=http://localhost:3001`；若 ECPay staging 拒絕非標準 port，改用 `ClientBackURL` 替代 `OrderResultURL`（純前端導回，無 port 驗證），並依賴 QueryTradeInfo 確認付款。

---

## 需要建立的檔案

### 1. `src/services/ecpay.js`（新建）

ECPay 工具模組，包含：
- `ecpayUrlEncode(source)` — Node.js 特有 URL encode 邏輯（空格→`+`，`~`→`%7e`，`'`→`%27`，後轉 lowercase 並還原特定字元）
- `generateCheckMacValue(params)` — SHA256 計算，使用 `crypto.timingSafeEqual` 比對
- `getMerchantTradeDate()` — 台灣時間（UTC+8），格式 `yyyy/MM/dd HH:mm:ss`
- `buildPaymentParams(order, baseUrl)` — 組合 AIO 必填參數
- `queryTradeInfo(merchantTradeNo)` — POST 到 QueryTradeInfo V5，回應為 URL-encoded 字串

**MerchantTradeNo 格式**：`FLR` + Unix 秒（10位）+ 7位隨機大寫英數 = 20 字元，在 `POST /api/orders` 時生成並存入 DB。

**buildPaymentParams 的 URL 設定**：
```
ReturnURL:       ${baseUrl}/payment/notify
OrderResultURL:  ${baseUrl}/payment/result
ChoosePayment:   Credit
EncryptType:     1
ItemName:        取訂單商品名稱（截到 400 字元）
```

### 2. `src/routes/paymentRoutes.js`（新建）

| 路由 | 說明 |
|------|------|
| `GET /payment/ecpay/:orderId` | 驗證訂單所有權、status=pending，render payment-redirect.ejs |
| `POST /payment/notify` | ReturnURL S2S handler，只回 `1\|OK`（本地不依賴） |
| `GET /payment/result` | OrderResultURL 瀏覽器導回，render payment-result.ejs |
| `POST /payment/result` | 同上，ECPay 有時用 POST |

`GET /payment/ecpay/:orderId` 需驗證訂單屬於當前 JWT 使用者（從 authMiddleware 取得）。

### 3. `views/pages/payment-redirect.ejs`（新建）

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><title>轉跳中...</title></head>
<body>
  <p>正在轉跳至綠界付款頁面，請稍候...</p>
  <form id="pay-form" action="<%= paymentUrl %>" method="post">
    <!-- 迭代 params 輸出 hidden inputs -->
  </form>
  <script>document.getElementById('pay-form').submit();</script>
</body>
</html>
```

### 4. `views/pages/payment-result.ejs`（新建）

付款完成後的中繼頁：
- 顯示「付款完成，查詢中...」
- 從 URL query 拿到 `MerchantTradeNo`（ECPay 在 GET redirect 時會帶）
- JS 自動呼叫 `POST /api/orders/:id/verify`（需先查 order by merchant_trade_no）
- 查詢成功後自動導向 `/orders/:id?payment=success` 或 `?payment=failed`

---

## 需要修改的檔案

### 5. `src/database.js`

在 `initializeDatabase()` 的 `db.exec(CREATE TABLE...)` 之後，加入 migration：

```javascript
// Migration: ECPay 欄位（try/catch 因為 SQLite 不支援 IF NOT EXISTS）
try { db.exec('ALTER TABLE orders ADD COLUMN merchant_trade_no TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE orders ADD COLUMN ecpay_trade_no TEXT'); } catch (_) {}
```

### 6. `src/routes/orderRoutes.js`

**A. `POST /api/orders`**：在建立訂單的 transaction 前生成 `merchant_trade_no`：
```javascript
const ts = Math.floor(Date.now() / 1000).toString();
const rand = Math.random().toString(36).substring(2, 9).toUpperCase();
const merchantTradeNo = 'FLR' + ts + rand; // 20 chars
```
將 `merchant_trade_no` 加進 INSERT 語句。  
回應的 `data` 中也要包含 `merchant_trade_no`。

**B. 新增 `POST /api/orders/:id/verify`**（需 JWT）：

```
1. 查 orders WHERE id=? AND user_id=?，找不到 → 404
2. 若 status !== 'pending' → 直接回傳現有狀態（已是終態）
3. 若 merchant_trade_no 為空 → 400 INVALID_STATE（尚未發起付款）
4. 呼叫 ecpay.queryTradeInfo(merchant_trade_no)
5. 解析回應：
   - TradeStatus === '1' → newStatus = 'paid'
   - TradeStatus === '10200095' → newStatus = 'failed'
   - 其他 → 保持 'pending'
6. 若狀態有變 → UPDATE orders SET status=?, ecpay_trade_no=? WHERE id=?
7. 回傳更新後的訂單（含 items）
```

**C. 新增 `GET /api/orders/by-trade-no/:merchantTradeNo`**（需 JWT）：

payment-result.ejs 頁面只知道 MerchantTradeNo，需透過此端點取得 order.id 以呼叫 verify。

### 7. `app.js`

在 `app.use('/api/orders', ...)` 之前加入：
```javascript
app.use('/payment', require('./src/routes/paymentRoutes'));
```

（payment 路由放在 API routes 之前，避免被 404 handler 攔截）

### 8. `views/pages/order-detail.ejs`

移除「付款成功/失敗」模擬按鈕區塊，改為：

**當 status === 'pending' 時顯示**：
```html
<a href="/payment/ecpay/<%= orderId %>" class="...">前往付款（綠界金流）</a>
<button @click="verifyPayment" class="...">確認付款狀態</button>
```

**狀態顯示**：保留原有 paymentResult 顯示邏輯。

### 9. `public/js/pages/order-detail.js`

新增 `verifyPayment` 函式：
```javascript
async function verifyPayment() {
  if (verifying.value) return;
  verifying.value = true;
  try {
    const res = await apiFetch('/api/orders/' + order.value.id + '/verify', { method: 'POST' });
    order.value = res.data;
    if (res.data.status === 'paid') paymentResult.value = 'success';
    else if (res.data.status === 'failed') paymentResult.value = 'failed';
    else Notification.show('尚未付款，請完成付款後再查詢', 'warning');
  } catch (e) {
    Notification.show('查詢付款狀態失敗', 'error');
  } finally {
    verifying.value = false;
  }
}
```

移除原有的 `simulatePay`、`handlePaySuccess`、`handlePayFail` 函式。

---

## 實作順序

1. `src/database.js` — 加入 migration
2. `src/services/ecpay.js` — 核心工具（先可獨立測試 CheckMacValue）
3. `src/routes/orderRoutes.js` — 加 merchant_trade_no 生成 + verify + by-trade-no 端點
4. `src/routes/paymentRoutes.js` — payment 路由
5. `app.js` — 掛載路由
6. `views/pages/payment-redirect.ejs` — ECPay 跳轉頁
7. `views/pages/payment-result.ejs` — 付款結果查詢中繼頁
8. `views/pages/order-detail.ejs` — 更新按鈕
9. `public/js/pages/order-detail.js` — 更新 JS

---

## 環境變數（.env）

`.env.example` 已有，確認 `.env` 包含：
```env
ECPAY_MERCHANT_ID=3002607
ECPAY_HASH_KEY=pwFHCqoQZGmho4w6
ECPAY_HASH_IV=EkRm7iFT261dpevs
ECPAY_ENV=staging
BASE_URL=http://localhost:3001
```

---

## 驗證方式（End-to-End 測試）

1. `npm run dev:server` 啟動伺服器
2. 登入 → 加商品入購物車 → 填寫收件資訊 → 建立訂單
3. 確認訂單詳情頁顯示「前往付款（綠界金流）」按鈕（status=pending）
4. 點選按鈕 → 應導向 `/payment/ecpay/:orderId` → 自動 submit 到 ECPay 測試頁
5. 使用測試卡 `4311-9522-2222-2222`，安全碼任意，3D SMS 填 `1234`
6. 付款成功 → ECPay 導回 `/payment/result` → 自動查詢 → 導向訂單頁
7. 確認訂單狀態變為「已付款」
8. 測試手動點「確認付款狀態」按鈕（在訂單頁）也能觸發 QueryTradeInfo

---

## 關鍵技術注意事項

- **ItemName 不可含**：echo、curl、python 等系統關鍵字（WAF 攔截），使用商品名稱即可
- **MerchantTradeNo 永久唯一**，若需重新測試須使用新訂單
- **QueryTradeInfo 的 TimeStamp 只有 3 分鐘有效期**，每次查詢時動態計算
- **RtnCode/TradeStatus 型別為字串**（CMV-SHA256 協議），用 `=== '1'` 比對
- **ReturnURL 必須回應精確 ASCII `1|OK`（HTTP 200）**，否則觸發重試
- **不可使用 iframe** 嵌入 ECPay 付款頁
- Source: web_fetch https://developers.ecpay.com.tw/2862.md, https://developers.ecpay.com.tw/2890.md (2026-04-28)
