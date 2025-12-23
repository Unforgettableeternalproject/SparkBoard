# 🚀 SparkBoard

**Serverless 任務與公告平台** - 基於 AWS 無伺服器架構的社團任務與檔案分享平台

[![AWS](https://img.shields.io/badge/AWS-Serverless-orange)](https://aws.amazon.com/)
[![CDK](https://img.shields.io/badge/CDK-TypeScript-blue)](https://aws.amazon.com/cdk/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB)](https://reactjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE.txt)

## 📖 專案簡介

SparkBoard 是一個展示完整 AWS Serverless 應用的全端專案，包含：

- ✅ **使用者認證**：Amazon Cognito 提供註冊/登入功能
- ✅ **RESTful API**：API Gateway + Lambda 建立無伺服器 API
- ✅ **資料儲存**：DynamoDB 單表設計 + GSI 索引查詢
- ✅ **檔案上傳**：S3 Presigned URL
- ✅ **郵件通知**：SQS + SNS 異步郵件通知系統
- ✅ **CI/CD**：GitHub Actions 自動化部署
- ✅ **監控日誌**：CloudWatch + X-Ray

## 🏗️ 系統架構

```
[React Frontend (Vite)]
        ↓
   [CloudFront CDN] (Optional)
        ↓
 [API Gateway REST API]
        ↓
 [Lambda Functions] ──> [DynamoDB: SparkTable]
        │
        ├──> [S3: sparkboard-files]
        ├──> [Cognito User Pool]
        └──> [SQS Queue] ──> [Notification Lambda] ──> [SNS Topic] ──> 📧 Email
                  ↓
            [Dead Letter Queue]
```

## 🛠️ 技術堆疊

### 後端基礎設施
| 技術 | 用途 |
|------|------|
| AWS CDK (TypeScript) | 基礎設施即程式碼 (IaC) |
| API Gateway | REST API 端點 |
| Lambda (Node.js 18) | 無伺服器運算 |
| DynamoDB | NoSQL 資料庫 |
| Cognito | 使用者認證與授權 |
| S3 | 檔案儲存 |
| SQS | 訊息隊列 (郵件通知) |
| SNS | 郵件發送服務 |
| CloudWatch | 日誌與監控 |

### 前端
| 技術 | 用途 |
|------|------|
| React 19 | UI 框架 |
| TypeScript | 型別安全 |
| Vite | 建構工具 |
| TailwindCSS 4 | 樣式框架 |
| Radix UI | 元件庫 |
| TanStack Query | 資料擷取與快取 |
| Amazon Cognito Identity JS | 認證客戶端 |

## 📁 專案結構

```
SparkBoard/
├── infra/                      # AWS CDK 基礎設施
│   ├── bin/app.ts             # CDK App 入口
│   ├── lib/
│   │   ├── auth-stack.ts      # Cognito 認證
│   │   ├── storage-stack.ts   # DynamoDB + S3
│   │   └── api-stack.ts       # API Gateway + Lambda
│   └── package.json
│
├── services/                   # Lambda 函式
│   ├── auth/                  # GET /auth/me
│   │   ├── index.js
│   │   └── package.json
│   ├── health/                # GET /health
│   │   ├── index.js
│   │   └── package.json
│   ├── items/                 # POST/GET /items
│   │   ├── index.js
│   │   ├── index.test.js
│   │   ├── package.json
│   │   └── README.md
│   └── notifications/         # SQS → Email (新增)
│       ├── index.js
│       └── package.json
│
├── src/                       # React 前端
│   ├── components/            # UI 元件
│   ├── hooks/                 # React Hooks
│   ├── lib/                   # 工具函式
│   └── App.tsx
│
├── .github/workflows/         # CI/CD
│   ├── ci.yml
│   └── cdk-deploy.yml
│
├── package.json               # 前端依賴
└── README.md
```

## 🚀 快速開始

### 前置需求

- Node.js 18+ 
- npm 或 yarn
- AWS CLI 配置完成
- AWS CDK CLI (`npm install -g aws-cdk`)

### 1. 安裝依賴

```bash
# 安裝前端依賴
npm install

# 安裝 CDK 依賴
npm run cdk:install

# 安裝 Lambda 服務依賴
cd services/items && npm install
cd services/auth && npm install
cd services/health && npm install
```

### 2. 部署 AWS 基礎設施

#### 方法 1: 一鍵部署所有 Stacks（推薦）

```powershell
# Windows
.\scripts\deploy-all-stacks.ps1
```

此腳本會自動：
- ✅ 檢查 CDK 和 AWS 配置
- ✅ Bootstrap CDK（如需要）
- ✅ 安裝所有依賴
- ✅ 按正確順序部署所有 stacks
- ✅ 顯示所有輸出值

#### 方法 2: 逐步部署（用於除錯）

```powershell
# Windows - 逐個 stack 部署並顯示詳細進度
.\scripts\deploy-stacks-step-by-step.ps1

# 跳過特定 stack
.\scripts\deploy-stacks-step-by-step.ps1 -SkipFrontend
```

#### 方法 3: 手動部署

```bash
# CDK Bootstrap (首次使用)
cd infra
cdk bootstrap

# 檢視變更
cdk diff

# 部署所有堆疊
cdk deploy --all --require-approval never

# 或單獨部署
cdk deploy SparkBoard-Storage
cdk deploy SparkBoard-Auth
cdk deploy SparkBoard-Api
cdk deploy SparkBoard-Messaging
cdk deploy SparkBoard-Monitoring
cdk deploy SparkBoard-Frontend
```

部署完成後，記下輸出的：
- User Pool ID
- User Pool Client ID
- API Gateway URL
- Notification Queue URL

### 3. 設定環境變數

複製 `env.example` 為 `env.local` 並填入 CDK 輸出的值：

```bash
cp env.example env.local
```

編輯 `env.local`：
```env
VITE_AWS_REGION=ap-northeast-1
VITE_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=sparkboard-xxxxx.auth.ap-northeast-1.amazoncognito.com
VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod
VITE_OAUTH_REDIRECT_URI=http://localhost:5173
VITE_OAUTH_LOGOUT_URI=http://localhost:5173
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

前端將在 http://localhost:5173 啟動

## 📚 API 端點

### 認證端點

| Method | Path | 描述 | 認證 |
|--------|------|------|------|
| `GET` | `/health` | 健康檢查 | ❌ |
| `GET` | `/auth/me` | 取得當前使用者資訊 | ✅ |

### 任務端點

| Method | Path | 描述 | 認證 |
|--------|------|------|------|
| `POST` | `/items` | 建立新任務/公告 | ✅ |
| `GET` | `/items?limit=20&nextToken=xxx` | 查詢任務列表（分頁） | ✅ |

詳細 API 文件請參考 [services/items/README.md](services/items/README.md)

## 🗄️ DynamoDB 資料模型

採用 **Single Table Design**：

| Partition Key | Sort Key | Entity | 用途 |
|---------------|----------|--------|------|
| `ORG#<orgId>` | `ITEM#<itemId>` | 任務/公告 | 組織內的項目 |
| `USER#<userId>` | `ITEM#<itemId>` | 使用者項目 | GSI1: 查詢使用者的所有項目 |
| `ITEM#ALL` | `<createdAt>` | 全域項目 | GSI2: 查詢最新項目（分頁） |

### Global Secondary Indexes

- **GSI1**: 依使用者查詢 (`GSI1PK`, `GSI1SK`)
- **GSI2**: 依建立時間排序全平台最新項目 (`GSI2PK`, `GSI2SK`)

## 🧪 測試

### 單元測試

```bash
# 測試 Lambda 函式
cd services/items
npm test

# 測試覆蓋率
npm run test:coverage
```

### 整合測試

```bash
# 使用 Postman 或 curl 測試 API
curl -X GET https://your-api-url/prod/health
```

## 🔐 安全性

- ✅ JWT 驗證：使用 Cognito User Pool Authorizer
- ✅ 最小權限原則：Lambda 僅能存取指定資源
- ✅ 資料加密：S3 與 DynamoDB 使用 AWS 管理的加密
- ✅ CORS 設定：限制來源存取

## 📊 監控與日誌

### CloudWatch Logs

Lambda 函式日誌保留 7 天：
- `/aws/lambda/SparkBoard-Health`
- `/aws/lambda/SparkBoard-AuthMe`
- `/aws/lambda/SparkBoard-Items`

### CloudWatch Metrics

API Gateway 和 Lambda 自動記錄：
- 請求數量
- 錯誤率
- 延遲時間

### X-Ray Tracing

啟用後可追蹤完整請求鏈：
API Gateway → Lambda → DynamoDB

## 💰 成本估算

符合 AWS Free Tier：
- Lambda: 100 萬次請求/月
- DynamoDB: 25GB 儲存 + 讀寫容量
- API Gateway: 100 萬次呼叫/月
- S3: 5GB 儲存
- SQS: 100 萬次請求/月
- SNS: 100 萬次發布 + 1000 封郵件/月

**預估月成本**: NT$0 ~ $30 (超過免費額度後)

## 📧 郵件通知系統

SparkBoard 整合了 SQS 和 SNS 提供異步郵件通知功能。

### 支援的通知類型

- ✅ **任務完成通知** - 當任務狀態變更為 completed 時發送
- ✅ **公告通知** - 新公告發布時發送給所有用戶
- 🔜 **任務分配通知** - 任務被指派給用戶時發送（未來功能）

### 快速部署

```powershell
# 部署郵件通知系統
cd scripts
.\deploy-messaging.ps1

# 訂閱 SNS 主題接收郵件
aws sns subscribe \
  --topic-arn <TOPIC-ARN> \
  --protocol email \
  --notification-endpoint your-email@example.com

# 測試通知系統
.\test-notifications.ps1
```

### 架構圖

```
Items Lambda → SQS Queue → Notification Lambda → SNS Topic → 📧 Email
                  ↓
            Dead Letter Queue (失敗重試)
```

### 詳細文檔

- 📖 [部署指南](./docs/EMAIL_NOTIFICATION_DEPLOYMENT.md)
- 📝 [實現總結](./docs/NOTIFICATION_SYSTEM_SUMMARY.md)
- 📚 [功能規格](./docs/FEATURES.md#郵件通知系統)

## 🚀 CI/CD Pipeline

SparkBoard 使用 GitHub Actions 實現完整的 CI/CD 自動化部署流程。

### 🔄 工作流程

```
Feature Branch → Development → Main → AWS Deployment
     ↓              ↓           ↓          ↓
  CI Checks    Auto-Merge   Trigger    Auto Deploy
```

### 📋 GitHub Actions Workflows

| Workflow | 觸發條件 | 功能 |
|----------|---------|------|
| **Feature CI** | Push to `feature/**` | 程式碼品質檢查、測試、安全掃描 |
| **CI Checks** | PR/Push to `development`/`main` | 完整測試套件 |
| **Merge to Main** | Push to `development` | 自動合併到 main 分支 |
| **CDK Deploy** | Push to `main` | 🚀 自動部署到 AWS |

### 🔐 安全部署

使用 **AWS OIDC** 進行無憑證部署：
- ✅ 無需在 GitHub 儲存 AWS Access Keys
- ✅ 短期臨時憑證，自動輪換
- ✅ 精確的權限控制
- ✅ 審計追蹤

### 📚 部署文檔

詳細設置步驟請參考：
- [CI/CD 部署指南](./docs/CICD_DEPLOYMENT_GUIDE.md) - 完整使用指南
- [AWS OIDC 設置](./docs/AWS_OIDC_SETUP.md) - OIDC 配置教學

### 🚀 快速開始

```bash
# 1. 設置 AWS OIDC（首次）
chmod +x scripts/setup-aws-oidc.sh
./scripts/setup-aws-oidc.sh

# 2. CDK Bootstrap（首次）
cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1

# 3. 正常開發流程
git checkout -b feature/my-feature
git commit -m "feat: add new feature"
git push origin feature/my-feature
# → 創建 PR → 合併到 development → 自動部署 ✅
```

## 📝 開發指令

### 前端
```bash
npm run dev          # 開發伺服器
npm run build        # 生產建置
npm run preview      # 預覽建置結果
npm run lint         # ESLint 檢查
```

### CDK 部署

#### 完整部署（首次或生產環境）
```powershell
# 一鍵部署所有 stacks（15-20 分鐘）
.\scripts\deploy-all-stacks.ps1

# 或逐步部署（便於追蹤進度）
.\scripts\deploy-stacks-step-by-step.ps1
```

#### 快速開發部署
```bash
# 只部署改動的 stack（3-5 分鐘）
cd infra
cdk deploy SparkBoard-Api --require-approval never

# 使用 hotswap 快速部署 Lambda 更改（30-60 秒）⚡
cdk deploy SparkBoard-Api --hotswap --require-approval never
```

#### 其他 CDK 指令
```bash
npm run cdk:synth    # 合成 CloudFormation 範本
npm run cdk:diff     # 檢視變更
npm run cdk:destroy  # 清除所有資源
```

**💡 部署時間優化**: 查看 [部署時間優化指南](./docs/DEPLOYMENT_TIME_OPTIMIZATION.md) 了解如何將部署時間從 15-20 分鐘減少到 30-60 秒。

### 測試
```bash
npm test             # 執行測試
```

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request！

## 📄 授權

本專案採用 MIT 授權 - 詳見 [LICENSE.txt](LICENSE.txt)

## 🙏 致謝

- AWS SDK for JavaScript
- React 與 Vite 社群
- Radix UI 與 TailwindCSS 團隊

## 📞 聯絡資訊

有任何問題或建議，歡迎開啟 Issue 討論！

---

**Built with ❤️ using AWS Serverless**
