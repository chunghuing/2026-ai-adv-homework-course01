# DEVELOPMENT.md

## 模組系統

本專案後端使用 **CommonJS**（`require` / `module.exports`），前端測試框架使用 ES Module 設定（`vitest.config.js` 用 `import`）。

- 伺服器端所有檔案（`src/`、`tests/`、`app.js`、`server.js`）：CommonJS
- `vitest.config.js`：ESM（`import { defineConfig } from 'vitest/config'`）
- 前端 JS（`public/js/`）：瀏覽器原生全域腳本，無打包，直接用 `<script>` 載入

## 命名規則對照表

| 情境 | 規則 | 範例 |
|------|------|------|
| 資料庫欄位 | snake_case | `order_no`、`product_price`、`created_at` |
| API 回應 JSON key | snake_case | `{ "order_no": "ORD-...", "total_amount": 1680 }` |
| API 請求 body（建立訂單） | camelCase | `{ "recipientName": "...", "recipientEmail": "..." }` |
| 路由檔案 | camelCase + Routes | `cartRoutes.js`、`adminOrderRoutes.js` |
| Middleware 檔案 | camelCase + Middleware | `authMiddleware.js`、`sessionMiddleware.js` |
| 前端 JS 頁面檔案 | kebab-case | `admin-products.js`、`product-detail.js` |
| EJS 頁面模板 | kebab-case | `order-detail.ejs`、`admin-header.ejs` |
| UUID | UUID v4（`uuidv4()`） | 用於所有表的 PRIMARY KEY |
| 訂單號 | `ORD-YYYYMMDD-{UUID前5碼大寫}` | `ORD-20260428-A3F2C` |

> 注意：`POST /api/orders` 的請求 body 用 camelCase（`recipientName`），但回應和資料庫用 snake_case（`recipient_name`）。這是本專案唯一的 camelCase/snake_case 混用點。

## 環境變數表

| 變數 | 用途 | 必要 | 預設值 |
|------|------|------|--------|
| `JWT_SECRET` | JWT 簽署密鑰 | **必要** | 無（未設定則拒絕啟動） |
| `PORT` | 伺服器監聽埠號 | 否 | `3001` |
| `FRONTEND_URL` | CORS 允許來源 | 否 | `http://localhost:3001` |
| `BASE_URL` | 基礎 URL（OpenAPI 文件用） | 否 | `http://localhost:3001` |
| `ADMIN_EMAIL` | 管理員帳號 email（seed） | 否 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 管理員帳號密碼（seed） | 否 | `12345678` |
| `NODE_ENV` | 環境識別（影響 bcrypt rounds） | 否 | 無 |
| `ECPAY_MERCHANT_ID` | 綠界商店代號（預留） | 否 | `3002607` |
| `ECPAY_HASH_KEY` | 綠界 HashKey（預留） | 否 | — |
| `ECPAY_HASH_IV` | 綠界 HashIV（預留） | 否 | — |
| `ECPAY_ENV` | 綠界環境（staging / production，預留） | 否 | `staging` |

> `NODE_ENV=test` 時 bcrypt salt rounds 降為 1，大幅加速測試。
> ECPay 相關變數目前僅出現在 `.env.example`，尚未整合至程式碼。

## 新增 API 路由步驟

1. 在 `src/routes/` 建立路由檔（遵循命名規則 `xxxRoutes.js`）
2. 在路由 handler 上方加入 `@openapi` JSDoc 註解（`swagger-jsdoc` 用）
3. 在 `app.js` 以 `app.use('/api/xxx', require('./src/routes/xxxRoutes'))` 掛載
4. 所有回應遵循統一格式：`{ data, error, message }`
5. 在 `tests/` 新增對應測試檔，並加入 `vitest.config.js` 的 `sequence.files`

## 新增 Middleware 步驟

1. 在 `src/middleware/` 建立 `xxxMiddleware.js`
2. Middleware 函式簽名：`function xxxMiddleware(req, res, next) { ... }`
3. 若需與 `authMiddleware` 串接（如 `adminMiddleware`），必須在路由級別依序 `router.use(authMiddleware, adminMiddleware)` 而非 `app.use`

## 新增資料庫欄位步驟

1. 修改 `src/database.js` 的 `CREATE TABLE IF NOT EXISTS` 語句
2. **注意**：`better-sqlite3` 使用 `IF NOT EXISTS`，若資料庫已存在則不會重建 schema。開發中若需修改欄位，須刪除 `src/database.sqlite` 讓 schema 重建
3. 更新 `docs/ARCHITECTURE.md` 的 Schema 表格

## JSDoc / OpenAPI 格式規範

路由上方使用 `@openapi` JSDoc 描述端點，格式參考現有路由。必填欄位：

```javascript
/**
 * @openapi
 * /api/xxx:
 *   post:
 *     summary: 端點摘要
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []      # 需要 JWT 認證時加上
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field1]
 *             properties:
 *               field1:
 *                 type: string
 *     responses:
 *       200:
 *         description: 成功
 *       400:
 *         description: 參數錯誤
 */
```

## 計畫歸檔流程

1. **計畫檔案命名格式**：`YYYY-MM-DD-<feature-name>.md`，例如 `2026-04-28-payment-integration.md`
2. **計畫文件結構**：
   ```markdown
   ## User Story
   作為 [角色]，我希望 [功能]，以便 [目的]

   ## Spec
   - 端點/UI 規格
   - 資料結構
   - 業務邏輯

   ## Tasks
   - [ ] Task 1
   - [x] Task 2（已完成）
   ```
3. **功能完成後**：
   - 將計畫檔從 `docs/plans/` 移至 `docs/plans/archive/`
   - 更新 `docs/FEATURES.md`（標記功能狀態）
   - 更新 `docs/CHANGELOG.md`（新增版本紀錄）
