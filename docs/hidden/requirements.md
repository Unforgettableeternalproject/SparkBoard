## 一、期末口頭簡報（PDF，一份）

**檔名**

```
Final-Presentation-第X組-SparkBoard.pdf
```

**內容一定要有（頁數不用多）** 

### 1️⃣ 專題回顧（1–2 張）

* 專題名稱
* 一句話說清楚解決什麼問題
* **一句話交代：期中 vs 期末有沒有調整**

  * 即使只是「補實作與觀測」也算

---

### 2️⃣ 最終系統架構圖（1–2 張）

圖中**一定要標出**：

* API Gateway
* Lambda
* DynamoDB
* S3 / CloudFront
* SQS / SNS / EventBridge（有就標，沒有不用硬加）
* Cognito

並在圖旁邊加註：

* 哪些是同步
* 哪些是非同步
* 哪些是課堂教過的

---

### 3️⃣ 核心流程展示（最重要，2 條流程）

每一條流程都要有 **實作證據**：

* API 呼叫（curl / Postman）
* Lambda 有跑（Logs）
* DynamoDB 有資料

> 至少 2 條（可以 2 條同步，也可以 1 同步 + 1 非同步）

---

### 4️⃣ 工程實務證據（一定要有）

至少涵蓋 **3 類**（你做得到的）：

* CDK / CI/CD deploy 成功畫面
* CloudWatch Logs
* CloudWatch Metrics（Invocation / Errors / Duration 任選 2）
* SQS queue depth（如果有非同步）

---

### 5️⃣ 安全性與可靠性（講概念）

* 有沒有用 Cognito
* IAM 最小權限怎麼想
* 錯誤處理（retry / DLQ / 冪等）有沒有設、或未來怎麼設

---

### 6️⃣ 成本與限制

* 用免費額度 / Educate
* 哪些是教學版設計
* 如果真的上線會怎麼調整

---

### 7️⃣ 總結與反思（1 張）

* 哪個 AWS 服務最有學習價值
* 哪個地方最容易踩雷
* 如果重來一次會怎麼設計

---

## 二、期末成果說明文件（Markdown，一份）

**檔名**

```
final-report-第X組.md
```

**章節不可缺**（照順序就好）

```md
# 專題簡介與問題定義
# 系統架構與服務選型理由
# 核心流程說明（至少 2 條）
# 非同步設計說明（若有 SQS/SNS/EventBridge）
# Observability 設計（Logs / Metrics / Alarms）
# 安全性與 IAM 設計原則
# 成本與限制
# 個人分工說明
```

👉 這份文件**不用寫得很長**，重點是「對得上你簡報與截圖」。

---

## 三、實作證據截圖資料夾（一定要交）

**資料夾名稱**

```
evidence/
```

**建議結構（照這個放，老師一看就懂）** 

```
evidence/
├── api-test.png          # Postman / curl 成功
├── lambda-logs.png       # CloudWatch Logs
├── dynamodb-data.png     # DynamoDB item
├── metrics-dashboard.png # CloudWatch Metrics
├── deploy-success.png    # cdk deploy 或 CI/CD 成功
├── sqs-messages.png      # 若有非同步（沒有可省）
```

⚠️ 老師原文重點：

> 「沒有證據 = 沒有實作」

---

## 四、整體交付物一覽表（你實際要準備的）

| 項目    | 你要交                 |
| ----- | ------------------- |
| 期末簡報  | ✅ 1 份 PDF           |
| 書面說明  | ✅ 1 份 Markdown      |
| 實作證據  | ✅ 1 個 evidence/ 資料夾 |
| 新功能   | ❌ 不強制               |
| UI 改動 | ❌ 不需要               |

---