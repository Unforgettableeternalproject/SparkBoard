# SparkBoard 技術堆疊文件

> **最後更新：** 2025-11-18  
> **版本：** 1.0.0

## 📋 目錄

- [前端技術棧](#前端技術棧)
- [後端技術棧](#後端技術棧)
- [AWS 服務架構](#aws-服務架構)
- [開發工具](#開發工具)

---

## 🎨 前端技術棧

### 核心框架

| 技術 | 版本 | 用途 |
|------|------|------|
| **React** | 19.0.0 | 前端核心框架，支援並發特性 |
| **TypeScript** | 5.7.2 | 類型安全開發 |
| **Vite** | 6.3.5 | 快速建置工具與 HMR |
| **React Router** | 7.9.4 | 客戶端路由管理 |

**選擇理由：**
- React 19 提供最新的並發渲染和自動批次更新
- Vite 提供極快的開發體驗和優化的生產建置
- TypeScript 確保代碼質量和開發體驗

### UI 與樣式系統

#### 樣式框架
```json
{
  "TailwindCSS": "4.1.11",
  "@tailwindcss/vite": "4.1.8",
  "autoprefixer": "10.4.20",
  "postcss": "8.5.1"
}
```

**配置特色：**
- 使用 Vite 插件進行即時編譯
- 自定義主題配置（顏色、間距、斷點）
- 暗黑模式支援

#### UI 組件庫（Radix UI）

完整的 25+ 個無障礙組件：

**對話框與彈窗：**
- `@radix-ui/react-dialog` - 模態對話框
- `@radix-ui/react-alert-dialog` - 警告確認對話框
- `@radix-ui/react-popover` - 彈出層
- `@radix-ui/react-hover-card` - 懸停卡片
- `@radix-ui/react-tooltip` - 工具提示

**導航組件：**
- `@radix-ui/react-dropdown-menu` - 下拉選單
- `@radix-ui/react-navigation-menu` - 導航選單
- `@radix-ui/react-menubar` - 選單欄
- `@radix-ui/react-context-menu` - 右鍵選單
- `@radix-ui/react-tabs` - 分頁標籤

**表單組件：**
- `@radix-ui/react-checkbox` - 核取框
- `@radix-ui/react-radio-group` - 單選按鈕組
- `@radix-ui/react-switch` - 開關
- `@radix-ui/react-slider` - 滑桿
- `@radix-ui/react-select` - 下拉選擇器
- `@radix-ui/react-label` - 表單標籤

**其他組件：**
- `@radix-ui/react-avatar` - 頭像
- `@radix-ui/react-progress` - 進度條
- `@radix-ui/react-accordion` - 摺疊面板
- `@radix-ui/react-collapsible` - 可摺疊內容
- `@radix-ui/react-scroll-area` - 滾動區域
- `@radix-ui/react-separator` - 分隔線
- `@radix-ui/react-toggle` - 切換按鈕
- `@radix-ui/react-toggle-group` - 切換按鈕組
- `@radix-ui/react-aspect-ratio` - 長寬比容器

**為什麼選擇 Radix UI：**
- ✅ 完全無障礙（ARIA 標準）
- ✅ 無樣式基礎組件，完全可自定義
- ✅ 鍵盤導航支援
- ✅ 焦點管理
- ✅ 螢幕閱讀器友好

#### 圖示庫

```typescript
// 三個圖示庫並用，提供豐富的視覺選擇
import { Check, X, Plus } from 'lucide-react'          // Lucide React 0.484
import { Trash, NotePencil } from '@phosphor-icons/react' // Phosphor 2.1.7
import { BellIcon } from '@heroicons/react/24/outline'     // Heroicons 2.2
```

#### 動畫與互動

```json
{
  "framer-motion": "12.6.2",
  "embla-carousel-react": "8.5.2"
}
```

**使用場景：**
- 頁面轉場動畫
- 組件進出場效果
- 手勢互動
- 輪播組件

### 狀態管理

#### 伺服器狀態管理

```typescript
// TanStack Query (React Query) 5.90.5
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 範例：Items 資料獲取
const { data, isLoading } = useQuery({
  queryKey: ['items'],
  queryFn: fetchItems,
  staleTime: 2 * 60 * 1000, // 2 分鐘
  refetchInterval: 2 * 60 * 1000, // 自動輪詢
})
```

**功能特色：**
- 自動快取管理
- 背景重新獲取
- 樂觀更新
- 無限滾動支援
- 請求去重

#### 表單狀態管理

```typescript
// React Hook Form 7.54.2 + Zod 3.25.76
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1, '標題為必填'),
  content: z.string().optional(),
})

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: { title: '', content: '' }
})
```

**優勢：**
- 性能優化（減少重渲染）
- 內建驗證
- 錯誤處理
- 與 UI 庫整合良好

### 身份驗證

```json
{
  "amazon-cognito-identity-js": "6.3.15"
}
```

**實作功能：**
- 用戶註冊與登入
- Email 驗證
- OAuth 2.0 流程（Hosted UI）
- JWT Token 管理
- 自動刷新 Token
- 密碼重設

### 內容渲染

#### Markdown 支援

```json
{
  "react-markdown": "10.1.0",
  "remark-gfm": "4.0.1",
  "remark-math": "6.0.0",
  "rehype-katex": "7.0.1",
  "marked": "15.0.7"
}
```

**支援功能：**
- GitHub Flavored Markdown（表格、任務列表、刪除線）
- 數學公式渲染（KaTeX）
- 代碼語法高亮
- 自動連結

### 工具函式庫

| 套件 | 用途 |
|------|------|
| `date-fns` 3.6.0 | 日期格式化與計算 |
| `uuid` 11.1.0 | UUID 生成 |
| `clsx` 2.1.1 | 條件式 className |
| `tailwind-merge` 3.0.2 | TailwindCSS 類名合併 |
| `class-variance-authority` 0.7.1 | 組件變體管理 |

### 資料視覺化

```json
{
  "recharts": "2.15.1",
  "d3": "7.9.0"
}
```

**使用場景：**
- 管理員監控儀表板
- API 性能圖表
- Lambda 執行統計
- DynamoDB 容量使用

### UI 增強組件

```json
{
  "sonner": "2.0.1",           // Toast 通知
  "next-themes": "0.4.6",      // 主題切換
  "react-resizable-panels": "2.1.7", // 可調整大小面板
  "cmdk": "1.1.1",             // 命令面板
  "input-otp": "1.4.2",        // OTP 輸入
  "react-day-picker": "9.6.7", // 日期選擇器
  "vaul": "1.1.2",             // 抽屜組件
  "react-error-boundary": "6.0.0" // 錯誤邊界
}
```

### 開發工具

```json
{
  "eslint": "9.28.0",
  "@vitejs/plugin-react-swc": "3.10.1",
  "@typescript-eslint/eslint-plugin": "8.38.0",
  "@typescript-eslint/parser": "8.38.0",
  "vite-tsconfig-paths": "5.2.0"
}
```

---

## ⚙️ 後端技術棧

### Lambda 運行環境

```yaml
Runtime: Node.js 18.x
Architecture: x86_64
Memory: 256-512 MB
Timeout: 10-60 seconds
```

### AWS SDK

所有 Lambda 函數使用最新的 AWS SDK v3：

```json
{
  "@aws-sdk/client-dynamodb": "^3.723.0",
  "@aws-sdk/lib-dynamodb": "^3.723.0",
  "@aws-sdk/client-s3": "^3.723.0",
  "@aws-sdk/s3-request-presigner": "^3.723.0",
  "@aws-sdk/client-cognito-identity-provider": "^3.478.0",
  "@aws-sdk/client-cloudwatch": "^3.478.0",
  "@aws-sdk/client-xray": "^3.478.0"
}
```

**v3 優勢：**
- 模組化設計（僅導入需要的客戶端）
- 更小的包大小
- 更快的冷啟動
- 原生 TypeScript 支援

### Lambda 函數清單

#### 1. SparkBoard-Items
```javascript
// 路徑: services/items/index.js
// 功能: 任務與公告的 CRUD 操作
// 記憶體: 512 MB
// 超時: 30 秒
```

**端點：**
- `POST /items` - 創建任務/公告
- `GET /items` - 列出所有項目（支援分頁）
- `GET /items/{sk}` - 取得單一項目
- `PATCH /items/{sk}` - 更新項目
- `DELETE /items/{sk}` - 刪除項目（支援 forceDelete）

**權限檢查：**
```javascript
function checkPermission(user, action, resource) {
  const isOwner = user.sub === resource.userId
  const isAdmin = user.groups?.includes('Admin')
  const isModerator = user.groups?.includes('Moderators')
  
  // 權限矩陣
  if (action === 'create:announcement') {
    return isAdmin || isModerator
  }
  if (action === 'delete:task') {
    return isOwner || isAdmin || isModerator
  }
  // ... 更多權限檢查
}
```

#### 2. SparkBoard-AuthMe
```javascript
// 路徑: services/auth/index.js
// 功能: 用戶個人資料管理
// 記憶體: 256 MB
// 超時: 10 秒
```

**端點：**
- `GET /auth/me` - 取得當前用戶資料
- `PATCH /auth/me` - 更新用戶資料（姓名、頭像、簡介）

**資料同步：**
- Cognito 屬性：name, email
- DynamoDB 擴展資料：bio, avatarUrl, preferences

#### 3. SparkBoard-Uploads
```javascript
// 路徑: services/uploads/index.js
// 功能: S3 預簽名 URL 生成
// 記憶體: 256 MB
// 超時: 10 秒
```

**支援的檔案類型：**
```javascript
const ALLOWED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv']
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
```

#### 4. SparkBoard-AutoArchive
```javascript
// 路徑: services/items/auto-archive.js
// 功能: 自動封存已完成任務
// 觸發器: EventBridge (每分鐘)
// 記憶體: 256 MB
// 超時: 60 秒
```

**執行邏輯：**
```javascript
// 1. 掃描 DynamoDB 尋找 autoArchiveAt <= now
// 2. 計算封存狀態：
//    - completed: 所有子任務完成
//    - partial: 部分子任務完成
//    - aborted: 無子任務完成
// 3. 更新項目狀態為 archived
// 4. 移除 autoArchiveAt 欄位
```

#### 5. SparkBoard-Users
```javascript
// 路徑: services/users/index.js
// 功能: 用戶管理（僅 Admin）
// 記憶體: 256 MB
// 超時: 30 秒
```

**端點：**
- `GET /users` - 列出所有用戶與群組
- `POST /users/{userId}/groups` - 將用戶加入群組
- `DELETE /users/{userId}/groups/{groupName}` - 移除群組成員
- `POST /users/{userId}/disable` - 停用用戶
- `POST /users/{userId}/enable` - 啟用用戶
- `DELETE /users/{userId}` - 刪除用戶（必須先停用）

#### 6. SparkBoard-Monitoring
```javascript
// 路徑: services/monitoring/index.js
// 功能: CloudWatch 指標與 X-Ray 追蹤
// 記憶體: 512 MB
// 超時: 30 秒
```

**端點：**
- `GET /monitoring/metrics` - CloudWatch 指標
- `GET /monitoring/traces` - X-Ray 追蹤資料
- `GET /monitoring/alarms` - 告警狀態

#### 7. SparkBoard-Health
```javascript
// 路徑: services/health/index.js
// 功能: API 健康檢查
// 記憶體: 128 MB
// 超時: 5 秒
// 無需授權
```

#### 8. SparkBoard-PostConfirm
```javascript
// 路徑: services/auth-trigger/index.js
// 功能: Cognito 註冊後觸發器
// 自動將新用戶加入 "Users" 群組
```

### 共用工具模組

所有 Lambda 函數共享的工具：

```javascript
// services/shared/permissions.js
// services/shared/response.js
// services/shared/validation.js
```

---

## ☁️ AWS 服務架構

### 運算服務

#### Lambda Functions
- **總數：** 8 個函數
- **運行時：** Node.js 18.x
- **部署方式：** AWS CDK
- **日誌保留：** 7 天
- **追蹤：** AWS X-Ray 啟用
- **環境變數管理：** CDK 注入

#### API Gateway
```yaml
Type: REST API
Name: SparkBoardAPI
Stage: prod
Authorization: Cognito User Pools Authorizer
CORS: Enabled
Throttling: 
  Rate Limit: 10000 requests/second
  Burst Limit: 5000 requests
Logging: INFO level
Metrics: Enabled
X-Ray Tracing: Active
```

### 儲存服務

#### DynamoDB
```yaml
Table Name: SparkTable
Billing Mode: PAY_PER_REQUEST (On-Demand)
Partition Key: PK (String)
Sort Key: SK (String)
Point-in-Time Recovery: Enabled
Encryption: AWS Managed Keys (SSE)
Stream: Disabled

Global Secondary Indexes:
  - GSI1:
      PK: GSI1PK (USER#userId)
      SK: GSI1SK (ITEM#timestamp)
      Projection: ALL
  - GSI2:
      PK: GSI2PK (ITEM#ALL)
      SK: GSI2SK (timestamp)
      Projection: ALL
```

#### S3
```yaml
Bucket: sparkboard-files-{accountId}-{region}
Encryption: SSE-S3
Versioning: Disabled
Public Access: Blocked
CORS: Enabled for CloudFront and localhost
Lifecycle Rules:
  - Delete files after 90 days
```

### 身份驗證

#### Cognito User Pool
```yaml
Pool Name: SparkBoardUserPool
Alias Attributes: [email]
Auto-verify: [email]
Password Policy:
  Minimum Length: 8
  Require Lowercase: true
  Require Uppercase: true
  Require Numbers: true
  Require Symbols: false
Custom Attributes:
  - custom:orgId (default: "sparkboard-demo")
Account Recovery: Email

Groups:
  - Admin (Precedence: 1)
  - Moderators (Precedence: 2)
  - Users (Precedence: 3)

Triggers:
  - PostConfirmation: SparkBoard-PostConfirm Lambda
```

#### Cognito User Pool Client
```yaml
Client Name: SparkBoardWebClient
Auth Flows:
  - USER_PASSWORD_AUTH
  - USER_SRP_AUTH
  - ADMIN_USER_PASSWORD_AUTH
  - REFRESH_TOKEN_AUTH
Token Validity:
  Access Token: 60 minutes
  ID Token: 60 minutes
  Refresh Token: 30 days
OAuth:
  Flows: [code, implicit]
  Scopes: [openid, profile, email]
  Callback URLs: [localhost:5173, CloudFront URL]
  Logout URLs: [localhost:5173, CloudFront URL]
```

### 內容分發

#### CloudFront Distribution
```yaml
Origin: S3 Bucket (Frontend)
Origin Access Identity: Enabled (OAI)
Viewer Protocol Policy: Redirect HTTP to HTTPS
Compress Objects: Enabled
Price Class: PriceClass_All
Cache Behaviors:
  - PathPattern: /index.html
    TTL: 0 (no cache)
  - PathPattern: /assets/*
    TTL: 31536000 (1 year)
Custom Error Responses:
  - 403 → /index.html (SPA routing)
  - 404 → /index.html (SPA routing)
```

### 監控與日誌

#### CloudWatch
- **Log Groups：** 8 個（每個 Lambda 一個）
- **Metrics：** API Gateway、Lambda、DynamoDB
- **Dashboards：** SparkBoard-Monitoring
- **Alarms：** 5xx 錯誤、Lambda 錯誤率

#### X-Ray
- **追蹤：** API Gateway → Lambda → DynamoDB
- **採樣率：** 100%（開發環境）
- **服務地圖：** 完整的請求流向視覺化

### 事件處理

#### EventBridge
```yaml
Rule: SparkBoard-AutoArchive-Rule
Schedule: rate(1 minute)
Target: SparkBoard-AutoArchive Lambda
State: ENABLED
```

### 通知服務

#### SNS
```yaml
Topic: SparkBoard-Alarms
Subscriptions:
  - Protocol: Email
    Endpoint: admin@example.com
```

---

## 🛠️ 開發工具

### 版本控制
- **Git** - 版本控制
- **GitHub** - 代碼托管與協作

### CI/CD
- **GitHub Actions** - 自動化 CI/CD
- **AWS CDK** - 基礎設施即代碼

### 測試
- **Jest** 29.7.0 - 單元測試框架
- **@aws-sdk/client-mock** - AWS SDK 模擬

### 代碼品質
- **ESLint** - JavaScript/TypeScript Linter
- **TypeScript** - 靜態類型檢查
- **Prettier** - 代碼格式化（建議）

### 本地開發
```bash
# Frontend
npm run dev           # 啟動開發伺服器 (Vite)
npm run build         # 生產建置
npm run preview       # 預覽生產建置

# Backend (Lambda)
npm test              # 運行單元測試
npm run test:watch    # 監聽模式測試
npm run test:coverage # 覆蓋率報告

# Infrastructure (CDK)
cd infra
npm run build         # 編譯 TypeScript
cdk synth --all       # 生成 CloudFormation 模板
cdk diff --all        # 查看變更差異
cdk deploy --all      # 部署到 AWS
```

### 環境管理
- **Development：** 本地開發環境
- **Staging：** 測試環境（可選）
- **Production：** 生產環境

---

## 📊 技術選型總結

### 為什麼選擇無伺服器架構？

✅ **自動擴展** - 根據流量自動調整  
✅ **按需付費** - 只為實際使用付費  
✅ **無需管理伺服器** - 專注於業務邏輯  
✅ **高可用性** - AWS 管理的基礎設施  
✅ **快速迭代** - 輕鬆部署和更新  

### 為什麼選擇 React + TypeScript？

✅ **類型安全** - 減少運行時錯誤  
✅ **強大生態系** - 豐富的第三方庫  
✅ **組件化開發** - 代碼重用性高  
✅ **優秀的開發體驗** - 豐富的工具支援  

### 為什麼選擇 DynamoDB？

✅ **完全管理** - 無需維護  
✅ **自動擴展** - 彈性容量  
✅ **低延遲** - 毫秒級回應  
✅ **靈活的定價** - On-Demand 計費  
✅ **與 Lambda 深度整合**  

---

## 🎯 效能指標

### 前端
- **首次內容繪製（FCP）：** < 1.5 秒
- **最大內容繪製（LCP）：** < 2.5 秒
- **累積佈局偏移（CLS）：** < 0.1
- **首次輸入延遲（FID）：** < 100 毫秒

### 後端
- **API 回應時間：** < 200 毫秒（P95）
- **Lambda 冷啟動：** < 1 秒
- **Lambda 暖啟動：** < 50 毫秒
- **DynamoDB 查詢：** < 10 毫秒

### 可用性
- **API Gateway SLA：** 99.95%
- **Lambda SLA：** 99.95%
- **DynamoDB SLA：** 99.99%
- **S3 SLA：** 99.99%
- **CloudFront SLA：** 99.9%

---

**文件維護：** 本文件會隨著技術堆疊更新而持續更新。
