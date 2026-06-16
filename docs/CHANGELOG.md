# CHANGELOG.md

所有重要變更記錄於此文件，格式參照 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)。

---

## [1.1.0] - 2026-06-16

### 變更

- **綠界金流付款方式**：`ChoosePayment` 由 `'Credit'`（僅信用卡）改為 `'ALL'`，ECPay 付款頁面現在同時顯示信用卡、ATM 轉帳、超商代碼、超商條碼等所有已開通的付款方式，由消費者在綠界頁面自行選擇（`src/services/ecpay.js`）

---

## [1.0.0] - 2026-04-28

### 新增

- **使用者認證**：註冊（POST /api/auth/register）、登入（POST /api/auth/login）、個人資料（GET /api/auth/profile）
- **商品瀏覽**：商品列表分頁（GET /api/products）、商品詳情（GET /api/products/:id）
- **購物車（雙模式）**：支援訪客（X-Session-Id）與登入（JWT）；加入、查看、修改數量、移除
- **訂單流程**：從購物車建立訂單（原子交易扣庫存）、訂單列表、訂單詳情
- **模擬付款**：PATCH /api/orders/:id/pay（action: success | fail）
- **後台商品管理**：CRUD 含 pending 訂單保護刪除邏輯
- **後台訂單管理**：列表（含 status 篩選）、詳情（含使用者資訊）
- **前端 EJS 介面**：前台（首頁、商品詳情、購物車、結帳、登入、訂單列表/詳情）與後台（商品管理、訂單管理）
- **測試套件**：6 個測試檔涵蓋全部 API（Vitest + Supertest）
- **OpenAPI 規格**：swagger-jsdoc 自動產生文件（npm run openapi）
- **資料庫 seed**：啟動時自動建立 admin 帳號與 8 筆花卉商品
