# SparkBoard API Reference

> **Base URL:** `https://api.sparkboard.example.com`  
> **認證方式:** Bearer Token (Cognito ID Token)

## 核心 API 端點

### 📋 Items API - 任務/公告管理

#### 1. 取得項目列表
```http
GET /items
Authorization: Bearer {idToken}
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "01JCXXX",
      "sk": "ITEM#01JCXXX",
      "type": "task",
      "title": "完成專案文件",
      "content": "需要撰寫技術文件和 API 說明",
      "status": "active",
      "priority": "high",
      "userId": "uuid-123",
      "userName": "張小明",
      "createdAt": "2025-11-18T10:00:00.000Z",
      "deadline": "2025-11-25T23:59:59.000Z",
      "subtasks": [
        { "id": "sub-1", "title": "架構圖", "completed": false },
        { "id": "sub-2", "title": "API 文件", "completed": true }
      ],
      "attachments": []
    },
    {
      "id": "01JCYYY",
      "sk": "ITEM#01JCYYY",
      "type": "announcement",
      "title": "系統維護通知",
      "content": "本週五進行系統維護",
      "priority": "urgent",
      "isPinned": true,
      "pinnedUntil": "2025-11-22T23:59:59.000Z",
      "userId": "uuid-456",
      "userName": "管理員",
      "createdAt": "2025-11-18T09:00:00.000Z"
    }
  ]
}
```

---

#### 2. 創建任務
```http
POST /items
Authorization: Bearer {idToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "task",
  "title": "實作新功能",
  "content": "開發用戶權限管理功能",
  "priority": "high",
  "deadline": "2025-11-30T23:59:59.000Z",
  "subtasks": [
    { "id": "sub-1", "title": "設計資料庫", "completed": false },
    { "id": "sub-2", "title": "API 開發", "completed": false },
    { "id": "sub-3", "title": "前端整合", "completed": false }
  ],
  "attachments": [
    {
      "name": "spec.pdf",
      "url": "https://s3.amazonaws.com/bucket/user123/spec.pdf",
      "type": "application/pdf",
      "size": 123456,
      "key": "user123/2025-11-18/uuid-spec.pdf"
    }
  ]
}
```

**Response 201:**
```json
{
  "item": {
    "id": "01JCZZZ",
    "sk": "ITEM#01JCZZZ",
    "type": "task",
    "title": "實作新功能",
    "status": "active",
    "userId": "uuid-123",
    "userName": "張小明",
    "createdAt": "2025-11-18T12:00:00.000Z"
  }
}
```

---

#### 3. 更新項目
```http
PATCH /items/{itemId}
Authorization: Bearer {idToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "completed",
  "subtasks": [
    { "id": "sub-1", "title": "設計資料庫", "completed": true },
    { "id": "sub-2", "title": "API 開發", "completed": true },
    { "id": "sub-3", "title": "前端整合", "completed": true }
  ]
}
```

**Response 200:**
```json
{
  "item": {
    "id": "01JCZZZ",
    "status": "completed",
    "completedAt": "2025-11-20T15:30:00.000Z",
    "updatedAt": "2025-11-20T15:30:00.000Z"
  }
}
```

---

#### 4. 刪除項目
```http
DELETE /items/{itemId}
Authorization: Bearer {idToken}

# 管理員強制刪除（跳過限制）
DELETE /items/{itemId}?forceDelete=true
Authorization: Bearer {idToken}
```

**Response 200:**
```json
{
  "message": "Item deleted successfully"
}
```

---

### 🔐 Auth API - 身份認證

#### 5. 取得當前用戶資訊
```http
GET /auth/me
Authorization: Bearer {idToken}
```

**Response 200:**
```json
{
  "user": {
    "userId": "c7e46ab8-f0b1-70f0-78c6-0d6c51ceeb63",
    "username": "user@example.com",
    "email": "user@example.com",
    "name": "張小明",
    "groups": ["Users"],
    "isAdmin": false,
    "isModerator": false,
    "orgId": "sparkboard",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### 📤 Uploads API - 檔案上傳

#### 6. 取得預簽名上傳 URL
```http
POST /uploads/presign
Authorization: Bearer {idToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "fileName": "document.pdf",
  "contentType": "application/pdf",
  "fileSize": 1234567
}
```

**Response 200:**
```json
{
  "upload": {
    "url": "https://s3.amazonaws.com/bucket/user123/2025-11-18/uuid-document.pdf?X-Amz-Algorithm=...",
    "key": "user123/2025-11-18/uuid-document.pdf",
    "bucket": "sparkboard-files-123456789-ap-northeast-1",
    "expiresIn": 300
  }
}
```

**使用方式:**
```javascript
// 1. 取得預簽名 URL
const { upload } = await fetch('/uploads/presign', {...})

// 2. 直接上傳到 S3
await fetch(upload.url, {
  method: 'PUT',
  headers: { 'Content-Type': file.type },
  body: file
})

// 3. 儲存 metadata 到項目
const attachment = {
  name: file.name,
  url: `https://${upload.bucket}.s3.amazonaws.com/${upload.key}`,
  type: file.type,
  size: file.size,
  key: upload.key
}
```

---

### 👥 Users API - 用戶管理（僅管理員）

#### 7. 取得所有用戶
```http
GET /users
Authorization: Bearer {idToken}
```

**Response 200:**
```json
{
  "users": [
    {
      "userId": "uuid-123",
      "username": "user1@example.com",
      "email": "user1@example.com",
      "enabled": true,
      "status": "CONFIRMED",
      "groups": ["Users"],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastModifiedAt": "2025-11-18T10:00:00.000Z"
    },
    {
      "userId": "uuid-456",
      "username": "admin@example.com",
      "email": "admin@example.com",
      "enabled": true,
      "status": "CONFIRMED",
      "groups": ["Admin"],
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### 8. 設定用戶群組
```http
POST /users/{userId}/groups
Authorization: Bearer {idToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "groupName": "Moderators"
}
```

**Response 200:**
```json
{
  "message": "User added to group successfully",
  "userId": "uuid-123",
  "groupName": "Moderators"
}
```

---

### 📊 Monitoring API - 監控數據（僅管理員）

#### 9. 取得 CloudWatch 指標
```http
POST /monitoring/metrics
Authorization: Bearer {idToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "namespace": "AWS/ApiGateway",
  "metricName": "Count",
  "dimensions": [
    { "Name": "ApiName", "Value": "SparkBoardAPI" }
  ],
  "startTime": "2025-11-18T00:00:00.000Z",
  "endTime": "2025-11-18T23:59:59.000Z",
  "period": 300,
  "statistics": ["Sum"]
}
```

**Response 200:**
```json
{
  "datapoints": [
    {
      "timestamp": "2025-11-18T10:00:00.000Z",
      "sum": 150,
      "unit": "Count"
    },
    {
      "timestamp": "2025-11-18T10:05:00.000Z",
      "sum": 200,
      "unit": "Count"
    }
  ]
}
```

---

### ❤️ Health API - 健康檢查

#### 10. 系統健康檢查
```http
GET /health
```

**Response 200:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-18T12:00:00.000Z",
  "version": "1.0.0"
}
```

---

## 錯誤回應格式

所有錯誤回應使用標準格式：

```json
{
  "error": "錯誤類型",
  "message": "詳細錯誤訊息"
}
```

### 常見錯誤碼

| 狀態碼 | 錯誤 | 說明 |
|--------|------|------|
| 400 | Bad Request | 請求參數錯誤 |
| 401 | Unauthorized | 未提供認證 Token 或 Token 無效 |
| 403 | Forbidden | 權限不足 |
| 404 | Not Found | 資源不存在 |
| 409 | Conflict | 資源衝突（如重複創建）|
| 500 | Internal Server Error | 伺服器內部錯誤 |

**範例:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

---

## 認證流程

1. **取得 ID Token:**
   ```javascript
   // 登入後從 Cognito 取得
   const session = await cognitoUser.getSession()
   const idToken = session.getIdToken().getJwtToken()
   ```

2. **攜帶 Token 呼叫 API:**
   ```javascript
   const response = await fetch(`${API_URL}/items`, {
     headers: {
       'Authorization': idToken  // 直接使用 token，不需要 "Bearer" 前綴
     }
   })
   ```

3. **Token 過期處理:**
   - ID Token 有效期：1 小時
   - 使用 Refresh Token 自動更新
   - 401 錯誤時重新登入

---

**最後更新:** 2025-11-18
