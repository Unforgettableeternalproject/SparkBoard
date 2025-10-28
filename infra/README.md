# SparkBoard Infrastructure (CDK)

這是 SparkBoard 的 AWS CDK 基礎設施定義，包含 Cognito、API Gateway、Lambda、DynamoDB 和 S3。

## 📦 架構

```
SparkBoard-Storage    → DynamoDB (SparkTable) + S3 (sparkboard-files)
SparkBoard-Auth       → Cognito User Pool + App Client
SparkBoard-Api        → API Gateway + Lambda Functions
```

## 🚀 快速開始

### 1. 安裝依賴

```bash
cd infra
npm install
```

或從根目錄：

```bash
npm run cdk:install
```

### 2. 配置 AWS Credentials

確保你的 AWS credentials 已設定：

```bash
aws configure
# 或使用環境變數
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
```

### 3. Bootstrap CDK (首次部署)

```bash
cd infra
npx cdk bootstrap
```

### 4. 檢視將要部署的資源

```bash
npm run cdk:synth
# 或
npm run cdk:diff
```

### 5. 部署到 AWS

```bash
npm run cdk:deploy
```

部署完成後，你會看到以下 Outputs：

```
SparkBoard-Api.ApiUrl = https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/
SparkBoard-Api.HealthEndpoint = https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/health
SparkBoard-Api.AuthMeEndpoint = https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/auth/me
SparkBoard-Auth.UserPoolId = us-east-1_xxxxx
SparkBoard-Auth.UserPoolClientId = xxxxxxxxxxxxx
SparkBoard-Storage.TableName = SparkTable
SparkBoard-Storage.BucketName = sparkboard-files-xxxxx-us-east-1
```

## 🧪 測試 API

### 測試 Health Check (無需認證)

```bash
curl https://YOUR_API_URL/prod/health
```

預期回應：

```json
{
  "status": "healthy",
  "service": "SparkBoard API",
  "timestamp": "2025-10-28T...",
  "version": "1.0.0",
  "environment": "production",
  "resources": {
    "dynamodb": "SparkTable",
    "s3": "sparkboard-files-xxxxx-us-east-1",
    "cognito": "us-east-1_xxxxx"
  }
}
```

### 測試 /auth/me (需要 Cognito JWT)

1. 先在 Cognito User Pool 建立測試使用者
2. 使用 AWS Amplify 或 Cognito SDK 登入取得 JWT token
3. 使用 JWT 呼叫 API：

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://YOUR_API_URL/prod/auth/me
```

預期回應：

```json
{
  "success": true,
  "user": {
    "userId": "xxxxx-xxxxx-xxxxx",
    "username": "testuser",
    "email": "test@example.com",
    "emailVerified": true,
    "name": "testuser",
    "orgId": "sparkboard-demo",
    "authTime": "2025-10-28T...",
    "tokenIssued": "2025-10-28T...",
    "tokenExpires": "2025-10-28T..."
  },
  "timestamp": "2025-10-28T..."
}
```

## 📚 Stack 說明

### StorageStack (`lib/storage-stack.ts`)

- **DynamoDB Table:** `SparkTable`
  - Partition Key: `PK` (String)
  - Sort Key: `SK` (String)
  - GSI1: 依使用者查詢 (`GSI1PK`, `GSI1SK`)
  - GSI2: 依時間排序 (`GSI2PK`, `GSI2SK`)
  - Billing: On-Demand
  - Point-in-Time Recovery: Enabled

- **S3 Bucket:** `sparkboard-files-{account}-{region}`
  - Encryption: S3 Managed
  - Block Public Access: All
  - CORS: Enabled for uploads
  - Lifecycle: 90 天後刪除

### AuthStack (`lib/auth-stack.ts`)

- **Cognito User Pool:** `SparkBoardUserPool`
  - Sign-in: Email or Username
  - Auto-verify: Email
  - Custom attribute: `orgId`
  - Password policy: 8+ chars, upper+lower+digits

- **User Pool Client:** `SparkBoardWebClient`
  - Auth flows: USER_PASSWORD_AUTH, USER_SRP_AUTH
  - Token validity: 1h (access/id), 30d (refresh)

### ApiStack (`lib/api-stack.ts`)

- **API Gateway:** REST API
  - Stage: `prod`
  - Logging: Enabled
  - Metrics: Enabled
  - CORS: Enabled

- **Lambda Functions:**
  - `SparkBoard-Health`: GET /health (no auth)
  - `SparkBoard-AuthMe`: GET /auth/me (Cognito auth)

- **Authorizer:** Cognito User Pools Authorizer

## 🗑️ 清理資源

```bash
npm run cdk:destroy
```

⚠️ **注意：** 這會刪除所有資源，包括 DynamoDB 資料和 S3 檔案。

## 📝 下一步

1. 在前端整合 AWS Amplify 連接 Cognito
2. 實作 `/items` CRUD API (Lambda + DynamoDB)
3. 實作 `/uploads/presign` API (S3 Presigned URLs)
4. 加入 CloudWatch Alarms
5. 加入 X-Ray Tracing
6. 設定 GitHub Actions CI/CD

## 🔧 常見問題

### CDK Bootstrap 失敗

確保你的 AWS 帳戶有足夠權限，並且 region 正確。

### Lambda 部署失敗

檢查 `services/health/` 和 `services/auth/` 目錄下是否有 `index.js` 和 `package.json`。

### API Gateway CORS 錯誤

更新 `api-stack.ts` 中的 `allowOrigins` 為你的前端域名。

## 📖 參考資料

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [API Gateway](https://docs.aws.amazon.com/apigateway/)
- [Lambda with Node.js](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
