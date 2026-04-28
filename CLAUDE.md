# CLAUDE.md

## 專案概述

花卉電商網站 — Node.js + Express + SQLite (better-sqlite3) + EJS + Tailwind CSS

前後端整合於單一 Express 服務，API 與頁面路由並存。資料庫使用 SQLite 檔案，不需外部資料庫服務。購物車支援雙模式認證（JWT 或 X-Session-Id），訂單建立為原子交易（扣庫存 + 清購物車）。

## 常用指令

```bash
npm start          # 建置 CSS 後啟動（生產用）
npm run dev:server # 僅啟動伺服器（開發用，不編譯 CSS）
npm run dev:css    # 監聽 CSS 變更並即時編譯
npm run css:build  # 一次性建置並壓縮 CSS
npm test           # 執行全部測試（Vitest，序列執行）
npm run openapi    # 產生 OpenAPI JSON 規格文件
```

## 關鍵規則

- **所有 API 回應**必須符合 `{ data, error, message }` 統一格式；`error` 在成功時為 `null`
- **購物車路由**使用自定義 `dualAuth` middleware，優先 JWT，其次 `X-Session-Id`；不可換成標準 `authMiddleware`
- **建立訂單**須在 SQLite transaction 中一次完成（insert orders → insert order_items → UPDATE stock → DELETE cart_items），任何步驟失敗整批 rollback
- **刪除商品**前須檢查是否存在 `status = 'pending'` 的訂單，有則返回 409
- **測試執行順序固定**（見 vitest.config.js），不可並行，因為各 test 檔共享同一個 SQLite 檔案實例
- 功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`

## 詳細文件

- `./docs/README.md` — 項目介紹與快速開始
- `./docs/ARCHITECTURE.md` — 架構、目錄結構、資料流、API 路由總覽
- `./docs/DEVELOPMENT.md` — 開發規範、命名規則、環境變數、計畫歸檔流程
- `./docs/FEATURES.md` — 功能列表、行為描述、錯誤碼
- `./docs/TESTING.md` — 測試規範、執行順序、撰寫指南
- `./docs/CHANGELOG.md` — 更新日誌
