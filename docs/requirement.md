# 🧭 Project Specification — SparkBoard

**Tagline:** Serverless 任務與公告平台
**目標:** 建立一個以雲端無伺服架構為基礎的社團任務與檔案分享平台，支援登入、公告、任務與檔案上傳功能，並能以 GitHub Actions 完成自動部署。

---

## 🏗️ Project Overview

SparkBoard 是一個以 **AWS Serverless 架構** 為核心的全端專案，旨在示範一個完整的雲端應用生命週期，包括基礎建設即程式（IaC）、API 設計、資料存取、安全性管理與 CI/CD 自動化。

主要特色：

* 使用 **Cognito** 提供帳號系統（註冊/登入/權限驗證）。
* **API Gateway + Lambda** 建立 RESTful API。
* **DynamoDB** 實作資料存取與索引查詢。
* **S3** 提供檔案上傳功能（Presigned URL）。
* **GitHub Actions** 完成 lint、測試與部署。
* **CloudWatch + X-Ray** 提供監控與日誌管理。

---

## ⚙️ Tech Stack

| 類別    | 技術                                 |
| ----- | ---------------------------------- |
| IaC   | AWS CDK (TypeScript)               |
| API   | API Gateway + AWS Lambda (Node.js) |
| 資料庫   | DynamoDB                           |
| 認證    | Amazon Cognito                     |
| 儲存    | Amazon S3                          |
| CI/CD | GitHub Actions                     |
| 測試    | Vitest + Supertest                 |
| 文件    | OpenAPI 3.0 / Swagger UI           |
| 監控    | CloudWatch / X-Ray                 |

---

## 🧩 System Architecture

```
[Frontend (React/Vite)]  ← optional
        ↓
   [CloudFront CDN]
        ↓
 [API Gateway REST API]
        ↓
 [Lambda Functions] ──> [DynamoDB Table: SparkTable]
        │
        ├──> [S3 Bucket: sparkboard-files]
        ├──> [SQS Queue: sparkboard-notify]
        └──> [Cognito User Pool]
```

---

## 📚 Repository Structure

```
sparkboard/
├─ infra/                    # CDK IaC
│  ├─ bin/stack.ts
│  ├─ lib/api-stack.ts
│  ├─ lib/auth-stack.ts
│  ├─ lib/storage-stack.ts
│  └─ cdk.json
├─ services/
│  ├─ auth/handlers.ts       # /auth/me
│  ├─ items/handlers.ts      # /items CRUD
│  ├─ uploads/handlers.ts    # /uploads/presign
│  ├─ notify/worker.ts       # SQS consumer
│  └─ common/
├─ openapi/
│  └─ sparkboard.yaml        # OpenAPI 定義
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ k6/
├─ .github/workflows/
│  ├─ ci.yml
│  └─ cdk-deploy.yml
├─ package.json
└─ README.md
```

---

## 📄 Core API Endpoints

| Method | Path               | Description      |
| ------ | ------------------ | ---------------- |
| `GET`  | `/auth/me`         | 取得登入使用者資訊（需 JWT） |
| `POST` | `/items`           | 建立新任務/公告         |
| `GET`  | `/items`           | 查詢任務清單（支援分頁）     |
| `POST` | `/uploads/presign` | 取得 S3 上傳簽名網址     |
| `POST` | `/notify`          | 發送通知（由 SQS 處理）   |

---

## 🧱 DynamoDB Schema (Single Table Design)

| Partition Key   | Sort Key              | Entity   | Attributes                        |
| --------------- | --------------------- | -------- | --------------------------------- |
| `ORG#<orgId>`   | `ITEM#<itemId>`       | 任務/公告    | title, content, createdAt, userId |
| `ORG#<orgId>`   | `COMMENT#<commentId>` | 留言       | text, createdAt, userId           |
| `USER#<userId>` | `ITEM#<itemId>`       | 使用者建立的項目 | alias for query                   |

**GSI1:** 依使用者查詢任務
**GSI2:** 依建立時間排序全平台最新項目

---

## 🔐 Security

* **JWT 驗證：** 使用 Cognito User Pool Authorizer 驗證 Token。
* **最小權限原則：** Lambda 僅允許操作指定 Table/Bucket。
* **資料加密：** S3 與 DynamoDB 使用 KMS Key。
* **Presigned URL 授權：** 限定使用者自身 `userId/` 前綴上傳。

---

## 🧪 Testing

* **Unit Test:** Vitest 測 Lambda handler
* **Integration Test:** Supertest 打 API Gateway
* **Contract Test:** Schemathesis 驗證 OpenAPI schema
* **Load Test:** k6 測 `/items` P95 < 200ms

---

## 🔄 CI/CD Pipeline

**GitHub Actions**

1. **CI (`ci.yml`)**

   * 安裝依賴 → Lint → Unit Test → OpenAPI Validate
2. **CD (`cdk-deploy.yml`)**

   * CDK Synth → Diff → Deploy (自動化部署至 AWS)

---

## 🧠 Monitoring

* CloudWatch Metrics：Lambda 成功率、錯誤率、延遲
* X-Ray Trace：API → Lambda → DynamoDB 追蹤
* Alarm：

  * Lambda Error > 0（連續 5 分鐘）
  * API 5xx > 1%
  * SQS 堆積 > 60 秒

---

## 💰 Estimated Cost

* 符合 AWS Free Tier
* Lambda + DynamoDB + API Gateway + S3 月成本 ≈ NT$0～30
* 可附上 **Budget Alarm** 截圖於期中簡報

---

## 🧩 Deliverables

* GitHub Repo（含 README + CI/CD workflows）
* Swagger UI Demo 網址
* CloudWatch / X-Ray 截圖
* 簡報：架構圖、功能流程、監控畫面、成本分析

---