# 郵件通知系統部署指南

本文檔說明如何部署和測試 SparkBoard 的郵件通知系統。

## 📋 系統概覽

郵件通知系統使用 AWS SQS 和 SNS 實現異步通知處理：

```
任務完成/公告發布 → SQS 隊列 → Notification Lambda → SNS 主題 → Email
                                    ↓
                           Dead Letter Queue (失敗重試)
```

## 🏗️ 架構組件

| 組件 | 服務 | 功能 |
|------|------|------|
| Notification Queue | SQS | 主要通知隊列 |
| Dead Letter Queue | SQS | 失敗訊息隊列（3 次重試後） |
| Notification Topic | SNS | 郵件發送主題 |
| Notification Handler | Lambda | 處理隊列訊息並發送郵件 |

## 📦 部署步驟

### 前置條件

- AWS CLI 已配置
- AWS CDK 已安裝
- Node.js 18.x 或更高版本
- SparkBoard-Storage 和 SparkBoard-Auth 堆疊已部署

### 步驟 1: 部署 Messaging Stack

```powershell
# 執行部署腳本
cd scripts
.\deploy-messaging.ps1
```

腳本會自動執行以下操作：
1. 安裝 `services/notifications` 依賴
2. 更新 `services/items` 依賴（添加 `@aws-sdk/client-sqs`）
3. 部署 `SparkBoard-Messaging` CDK 堆疊
4. 重新部署 `SparkBoard-Api` 堆疊（添加 SQS 權限）

### 步驟 2: 訂閱 SNS 主題

#### 方法 1: AWS Console

1. 前往 [SNS Console](https://console.aws.amazon.com/sns/)
2. 在左側導航中選擇 **Topics**
3. 找到 `SparkBoard-Notifications` 主題並點擊
4. 點擊 **Create subscription**
5. 選擇 Protocol: **Email**
6. 輸入您的郵箱地址
7. 點擊 **Create subscription**
8. 檢查郵箱並確認訂閱

#### 方法 2: AWS CLI

```bash
# 獲取 Topic ARN
TOPIC_ARN=$(aws cloudformation describe-stacks \
  --stack-name SparkBoard-Messaging \
  --query "Stacks[0].Outputs[?OutputKey=='NotificationTopicArn'].OutputValue" \
  --output text)

# 訂閱郵箱
aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com

# 確認訂閱郵件
echo "Please check your email and confirm the subscription"
```

### 步驟 3: 測試通知系統

```powershell
# 發送測試通知
cd scripts
.\test-notifications.ps1
```

測試腳本會發送：
- ✅ 任務完成通知
- 📢 公告通知

檢查以下位置確認系統運作：
1. **Lambda 日誌**: CloudWatch Logs → `/aws/lambda/SparkBoard-NotificationHandler`
2. **SQS 指標**: SQS Console → `SparkBoard-Notification-Queue` → Monitoring
3. **郵箱**: 檢查是否收到測試郵件

## 📧 通知類型

### 1. 任務完成通知

**觸發時機：**
- 任務狀態變更為 `completed`
- 所有子任務完成

**郵件主旨：**
```
✅ Task Completed: [任務標題]
```

**郵件內容：**
- 任務標題
- 完成時間
- 完成者
- 子任務完成狀態
- 原始截止日期

### 2. 公告通知

**觸發時機：**
- 新公告被創建

**郵件主旨：**
```
🚨 Announcement: [公告標題]    (urgent)
⚠️ Announcement: [公告標題]    (high)
📢 Announcement: [公告標題]    (normal)
```

**郵件內容：**
- 公告內容
- 發布者
- 優先級
- 發布時間

### 3. 任務分配通知（未來功能）

**觸發時機：**
- 任務被指派給特定用戶

## 🔍 監控與除錯

### CloudWatch 日誌

查看 Notification Handler 日誌：

```bash
# 查看最近日誌
aws logs tail /aws/lambda/SparkBoard-NotificationHandler --follow

# 查看特定時間範圍
aws logs tail /aws/lambda/SparkBoard-NotificationHandler \
  --since 1h \
  --format short
```

### SQS 指標

在 AWS Console 中查看：
- **Messages Sent**: 發送到隊列的訊息數量
- **Messages Received**: Lambda 接收的訊息數量
- **Messages Deleted**: 成功處理的訊息數量
- **Age of Oldest Message**: 最舊訊息的等待時間

### SNS 指標

- **NumberOfNotificationsSent**: 成功發送的郵件數量
- **NumberOfNotificationsFailed**: 失敗的郵件數量

### Dead Letter Queue

如果訊息處理失敗 3 次，會進入 DLQ：

```bash
# 檢查 DLQ 中的訊息
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/xxx/SparkBoard-Notification-DLQ \
  --max-number-of-messages 10

# 清空 DLQ（測試後）
aws sqs purge-queue \
  --queue-url https://sqs.us-east-1.amazonaws.com/xxx/SparkBoard-Notification-DLQ
```

## 🐛 常見問題

### Q1: 沒有收到測試郵件

**檢查清單：**
1. ✅ SNS 訂閱是否已確認？
   - 前往 SNS Console → SparkBoard-Notifications → Subscriptions
   - 狀態應為 "Confirmed"

2. ✅ Lambda 是否執行成功？
   - 查看 CloudWatch Logs: `/aws/lambda/SparkBoard-NotificationHandler`
   - 確認沒有錯誤日誌

3. ✅ SQS 訊息是否被處理？
   - 前往 SQS Console → SparkBoard-Notification-Queue → Monitoring
   - 檢查 "Messages Deleted" 指標

4. ✅ 檢查垃圾郵件資料夾
   - AWS SNS 郵件可能被誤判為垃圾郵件

### Q2: Lambda 執行失敗

**常見錯誤：**

**錯誤 1: `AccessDeniedException` (Cognito)**
```
User: arn:aws:sts::xxx:assumed-role/... is not authorized to perform: cognito-idp:ListUsers
```

**解決方法：**
確認 Notification Handler 有 Cognito 權限：
```typescript
notificationHandler.addToRolePolicy(new iam.PolicyStatement({
  actions: ['cognito-idp:AdminGetUser', 'cognito-idp:ListUsers'],
  resources: [userPool.userPoolArn]
}))
```

**錯誤 2: `ResourceNotFoundException` (DynamoDB)**
```
Requested resource not found: Table: SparkTable
```

**解決方法：**
確認環境變數 `TABLE_NAME` 正確設定。

**錯誤 3: `InvalidParameterException` (SNS)**
```
Invalid parameter: TopicArn
```

**解決方法：**
確認環境變數 `SNS_TOPIC_ARN` 正確設定。

### Q3: 訊息進入 DLQ

**排查步驟：**

1. 查看 DLQ 訊息內容：
```bash
aws sqs receive-message \
  --queue-url [DLQ-URL] \
  --attribute-names All \
  --message-attribute-names All
```

2. 檢查 Lambda 日誌找出失敗原因

3. 修復問題後手動重新處理：
```bash
# 從 DLQ 接收訊息
MESSAGE=$(aws sqs receive-message --queue-url [DLQ-URL] --max-number-of-messages 1)

# 發送到主隊列
aws sqs send-message \
  --queue-url [MAIN-QUEUE-URL] \
  --message-body "$(echo $MESSAGE | jq -r '.Messages[0].Body')"

# 從 DLQ 刪除訊息
aws sqs delete-message \
  --queue-url [DLQ-URL] \
  --receipt-handle "$(echo $MESSAGE | jq -r '.Messages[0].ReceiptHandle')"
```

## 💰 成本估算

### 免費額度（每月）

- **SQS**: 100 萬次請求
- **SNS**: 100 萬次發布 + 1000 封郵件
- **Lambda**: 100 萬次請求 + 400,000 GB-秒

### 估算成本（超過免費額度後）

假設每月 10,000 個通知：

| 服務 | 使用量 | 單價 | 月成本 |
|------|--------|------|--------|
| SQS | 10,000 requests | $0.40 / 1M | $0.004 |
| SNS | 10,000 emails | $2.00 / 100K | $0.20 |
| Lambda | 10,000 invocations × 128MB × 1s | $0.20 / 1M requests | $0.002 |
| **總計** | | | **$0.21/月** |

**結論：** 在低到中等流量下，成本極低（<$1/月）

## 🚀 生產環境建議

### 1. 增加監控告警

```typescript
// 在 MessagingStack 中添加
const dlqAlarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
  metric: deadLetterQueue.metricApproximateNumberOfMessagesVisible(),
  threshold: 1,
  evaluationPeriods: 1,
  alarmDescription: 'Alert when messages enter DLQ',
})

dlqAlarm.addAlarmAction(new actions.SnsAction(alarmTopic))
```

### 2. 調整批次大小

對於高流量場景：
```typescript
notificationHandler.addEventSource(new lambdaEventSources.SqsEventSource(queue, {
  batchSize: 10,              // 增加到 10
  maxBatchingWindow: cdk.Duration.seconds(5),
}))
```

### 3. 啟用 DynamoDB 查詢快取

減少重複查詢：
```javascript
const cache = new Map()

async function getItemDetails(orgId, itemId) {
  const key = `${orgId}#${itemId}`
  if (cache.has(key)) return cache.get(key)
  
  const item = await dynamoDB.get(...)
  cache.set(key, item)
  return item
}
```

### 4. 郵件範本優化

使用 SNS Email-JSON 協議實現 HTML 郵件：
```javascript
await sns.publish({
  TopicArn: topicArn,
  Subject: subject,
  Message: JSON.stringify({
    default: textMessage,
    email: htmlMessage,
  }),
  MessageStructure: 'json',
})
```

## 📚 相關資源

- [AWS SQS 文檔](https://docs.aws.amazon.com/sqs/)
- [AWS SNS 文檔](https://docs.aws.amazon.com/sns/)
- [Lambda 事件源映射](https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html)
- [SparkBoard FEATURES.md](../docs/FEATURES.md#郵件通知系統)

## 🎯 下一步

- [ ] 添加更多通知類型（任務分配、任務即將到期等）
- [ ] 實現郵件偏好設定（用戶可選擇接收哪些通知）
- [ ] 支援 SMS 通知（使用 SNS）
- [ ] 添加 Slack/Discord webhook 整合
- [ ] 實現通知歷史記錄（存儲到 DynamoDB）
- [ ] 郵件範本系統（支援自定義範本）
