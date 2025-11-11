# SparkBoard 測試指南

## 測試架構

本專案採用三層測試策略：
1. **單元測試 (Unit Tests)** - Jest
2. **契約測試 (Contract Tests)** - OpenAPI + Jest
3. **壓力測試 (Load Tests)** - k6

---

## 1. 單元測試 (Unit Tests)

### 執行方式
```bash
cd services/items
npm test
```

### 當前狀態
- ✅ **27 tests passing**
- 覆蓋範圍:
  - POST /items (8 tests) - 建立 task/announcement、權限檢查、欄位驗證
  - GET /items (5 tests) - 分頁、查詢、授權
  - DELETE /items/{sk} (5 tests) - 刪除權限、所有權檢查
  - Permission System (4 tests) - Admin/Moderators/Users 角色權限
  - Field Validation (3 tests) - subtasks、deadline、priority 欄位
  - OPTIONS (1 test)、Error handling (1 test)

---

## 2. 契約測試 (Contract Tests)

### 安裝與執行
```bash
cd tests/contract
npm install  # 首次執行
npm test
```

### 使用認證 Token
```powershell
# Windows PowerShell
$env:AUTH_TOKEN="your-cognito-jwt-token"
npm test

# Linux/Mac
export AUTH_TOKEN="your-cognito-jwt-token"
npm test
```

### 當前狀態
- ✅ **10 tests passing**
- 測試項目:
  - GET /health - 健康檢查
  - GET /items - 列表、分頁、授權
  - POST /items - 建立 task、驗證
  - OPTIONS /items - CORS
  - Schema validation - OpenAPI 規範驗證

### OpenAPI 規範
位置: `openapi/sparkboard.yaml`

---

## 3. 壓力測試 (Load Tests)

### 安裝 k6

#### Windows (Chocolatey)
```bash
choco install k6
```

#### Windows (直接下載)
https://github.com/grafana/k6/releases

#### Mac
```bash
brew install k6
```

### 執行方式
```bash
cd tests/k6

# 基本執行
k6 run items_get.js

# 使用認證
k6 run -e AUTH_TOKEN="your-jwt-token" items_get.js

# 自訂場景
k6 run --vus 10 --duration 30s items_get.js
```

### 效能目標
- ✅ P95 latency < 200ms
- ✅ Error rate < 5%
- ✅ 支援 20 concurrent users

---

## 完整測試流程

進入下一階段前執行：

```bash
# 1. 單元測試
cd services/items
npm test

# 2. 契約測試
cd ../../tests/contract
npm install
npm test

# 3. 壓力測試（需先安裝 k6）
cd ../k6
k6 run items_get.js
```

---

## 驗收測試：Items CRUD 完整流程

### 前置準備
1. 清除瀏覽器的 localStorage（開發者工具 > Application > Local Storage > 刪除 `spark_items`）
2. 確保已登入 Bernie 管理員帳號

### 測試步驟

#### 1. 測試新增 Item（一般使用者視角）
- [ ] 點擊 "Items" 頁面的 "Create New" 按鈕
- [ ] 選擇類型：Task 或 Announcement
- [ ] 輸入標題和內容
- [ ] （可選）上傳附件（測試圖片檔案）
- [ ] 點擊 Create
- [ ] ✅ 驗證：Item 立即出現在列表頂部
- [ ] ✅ 驗證：如果有圖片附件，應該顯示預覽
- [ ] ✅ 驗證：顯示作者、時間、類型標籤

#### 2. 測試查看 Item
- [ ] 重新整理頁面
- [ ] ✅ 驗證：剛才建立的 Item 仍然存在（從 API 載入）
- [ ] ✅ 驗證：資料完整（標題、內容、附件）

#### 3. 測試管理員儀表板
- [ ] 點擊 Header 的 "Admin" 按鈕
- [ ] 切換到 "Item Management" 標籤
- [ ] ✅ 驗證：看到所有使用者建立的 Items
- [ ] 使用搜尋框測試搜尋功能
- [ ] ✅ 驗證：搜尋結果正確過濾

#### 4. 測試管理員註釋功能
- [ ] 在任一 Item 上點擊筆記圖示
- [ ] 輸入管理員註釋
- [ ] 點擊 "Add Annotation"
- [ ] ✅ 驗證：顯示成功訊息（目前前端功能，後端待實作）

#### 5. 測試管理員刪除功能
- [ ] 在任一 Item 上點擊垃圾桶圖示
- [ ] 確認刪除對話框
- [ ] ✅ 驗證：Item 從列表中消失
- [ ] 回到 "Items" 頁面
- [ ] ✅ 驗證：該 Item 也從主列表消失

#### 6. 測試權限控制
- [ ] 使用非管理員帳號登入（如果有的話）
- [ ] ✅ 驗證：看不到 "Admin" 按鈕
- [ ] 嘗試直接訪問 `/admin` 路由
- [ ] ✅ 驗證：顯示 "Access Denied" 訊息

#### 7. 測試路由持久化
- [ ] 在 Admin 頁面重新整理瀏覽器
- [ ] ✅ 驗證：停留在 Admin 頁面（不會回到首頁）
- [ ] 點擊瀏覽器的返回按鈕
- [ ] ✅ 驗證：正確導航到上一頁

#### 8. 測試資料快取
- [ ] 開啟開發者工具 Network 標籤
- [ ] 在 Admin 頁面切換標籤（Monitoring ↔ Item Management）
- [ ] ✅ 驗證：不會重複發送 API 請求（使用快取）
- [ ] 等待 60 秒後
- [ ] ✅ 驗證：自動重新抓取資料（背景更新）

### 預期結果
✅ 所有測試通過，從新增到管理到刪除的路徑皆可行

### API 端點確認
- `GET /items` - 列出所有 items
- `POST /items` - 建立新 item（附帶 attachments）
- `DELETE /items/{sk}` - 刪除 item（管理員或擁有者）

### 認證方式
- 使用 Cognito ID Token
- Header: `Authorization: <id_token>`
- Token 儲存在 localStorage: `cognito_id_token`
