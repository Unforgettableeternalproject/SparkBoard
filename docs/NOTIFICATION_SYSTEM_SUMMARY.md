# SparkBoard 郵件通知系統實現總結

## ✅ 已完成的工作

### 1. 基礎設施 (CDK)

#### 新增 Stack: `MessagingStack`
- **文件**: `infra/lib/messaging-stack.ts`
- **組件**:
  - SQS 主隊列 (`SparkBoard-Notification-Queue`)
  - SQS 死信隊列 (`SparkBoard-Notification-DLQ`)
  - SNS 主題 (`SparkBoard-Notifications`)
  - Lambda 處理器 (`SparkBoard-NotificationHandler`)

#### 更新 Stack: `ApiStack`
- **新增方法**: `setNotificationQueue(queueUrl, queueArn)`
- **功能**: 將 SQS 隊列 URL 添加到 Items Lambda 環境變數
- **權限**: Items Lambda 可發送訊息到 SQS

#### 更新 App: `infra/bin/app.ts`
- 導入 `MessagingStack`
- 創建 Messaging Stack 實例
- 設定 Stack 依賴關係
- 連接 ApiStack 和 MessagingStack

### 2. Lambda 函數

#### 新增: Notification Handler
- **路徑**: `services/notifications/`
- **文件**:
  - `index.js` - 主處理邏輯
  - `package.json` - 依賴管理
- **功能**:
  - 處理 SQS 訊息批次（最多 10 條）
  - 從 Cognito 獲取用戶郵箱
  - 從 DynamoDB 獲取任務詳情
  - 透過 SNS 發送郵件
  - 錯誤處理和重試機制

#### 更新: Items Lambda
- **文件**: `services/items/index.js`
- **新增依賴**: `@aws-sdk/client-sqs`
- **新增函數**: `sendNotification(message)`
- **觸發點**:
  1. 任務完成時發送 `TASK_COMPLETED` 通知
  2. 創建公告時發送 `ANNOUNCEMENT` 通知

### 3. 通知類型

#### 已實現：

**1. TASK_COMPLETED**
```json
{
  "type": "TASK_COMPLETED",
  "userId": "user-id",
  "itemId": "task-id",
  "orgId": "org-id",
  "title": "任務標題",
  "completedBy": "user@example.com"
}
```
- 觸發時機：任務狀態變更為 completed
- 收件人：任務擁有者
- 郵件內容：任務詳情、子任務完成狀態、截止日期

**2. ANNOUNCEMENT**
```json
{
  "type": "ANNOUNCEMENT",
  "title": "公告標題",
  "content": "公告內容",
  "priority": "urgent|high|normal",
  "createdBy": "admin@example.com",
  "orgId": "org-id"
}
```
- 觸發時機：創建新公告 **且選擇發送郵件通知**
- 收件人：**Cognito User Pool 中所有用戶**（使用分頁支持 500+ 用戶）
- 郵件內容：公告內容、優先級、發布者
- 發送策略：
  - 使用分頁獲取所有用戶（每批 60 個，最多 500 個）
  - 批次發送（每批 10 封，避免 SNS 速率限制）
  - 批次間延遲 100ms
- ⚡ **新功能**：創建公告時可選擇是否發送郵件
  - 預設：發送郵件（`sendEmailNotification: true`）
  - 可取消勾選只發布公告而不發送郵件
  - 適用場景：非重要公告、測試公告、或僅供記錄的公告
- 注意：目前發送給整個 User Pool，未來可以根據 orgId 過濾特定組織成員

**3. TASK_ASSIGNED (已準備，未啟用)**
```json
{
  "type": "TASK_ASSIGNED",
  "userId": "user-id",
  "itemId": "task-id",
  "orgId": "org-id",
  "title": "任務標題",
  "assignedBy": "manager@example.com"
}
```
- 觸發時機：任務被指派（需要前端實現任務分配功能）
- 收件人：被指派的用戶
- 郵件內容：任務詳情、分配者、截止日期

**4. TASK_DELETED (✅ 已實現)**
```json
{
  "type": "TASK_DELETED",
  "userId": "user-id",
  "itemId": "task-id",
  "title": "任務標題",
  "deadline": "2025-12-15T00:00:00.000Z",
  "status": "pending",
  "reason": "overdue_inactive",
  "deletedAt": "2025-12-23T10:30:00.000Z"
}
```
- 觸發時機：**To do 狀態**任務過期時自動刪除
- 觸發者：AutoArchive Lambda（每分鐘檢查一次）
- 收件人：任務擁有者/創建者
- 郵件內容：
  - 任務標題和最後狀態（pending）
  - 原定截止日期
  - 刪除原因（overdue_inactive）
  - 刪除時間
  - 提示：如需繼續處理可重新建立任務
- 條件：`status = pending`（To do）AND `deadline < 當前時間` AND 未封存
- 注意：**In Progress 狀態的任務即使過期也不會被刪除**（表示用戶正在處理中）

### 4. 部署腳本

#### `scripts/deploy-messaging.ps1`
- 安裝 notifications 服務依賴
- 安裝 items 服務 SQS SDK
- 部署 MessagingStack
- 重新部署 ApiStack（添加 SQS 權限）

#### `scripts/test-notifications.ps1`
- 從 CloudFormation 獲取 Queue URL
- 從 Cognito 獲取測試用戶
- 發送測試訊息到 SQS
- 提供檢查清單

### 5. 文檔

#### `docs/FEATURES.md`
- 新增「郵件通知系統」章節
- 架構圖和組件說明
- 通知類型詳細規格
- 實現細節和程式碼範例
- 錯誤處理和監控
- 成本估算

#### `docs/EMAIL_NOTIFICATION_DEPLOYMENT.md`
- 完整部署指南
- 測試步驟
- 監控和除錯
- 常見問題排查
- 生產環境建議

## 📊 系統架構

```
┌─────────────────┐
│  前端 (React)   │
└────────┬────────┘
         │ HTTP POST /items
         ↓
┌─────────────────┐     sendMessage     ┌──────────────────┐
│  Items Lambda   │ ──────────────────→ │   SQS Queue      │
│  (Node.js)      │                     │  (SparkBoard-    │
│                 │                     │   Notification)  │
└─────────────────┘                     └────────┬─────────┘
                                                 │ Event Source
                                                 │ (batch: 10)
                                                 ↓
                                        ┌──────────────────┐
                                        │ Notification     │
                                        │ Handler Lambda   │
                                        │                  │
                                        │ 1. Get user email│
                                        │    from Cognito  │
                                        │ 2. Get item from │
                                        │    DynamoDB      │
                                        │ 3. Format email  │
                                        └────────┬─────────┘
                                                 │ publish
                                                 ↓
                                        ┌──────────────────┐
                                        │   SNS Topic      │
                                        │  (SparkBoard-    │
                                        │   Notifications) │
                                        └────────┬─────────┘
                                                 │ email subscription
                                                 ↓
                                        ┌──────────────────┐
                                        │   User Email     │
                                        │  📧 Inbox        │
                                        └──────────────────┘
```

## 🔧 關鍵配置

### SQS 配置
```typescript
visibilityTimeout: 300 秒 (5 分鐘)
receiveMessageWaitTime: 20 秒 (長輪詢)
maxReceiveCount: 3 (重試 3 次後進入 DLQ)
retentionPeriod: 4 天
```

### Lambda 事件源
```typescript
batchSize: 10 (一次處理 10 條訊息)
maxBatchingWindow: 5 秒 (最多等待 5 秒湊批次)
```

### 環境變數

**Items Lambda:**
- `TABLE_NAME` - DynamoDB 表名
- `NOTIFICATION_QUEUE_URL` - SQS 隊列 URL (新增)

**Notification Handler:**
- `TABLE_NAME` - DynamoDB 表名
- `SNS_TOPIC_ARN` - SNS 主題 ARN
- `USER_POOL_ID` - Cognito User Pool ID

## 🚀 部署流程

### 1. 部署基礎設施
```powershell
cd scripts
.\deploy-messaging.ps1
```

### 2. 訂閱 SNS 主題
```bash
# 獲取 Topic ARN
aws cloudformation describe-stacks \
  --stack-name SparkBoard-Messaging \
  --query "Stacks[0].Outputs[?OutputKey=='NotificationTopicArn'].OutputValue"

# 訂閱郵箱
aws sns subscribe \
  --topic-arn <TOPIC-ARN> \
  --protocol email \
  --notification-endpoint your-email@example.com
```

### 3. 測試系統
```powershell
.\test-notifications.ps1
```

### 4. 驗證結果
- ✅ CloudWatch Logs: `/aws/lambda/SparkBoard-NotificationHandler`
- ✅ SQS Queue metrics
- ✅ 郵箱收件

## 📈 監控指標

### SQS
- Messages Sent
- Messages Received  
- Messages Deleted
- Approximate Age of Oldest Message

### SNS
- Number of Notifications Sent
- Number of Notifications Failed

### Lambda
- Invocations
- Errors
- Duration
- Throttles

## 💰 成本估算

**假設每月 10,000 個通知：**
- SQS: $0.004
- SNS: $0.20 (1000 封免費，額外 9000 封)
- Lambda: $0.002 (免費額度內)
- **總計: ~$0.21/月**

**優化建議：**
- ✅ 使用長輪詢減少空請求
- ✅ 批次處理提高效率
- ✅ 免費額度內可處理 1000+ 通知/月

## 🔍 測試檢查清單

### 部署後檢查
- [ ] CloudFormation Stack 部署成功
- [ ] SQS Queue 已創建
- [ ] SNS Topic 已創建
- [ ] Lambda 函數已部署
- [ ] Items Lambda 有 SQS 發送權限
- [ ] Notification Handler 有 Cognito/DynamoDB/SNS 權限

### 功能測試
- [ ] 完成任務觸發通知
- [ ] 創建公告觸發通知
- [ ] 郵件內容正確格式化
- [ ] 用戶收到郵件
- [ ] Lambda 日誌無錯誤

### 錯誤處理測試
- [ ] 無效用戶 ID 處理
- [ ] 不存在的任務 ID 處理
- [ ] Cognito 查詢失敗處理
- [ ] DynamoDB 查詢失敗處理
- [ ] SNS 發送失敗處理
- [ ] 訊息進入 DLQ (3 次失敗後)

## 🎯 未來擴展

### 短期 (1-2 週)
- [x] **任務過期刪除通知** - 已實現 TASK_DELETED 通知類型
- [ ] 任務分配通知
- [ ] 任務即將到期提醒（在 deadline 前 24 小時）
- [ ] 郵件偏好設定（用戶可選擇接收哪些通知）

### 中期 (1-2 個月)
- [ ] HTML 郵件範本
- [ ] 郵件範本系統
- [ ] 通知歷史記錄
- [ ] 批次摘要郵件（每日/每週）

### 長期 (3+ 個月)
- [ ] SMS 通知整合
- [ ] Slack/Discord webhook
- [ ] 推送通知 (PWA)
- [ ] 自定義通知規則
- [ ] 通知統計和分析

## 🔄 自動化任務管理

### AutoArchive Lambda 功能

**觸發頻率**: 每 1 分鐘（EventBridge Rule）

**處理邏輯**:

1. **封存已完成任務**
   - 條件：`entityType = ITEM` AND `autoArchiveAt <= 當前時間` AND 未封存
   - 操作：設置 `archivedAt` 和 `archiveStatus`（completed/partial/aborted）
   - 通知：無（任務完成時已發送通知）

2. **刪除過期 To do 任務** ⚡ NEW
   - 條件：`entityType = ITEM` AND `status = pending`（To do）AND `deadline < 當前時間` AND 未封存
   - 操作：刪除任務記錄
   - 通知：發送 TASK_DELETED 通知給任務擁有者
   - 郵件內容：
     - 任務標題和最後狀態（pending）
     - 原定截止日期
     - 刪除原因（overdue_inactive）
     - 建議重新建立任務的提示
   - **重要**：In Progress 狀態的任務不會被刪除（表示用戶正在處理）

**優勢**:
- 自動清理過期且未開始的任務，保持工作區整潔
- 避免長期擱置的任務堆積造成視覺混亂
- 保留正在處理中的任務（in-progress），尊重用戶的工作進度
- 通知用戶被刪除的任務，防止資訊遺失
- 鼓勵用戶及時處理任務或更新截止日期/狀態

## 📚 相關文件

- [FEATURES.md](./docs/FEATURES.md#郵件通知系統) - 功能規格
- [EMAIL_NOTIFICATION_DEPLOYMENT.md](./docs/EMAIL_NOTIFICATION_DEPLOYMENT.md) - 部署指南
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - 系統架構
- [API_REFERENCE.md](./docs/API_REFERENCE.md) - API 文檔

## 👥 團隊參考

### 開發者
- 查看 Lambda 日誌定位問題
- 使用測試腳本驗證功能
- 監控 SQS/SNS 指標

### 運維人員
- 檢查 DLQ 失敗訊息
- 調整 SQS 批次大小和超時
- 設定 CloudWatch 告警

### 產品經理
- 了解通知類型和內容
- 規劃新通知場景
- 評估用戶體驗

---

**最後更新**: 2025-11-25  
**版本**: 1.0.0  
**狀態**: ✅ 已實現並測試
