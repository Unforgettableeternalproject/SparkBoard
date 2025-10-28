# GitHub Actions Workflows

此目錄包含 SparkBoard 專案的 CI/CD 工作流程。

## 📋 工作流程清單

### 1. Feature Branch CI (`feature-ci.yml`)

**觸發時機：**
- 推送到 `feature/**` 分支
- 對 `development` 分支的 Pull Request

**執行內容：**
- ✅ 程式碼品質檢查 (ESLint, TypeScript)
- ✅ 前端建置測試與大小檢查
- ✅ Lambda 服務單元測試 (並行)
- ✅ CDK 基礎設施驗證
- ✅ 安全性掃描 (npm audit, 秘密檢查)
- ✅ PR 檢查 (標題格式, 變更檔案數, 分支狀態)
- ✅ 自動標籤 (根據修改的檔案)

**用途：** 確保 feature 分支程式碼品質，準備合併到 development。

---

### 2. CI - Pull Request Checks (`ci.yml`)

**觸發時機：**
- 對 `development` 或 `main` 分支的 Pull Request
- 直接推送到 `development` 或 `main` 分支

**執行內容：**
- ✅ 前端建置與 Lint 檢查
- ✅ Lambda 函式單元測試
- ✅ CDK 基礎設施驗證

**用途：** 確保程式碼品質，防止有問題的程式碼合併到主要分支。

---

### 3. Deploy to Main (`deploy-to-main.yml`)

**觸發時機：**
- 推送到 `development` 分支

**執行內容：**
1. **Quality Checks (品質檢查)**
   - ESLint 檢查
   - Lambda 單元測試
   - CDK 建置驗證

2. **Merge to Main (合併到主分支)**
   - 自動將 development 合併到 main
   - 建立部署標籤 (deploy-YYYYMMDD-HHMMSS)
   - 使用 `--no-ff` 保留合併歷史

3. **Notify Result (通知結果)**
   - 生成部署摘要
   - 顯示各階段執行狀態

**用途：** 自動化 development → main 的合併流程。

---

## 🚀 使用方式

### Feature 分支開發流程 (推薦)

```bash
# 1. 從 development 建立 feature 分支
git checkout development
git pull origin development
git checkout -b feature/new-feature

# 2. 進行開發
# ... 編輯程式碼 ...

# 3. 提交變更 (遵循 conventional commits)
git add .
git commit -m "feat: add new feature description"

# 4. 推送 feature 分支
git push origin feature/new-feature

# 5. GitHub Actions 自動執行：
#    ✅ 程式碼品質檢查
#    ✅ 單元測試
#    ✅ 建置驗證
#    ✅ 安全性掃描

# 6. 在 GitHub 建立 PR 到 development
#    - Feature CI 會執行完整檢查
#    - 自動添加相關標籤
#    - 檢查 PR 標題格式
#    - 提示是否需要 rebase

# 7. Code Review 後合併到 development

# 8. development 推送後自動合併到 main
```

### 直接在 development 開發 (小改動)

```bash
# 1. 在 development 分支開發
git checkout development
git pull origin development

# 2. 進行開發與測試
# ... 編輯程式碼 ...

# 3. 提交變更
git add .
git commit -m "fix: correct minor bug"

# 4. 推送到 development
git push origin development

# 5. GitHub Actions 自動執行：
#    - CI 檢查通過
#    - 自動合併到 main
#    - 建立部署標籤
```

### Commit Message 格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**類型 (type):**
- `feat`: 新功能
- `fix`: 修復 bug
- `docs`: 文件變更
- `style`: 程式碼格式 (不影響功能)
- `refactor`: 重構
- `test`: 測試相關
- `chore`: 建置流程或輔助工具
- `perf`: 效能改進

**範例:**
```bash
feat(items): add pagination support
fix(auth): correct token validation
docs: update API documentation
chore(deps): upgrade dependencies
```

---

## ⚙️ 工作流程配置

### 需要的 GitHub Secrets

目前使用內建的 `GITHUB_TOKEN`，無需額外設定。

未來如果需要部署到 AWS，需要新增：
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

### 分支保護規則 (建議設定)

#### `main` 分支
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass before merging
  - CI - Frontend Checks
  - CI - Lambda Tests
  - CI - Infrastructure
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

#### `development` 分支
- ✅ Require status checks to pass before merging
- ✅ Allow force pushes (for team collaboration)

---

## 🔄 工作流程執行順序

### Feature → Development → Main

```
1. Feature Branch
   └─ Push to feature/*
      └─ Feature CI runs
         ├─ Code Quality
         ├─ Frontend Build
         ├─ Lambda Tests
         ├─ Infrastructure Check
         └─ Security Scan
            ↓
   └─ Create PR to development
      └─ PR Checks
         ├─ Title format
         ├─ Changed files count
         ├─ Branch up-to-date
         └─ Auto labeling
            ↓
   └─ Merge to development (manual)
      
2. Development Branch
   └─ Push to development
      └─ Deploy to Main workflow
         ├─ Quality Checks
         ├─ Auto merge to main
         ├─ Create tag
         └─ Summary
```

### 分支策略圖

```
feature/xxx ─────┐
                 ├──> development ──> main
feature/yyy ─────┘         │           │
                           │           │
                      (PR + CI)   (Auto merge)
                                       │
                                   (Tagged)
```

---

## 📊 監控與除錯

### 檢視工作流程執行狀態
1. 前往 GitHub Repository
2. 點選 "Actions" 標籤
3. 查看最新的工作流程執行

### 常見問題

**Q: Feature CI 檢查失敗？**
A: 
1. 查看 Actions 標籤中具體失敗的 job
2. 修正問題後重新推送
3. GitHub Actions 會自動重新執行

**Q: PR 標題格式不正確？**
A: 使用格式: `type(scope): description`
   例如: `feat(auth): add login feature`

**Q: 分支落後 development 太多？**
A: 
```bash
git checkout feature/your-feature
git fetch origin
git rebase origin/development
git push --force-with-lease
```

**Q: 如何跳過 CI？**
A: 在 commit message 加上 `[skip ci]`

**Q: 合併衝突怎麼辦？**
A: 
1. 在本地 rebase development
2. 解決衝突
3. 重新推送

**Q: 想要只執行特定的 CI 檢查？**
A: 目前暫不支援，所有檢查都會執行以確保品質

---

## 🔮 未來擴展

計劃中的改進：
- [ ] 自動部署到 AWS (CDK Deploy)
- [ ] 整合測試 (Integration Tests)
- [ ] 效能測試 (k6 load tests)
- [ ] Slack/Email 通知
- [ ] 自動生成 Changelog
- [ ] 版本號自動更新

---

## 📝 注意事項

1. **[skip ci]**: 在 commit message 中加入此關鍵字可跳過 CI
2. **標籤格式**: 自動建立的標籤格式為 `deploy-YYYYMMDD-HHMMSS`
3. **合併策略**: 使用 `--no-ff` 保留完整的合併歷史
4. **權限**: 需要 `contents: write` 權限才能推送到 main

---

**Last Updated:** 2025-10-28
