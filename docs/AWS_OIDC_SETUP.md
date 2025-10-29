# AWS OIDC Setup for GitHub Actions

本文檔說明如何設置 AWS OIDC 提供者，讓 GitHub Actions 可以無需長期憑證即可部署到 AWS。

## 為什麼使用 OIDC？

- ✅ 無需在 GitHub Secrets 中存儲 AWS Access Keys
- ✅ 自動輪換的短期憑證
- ✅ 精確控制權限範圍
- ✅ 符合最佳安全實踐

## 步驟 1: 創建 OIDC Identity Provider

在 AWS IAM Console 中創建 OIDC 提供者：

1. 前往 **IAM Console** → **Identity providers** → **Add provider**
2. 選擇 **OpenID Connect**
3. 配置如下：
   ```
   Provider URL: https://token.actions.githubusercontent.com
   Audience: sts.amazonaws.com
   ```
4. 點擊 **Add provider**

### AWS CLI 方式

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

## 步驟 2: 創建 IAM Role

創建一個 IAM Role 供 GitHub Actions 使用。

### 信任策略 (Trust Policy)

保存以下內容為 `github-actions-trust-policy.json`：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
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
    }
  ]
}
```

**重要**：
- 將 `YOUR_ACCOUNT_ID` 替換為您的 AWS 帳戶 ID
- `sub` 條件限制為只有 `Unforgettableeternalproject/SparkBoard` repo 可以使用
- 使用 `repo:OWNER/REPO:ref:refs/heads/main` 可以進一步限制只有 main 分支

### 創建 Role

```bash
aws iam create-role \
  --role-name GitHubActionsSparkBoardDeploy \
  --assume-role-policy-document file://github-actions-trust-policy.json \
  --description "Role for GitHub Actions to deploy SparkBoard"
```

## 步驟 3: 附加權限策略

創建一個自定義策略 `sparkboard-deploy-policy.json`：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CDKDeployment",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResources",
        "cloudformation:GetTemplate",
        "cloudformation:ValidateTemplate",
        "cloudformation:CreateChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DeleteChangeSet",
        "cloudformation:ListStacks"
      ],
      "Resource": [
        "arn:aws:cloudformation:*:YOUR_ACCOUNT_ID:stack/SparkBoard-*/*",
        "arn:aws:cloudformation:*:YOUR_ACCOUNT_ID:stack/CDKToolkit/*"
      ]
    },
    {
      "Sid": "S3CDKAssets",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:CreateBucket"
      ],
      "Resource": [
        "arn:aws:s3:::cdk-*",
        "arn:aws:s3:::cdk-*/*"
      ]
    },
    {
      "Sid": "LambdaDeployment",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:ListFunctions",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:*:YOUR_ACCOUNT_ID:function:SparkBoard-*"
    },
    {
      "Sid": "APIGatewayDeployment",
      "Effect": "Allow",
      "Action": [
        "apigateway:*"
      ],
      "Resource": "arn:aws:apigateway:*::/*"
    },
    {
      "Sid": "DynamoDBDeployment",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:UpdateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:ListTables",
        "dynamodb:UpdateTimeToLive",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:ListTagsOfResource",
        "dynamodb:TagResource",
        "dynamodb:UntagResource"
      ],
      "Resource": "arn:aws:dynamodb:*:YOUR_ACCOUNT_ID:table/SparkBoard-*"
    },
    {
      "Sid": "CognitoDeployment",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:CreateUserPool",
        "cognito-idp:UpdateUserPool",
        "cognito-idp:DeleteUserPool",
        "cognito-idp:DescribeUserPool",
        "cognito-idp:CreateUserPoolClient",
        "cognito-idp:UpdateUserPoolClient",
        "cognito-idp:DeleteUserPoolClient",
        "cognito-idp:DescribeUserPoolClient"
      ],
      "Resource": "arn:aws:cognito-idp:*:YOUR_ACCOUNT_ID:userpool/*"
    },
    {
      "Sid": "S3BucketManagement",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:PutBucketPolicy",
        "s3:PutBucketCORS",
        "s3:PutBucketVersioning",
        "s3:PutEncryptionConfiguration",
        "s3:PutBucketPublicAccessBlock",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::sparkboard-*"
    },
    {
      "Sid": "IAMRoleManagement",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy"
      ],
      "Resource": "arn:aws:iam::YOUR_ACCOUNT_ID:role/SparkBoard-*"
    },
    {
      "Sid": "SSMParameterAccess",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:PutParameter",
        "ssm:DeleteParameter"
      ],
      "Resource": "arn:aws:ssm:*:YOUR_ACCOUNT_ID:parameter/cdk-bootstrap/*"
    },
    {
      "Sid": "ECRAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    }
  ]
}
```

附加策略到 Role：

```bash
aws iam put-role-policy \
  --role-name GitHubActionsSparkBoardDeploy \
  --policy-name SparkBoardDeployPolicy \
  --policy-document file://sparkboard-deploy-policy.json
```

## 步驟 4: 配置 GitHub Secrets

在 GitHub Repository 中添加以下 Secrets：

1. 前往 **Settings** → **Secrets and variables** → **Actions**
2. 添加 Secret：
   ```
   Name: AWS_ROLE_ARN
   Value: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsSparkBoardDeploy
   ```

## 步驟 5: CDK Bootstrap

確保 CDK 環境已經 bootstrap：

```bash
cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
```

這會創建：
- S3 bucket 用於存放 CDK assets
- IAM roles 用於 CloudFormation 執行
- ECR repository 用於 Docker images (如果需要)

## 驗證設置

測試 OIDC 配置：

```bash
# 在 GitHub Actions workflow 中
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: us-east-1

- name: Test AWS access
  run: |
    aws sts get-caller-identity
    aws s3 ls
```

## 安全最佳實踐

1. **最小權限原則**：只授予部署所需的最小權限
2. **資源限制**：使用 ARN 限制可操作的資源範圍
3. **條件限制**：在信任策略中使用 `StringLike` 限制 repo 和分支
4. **定期審查**：定期檢查 IAM 角色的使用情況

## 常見問題

### Q: 錯誤 "Not authorized to perform sts:AssumeRoleWithWebIdentity"

A: 檢查：
- OIDC Provider 的 URL 和 Audience 是否正確
- Trust Policy 中的 repo 名稱是否正確
- GitHub Actions 的 permissions 是否包含 `id-token: write`

### Q: 錯誤 "CDK bootstrap required"

A: 運行 `cdk bootstrap` 初始化環境

### Q: 部署失敗但本地成功

A: 檢查：
- IAM Role 是否有所有必要的權限
- CloudFormation stack 是否有舊的資源導致衝突
- 環境變數是否正確設置

## 相關資源

- [GitHub Actions OIDC 文檔](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [AWS CDK Bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
