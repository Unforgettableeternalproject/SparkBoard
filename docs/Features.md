# SparkBoard 功能特性文件

> **最後更新：** 2025-11-18  
> **版本：** 1.0.0

## 📋 目錄

- [核心功能](#核心功能)
- [任務管理系統](#任務管理系統)
- [公告系統](#公告系統)
- [郵件通知系統](#郵件通知系統)
- [自動封存機制](#自動封存機制)
- [檔案附件管理](#檔案附件管理)
- [用戶管理](#用戶管理)
- [監控儀表板](#監控儀表板)

---

## 🎯 核心功能

SparkBoard 是一個完整的任務與公告管理平台，具備以下核心特性：

### ✨ 主要特點

| 特性 | 說明 |
|------|------|
| 🔐 **身份驗證** | AWS Cognito 整合，支援 Email/密碼登入和 OAuth |
| 📝 **任務管理** | 完整的任務生命週期管理，包含子任務和截止日期 |
| 📢 **公告系統** | 版主可發布公告，支援置頂和過期設定 |
| � **郵件通知** | SQS/SNS 整合，自動發送任務完成和公告通知郵件 |
| 📎 **檔案附件** | S3 整合，支援圖片、PDF、Office 文件上傳 |
| ⚡ **自動封存** | 已完成任務在截止日期後自動封存 |
| 👥 **角色權限** | 三級權限系統：管理員、版主、一般用戶 |
| 📊 **監控儀表板** | 管理員可查看系統指標和性能數據 |
| 🎨 **響應式設計** | 支援桌面和移動裝置 |
| 🌙 **暗黑模式** | 支援淺色/深色主題切換 |
| 🔄 **即時更新** | 自動輪詢最新資料（5 分鐘間隔）|

---

## 📝 任務管理系統

### 功能概覽

任務管理是 SparkBoard 的核心功能，提供完整的任務生命週期管理。

#### 任務創建

**功能描述：**
- 所有登入用戶都可以創建任務
- 支援豐富的任務描述（Markdown 格式）
- 可設定優先級、截止日期
- 支援多個檔案附件
- 支援子任務清單

**UI 組件：** `CreateItemDialog.tsx`

**表單欄位：**

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| 標題 | 文字 | ✅ | 任務名稱（最多 200 字元）|
| 內容 | Markdown | ❌ | 詳細描述，支援 Markdown 格式 |
| 優先級 | 選擇 | ✅ | Low, Medium, High, Urgent |
| 截止日期 | 日期時間 | ❌ | 任務到期時間 |
| 附件 | 檔案 | ❌ | 支援多個檔案上傳（最多 10 MB/個）|
| 子任務 | 清單 | ❌ | 可新增多個子任務項目 |

**範例請求：**
```json
{
  "type": "task",
  "title": "完成專案技術文件",
  "content": "# 需要完成的項目\n\n- 系統架構圖\n- API 文件\n- 部署指南",
  "priority": "high",
  "deadline": "2025-11-30T23:59:59.000Z",
  "subtasks": [
    { "id": "sub-1", "title": "繪製架構圖", "completed": false },
    { "id": "sub-2", "title": "撰寫 API 文件", "completed": false }
  ],
  "attachments": [
    {
      "name": "template.docx",
      "url": "https://s3.amazonaws.com/.../template.docx",
      "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "size": 45678,
      "key": "userId/2025-11-18/uuid-template.docx"
    }
  ]
}
```

#### 任務狀態管理

**任務狀態流轉：**

```
[創建] → active (進行中)
         ↓
[完成] → completed (已完成)
         ↓
[封存] → archived (已封存)
```

**狀態說明：**

| 狀態 | 英文 | 說明 | 允許操作 |
|------|------|------|---------|
| 進行中 | active | 新創建或進行中的任務 | 編輯、完成、刪除* |
| 已完成 | completed | 標記為完成的任務 | 編輯、封存、重新開始 |
| 已封存 | archived | 封存的任務 | 僅查看（管理員可強制刪除）|

*註：已進行中的任務（有子任務歷史記錄）不能刪除，只能封存

#### 子任務功能

**特點：**
- 每個任務可包含多個子任務
- 子任務可單獨標記完成
- 追蹤子任務完成進度
- 影響任務的封存狀態

**子任務結構：**
```typescript
interface Subtask {
  id: string              // 唯一識別碼
  title: string           // 子任務標題
  completed: boolean      // 是否完成
  completedAt?: string    // 完成時間（ISO 8601）
}
```

**完成進度計算：**
```typescript
const progress = (completedSubtasks / totalSubtasks) * 100

// 範例：5 個子任務，3 個已完成
const progress = (3 / 5) * 100 // 60%
```

#### 任務編輯

**可編輯欄位：**
- 標題、內容
- 優先級
- 截止日期
- 附件（新增/移除）
- 子任務（新增/編輯/刪除/標記完成）
- 狀態（進行中 ↔ 已完成）

**UI 組件：** `EditItemDialog.tsx`

**權限限制：**
- 任務擁有者可編輯自己的任務
- 版主和管理員可編輯任何任務

#### 任務刪除

**刪除限制：**

1. **一般刪除：**
   - 只能刪除 `active` 狀態的任務
   - 任務必須未曾進入 `in-progress` 狀態
   - 檢查標誌：`hasBeenInProgress === false`

2. **強制刪除（管理員）：**
   - 使用 `?forceDelete=true` 查詢參數
   - 跳過所有限制檢查
   - 可刪除已封存的任務

**範例：**
```typescript
// 一般刪除
DELETE /items/task-id

// 管理員強制刪除
DELETE /items/task-id?forceDelete=true
```

#### 任務查詢與過濾

**查詢選項：**

```http
GET /items?type=task&status=active&limit=20&lastKey=xxx
```

**查詢參數：**
- `type=task` - 只顯示任務
- `status=active|completed|archived` - 按狀態過濾
- `limit` - 每頁數量（預設 20）
- `lastKey` - 分頁游標

**前端過濾：**
- 按優先級過濾
- 按截止日期排序
- 搜尋標題/內容
- 查看自己創建的任務（透過 GSI1）

#### 任務視圖

SparkBoard 提供多種任務視圖：

1. **列表視圖** (`ItemList.tsx`)
   - 預設視圖
   - 顯示所有任務詳細資訊
   - 支援分頁

2. **看板視圖** (`KanbanView.tsx`)
   - 按狀態分欄顯示
   - 拖放排序（規劃中）
   - 適合敏捷開發

3. **個人視圖** (`ProfilePage.tsx`)
   - 只顯示自己創建的任務
   - 按時間倒序排列

---

## 📢 公告系統

### 功能概覽

公告系統允許版主和管理員發布重要通知給所有用戶。

#### 公告創建

**權限要求：** 版主或管理員

**表單欄位：**

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| 標題 | 文字 | ✅ | 公告標題 |
| 內容 | Markdown | ✅ | 公告內容 |
| 優先級 | 選擇 | ✅ | Low, Medium, High, Urgent |
| 過期時間 | 日期時間 | ❌ | 公告過期後不再顯示 |
| 是否置頂 | 切換 | ❌ | 在頂部橫幅顯示 |
| 置頂至 | 日期時間 | ❌ | 置頂的結束時間 |
| 附件 | 檔案 | ❌ | 相關文件 |

**範例請求：**
```json
{
  "type": "announcement",
  "title": "【重要】系統維護通知",
  "content": "系統將於 2025-11-25 進行維護，預計需要 2 小時。\n\n維護期間服務將暫時中斷。",
  "priority": "urgent",
  "expiresAt": "2025-11-26T00:00:00.000Z",
  "isPinned": true,
  "pinnedUntil": "2025-11-25T23:59:59.000Z"
}
```

#### 公告置頂

**置頂機制：**
- 置頂的公告顯示在頁面頂部橫幅
- 可同時置頂多個公告（輪播顯示）
- 置頂有時間限制（`pinnedUntil`）
- 過期後自動取消置頂

**UI 組件：**
- `AnnouncementBanner.tsx` - 橫幅組件
- `AnnouncementCard.tsx` - 單個橫幅

**顯示邏輯：**
```typescript
function isPinned(announcement: Announcement): boolean {
  if (!announcement.isPinned) return false
  if (!announcement.pinnedUntil) return true
  
  const now = new Date()
  const pinnedUntil = new Date(announcement.pinnedUntil)
  
  return now <= pinnedUntil
}
```

#### 公告過期

**自動過期：**
- 公告可設定過期時間（`expiresAt`）
- 過期後不再顯示（前端過濾）
- 過期的公告仍保留在資料庫中

**過期檢查：**
```typescript
function isExpired(announcement: Announcement): boolean {
  if (!announcement.expiresAt) return false
  
  const now = new Date()
  const expiresAt = new Date(announcement.expiresAt)
  
  return now > expiresAt
}
```

#### 公告編輯與刪除

**編輯權限：**
- 公告創建者
- 管理員
- 版主

**可編輯內容：**
- 標題、內容
- 優先級
- 過期時間
- 置頂狀態和時間
- 附件

**刪除限制：**
- 版主和管理員可刪除任何公告
- 一般用戶無法刪除公告

---

## 📧 郵件通知系統

### 功能概覽

SparkBoard 整合了 AWS SQS 和 SNS，提供可靠的異步郵件通知服務。當重要事件發生時（如任務完成、發布公告），系統會自動發送郵件通知給相關用戶。

### 架構設計

#### 組件架構

```
Items Lambda → SQS Queue → Notification Lambda → SNS Topic → Email
                    ↓
              Dead Letter Queue (失敗重試)
```

**組件說明：**

| 組件 | 類型 | 功能 |
|------|------|------|
| Notification Queue | SQS | 主要通知隊列，緩存待處理的通知 |
| Dead Letter Queue | SQS | 接收處理失敗的訊息（3 次重試後） |
| Notification Topic | SNS | 郵件發送主題，支援多訂閱者 |
| Notification Handler | Lambda | 處理 SQS 訊息，格式化並發送郵件 |

#### SQS 配置

```typescript
{
  queueName: 'SparkBoard-Notification-Queue',
  visibilityTimeout: 300,        // 5 分鐘
  receiveMessageWaitTime: 20,    // 長輪詢 20 秒
  deadLetterQueue: {
    queue: deadLetterQueue,
    maxReceiveCount: 3            // 重試 3 次後進入 DLQ
  }
}
```

#### Lambda 事件源

```typescript
{
  batchSize: 10,                   // 一次處理 10 條訊息
  maxBatchingWindow: 5,            // 最多等待 5 秒湊批次
}
```

### 通知類型

#### 1. 任務完成通知

**觸發條件：**
- 任務狀態從 `active` 變更為 `completed`
- 所有子任務標記為完成

**訊息格式：**
```json
{
  "type": "TASK_COMPLETED",
  "userId": "abc-123-def",
  "itemId": "task-456",
  "orgId": "default",
  "title": "完成需求文檔撰寫",
  "completedBy": "user@example.com"
}
```

**郵件內容：**
```
主旨：✅ Task Completed: 完成需求文檔撰寫

Hi there,

Your task "完成需求文檔撰寫" has been marked as completed.

Task Details:
- Title: 完成需求文檔撰寫
- Completed by: user@example.com
- Completed at: 2025-11-25 18:30:00
- Original deadline: 2025-11-26 00:00:00

Subtasks (3/3 completed):
  ✓ 收集需求
  ✓ 撰寫文檔
  ✓ 團隊審核

View your tasks at: https://sparkboard.example.com
```

#### 2. 任務分配通知

**觸發條件：**
- 新任務被創建並指派給特定用戶（未來功能）

**訊息格式：**
```json
{
  "type": "TASK_ASSIGNED",
  "userId": "user-id",
  "itemId": "task-id",
  "orgId": "default",
  "title": "設計新功能 UI",
  "assignedBy": "manager@example.com"
}
```

#### 3. 公告通知

**觸發條件：**
- 新公告被創建
- 公告優先級為 `high` 或 `urgent`

**訊息格式：**
```json
{
  "type": "ANNOUNCEMENT",
  "title": "系統維護通知",
  "content": "系統將於本週五晚上 10 點進行維護...",
  "priority": "urgent",
  "createdBy": "admin@example.com",
  "orgId": "default"
}
```

**郵件內容：**
```
主旨：🚨 Announcement: 系統維護通知

SparkBoard Announcement

系統將於本週五晚上 10 點進行維護，預計需要 2 小時...

---
Posted by: admin@example.com
Priority: Urgent
Time: 2025-11-25 14:00:00

View more at: https://sparkboard.example.com
```

### 實現細節

#### Items Lambda 發送通知

```javascript
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs')
const sqsClient = new SQSClient({})

// 在任務完成時發送通知
if (newStatus === 'completed' && completedAtSet) {
  await sqsClient.send(new SendMessageCommand({
    QueueUrl: process.env.NOTIFICATION_QUEUE_URL,
    MessageBody: JSON.stringify({
      type: 'TASK_COMPLETED',
      userId: item.userId,
      itemId: item.itemId,
      orgId: user.orgId,
      title: item.title,
      completedBy: user.email
    })
  }))
}
```

#### Notification Handler 處理邏輯

```javascript
exports.handler = async (event) => {
  // 處理每條 SQS 訊息
  for (const record of event.Records) {
    const message = JSON.parse(record.body)
    
    switch (message.type) {
      case 'TASK_COMPLETED':
        await processTaskCompletion(message)
        break
      
      case 'TASK_ASSIGNED':
        await processTaskAssignment(message)
        break
      
      case 'ANNOUNCEMENT':
        await processAnnouncement(message)
        break
    }
  }
}

async function processTaskCompletion(event) {
  // 1. 從 Cognito 獲取用戶郵箱
  const userEmail = await getUserEmail(event.userId)
  
  // 2. 從 DynamoDB 獲取任務詳情
  const item = await getItemDetails(event.orgId, event.itemId)
  
  // 3. 格式化郵件內容
  const subject = `✅ Task Completed: ${event.title}`
  const message = formatTaskCompletionEmail(event, item)
  
  // 4. 透過 SNS 發送郵件
  await sendEmailNotification(userEmail, subject, message)
}
```

#### SNS 郵件發送

```javascript
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')
const snsClient = new SNSClient({})

async function sendEmailNotification(email, subject, message) {
  await snsClient.send(new PublishCommand({
    TopicArn: process.env.SNS_TOPIC_ARN,
    Subject: subject,
    Message: message,
    MessageAttributes: {
      email: {
        DataType: 'String',
        StringValue: email
      }
    }
  }))
}
```

### 錯誤處理

#### 重試機制

**SQS 配置：**
- 可見性超時：5 分鐘
- 最大接收次數：3 次
- 失敗後進入 DLQ

**Lambda 處理：**
```javascript
try {
  await processNotification(message)
} catch (error) {
  console.error('Error processing notification:', error)
  // Lambda 返回錯誤，SQS 自動重試
  throw error
}
```

#### Dead Letter Queue

**DLQ 配置：**
```typescript
{
  queueName: 'SparkBoard-Notification-DLQ',
  retentionPeriod: 14 days
}
```

**監控：**
- CloudWatch Alarm 當 DLQ 有訊息時觸發
- 管理員可檢視 DLQ 中的失敗訊息
- 手動重新處理或分析失敗原因

### 部署與測試

#### 部署 MessagingStack

```powershell
# 執行部署腳本
.\scripts\deploy-messaging.ps1

# 腳本會：
# 1. 安裝 notifications 服務依賴
# 2. 更新 items 服務依賴（SQS SDK）
# 3. 部署 MessagingStack (SQS + SNS + Lambda)
# 4. 重新部署 ApiStack（添加 SQS 權限）
```

#### 訂閱 SNS 主題

```bash
# 方法 1: AWS Console
1. 前往 SNS Console
2. 選擇 SparkBoard-Notifications topic
3. Create subscription → Email → 輸入郵箱
4. 確認訂閱郵件

# 方法 2: AWS CLI
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:xxx:SparkBoard-Notifications \
  --protocol email \
  --notification-endpoint your-email@example.com
```

#### 測試通知

```powershell
# 發送測試通知
.\scripts\test-notifications.ps1

# 腳本會發送：
# 1. TASK_COMPLETED 測試訊息
# 2. ANNOUNCEMENT 測試訊息

# 檢查結果：
# - CloudWatch Logs: /aws/lambda/SparkBoard-NotificationHandler
# - SQS Queue metrics
# - 郵箱收件
```

### 監控與日誌

#### CloudWatch 指標

**SQS 指標：**
- `NumberOfMessagesSent` - 發送的訊息數量
- `NumberOfMessagesReceived` - 接收的訊息數量
- `ApproximateAgeOfOldestMessage` - 最舊訊息年齡
- `NumberOfMessagesDeleted` - 成功處理的訊息數量

**SNS 指標：**
- `NumberOfNotificationsSent` - 發送的通知數量
- `NumberOfNotificationsFailed` - 失敗的通知數量

**Lambda 指標：**
- 執行次數
- 錯誤率
- 執行時間

#### Lambda 日誌

```
/aws/lambda/SparkBoard-NotificationHandler

[INFO] Notification handler triggered: 10 messages
[INFO] Processing message: TASK_COMPLETED
[INFO] User email: user@example.com
[INFO] Email notification sent to user@example.com
[INFO] All messages processed successfully
```

### 成本優化

**設計考量：**
- ✅ SQS 長輪詢減少空請求
- ✅ Lambda 批次處理（10 條/次）
- ✅ 非同步處理不阻塞主流程
- ✅ 重試機制避免訊息丟失
- ✅ DLQ 隔離問題訊息

**預估成本（每月）：**
- SQS: $0.40 per 1M requests → ~$0.01 (1000 notifications)
- SNS: $0.50 per 1M requests → ~$0.01 (1000 emails)
- Lambda: $0.20 per 1M requests → ~$0.01 (included in free tier)
- **總計：** <$0.10/月 (低流量情況)

---

## ⚡ 自動封存機制

### 功能概覽

自動封存是一個後台服務，定期檢查已完成的任務並在適當時機自動封存。

### 觸發機制

**EventBridge 排程：**
```yaml
Rule: SparkBoard-AutoArchive-Rule
Schedule: rate(1 minute)  # 每分鐘執行一次
Target: SparkBoard-AutoArchive Lambda
State: ENABLED
```

### 封存邏輯

#### 1. 任務完成時

當任務狀態從 `active` 變更為 `completed` 時：

```javascript
// 計算自動封存時間
let autoArchiveTime

if (item.deadline) {
  const deadlineTime = new Date(item.deadline).getTime()
  const nowTime = Date.now()
  
  if (deadlineTime > nowTime) {
    // 截止日期在未來，在截止日期時封存
    autoArchiveTime = new Date(deadlineTime).toISOString()
  } else {
    // 截止日期已過，3 分鐘後封存
    autoArchiveTime = new Date(nowTime + 3 * 60 * 1000).toISOString()
  }
} else {
  // 沒有截止日期，3 分鐘後封存
  autoArchiveTime = new Date(Date.now() + 3 * 60 * 1000).toISOString()
}

// 設定 autoArchiveAt 欄位
item.autoArchiveAt = autoArchiveTime
```

#### 2. Lambda 執行時

AutoArchive Lambda 每分鐘執行以下步驟：

```javascript
// 1. 掃描 DynamoDB 尋找需要封存的任務
const now = new Date().toISOString()

const scanParams = {
  TableName: 'SparkTable',
  FilterExpression: 'entityType = :type AND attribute_exists(autoArchiveAt) AND autoArchiveAt <= :now',
  ExpressionAttributeValues: {
    ':type': 'ITEM',
    ':now': now
  }
}

const result = await docClient.scan(scanParams)

// 2. 對每個任務計算封存狀態
for (const item of result.Items) {
  let archiveStatus
  
  if (!item.subtasks || item.subtasks.length === 0) {
    archiveStatus = 'completed'
  } else {
    const completed = item.subtasks.filter(s => s.completed).length
    const total = item.subtasks.length
    
    if (completed === total) {
      archiveStatus = 'completed'  // 所有子任務完成
    } else if (completed > 0) {
      archiveStatus = 'partial'    // 部分子任務完成
    } else {
      archiveStatus = 'aborted'    // 無子任務完成
    }
  }
  
  // 3. 更新任務狀態
  await docClient.update({
    TableName: 'SparkTable',
    Key: { PK: item.PK, SK: item.SK },
    UpdateExpression: 'SET archivedAt = :archivedAt, archiveStatus = :archiveStatus, updatedAt = :updatedAt REMOVE autoArchiveAt',
    ExpressionAttributeValues: {
      ':archivedAt': new Date().toISOString(),
      ':archiveStatus': archiveStatus,
      ':updatedAt': new Date().toISOString()
    }
  })
}
```

### 封存狀態

| 狀態 | 英文 | 說明 | 條件 |
|------|------|------|------|
| 已完成封存 | completed | 任務正常完成 | 所有子任務都已完成 |
| 部分完成封存 | partial | 任務部分完成 | 部分子任務完成，部分未完成 |
| 中止封存 | aborted | 任務被強制封存 | 沒有完成任何子任務 |

### 手動封存

用戶也可以手動封存任務：

**一般封存：**
```http
PATCH /items/{itemId}
Content-Type: application/json

{
  "status": "archived",
  "archiveStatus": "completed"
}
```

**強制封存（管理員）：**
```http
PATCH /items/{itemId}
Content-Type: application/json

{
  "status": "archived",
  "archiveStatus": "forced"
}
```

### 時區處理

**重要：** 所有時間都轉換為 UTC 存儲

```typescript
// 前端：將 datetime-local 轉換為 UTC
function convertToUTC(dateTimeLocal?: string) {
  if (!dateTimeLocal) return undefined
  return new Date(dateTimeLocal).toISOString()
}

// 範例
const localTime = "2025-11-25T18:00"  // 用戶輸入（本地時間）
const utcTime = convertToUTC(localTime)  // "2025-11-25T10:00:00.000Z" (UTC)
```

**套用於：**
- `deadline`
- `expiresAt`
- `pinnedUntil`
- `autoArchiveAt`

### 監控與日誌

**CloudWatch 日誌：**
```
/aws/lambda/SparkBoard-AutoArchive

[INFO] Found 5 tasks to auto-archive
[INFO] Archived task ITEM#xxx with status: completed
[INFO] Archived task ITEM#yyy with status: partial
[INFO] Auto-archive completed in 234ms
```

**指標：**
- 每次執行封存的任務數量
- 執行時間
- 錯誤率

---

## 📎 檔案附件管理

### S3 整合

SparkBoard 使用 AWS S3 存儲所有檔案附件，透過預簽名 URL 實現安全的直接上傳。

### 上傳流程

#### 完整步驟

1. **前端：驗證檔案**
   ```typescript
   // 檢查檔案類型
   const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', ...]
   if (!allowedTypes.includes(file.type)) {
     throw new Error('不支援的檔案類型')
   }
   
   // 檢查檔案大小
   const maxSize = 10 * 1024 * 1024 // 10 MB
   if (file.size > maxSize) {
     throw new Error('檔案大小超過 10 MB')
   }
   ```

2. **前端：請求預簽名 URL**
   ```typescript
   const response = await fetch(`${API_URL}/uploads/presign`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': idToken
     },
     body: JSON.stringify({
       fileName: file.name,
       contentType: file.type,
       fileSize: file.size
     })
   })
   
   const { upload } = await response.json()
   // upload = { url, key, bucket, expiresIn: 300 }
   ```

3. **後端：生成預簽名 URL**
   ```javascript
   const key = `${userId}/${date}/${uuid}-${fileName}`
   
   const command = new PutObjectCommand({
     Bucket: BUCKET_NAME,
     Key: key,
     ContentType: contentType,
     ContentLength: fileSize
   })
   
   const presignedUrl = await getSignedUrl(s3Client, command, {
     expiresIn: 300 // 5 分鐘
   })
   ```

4. **前端：直接上傳到 S3**
   ```typescript
   const uploadResponse = await fetch(upload.url, {
     method: 'PUT',
     headers: {
       'Content-Type': file.type
     },
     body: file
   })
   
   if (!uploadResponse.ok) {
     throw new Error('上傳失敗')
   }
   ```

5. **前端：儲存檔案 metadata**
   ```typescript
   const attachment = {
     name: file.name,
     size: file.size,
     type: file.type,
     key: upload.key,
     url: `https://${upload.bucket}.s3.amazonaws.com/${upload.key}`
   }
   
   // 在創建/更新項目時一起提交
   ```

### 支援的檔案類型

#### 圖片

| 格式 | MIME 類型 | 副檔名 |
|------|----------|--------|
| JPEG | image/jpeg | .jpg, .jpeg |
| PNG | image/png | .png |
| GIF | image/gif | .gif |
| WebP | image/webp | .webp |

#### 文件

| 格式 | MIME 類型 | 副檔名 |
|------|----------|--------|
| PDF | application/pdf | .pdf |
| Word | application/msword | .doc |
| Word (新) | application/vnd.openxmlformats-officedocument.wordprocessingml.document | .docx |
| Excel | application/vnd.ms-excel | .xls |
| Excel (新) | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | .xlsx |
| 純文字 | text/plain | .txt |
| CSV | text/csv | .csv |

### 檔案組織

**S3 路徑結構：**
```
sparkboard-files-{accountId}-{region}/
├── {userId}/
│   ├── 2025-11-18/
│   │   ├── a1b2c3d4-document.pdf
│   │   ├── b2c3d4e5-screenshot.png
│   │   └── c3d4e5f6-report.xlsx
│   ├── 2025-11-19/
│   │   └── ...
│   └── 2025-11-20/
│       └── ...
└── {anotherUserId}/
    └── ...
```

**檔案命名：**
- 格式：`{uuid}-{originalFileName}`
- UUID 確保唯一性
- 保留原始檔案名稱便於識別

### 安全性

#### 存取控制

- **私有儲存桶：** 封鎖所有公開存取
- **預簽名 URL：** 臨時存取授權（5 分鐘）
- **身份驗證：** 必須登入才能上傳
- **OAI：** CloudFront Origin Access Identity

#### CORS 設定

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "http://localhost:5173",
        "https://dil6s218sdym2.cloudfront.net"
      ],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

#### 檔案大小限制

- **前端驗證：** 10 MB
- **後端驗證：** 10 MB
- **S3 限制：** 5 TB（理論上限）

#### 生命週期管理

```yaml
Lifecycle Rules:
  - Delete files after 90 days
  - Transition to Glacier after 30 days (optional)
```

### 附件顯示

#### 圖片預覽

```typescript
// 在 ItemCard 中顯示圖片縮圖
{item.attachments
  .filter(a => a.type.startsWith('image/'))
  .map(image => (
    <img 
      src={image.url} 
      alt={image.name}
      className="w-20 h-20 object-cover rounded"
    />
  ))
}
```

#### 檔案下載

```typescript
// 點擊下載按鈕
function handleDownload(attachment: FileAttachment) {
  const link = document.createElement('a')
  link.href = attachment.url
  link.download = attachment.name
  link.click()
}
```

#### 檔案圖示

根據檔案類型顯示不同圖示：

```typescript
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon />
  if (mimeType === 'application/pdf') return <PdfIcon />
  if (mimeType.includes('word')) return <WordIcon />
  if (mimeType.includes('excel')) return <ExcelIcon />
  return <FileIcon />
}
```

---

## 👥 用戶管理

### 用戶註冊

**註冊流程：**

1. **填寫註冊表單**
   - Email（用作用戶名）
   - 密碼（至少 8 字元，包含大小寫和數字）
   - 姓名

2. **Email 驗證**
   - Cognito 自動發送驗證碼到 Email
   - 用戶輸入驗證碼
   - 驗證成功後帳戶啟用

3. **自動群組分配**
   - PostConfirmation 觸發器
   - 自動加入 "Users" 群組
   - 獲得基本權限

**UI 組件：** `RegistrationForm.tsx`

### 用戶登入

#### 方式 1：Email/密碼登入

```typescript
// 使用 Cognito SDK
const authDetails = new AuthenticationDetails({
  Username: email,
  Password: password
})

const cognitoUser = new CognitoUser({
  Username: email,
  Pool: userPool
})

cognitoUser.authenticateUser(authDetails, {
  onSuccess: (session) => {
    // 取得 JWT tokens
    const idToken = session.getIdToken().getJwtToken()
    const accessToken = session.getAccessToken().getJwtToken()
    const refreshToken = session.getRefreshToken().getToken()
    
    // 儲存到 localStorage
    localStorage.setItem('cognito_id_token', idToken)
  },
  onFailure: (err) => {
    console.error('登入失敗:', err)
  }
})
```

#### 方式 2：OAuth Hosted UI

```typescript
// 重定向到 Cognito Hosted UI
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN
const clientId = import.meta.env.VITE_USER_POOL_CLIENT_ID
const redirectUri = import.meta.env.VITE_OAUTH_REDIRECT_URI

const authUrl = `https://${cognitoDomain}/oauth2/authorize?` +
  `client_id=${clientId}&` +
  `response_type=code&` +
  `scope=openid+profile+email&` +
  `redirect_uri=${redirectUri}`

window.location.href = authUrl
```

**UI 組件：** `LoginForm.tsx`

### 個人資料管理

#### 可編輯欄位

| 欄位 | 儲存位置 | 驗證規則 |
|------|---------|---------|
| 姓名 | Cognito + DynamoDB | 1-50 字元 |
| Email | Cognito | 有效的 Email 格式，需重新驗證 |
| 頭像 | S3 + DynamoDB (URL) | 圖片檔案，最大 10 MB |
| 個人簡介 | DynamoDB | 最多 500 字元 |

#### 更新流程

```typescript
// 1. 更新 Cognito 屬性
await cognitoUser.updateAttributes([
  { Name: 'name', Value: newName },
  { Name: 'email', Value: newEmail }
])

// 2. 同步到 DynamoDB
await fetch(`${API_URL}/auth/me`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': idToken
  },
  body: JSON.stringify({
    name: newName,
    bio: newBio,
    avatarUrl: newAvatarUrl
  })
})
```

**UI 組件：** `ProfilePage.tsx`

### 管理員功能

#### 用戶列表

**端點：** `GET /users`

**回應：**
```json
{
  "users": [
    {
      "userId": "c7e46ab8-f0b1-70f0-78c6-0d6c51ceeb63",
      "username": "user@example.com",
      "email": "user@example.com",
      "enabled": true,
      "status": "CONFIRMED",
      "groups": ["Users"],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastModifiedAt": "2025-11-18T10:00:00.000Z"
    }
  ]
}
```

#### 群組管理

**加入群組：**
```http
POST /users/{userId}/groups
Content-Type: application/json

{
  "groupName": "Moderators"
}
```

**移除群組：**
```http
DELETE /users/{userId}/groups/{groupName}
```

**群組互斥：**
- 用戶只能屬於一個群組
- 新增群組時自動移除舊群組

#### 停用/啟用用戶

**停用：**
```http
POST /users/{userId}/disable
```

**啟用：**
```http
POST /users/{userId}/enable
```

**停用效果：**
- 無法登入
- 現有 Token 失效
- API 請求被拒絕

#### 刪除用戶

```http
DELETE /users/{userId}
```

**限制：**
- 必須先停用用戶
- 刪除是永久性的
- 刪除後無法恢復

**UI 組件：** `UserManagement.tsx`

---

## 📊 監控儀表板

### 功能概覽

監控儀表板提供系統健康狀態和性能指標的即時視圖，僅管理員可存取。

### CloudWatch 指標

#### API Gateway 指標

**可視化圖表：**
- 請求數量（Count）
- 4xx 錯誤率（%)
- 5xx 錯誤率（%)
- 延遲（Latency）- P50, P90, P95, P99
- 整合延遲（Integration Latency）

**時間範圍：**
- 最近 1 小時
- 最近 6 小時
- 最近 24 小時
- 最近 7 天

**查詢範例：**
```typescript
const params = {
  Namespace: 'AWS/ApiGateway',
  MetricName: 'Count',
  Dimensions: [
    { Name: 'ApiName', Value: 'SparkBoardAPI' }
  ],
  StartTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
  EndTime: new Date(),
  Period: 300, // 5 分鐘
  Statistics: ['Sum']
}
```

#### Lambda 指標

**指標項目：**
- 調用次數（Invocations）
- 錯誤數（Errors）
- 持續時間（Duration）- 平均、最大
- 並發執行數（Concurrent Executions）
- 節流次數（Throttles）

**按 Lambda 函數分組：**
- SparkBoard-Items
- SparkBoard-AuthMe
- SparkBoard-Uploads
- SparkBoard-Users
- SparkBoard-Monitoring
- SparkBoard-Health
- SparkBoard-AutoArchive
- SparkBoard-PostConfirm

#### DynamoDB 指標

**指標項目：**
- 讀取容量單位（Consumed Read Capacity）
- 寫入容量單位（Consumed Write Capacity）
- 用戶錯誤（User Errors）
- 系統錯誤（System Errors）
- 成功請求延遲（Successful Request Latency）

**查詢類型分解：**
- GetItem
- PutItem
- UpdateItem
- DeleteItem
- Query
- Scan

### X-Ray 追蹤

**服務地圖：**
```
用戶 → CloudFront → API Gateway → Lambda → DynamoDB
                                   ├→ S3
                                   └→ Cognito
```

**追蹤資訊：**
- 完整請求路徑
- 每個服務的回應時間
- 錯誤和異常
- 註解和 metadata

**範例追蹤：**
```
POST /items
├─ API Gateway (5ms)
├─ Lambda SparkBoard-Items (45ms)
│  ├─ DynamoDB PutItem (8ms)
│  └─ S3 GetObject (12ms)
└─ Total: 70ms
```

### CloudWatch 告警

**已配置告警：**

1. **API 5xx 錯誤率過高**
   - 閾值：> 5%（5 分鐘內）
   - 動作：發送 SNS 通知

2. **Lambda 錯誤率過高**
   - 閾值：> 10%（5 分鐘內）
   - 動作：發送 SNS 通知

3. **DynamoDB 系統錯誤**
   - 閾值：> 0（5 分鐘內）
   - 動作：發送 SNS 通知

**告警狀態：**
- OK - 正常
- ALARM - 告警觸發
- INSUFFICIENT_DATA - 資料不足

### 儀表板視圖

**UI 組件：** `MonitoringDashboard.tsx`

**頁面區塊：**

1. **總覽卡片**
   - API 請求總數（24 小時）
   - Lambda 調用總數（24 小時）
   - 平均回應時間
   - 錯誤率

2. **圖表區域**
   - API Gateway 請求圖表
   - Lambda 執行時間圖表
   - DynamoDB 讀寫圖表
   - 錯誤趨勢圖表

3. **告警清單**
   - 告警名稱
   - 當前狀態
   - 上次狀態變更時間
   - 快速操作按鈕

4. **最近追蹤**
   - 追蹤 ID
   - HTTP 方法和路徑
   - 狀態碼
   - 持續時間
   - 時間戳記

**圖表庫：** Recharts 2.15.1

```typescript
<LineChart data={metricsData}>
  <XAxis dataKey="timestamp" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Line type="monotone" dataKey="requests" stroke="#8884d8" />
  <Line type="monotone" dataKey="errors" stroke="#ff4444" />
</LineChart>
```

### 日誌查詢

**CloudWatch Logs Insights 查詢範例：**

```sql
-- 查詢 Items Lambda 的錯誤
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

```sql
-- 統計 API 端點使用情況
fields httpMethod, path
| stats count() by httpMethod, path
| sort count desc
```

```sql
-- 查詢慢速請求（> 1 秒）
fields @timestamp, @message, @duration
| filter @duration > 1000
| sort @duration desc
```

---

## 📱 使用者介面

### 響應式設計

**斷點：**
```css
/* Tailwind 預設斷點 */
sm: 640px   /* 小型裝置 */
md: 768px   /* 平板 */
lg: 1024px  /* 筆電 */
xl: 1280px  /* 桌面 */
2xl: 1536px /* 大型桌面 */
```

**適配策略：**
- 移動優先設計
- 側邊欄在小螢幕自動收合
- 表格在小螢幕轉為卡片視圖
- 對話框在小螢幕全屏顯示

### 主題系統

**支援模式：**
- 淺色模式（預設）
- 深色模式
- 系統自動（跟隨作業系統）

**實作：**
```typescript
import { ThemeProvider } from 'next-themes'

// 主題切換
const { theme, setTheme } = useTheme()

// 切換函數
const toggleTheme = () => {
  setTheme(theme === 'dark' ? 'light' : 'dark')
}
```

### 無障礙設計

**ARIA 標籤：**
- 所有互動元素都有適當的 aria-label
- 表單輸入都有關聯的 label
- 按鈕狀態有 aria-pressed/aria-expanded

**鍵盤導航：**
- Tab 鍵順序合理
- Enter/Space 觸發按鈕
- Escape 關閉對話框
- 方向鍵導航選單

**螢幕閱讀器：**
- 所有圖片都有 alt 文字
- 使用語義化 HTML（header, nav, main, article）
- 動態內容變更通知

**焦點管理：**
- 對話框開啟時焦點移入
- 對話框關閉時焦點返回
- 下拉選單鍵盤導航

---

**文件維護：** 本文件會隨著功能更新而持續更新。
