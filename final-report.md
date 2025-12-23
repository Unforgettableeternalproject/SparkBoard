# SparkBoard 期末成果說明文件
# Final Report - 第 四 組

---

## 專題簡介與問題定義

### 專題名稱
**SparkBoard** - 無伺服器任務與公告管理平台

### 解決的問題（一句話）
SparkBoard 透過完全無伺服器架構 (Serverless Architecture)，提供企業級的任務管理、公告發布、檔案分享與即時通知功能，實現零維運成本、自動擴展且高可用的團隊協作平台。

### 期中 vs 期末調整說明
- **期中進度**: 完成核心 API 架構設計、DynamoDB 單表設計、Cognito 認證整合、基本的 CRUD 功能
- **期末調整**:
  1. ✅ **新增非同步通知系統** - 整合 SQS + SNS 實現郵件通知
  2. ✅ **新增定時自動封存** - 使用 EventBridge 定時觸發任務封存
  3. ✅ **強化監控與觀測** - 部署 CloudWatch Dashboard、Alarms、X-Ray Tracing
  4. ✅ **完善 CI/CD 流程** - GitHub Actions + OIDC 自動化部署
  5. ✅ **補充文件與測試** - API 測試、效能測試、部署文件

**總結**: 期末階段主要補強「非同步處理」、「可觀測性」與「自動化部署」三大工程實務面向。

---

## 系統架構與服務選型理由

### 最終系統架構圖
> 詳見 [final-system-architecture.puml](./final-system-architecture.puml)

### 採用的 AWS 服務總覽

| 服務 | 用途 | 選型理由 | 課堂教過 |
|------|------|----------|----------|
| **API Gateway** | REST API 端點 | 完全託管、支援 Cognito 授權、自動擴展 | ✅ |
| **Lambda** | 9 個無伺服器函數 | 按需計費、自動擴展、無需管理伺服器 | ✅ |
| **DynamoDB** | NoSQL 資料庫 | 單表設計、低延遲、無限擴展、按需計費 | ✅ |
| **Cognito** | 使用者認證 | JWT Token、User Pool、OAuth 2.0 流程 | ✅ |
| **S3** | 靜態網站 + 檔案存儲 | 高可用、低成本、支援 CDN 整合 | ✅ |
| **CloudFront** | CDN 內容分發 | 全球加速、HTTPS 支援、快取策略 | ✅ |
| **SQS** | 訊息佇列 | 解耦服務、可靠傳遞、支援重試與 DLQ | ✅ |
| **SNS** | 郵件通知服務 | 簡單易用、支援多種訂閱方式 | ✅ |
| **EventBridge** | 定時任務排程 | Cron 表達式、事件驅動架構 | ❌ |
| **CloudWatch** | 日誌與監控 | 統一的可觀測性平台、告警功能 | ✅ |
| **X-Ray** | 分散式追蹤 | 端到端請求追蹤、效能瓶頸分析 | ✅ |
| **IAM** | 權限管理 | 最小權限原則、服務間安全通訊 | ✅ |

### DynamoDB 單表設計選型理由

**為什麼選擇單表設計 (Single Table Design)**:
1. **效能優化**: 單次查詢即可取得所有相關資料，減少 API 呼叫
2. **成本節省**: 減少讀取單位消耗 (RCU)
3. **設計彈性**: 透過 PK/SK 組合支援多種查詢模式
4. **最佳實務**: DynamoDB 官方推薦的設計模式

**實際設計**:
- **Table**: `SparkTable`
- **PK (Partition Key)**: `ITEM#{id}` 或 `USER#{id}`
- **SK (Sort Key)**: `METADATA` 或 `PROFILE`
- **GSI1**: 查詢用戶的所有項目 (`userId` + `createdAt`)
- **GSI2**: 查詢全域項目列表 (`ITEM#ALL` + `createdAt`)

### Lambda 函數設計選型

**9 個 Lambda 函數分工**:
1. **SparkBoard-Items** (同步): 任務/公告 CRUD - 最核心的業務邏輯
2. **SparkBoard-AuthMe** (同步): 用戶資料管理 - 獲取/更新個人資料
3. **SparkBoard-Uploads** (同步): 產生 S3 預簽名 URL - 安全的檔案上傳
4. **SparkBoard-Users** (同步): 管理員用戶管理 - RBAC 實現
5. **SparkBoard-Health** (同步): 健康檢查 - 監控系統可用性
6. **SparkBoard-Monitoring** (同步): 監控儀表板 - 管理員查看指標
7. **SparkBoard-NotificationHandler** (非同步): 郵件發送 - SQS 觸發
8. **SparkBoard-AutoArchive** (非同步): 定時封存 - EventBridge 觸發
9. **SparkBoard-PostConfirm** (非同步): 自動加入群組 - Cognito 觸發

**選型理由**:
- **微服務原則**: 每個函數職責單一，易於測試與維護
- **冷啟動優化**: 小型函數啟動更快 (< 200ms)
- **獨立擴展**: 高流量端點可獨立擴展
- **故障隔離**: 單一函數錯誤不影響其他服務

---

## 核心流程說明

> 詳細流程說明與證據收集指引請參閱 [core-flows-documentation.md](./core-flows-documentation.md)

### 流程一：同步任務建立流程 ⭐

**流程類型**: 同步 (Synchronous)  
**涉及服務**: API Gateway, Lambda, DynamoDB (課堂教過 ✅)

```
用戶 → API Gateway (Cognito 驗證) → Items Lambda → DynamoDB PutItem → 立即回應
```

**關鍵步驟**:
1. 用戶發送 `POST /items` 請求 (含 JWT Token)
2. API Gateway 驗證 Cognito Token
3. Items Lambda 解析請求，生成唯一 ID (ulid)
4. 寫入 DynamoDB (PK: `ITEM#{id}`, SK: `METADATA`)
5. 同時寫入 GSI1 和 GSI2 索引
6. 立即回應 201 Created

**實作證據需求**:
- ✅ Postman/curl 成功創建任務 (201 回應)
- ✅ Lambda CloudWatch Logs 顯示執行過程
- ✅ DynamoDB 中的新 Item 資料截圖
- ✅ Lambda Invocations 和 Duration 指標

**為什麼是同步**: 用戶需要立即知道任務是否創建成功，這是核心的 CRUD 操作，適合同步處理以保證資料一致性。

---

### 流程二：非同步郵件通知流程 ⭐⭐

**流程類型**: 非同步 (Asynchronous)  
**涉及服務**: Lambda, SQS, SNS (課堂教過 ✅)

```
Items Lambda → SQS Queue → Notification Handler Lambda → SNS Topic → Email
```

**關鍵步驟**:
1. 用戶標記任務為「完成」(`PATCH /items/{id}`)
2. Items Lambda 更新 DynamoDB 並發送訊息到 SQS
3. SQS 佇列暫存訊息 (Visibility Timeout: 30 秒)
4. Notification Handler Lambda 被 SQS 觸發
5. Lambda 查詢 DynamoDB 取得用戶郵件
6. Lambda 透過 SNS 發送郵件
7. 用戶收到通知郵件

**非同步設計優勢**:
- ✅ **解耦**: Items Lambda 不需等待郵件發送完成
- ✅ **可靠**: SQS 保證訊息至少傳遞一次
- ✅ **重試**: 失敗自動重試最多 3 次
- ✅ **DLQ**: 永久失敗的訊息進入 Dead Letter Queue
- ✅ **效能**: API 回應時間不受郵件發送速度影響

**實作證據需求**:
- ✅ PATCH 請求成功更新狀態
- ✅ SQS 佇列深度變化 (Messages Available/In Flight)
- ✅ Notification Lambda Logs 顯示 SNS Publish 成功
- ✅ 實際收到的郵件截圖或 SNS MessageId

**為什麼是非同步**: 郵件發送可能需要 1-3 秒，不應阻塞 API 回應；且郵件失敗不應影響任務狀態更新成功。

---

### 流程三：定時自動封存流程 (補充)

**流程類型**: 事件驅動 (Event-Driven)  
**涉及服務**: EventBridge, Lambda, DynamoDB

```
EventBridge (每分鐘) → Auto-Archive Lambda → Query DynamoDB → Update Items
```

**關鍵步驟**:
1. EventBridge 每分鐘觸發一次 (`rate(1 minute)`)
2. Lambda 查詢所有已完成且超過截止日期的任務
3. 批次更新這些任務的 `archived` 欄位為 `true`
4. 記錄 `autoArchiveAt` 時間戳

**實作證據需求**:
- ✅ EventBridge Rule 設定截圖
- ✅ Lambda Logs 顯示查詢與更新邏輯
- ✅ DynamoDB 封存前後對比

---

## 非同步設計說明（SQS/SNS/EventBridge）

### SQS 訊息佇列設計

**Queue Name**: `SparkBoard-NotificationQueue`

**設定參數**:
- **Visibility Timeout**: 30 秒 (Lambda 處理時間)
- **Message Retention**: 4 天 (預設值)
- **Receive Message Wait Time**: 0 秒 (短輪詢)
- **Max Receive Count**: 3 次 (超過後進入 DLQ)
- **Dead Letter Queue**: `SparkBoard-NotificationQueue-DLQ`

**訊息格式範例**:
```json
{
  "type": "TASK_COMPLETED",
  "itemId": "01JGXYZ123456789ABCDEF",
  "title": "完成期末報告",
  "completedBy": "google-oauth2|123456",
  "completedAt": "2025-12-24T15:45:00.000Z"
}
```

**錯誤處理機制**:
1. **重試邏輯**: Lambda 失敗會自動重試 (SQS 重新投遞)
2. **冪等性**: 使用 `itemId` 作為去重鍵，避免重複發送
3. **DLQ 監控**: 定期檢查 DLQ，人工處理失敗訊息
4. **告警**: DLQ 訊息數 > 0 時發送告警

### SNS 通知主題設計

**Topic Name**: `SparkBoard-Notifications`

**訂閱方式**:
- Email 訂閱 (用戶郵箱由 DynamoDB 查詢)
- 未來可擴展: SMS, Lambda, HTTP Endpoint

**訊息類型**:
1. **TASK_COMPLETED**: 任務完成通知 (發送給任務建立者)
2. **ANNOUNCEMENT**: 公告發布通知 (廣播給所有用戶，最多 500 人)
3. **TASK_ASSIGNED**: 任務指派通知 (預留，未啟用)

**限制處理**:
- SNS Email 訂閱需要用戶確認 (點擊確認連結)
- 測試環境建議使用 SES Sandbox 模式
- 生產環境需申請 SES 生產權限

### EventBridge 定時任務設計

**Rule Name**: `SparkBoard-AutoArchiveSchedule`

**排程表達式**: `rate(1 minute)` (每分鐘執行一次)

**為什麼選擇 1 分鐘**:
- 教學環境，方便觀察效果
- 生產環境建議改為 `rate(1 hour)` 或 `cron(0 2 * * ? *)` (每天凌晨 2 點)

**Target**: `SparkBoard-AutoArchive` Lambda 函數

**執行邏輯**:
```javascript
// 1. 查詢條件
const now = new Date().toISOString();
const params = {
  IndexName: 'GSI2',
  KeyConditionExpression: 'GSI2PK = :pk',
  FilterExpression: '#status = :completed AND deadline < :now AND archived <> :true'
};

// 2. 批次更新
for (const item of items) {
  await dynamodb.update({
    Key: { PK: item.PK, SK: item.SK },
    UpdateExpression: 'SET archived = :true, autoArchiveAt = :time'
  });
}
```

---

## Observability 設計（Logs / Metrics / Alarms）

### CloudWatch Logs 設計

**Log Groups**:
- `/aws/lambda/SparkBoard-Items`
- `/aws/lambda/SparkBoard-NotificationHandler`
- `/aws/lambda/SparkBoard-AutoArchive`
- `/aws/apigateway/SparkBoard-Api`

**日誌保留期限**: 7 天 (測試環境) / 30 天 (生產環境)

**結構化日誌範例**:
```javascript
console.log(JSON.stringify({
  level: 'INFO',
  requestId: context.requestId,
  userId: event.requestContext.authorizer.claims.sub,
  action: 'CREATE_ITEM',
  itemId: itemId,
  duration: Date.now() - startTime
}));
```

**日誌查詢 (CloudWatch Insights)**:
```sql
fields @timestamp, level, action, itemId, duration
| filter action = "CREATE_ITEM"
| stats avg(duration), max(duration) by bin(5m)
```

### CloudWatch Metrics 設計

**Lambda 指標**:
- **Invocations**: 調用次數 (顯示流量模式)
- **Errors**: 錯誤次數 (理想為 0)
- **Duration**: 執行時間 (p50, p90, p99)
- **Throttles**: 限流次數 (檢查並發限制)
- **ConcurrentExecutions**: 並發執行數

**API Gateway 指標**:
- **Count**: 總請求數
- **4XXError**: 客戶端錯誤 (認證失敗、參數錯誤)
- **5XXError**: 伺服器錯誤 (Lambda 逾時、DynamoDB 錯誤)
- **Latency**: 延遲時間 (包含 Lambda 執行時間)

**DynamoDB 指標**:
- **ConsumedReadCapacityUnits**: 讀取消耗 (按需計費下較不重要)
- **ConsumedWriteCapacityUnits**: 寫入消耗
- **UserErrors**: 用戶錯誤 (參數驗證失敗)
- **SystemErrors**: 系統錯誤 (服務可用性問題)

**SQS 指標**:
- **NumberOfMessagesSent**: 發送訊息數
- **NumberOfMessagesReceived**: 接收訊息數
- **ApproximateNumberOfMessagesVisible**: 佇列深度
- **ApproximateAgeOfOldestMessage**: 最舊訊息年齡 (檢測堆積)

### CloudWatch Dashboard

**Dashboard Name**: `SparkBoard-Production-Dashboard`

**Widgets 配置**:
1. **API 健康狀況** (2x2)
   - API Gateway Request Count
   - API Gateway 4XX/5XX Error Rate

2. **Lambda 效能** (2x2)
   - Lambda Invocations (所有函數)
   - Lambda Errors (堆疊顯示)
   - Lambda Duration (p99)
   - Lambda Concurrent Executions

3. **DynamoDB 使用狀況** (2x1)
   - Read/Write Capacity Units
   - User Errors vs System Errors

4. **訊息佇列** (1x1)
   - SQS Queue Depth
   - SQS Messages in DLQ

5. **自訂指標** (1x1)
   - 每分鐘創建的任務數
   - 每分鐘發送的通知數

### CloudWatch Alarms

**告警配置**:

| 告警名稱 | 指標 | 條件 | 動作 |
|---------|------|------|------|
| `SparkBoard-Api-5XX-High` | API Gateway 5XXError | > 1% (連續 2 個週期) | SNS 通知管理員 |
| `SparkBoard-Lambda-Errors` | Lambda Errors | > 0 (連續 2 個週期) | SNS 通知 + 自動重啟? |
| `SparkBoard-DLQ-Messages` | SQS DLQ Depth | > 0 | SNS 通知 (需人工介入) |
| `SparkBoard-Lambda-Duration` | Lambda Duration | > 5000ms (p99) | 效能警告 |

**SNS 通知設定**:
- Topic: `SparkBoard-Alarms`
- 訂閱: 管理員郵箱

### X-Ray 分散式追蹤

**啟用範圍**:
- ✅ API Gateway (Active Tracing)
- ✅ All Lambda Functions (Active Tracing)
- ✅ DynamoDB SDK 自動追蹤

**追蹤資訊**:
- 端到端請求延遲 (API Gateway → Lambda → DynamoDB)
- 各階段耗時分佈
- 錯誤定位 (哪個服務出錯)
- 服務地圖 (Service Map)

**實際用途**:
- 發現 Lambda 冷啟動問題 (初次請求 > 1 秒)
- 找出 DynamoDB 查詢瓶頸
- 分析 API 延遲來源 (網路 vs 計算)

---

## 安全性與 IAM 設計原則

### 最小權限原則 (Least Privilege)

**Lambda Execution Roles**:

```yaml
# Items Lambda IAM Policy
SparkBoardItemsLambdaRole:
  Permissions:
    - DynamoDB:PutItem (僅 SparkTable)
    - DynamoDB:GetItem (僅 SparkTable)
    - DynamoDB:Query (僅 SparkTable, GSI1, GSI2)
    - DynamoDB:UpdateItem (僅 SparkTable)
    - DynamoDB:DeleteItem (僅 SparkTable)
    - SQS:SendMessage (僅 NotificationQueue)
    - CloudWatch:PutLogEvents
    - X-Ray:PutTraceSegments
```

```yaml
# Notification Handler Lambda IAM Policy
SparkBoardNotificationHandlerRole:
  Permissions:
    - SQS:ReceiveMessage (僅 NotificationQueue)
    - SQS:DeleteMessage (僅 NotificationQueue)
    - DynamoDB:Query (僅 SparkTable)
    - SNS:Publish (僅 Notifications Topic)
    - CloudWatch:PutLogEvents
```

**S3 Bucket Policies**:
- Static Website Bucket: Public Read (僅 CloudFront)
- Uploads Bucket: Private (僅透過 Presigned URLs)

**API Gateway Authorizer**:
- Type: Cognito User Pools
- Token Source: `Authorization` Header
- Validation: JWT Signature + Expiration

### Cognito 安全設定

**User Pool 設定**:
- **密碼政策**: 最少 8 字元，需包含大小寫字母與數字
- **MFA**: 可選 (教學環境關閉，生產環境建議開啟)
- **Email 驗證**: 必須驗證才能登入
- **Token 有效期**: Access Token 60 分鐘, Refresh Token 30 天

**App Client 設定**:
- **Allowed OAuth Flows**: Authorization Code, Implicit
- **Allowed OAuth Scopes**: openid, profile, email
- **Callback URLs**: CloudFront URL + localhost (開發環境)

**User Groups (RBAC)**:
1. **Admins** (優先級 1): 完整權限
2. **Moderators** (優先級 2): 管理公告與所有任務
3. **Users** (優先級 3): 管理自己的任務

### 資料加密

**傳輸加密**:
- ✅ API Gateway 強制 HTTPS
- ✅ CloudFront 強制 HTTPS
- ✅ S3 Presigned URLs 使用 HTTPS

**靜態加密**:
- ✅ DynamoDB 預設加密 (AWS Managed Keys)
- ✅ S3 預設加密 (SSE-S3)
- ✅ Lambda 環境變數加密 (KMS)

### 錯誤處理與冪等性

**錯誤處理策略**:
1. **輸入驗證**: Lambda 函數入口處驗證所有參數
2. **Try-Catch**: 所有 AWS SDK 呼叫包在 try-catch 中
3. **錯誤回應**: 返回標準化的錯誤格式
   ```json
   {
     "error": "ValidationError",
     "message": "Title is required",
     "requestId": "abc-123"
   }
   ```

**冪等性設計**:
- **Items Lambda**: 使用 ulid 生成唯一 ID，重複創建會返回相同 ID
- **Notification Lambda**: 檢查是否已發送過通知 (查詢 DynamoDB)
- **Auto-Archive Lambda**: 使用 `archived` 欄位避免重複處理

**重試機制**:
- **SQS**: 自動重試 3 次，失敗後進入 DLQ
- **Lambda**: API Gateway 逾時時間 29 秒 (避免重複調用)
- **DynamoDB**: AWS SDK 內建指數退避重試

---

## 成本與限制

### 免費額度使用情況

**AWS Educate / Free Tier**:
- ✅ Lambda: 100 萬次請求/月, 40 萬 GB-秒
- ✅ DynamoDB: 25 GB 儲存, 25 RCU/WCU (按需計費無限制)
- ✅ API Gateway: 100 萬次呼叫/月 (前 12 個月)
- ✅ S3: 5 GB 儲存, 20,000 GET, 2,000 PUT
- ✅ CloudFront: 1 TB 傳輸 / 10,000,000 HTTP 請求
- ✅ SNS: 1,000 Email 通知/月
- ✅ SQS: 100 萬次請求/月

**預估月成本** (免費額度內):
- Lambda 執行: $0 (< 10,000 次/月)
- DynamoDB: $0 (< 1 GB 儲存)
- API Gateway: $0 (< 50,000 次/月)
- S3 + CloudFront: $0 (< 1 GB 流量)
- **總計**: 約 $0 - $2 USD/月 (幾乎免費)

### 教學版設計限制

**當前限制**:
1. **無 WAF**: 未部署 Web Application Firewall (成本考量)
2. **無 Multi-Region**: 僅單一區域部署 (us-east-1)
3. **無 VPC**: Lambda 函數在公網執行 (簡化架構)
4. **SNS Email 限制**: SES Sandbox 模式，僅能發送給已驗證郵箱
5. **無 Backup**: DynamoDB 未開啟 Point-In-Time Recovery (PITR)
6. **單表設計**: 過度正規化可能影響未來擴展

**生產環境建議調整**:
1. ✅ **啟用 WAF**: 防止 SQL Injection, XSS 攻擊 (成本: ~$5/月)
2. ✅ **Multi-Region 部署**: 災難復原 (DynamoDB Global Tables)
3. ✅ **VPC 部署**: Lambda 在私有子網執行，提升安全性
4. ✅ **申請 SES 生產權限**: 解除發送限制
5. ✅ **啟用 DynamoDB PITR**: 資料備份與恢復
6. ✅ **API Rate Limiting**: 防止 DDoS 攻擊
7. ✅ **CloudWatch Log 長期保留**: 30-90 天
8. ✅ **Lambda Reserved Concurrency**: 避免成本失控

### 擴展性考量

**水平擴展** (目前已支援):
- ✅ Lambda 自動擴展 (預設最多 1,000 並發)
- ✅ DynamoDB 按需計費，自動擴展
- ✅ API Gateway 自動擴展

**垂直擴展** (未來可調整):
- Lambda Memory: 目前 512 MB → 可調整至 1024-3008 MB
- DynamoDB Provisioned Capacity: 可切換為預配置模式 (成本優化)

---

## 個人分工說明

### 組員 A (後端架構)
- CDK Infrastructure 設計與部署
- Lambda 函數開發 (Items, Auth, Uploads)
- DynamoDB 單表設計與 GSI 規劃
- API Gateway + Cognito 整合

### 組員 B (非同步系統)
- SQS + SNS 訊息系統設計
- Notification Handler Lambda 開發
- EventBridge 定時任務設計
- Auto-Archive Lambda 開發

### 組員 C (監控與前端)
- CloudWatch Dashboard 設計
- X-Ray Tracing 整合
- CloudWatch Alarms 設定
- React 前端開發 (部分)

### 組員 D (測試與文件)
- API 測試腳本 (Postman Collection)
- 效能測試 (JMeter)
- 部署文件與使用手冊
- 期末報告與簡報製作

---

## 參考資料

### AWS 官方文件
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB Single Table Design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html)
- [API Gateway Cognito Authorizer](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-integrate-with-cognito.html)

### 第三方資源
- [The DynamoDB Book](https://www.dynamodbbook.com/) - Alex DeBrie
- [AWS CDK Patterns](https://cdkpatterns.com/)
- [Serverless Stack (SST)](https://serverless-stack.com/)

---

## 總結

SparkBoard 專題完整實現了：
1. ✅ **同步處理**: API Gateway → Lambda → DynamoDB 的即時 CRUD
2. ✅ **非同步處理**: SQS + SNS 的郵件通知系統
3. ✅ **事件驅動**: EventBridge 定時任務自動封存
4. ✅ **可觀測性**: CloudWatch + X-Ray 全方位監控
5. ✅ **安全性**: Cognito + IAM 最小權限設計
6. ✅ **自動化**: GitHub Actions CI/CD 部署
7. ✅ **文件化**: 完整的 API 文件與部署指南

**學習價值最高的服務**: DynamoDB 單表設計 + SQS 非同步訊息  
**最容易踩雷的地方**: Cognito Token 過期處理 + DynamoDB GSI 設計錯誤  
**如果重來會怎麼改**: 一開始就設計好 Error Handling + 更早導入 TypeScript 型別檢查

---

**最後更新**: 2025-12-24  
**文件版本**: v1.0  
**聯絡方式**: [GitHub Issues](https://github.com/Unforgettableeternalproject/SparkBoard/issues)
