# User Profile Persistence Implementation

## 概述
實現了用戶資料（Bio 和 Avatar）的持久化存儲到 DynamoDB。

## 架構變更

### 1. Backend (Lambda + DynamoDB)

**Auth Lambda** (`services/auth/index.js`)
- ✅ 新增 `GET /auth/me` - 從 DynamoDB 讀取用戶資料
- ✅ 新增 `PATCH /auth/me` - 更新用戶 bio 和 avatarUrl
- ✅ 數據存儲在 DynamoDB: `PK: ORG#{orgId}, SK: USER#{userId}`

**API Gateway** (`infra/lib/api-stack.ts`)
- ✅ 添加 PATCH 方法到 `/auth/me` 端點

### 2. Frontend (React)

**ProfilePage.tsx**
- ✅ `useEffect` - 自動從後端載入用戶資料
- ✅ `saveProfileToBackend()` - 保存 bio 和 avatar 到後端
- ✅ `handleSave()` - 更新為異步保存
- ✅ `handleAvatarUpload()` - 上傳後自動保存 URL

## DynamoDB 數據結構

```json
{
  "PK": "ORG#sparkboard-demo",
  "SK": "USER#{userId}",
  "entityType": "USER_PROFILE",
  "userId": "{userId}",
  "orgId": "sparkboard-demo",
  "bio": "使用者的個人簡介",
  "avatarUrl": "https://bucket.s3.region.amazonaws.com/path/to/avatar.jpg",
  "createdAt": "2025-11-11T01:00:00.000Z",
  "updatedAt": "2025-11-11T01:30:00.000Z"
}
```

## API 端點

### GET /auth/me
返回用戶資料（包含 bio 和 avatarUrl）

**Response:**
```json
{
  "success": true,
  "user": {
    "userId": "...",
    "email": "...",
    "bio": "個人簡介",
    "avatarUrl": "https://...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### PATCH /auth/me
更新用戶資料

**Request Body:**
```json
{
  "bio": "新的個人簡介",
  "avatarUrl": "https://new-avatar-url.com/image.jpg"
}
```

**Validation:**
- `bio`: 字串，最多 500 字元
- `avatarUrl`: 必須是有效的 URL

## 部署步驟

### 方法 1: 使用部署腳本
```powershell
.\scripts\deploy-auth-update.ps1
```

### 方法 2: 手動部署
```powershell
cd infra
npm install
cdk deploy ApiStack --require-approval never
```

## 測試

1. 啟動開發服務器
```powershell
npm run dev
```

2. 登入並進入 Profile 頁面

3. 測試功能：
   - ✅ 上傳頭像 → 重新整理後仍然存在
   - ✅ 編輯 Bio → 保存後重新整理仍然存在
   - ✅ 查看控制台日誌確認 API 調用成功

## 權限

Auth Lambda 已經有 DynamoDB 讀寫權限：
```typescript
table.grantReadWriteData(this.authFunction);
```

## 注意事項

1. **S3 上傳流程**：
   - 前端請求 presigned URL
   - 前端上傳檔案到 S3
   - 前端調用 PATCH /auth/me 保存 URL

2. **資料隔離**：
   - 每個 organization 的用戶資料分開存儲
   - 使用 `ORG#{orgId}` 作為 Partition Key

3. **錯誤處理**：
   - API 返回詳細的錯誤信息
   - 前端顯示 toast 提示用戶

## 未來改進

- [ ] 添加頭像裁剪功能
- [ ] 支援更多個人資料欄位（電話、地址等）
- [ ] 添加資料變更歷史記錄
- [ ] 實現頭像快取機制
