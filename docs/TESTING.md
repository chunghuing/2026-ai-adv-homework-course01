# TESTING.md

## 測試框架

- **Vitest 2.x**：測試執行器（支援 Jest 相容 API）
- **Supertest 7.x**：HTTP 請求模擬（不需啟動真實伺服器）
- 測試直接 `require('../app')`，操作同一個 SQLite 實例（`src/database.sqlite`）

## 測試檔案總覽

| 檔案 | 測試範圍 |
|------|----------|
| `tests/setup.js` | 共用輔助函式（非測試檔） |
| `tests/auth.test.js` | 註冊、登入、個人資料 |
| `tests/products.test.js` | 商品列表、分頁、商品詳情 |
| `tests/cart.test.js` | 訪客購物車、登入購物車、庫存驗證 |
| `tests/orders.test.js` | 建立訂單、訂單列表、詳情、auth 保護 |
| `tests/adminProducts.test.js` | 後台商品 CRUD、權限控制 |
| `tests/adminOrders.test.js` | 後台訂單列表（含 status 篩選）、詳情、權限控制 |

## 執行順序與依賴關係

**關鍵限制**：測試檔**必須序列執行**，且順序固定。

```
auth → products → cart → orders → adminProducts → adminOrders
```

原因：
1. 所有測試共享同一個 SQLite 資料庫實例，並行執行會產生競態條件
2. `cart.test.js` 依賴 `products.test.js` 執行後資料庫中有商品（seed data 在啟動時植入，但訂單測試會消耗庫存）
3. `orders.test.js` 在 `beforeAll` 中建立購物車並下單，`adminOrders.test.js` 在 `beforeAll` 中也建立訂單，需依序不衝突

`vitest.config.js` 設定：

```javascript
{
  test: {
    globals: true,          // 全域 describe/it/expect，無需 import
    fileParallelism: false,  // 禁止並行執行
    sequence: {
      files: [
        'tests/auth.test.js',
        'tests/products.test.js',
        'tests/cart.test.js',
        'tests/orders.test.js',
        'tests/adminProducts.test.js',
        'tests/adminOrders.test.js',
      ]
    },
    hookTimeout: 10000,     // beforeAll 10 秒 timeout（bcrypt + HTTP 較慢）
  }
}
```

## 共用輔助函式（tests/setup.js）

### `getAdminToken()`

```javascript
async function getAdminToken() → string
```

登入 seed 管理員帳號（`admin@hexschool.com` / `12345678`），返回 JWT token。

使用情境：需要 admin 權限的測試在 `beforeAll` 中呼叫。

### `registerUser(overrides = {})`

```javascript
async function registerUser(overrides) → { token: string, user: object }
```

自動產生唯一 email（`test-{timestamp}-{random}@example.com`）並呼叫 `/api/auth/register`。
可傳入 `{ email, password, name }` 覆蓋預設值。

使用情境：需要一般使用者 token 的測試，尤其是驗證「非 admin 被拒絕」的情境。

## 撰寫新測試步驟

1. 在 `tests/` 建立 `{feature}.test.js`
2. 在 `tests/setup.js` 的 `module.exports` 確認需要的工具已匯出
3. 於 `vitest.config.js` 的 `sequence.files` 陣列末尾（或適當位置）加入新測試檔路徑
4. 遵循以下結構範本：

```javascript
const { app, request, getAdminToken, registerUser } = require('./setup');

describe('Feature Name API', () => {
  let token;
  let createdId;

  beforeAll(async () => {
    token = await getAdminToken(); // 或 const { token } = await registerUser();
  });

  it('should do something', async () => {
    const res = await request(app)
      .post('/api/xxx')
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'value' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
    expect(res.body).toHaveProperty('message');
    // 驗證具體欄位
    expect(res.body.data).toHaveProperty('id');
  });
});
```

## 常見陷阱

### 1. 購物車 session vs user

購物車測試需明確區分 guest 和 authenticated 模式：
- Guest：`.set('X-Session-Id', sessionId)`（session ID 需在 `describe` 範圍內定義並重用）
- 登入：`.set('Authorization', \`Bearer ${token}\`)`
- **不要在同一個 session ID 混用兩種模式**，dualAuth 以 JWT 優先

### 2. 訂單測試會清空購物車

`POST /api/orders` 成功後會自動清空購物車。若同一個 token 需要多次下單，每次下單前都要重新加入購物車。

### 3. 商品庫存會被消耗

`orders.test.js` 和 `adminOrders.test.js` 的 `beforeAll` 都會扣庫存。若商品庫存耗盡，後續測試可能因庫存不足而失敗。seed 商品庫存普遍充足（15–100），通常不成問題，但新增大量測試時需注意。

### 4. bcrypt 在測試環境

`NODE_ENV=test` 時 salt rounds 降為 1。`npm test` 執行前確認 `.env` 或環境中有 `NODE_ENV=test`（或測試腳本內設定），否則每次 `registerUser` 會用 10 rounds 使測試大幅變慢。

### 5. 無跨使用者權限測試隔離

目前測試不清理 DB（無 `afterEach` 清表）。每次 `npm test` 都是對同一個 `database.sqlite` 操作，若手動刪除 `src/database.sqlite` 可強制重置。

## 執行測試

```bash
# 執行全部測試
npm test

# 執行單一測試檔（Vitest CLI）
npx vitest run tests/auth.test.js

# 觀察模式（開發時）
npx vitest
```
