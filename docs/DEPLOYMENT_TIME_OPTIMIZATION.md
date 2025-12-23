# SparkBoard 部署時間優化指南

## 📊 當前部署狀況

**完整部署時間**: ~15-20 分鐘

這是正常的，因為 SparkBoard 包含了多個 AWS 資源：

### 部署的資源清單

| Stack | 資源類型 | 數量 | 預估時間 |
|-------|---------|------|---------|
| **Storage** | DynamoDB Table + S3 Bucket | 2 | 2-3 分鐘 |
| **Auth** | Cognito User Pool + Client + Groups | 4+ | 2-3 分鐘 |
| **Api** | API Gateway + 8 Lambda Functions + EventBridge | 10+ | 5-7 分鐘 |
| **Messaging** | SQS + SNS + Lambda + Event Source | 4+ | 3-4 分鐘 |
| **Monitoring** | CloudWatch Dashboard + Alarms | 3+ | 1-2 分鐘 |
| **Frontend** | CloudFront + S3 + OAI | 3+ | 2-3 分鐘 |
| **總計** | | **25+** | **15-22 分鐘** |

### 為什麼這麼久？

1. **CloudFormation 串行處理**：雖然 CDK 可以並行部署無依賴的 stacks，但每個 stack 內的資源大多是串行創建的
2. **CloudFront 分發需要全球傳播**：CloudFront 創建最慢，需要 2-3 分鐘在全球邊緣節點部署
3. **Lambda 函數打包和上傳**：8 個 Lambda 函數需要打包並上傳到 S3
4. **依賴關係**：Stacks 之間有依賴關係（Storage → Auth → Api → Messaging）

## ⚡ 優化策略

### 1. 增量部署（推薦）

只部署改動的 stack：

```powershell
# 只部署 API Stack（如果只改了 Lambda 代碼）
cdk deploy SparkBoard-Api --require-approval never

# 只部署 Frontend（如果只改了前端代碼）
cdk deploy SparkBoard-Frontend --require-approval never
```

**節省時間**: 2-5 分鐘（vs 15-20 分鐘）

### 2. 跳過未改動的 Stacks

使用我們的逐步部署腳本：

```powershell
# 跳過已部署的 stacks
.\scripts\deploy-stacks-step-by-step.ps1 -SkipStorage -SkipAuth -SkipMonitoring
```

### 3. Hotswap 模式（開發環境）

對於 Lambda 代碼更改，使用 hotswap 模式：

```bash
# 快速部署 Lambda 更改（不經過 CloudFormation）
cdk deploy SparkBoard-Api --hotswap --require-approval never
```

**⚠️ 警告**: 
- 僅限開發環境使用
- 不會更新 CloudFormation stack
- 不適用於資源配置更改

**節省時間**: 30-60 秒（vs 5-7 分鐘）

### 4. 本地測試優先

在部署前本地測試：

```powershell
# 本地運行前端
npm run dev

# 本地測試 Lambda 函數（使用 SAM Local）
sam local invoke SparkBoard-Items -e event.json
```

## 🎯 最佳實踐

### 開發階段

```powershell
# 1. 首次部署：完整部署
.\scripts\deploy-all-stacks.ps1

# 2. 開發時：使用 hotswap
cd infra
cdk deploy SparkBoard-Api --hotswap

# 3. 前端開發：不需要重新部署
npm run dev  # 本地開發伺服器
```

### 生產部署

```powershell
# 完整部署，確保所有資源一致
.\scripts\deploy-all-stacks.ps1

# 或通過 CI/CD 自動部署
git push origin main  # 觸發 GitHub Actions
```

## 📈 部署時間分解

### 典型的完整部署流程

```
[00:00] CDK Synth                                 ━━ 10-15 秒
[00:15] SparkBoard-Storage 部署中...
        ├─ DynamoDB Table                        ━━ 45 秒
        └─ S3 Bucket                             ━━ 30 秒
[02:30] ✓ Storage Stack 完成

[02:30] SparkBoard-Auth 部署中...
        ├─ User Pool                             ━━ 60 秒
        ├─ User Pool Client                      ━━ 20 秒
        ├─ Groups (Admin/Moderators/Users)       ━━ 30 秒
        └─ Auth Trigger Lambda                   ━━ 30 秒
[04:50] ✓ Auth Stack 完成

[04:50] SparkBoard-Api 部署中...
        ├─ API Gateway                           ━━ 40 秒
        ├─ Health Lambda                         ━━ 45 秒
        ├─ Auth Lambda                           ━━ 45 秒
        ├─ Items Lambda                          ━━ 45 秒
        ├─ Uploads Lambda                        ━━ 45 秒
        ├─ Users Lambda                          ━━ 45 秒
        ├─ Monitoring Lambda                     ━━ 45 秒
        ├─ AutoArchive Lambda                    ━━ 45 秒
        └─ EventBridge Rule                      ━━ 20 秒
[11:00] ✓ Api Stack 完成

[11:00] SparkBoard-Messaging 部署中...
        ├─ SQS Queue + DLQ                       ━━ 30 秒
        ├─ SNS Topic                             ━━ 20 秒
        ├─ Notification Lambda                   ━━ 45 秒
        └─ Event Source Mapping                  ━━ 30 秒
[13:05] ✓ Messaging Stack 完成

[13:05] SparkBoard-Monitoring 部署中...
        ├─ CloudWatch Dashboard                  ━━ 30 秒
        └─ SNS Topic + Alarms                    ━━ 40 秒
[14:15] ✓ Monitoring Stack 完成

[14:15] SparkBoard-Frontend 部署中...
        ├─ S3 Bucket                             ━━ 30 秒
        ├─ Origin Access Identity                ━━ 20 秒
        └─ CloudFront Distribution               ━━ 120-180 秒 ⏱️
[17:25] ✓ Frontend Stack 完成

[17:25] ✓ 所有 Stacks 部署完成！
```

## 🔍 如何監控部署進度

### 1. 使用 --progress events

```bash
cdk deploy --all --progress events
```

顯示每個資源的創建狀態。

### 2. CloudFormation Console

在 AWS Console 中查看：
1. 前往 CloudFormation
2. 查看各個 Stack 的 Events 標籤
3. 即時監控資源創建進度

### 3. 使用我們的逐步腳本

```powershell
.\scripts\deploy-stacks-step-by-step.ps1
```

顯示每個 stack 的詳細進度和時間。

## 💡 減少未來部署時間的技巧

### 1. 模組化開發

- 只修改需要的 Lambda 函數
- 使用 `cdk deploy <specific-stack>` 而不是 `--all`

### 2. 使用 CloudFormation Change Sets

```bash
# 查看會改變什麼
cdk diff SparkBoard-Api

# 只部署有變更的資源
cdk deploy SparkBoard-Api
```

### 3. 優化 Lambda 打包

```javascript
// 在 api-stack.ts 中使用 bundling
code: lambda.Code.fromAsset(path.join(__dirname, '../../services/items'), {
  bundling: {
    image: lambda.Runtime.NODEJS_18_X.bundlingImage,
    command: [
      'bash', '-c',
      'npm install && cp -au . /asset-output'
    ],
  },
}),
```

這會在本地打包，減少上傳時間。

## 📊 比較：各種部署方式的時間

| 場景 | 方法 | 時間 | 適用情況 |
|------|------|------|---------|
| 首次部署 | `deploy-all-stacks.ps1` | 15-20 分 | 新環境設置 |
| Lambda 代碼更改 | `cdk deploy Api --hotswap` | 30-60 秒 | 開發階段 |
| 單一 Stack 更新 | `cdk deploy SparkBoard-Api` | 3-5 分 | 小幅改動 |
| 前端更新 | `deploy-frontend.ps1` | 2-3 分 | 前端改動 |
| 配置更改 | `cdk deploy <stack>` | 2-5 分 | 環境變數等 |
| CI/CD 部署 | GitHub Actions | 15-20 分 | 生產部署 |

## 🎯 結論

**15-20 分鐘的部署時間是正常的**，因為：
- ✅ 我們有 25+ 個 AWS 資源
- ✅ CloudFront 需要全球分發
- ✅ 多個 Lambda 函數需要打包上傳
- ✅ Stacks 之間有依賴關係

**優化建議**：
- 🚀 開發時使用 `--hotswap`
- 🎯 只部署改動的 stack
- 💻 本地測試優先
- 🔄 使用 CI/CD 進行生產部署

這樣可以將日常開發的部署時間從 15-20 分鐘減少到 30-60 秒！
