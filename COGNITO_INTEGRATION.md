# SparkBoard Cognito Integration - Deployment Summary

## ✅ 已完成部署

### 1. AWS Infrastructure (CDK)

**Stacks 狀態：**
- ✅ SparkBoard-Storage (DynamoDB + S3)
- ✅ SparkBoard-Auth (Cognito with Hosted UI)
- ✅ SparkBoard-Api (API Gateway + Lambda)

### 2. Cognito Hosted UI Configuration

**User Pool ID:** `ap-northeast-1_59qRuLzAB`
**Client ID:** `3mare5vo5cqqtbialfbhpddaqq`
**Region:** `ap-northeast-1`
**Domain:** `sparkboard-434824683139.auth.ap-northeast-1.amazoncognito.com`

**Callback URLs:**
- http://localhost:5173
- http://localhost:5173/
- http://localhost:5173/callback

**Logout URLs:**
- http://localhost:5173
- http://localhost:5173/

### 3. Hosted UI URLs

**Login URL:**
```
https://sparkboard-434824683139.auth.ap-northeast-1.amazoncognito.com/login?client_id=3mare5vo5cqqtbialfbhpddaqq&response_type=code&redirect_uri=http://localhost:5173
```

**Sign Up URL:**
```
https://sparkboard-434824683139.auth.ap-northeast-1.amazoncognito.com/signup?client_id=3mare5vo5cqqtbialfbhpddaqq&response_type=code&redirect_uri=http://localhost:5173
```

### 4. API Endpoints

**Base URL:** `https://994mxyt7tl.execute-api.ap-northeast-1.amazonaws.com/prod`

**Endpoints:**
- `GET /health` - Health check (no auth)
- `GET /auth/me` - Get user info (requires JWT)

### 5. Frontend Integration

**已實作：**
- ✅ `use-auth.ts` 使用 `amazon-cognito-identity-js`
- ✅ 支援直接登入（username/password）
- ✅ 支援 Hosted UI OAuth flow
- ✅ 處理 authorization code callback
- ✅ JWT token 管理
- ✅ 環境變數配置 (`.env.local`)

**環境變數：**
```env
VITE_AWS_REGION=ap-northeast-1
VITE_USER_POOL_ID=ap-northeast-1_59qRuLzAB
VITE_USER_POOL_CLIENT_ID=3mare5vo5cqqtbialfbhpddaqq
VITE_COGNITO_DOMAIN=sparkboard-434824683139.auth.ap-northeast-1.amazoncognito.com
VITE_API_BASE_URL=https://994mxyt7tl.execute-api.ap-northeast-1.amazonaws.com/prod
VITE_OAUTH_REDIRECT_URI=http://localhost:5173
VITE_OAUTH_LOGOUT_URI=http://localhost:5173
```

## 🧪 驗收測試步驟

### 測試 1: Hosted UI 註冊與登入

1. **開啟 Hosted UI 註冊頁面：**
   ```
   https://sparkboard-434824683139.auth.ap-northeast-1.amazoncognito.com/signup?client_id=3mare5vo5cqqtbialfbhpddaqq&response_type=code&redirect_uri=http://localhost:5173
   ```

2. **註冊新使用者：**
   - Email: 你的測試 email
   - Password: 至少 8 字元，包含大小寫和數字

3. **確認 email** （會收到驗證碼）

4. **登入後會 redirect 回：**
   ```
   http://localhost:5173?code=<authorization_code>
   ```

5. **前端會自動：**
   - 擷取 `code` 參數
   - 呼叫 Cognito Token Endpoint 交換 tokens
   - 儲存 `id_token`
   - 顯示已登入狀態

### 測試 2: 直接使用 Username/Password 登入

1. 啟動前端：`npm run dev`
2. 在登入表單輸入 Cognito 使用者的 email/password
3. 點擊 "Sign In"
4. 應該成功登入並取得 JWT token

### 測試 3: 使用 JWT 呼叫 `/auth/me`

使用前端取得的 `id_token` 測試：

```bash
# 從 browser localStorage 取得 token
# 或使用 admin 方式取得：

TOKEN=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id ap-northeast-1_59qRuLzAB \
  --client-id 3mare5vo5cqqtbialfbhpddaqq \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=your-email,PASSWORD=your-password \
  --query 'AuthenticationResult.IdToken' \
  --output text)

curl -H "Authorization: Bearer $TOKEN" \
  https://994mxyt7tl.execute-api.ap-northeast-1.amazonaws.com/prod/auth/me
```

**預期回應：**
```json
{
  "success": true,
  "user": {
    "userId": "...",
    "username": "...",
    "email": "...",
    "emailVerified": true,
    "name": "...",
    "orgId": "sparkboard-demo",
    ...
  }
}
```

## ⚠️ 已知問題與注意事項

### Port 衝突
- Spark plugin 預設使用 port 5000
- Vite 前端設定為 port 5173
- 如果遇到 port 衝突，請執行：
  ```bash
  lsof -ti:5000 | xargs kill -9
  npm run dev
  ```

### Callback URL 必須精確匹配
- Cognito Callback URLs 必須與前端 URL 完全一致
- 包括 protocol (`http://`)、domain、port
- 如果前端跑在不同 port，需要更新 CDK 配置並重新部署

### OAuth Flow Debug
- 如果 OAuth callback 失敗，檢查 browser console
- 確認 `code` 參數有正確傳遞
- 檢查 Token Endpoint 回應

## 📋 下一步

1. **測試前端整合：**
   - 啟動前端並測試 Hosted UI 流程
   - 測試直接登入
   - 驗證 JWT token 可正確呼叫 API

2. **整合 API 呼叫：**
   - 更新 `use-items.ts` 使用真實 API（而非 localStorage）
   - 加入 Authorization header
   - 處理 API 錯誤

3. **加入更多 API 端點：**
   - `POST /items` - 建立任務
   - `GET /items` - 查詢任務列表
   - `POST /uploads/presign` - 取得 S3 上傳 URL

4. **CI/CD：**
   - 建立 GitHub Actions workflows
   - 自動部署到 AWS

## 📚 參考連結

- [Cognito Hosted UI](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html)
- [Authorization Code Grant Flow](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)
- [amazon-cognito-identity-js](https://github.com/aws-amplify/amplify-js/tree/main/packages/amazon-cognito-identity-js)
