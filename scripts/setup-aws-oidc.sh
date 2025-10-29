#!/bin/bash

# SparkBoard AWS OIDC Setup Script
# This script automates the creation of OIDC provider and IAM role for GitHub Actions

set -e

echo "🚀 SparkBoard AWS OIDC Setup"
echo "=============================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "   macOS: brew install awscli"
    echo "   Ubuntu: sudo apt install awscli"
    echo "   Windows: choco install awscli"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run: aws configure"
    exit 1
fi

# Get AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}

echo "✅ AWS Account ID: $ACCOUNT_ID"
echo "✅ AWS Region: $REGION"
echo ""

# Repository information
REPO_OWNER="Unforgettableeternalproject"
REPO_NAME="SparkBoard"
ROLE_NAME="GitHubActionsSparkBoardDeploy"

echo "📦 Repository: $REPO_OWNER/$REPO_NAME"
echo "🔐 IAM Role: $ROLE_NAME"
echo ""

read -p "Continue with setup? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

# Step 1: Create OIDC Provider
echo ""
echo "Step 1: Creating OIDC Provider..."

if aws iam get-open-id-connect-provider \
    --open-id-connect-provider-arn "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" \
    &> /dev/null; then
    echo "✅ OIDC Provider already exists"
else
    aws iam create-open-id-connect-provider \
        --url https://token.actions.githubusercontent.com \
        --client-id-list sts.amazonaws.com \
        --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
    echo "✅ OIDC Provider created"
fi

# Step 2: Create Trust Policy
echo ""
echo "Step 2: Creating Trust Policy..."

cat > /tmp/github-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${REPO_OWNER}/${REPO_NAME}:*"
        }
      }
    }
  ]
}
EOF

# Step 3: Create IAM Role
echo ""
echo "Step 3: Creating IAM Role..."

if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    echo "⚠️  Role already exists. Updating trust policy..."
    aws iam update-assume-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-document file:///tmp/github-trust-policy.json
else
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/github-trust-policy.json \
        --description "Role for GitHub Actions to deploy SparkBoard"
    echo "✅ IAM Role created"
fi

# Step 4: Create and attach deployment policy
echo ""
echo "Step 4: Creating Deployment Policy..."

cat > /tmp/sparkboard-deploy-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CDKDeployment",
      "Effect": "Allow",
      "Action": [
        "cloudformation:*"
      ],
      "Resource": [
        "arn:aws:cloudformation:*:${ACCOUNT_ID}:stack/SparkBoard-*/*",
        "arn:aws:cloudformation:*:${ACCOUNT_ID}:stack/CDKToolkit/*"
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
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:PutBucketPolicy",
        "s3:PutBucketCORS",
        "s3:PutBucketVersioning",
        "s3:PutEncryptionConfiguration",
        "s3:PutBucketPublicAccessBlock"
      ],
      "Resource": [
        "arn:aws:s3:::cdk-*",
        "arn:aws:s3:::cdk-*/*",
        "arn:aws:s3:::sparkboard-*",
        "arn:aws:s3:::sparkboard-*/*"
      ]
    },
    {
      "Sid": "LambdaDeployment",
      "Effect": "Allow",
      "Action": [
        "lambda:*"
      ],
      "Resource": "arn:aws:lambda:*:${ACCOUNT_ID}:function:SparkBoard-*"
    },
    {
      "Sid": "APIGatewayDeployment",
      "Effect": "Allow",
      "Action": [
        "apigateway:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DynamoDBDeployment",
      "Effect": "Allow",
      "Action": [
        "dynamodb:*"
      ],
      "Resource": "arn:aws:dynamodb:*:${ACCOUNT_ID}:table/SparkBoard-*"
    },
    {
      "Sid": "CognitoDeployment",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:*"
      ],
      "Resource": "*"
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
        "iam:GetRolePolicy",
        "iam:TagRole",
        "iam:UntagRole"
      ],
      "Resource": "arn:aws:iam::${ACCOUNT_ID}:role/SparkBoard-*"
    },
    {
      "Sid": "SSMParameterAccess",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:PutParameter",
        "ssm:DeleteParameter"
      ],
      "Resource": "arn:aws:ssm:*:${ACCOUNT_ID}:parameter/cdk-bootstrap/*"
    },
    {
      "Sid": "ECRAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Sid": "STSAccess",
      "Effect": "Allow",
      "Action": [
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name SparkBoardDeployPolicy \
    --policy-document file:///tmp/sparkboard-deploy-policy.json

echo "✅ Deployment policy attached"

# Step 5: Check CDK Bootstrap
echo ""
echo "Step 5: Checking CDK Bootstrap..."

if aws cloudformation describe-stacks --stack-name CDKToolkit --region "$REGION" &> /dev/null; then
    echo "✅ CDK Bootstrap stack exists"
else
    echo "⚠️  CDK Bootstrap not found!"
    echo ""
    echo "Please run the following command to bootstrap CDK:"
    echo "  cdk bootstrap aws://${ACCOUNT_ID}/${REGION}"
    echo ""
fi

# Clean up
rm /tmp/github-trust-policy.json
rm /tmp/sparkboard-deploy-policy.json

# Display summary
echo ""
echo "=============================="
echo "✅ Setup Complete!"
echo "=============================="
echo ""
echo "Next steps:"
echo ""
echo "1. Add GitHub Secret:"
echo "   Go to: https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/secrets/actions"
echo "   Name: AWS_ROLE_ARN"
echo "   Value: arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo ""
echo "2. Add GitHub Variable (optional):"
echo "   Go to: https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/variables/actions"
echo "   Name: AWS_REGION"
echo "   Value: ${REGION}"
echo ""
echo "3. If CDK Bootstrap is needed:"
echo "   cdk bootstrap aws://${ACCOUNT_ID}/${REGION}"
echo ""
echo "4. Test deployment:"
echo "   Push to main branch or manually trigger 'CDK Deploy to AWS' workflow"
echo ""
