# CI/CD 部署指南

本指南說明如何設置和使用 SparkBoard 的 CI/CD 自動部署流程。

## 📋 前置需求

### 1. AWS 帳號設置

1. 擁有 AWS 帳號，並有管理員權限
2. 知道您的 AWS Account ID
3. 決定部署的 AWS Region (預設: `us-east-1`)

### 2. 本地環境

```bash
# 安裝 AWS CLI
# macOS
brew install awscli

# Windows
choco install awscli

# 配置 AWS 憑證
aws configure
```

### 3. CDK Bootstrap

**重要**：首次部署前必須執行 CDK bootstrap：

```bash
# 替換 ACCOUNT_ID 和 REGION
cdk bootstrap aws://ACCOUNT_ID/us-east-1
```

這會創建：
- S3 bucket 用於存放 CDK assets
- IAM roles 用於 CloudFormation
- ECR repository (如果需要)

驗證 bootstrap：
```bash
aws cloudformation describe-stacks --stack-name CDKToolkit
```

## 🔐 Step 1: 設置 AWS OIDC

按照 [AWS_OIDC_SETUP.md](./AWS_OIDC_SETUP.md) 完整指南進行設置。

### 快速步驟

1. **創建 OIDC Provider**
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

2. **創建 IAM Role**

保存以下內容為 `trust-policy.json`，替換 `YOUR_ACCOUNT_ID`：

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:Unforgettableeternalproject/SparkBoard:*"
      }
    }
  }]
}
```

創建 Role：
```bash
aws iam create-role \
  --role-name GitHubActionsSparkBoardDeploy \
  --assume-role-policy-document file://trust-policy.json
```

3. **附加權限**

使用 [AWS_OIDC_SETUP.md](./AWS_OIDC_SETUP.md) 中的完整策略文件。

## 🔧 Step 2: 配置 GitHub Secrets

在 GitHub Repository 中添加以下 Secrets：

1. 前往 **Settings** → **Secrets and variables** → **Actions**

2. 添加 **Repository secrets**：
   ```
   Name: AWS_ROLE_ARN
   Value: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsSparkBoardDeploy
   ```

3. 添加 **Repository variables** (可選)：
   ```
   Name: AWS_REGION
   Value: us-east-1
   ```

## 🚀 Step 3: 工作流程說明

### Workflow 1: Feature Branch CI (`feature-ci.yml`)

**觸發條件：**
- Push 到 `feature/**` 分支
- 創建 PR 到 `development`

**執行內容：**
- ✅ Code quality & ESLint
- ✅ Frontend build
- ✅ Lambda unit tests (items, auth, health, uploads)
- ✅ CDK infrastructure validation
- ✅ Security scan
- ✅ PR checks

**不會部署到 AWS**

### Workflow 2: CI Checks (`ci.yml`)

**觸發條件：**
- PR 到 `development` 或 `main`
- Push 到 `development` 或 `main`

**執行內容：**
- ✅ Frontend checks & build
- ✅ Lambda unit tests
- ✅ CDK infrastructure validation

**不會部署到 AWS**

### Workflow 3: Merge to Main (`deploy-to-main.yml`)

**觸發條件：**
- Push 到 `development` 分支

**執行內容：**
1. 運行所有質量檢查
2. 自動合併 `development` → `main`
3. 創建版本 tag

**不會部署到 AWS**（觸發下一個 workflow）

### Workflow 4: CDK Deploy (`cdk-deploy.yml`) ⭐

**觸發條件：**
- Push 到 `main` 分支（自動）
- 手動觸發 (workflow_dispatch)

**執行內容：**
1. **CI Checks**
   - ESLint & Frontend build
   - 所有 Lambda 測試
   - CDK build

2. **CDK Deployment**
   - 使用 OIDC 認證 AWS
   - 檢查 CDK bootstrap
   - CDK synth & diff
   - CDK deploy (無需手動批准)
   - 提取 API endpoint
   - 測試 API health

3. **Post-Deployment**
   - 驗證 CloudFormation stacks
   - 列出 Lambda functions
   - 創建部署記錄

4. **Rollback** (失敗時)
   - 通知失敗
   - 提供排錯指引

**會自動部署到 AWS** ✅

## 📝 使用流程

### 日常開發流程

```bash
# 1. 創建 feature 分支
git checkout -b feature/my-new-feature

# 2. 進行開發和提交
git add .
git commit -m "feat: add new feature"

# 3. Push 到 GitHub
git push origin feature/my-new-feature
# → 觸發 feature-ci.yml，運行所有檢查

# 4. 創建 PR 到 development
# → 觸發 ci.yml，運行 PR 檢查

# 5. 合併 PR 到 development
# → 觸發 ci.yml 和 deploy-to-main.yml

# 6. deploy-to-main.yml 自動合併到 main
# → 觸發 cdk-deploy.yml，自動部署到 AWS ✅
```

### 手動部署

如果需要手動觸發部署：

1. 前往 **Actions** tab
2. 選擇 **CDK Deploy to AWS** workflow
3. 點擊 **Run workflow**
4. 選擇 environment (production/staging)
5. 點擊 **Run workflow**

### 本地測試

```bash
# 運行測試
npm run lint
npm run build
cd services/items && npm test

# 本地 CDK 操作
cd infra
npm install
npm run build
npx cdk synth     # 生成 CloudFormation
npx cdk diff      # 查看變更
npx cdk deploy    # 部署（需要 AWS 憑證）
```

## 🔍 驗證部署

### 檢查 GitHub Actions

1. 前往 **Actions** tab
2. 查看最新的 workflow run
3. 確保所有 jobs 都是綠色 ✅

### 檢查 AWS

```bash
# 查看 CloudFormation stacks
aws cloudformation list-stacks \
  --query "StackSummaries[?StackName.starts_with(@, 'SparkBoard-')].{Name:StackName,Status:StackStatus}" \
  --output table

# 查看 Lambda functions
aws lambda list-functions \
  --query "Functions[?starts_with(FunctionName, 'SparkBoard-')].FunctionName" \
  --output table

# 查看 API Gateway
aws apigateway get-rest-apis \
  --query "items[?name.contains(@, 'SparkBoard')]" \
  --output table
```

### 測試 API

從 GitHub Actions 的 **Summary** 中找到 API Endpoint，然後：

```bash
# 假設 API_URL 是從部署輸出中獲得的
API_URL="https://xxx.execute-api.us-east-1.amazonaws.com/prod"

# 測試 health endpoint
curl "$API_URL/health"

# 預期輸出：
# {"status":"healthy","timestamp":"..."}
```

## ⚠️  常見問題

### 1. "Error: Need to perform AWS calls for account XXX"

**原因：** 沒有執行 CDK bootstrap

**解決：**
```bash
cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
```

### 2. "Error: User is not authorized to perform sts:AssumeRoleWithWebIdentity"

**原因：** OIDC 配置錯誤或 IAM Role ARN 不正確

**解決：**
1. 檢查 `AWS_ROLE_ARN` secret 是否正確
2. 驗證 IAM Role 的 Trust Policy
3. 確認 repo 名稱匹配

### 3. "Error: Stack XXX is in UPDATE_ROLLBACK_FAILED state"

**原因：** 之前的部署失敗且回滾也失敗

**解決：**
```bash
# 在 AWS Console 中手動修復或刪除 stack
aws cloudformation continue-update-rollback --stack-name SparkBoard-XXX
# 或
aws cloudformation delete-stack --stack-name SparkBoard-XXX
```

### 4. "Error: No space left on device"

**原因：** GitHub Actions runner 磁碟空間不足

**解決：** 在 workflow 中添加清理步驟（已包含在 workflow 中）

### 5. Lambda 測試失敗

**原因：** package.json 或 package-lock.json 不同步

**解決：**
```bash
cd services/XXX
npm install  # 重新生成 package-lock.json
git add package-lock.json
git commit -m "chore: update package-lock.json"
```

## 🎯 最佳實踐

1. **始終在 feature 分支開發**
   - 不要直接 push 到 `development` 或 `main`

2. **使用有意義的 commit messages**
   - 遵循 Conventional Commits: `feat:`, `fix:`, `docs:`, 等

3. **小而頻繁的提交**
   - 每個 PR 專注於單一功能或修復

4. **定期合併 development**
   - 保持 feature 分支與 development 同步

5. **檢查 CI 結果**
   - PR 合併前確保所有檢查通過

6. **監控部署**
   - 部署後檢查 CloudWatch Logs
   - 驗證 API endpoints 正常工作

## 📚 相關文檔

- [AWS OIDC Setup](./AWS_OIDC_SETUP.md) - 詳細的 OIDC 設置指南
- [CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)

## 🆘 獲取幫助

如果遇到問題：

1. 檢查 [GitHub Actions logs](https://github.com/Unforgettableeternalproject/SparkBoard/actions)
2. 查看 [CloudFormation Events](https://console.aws.amazon.com/cloudformation)
3. 檢查 [CloudWatch Logs](https://console.aws.amazon.com/cloudwatch)
4. 參考本文檔的常見問題部分
