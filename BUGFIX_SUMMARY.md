# Bug Fix Summary - 2025-11-18

## 問題描述

1. **封存按鈕顯示問題**
   - 已完成的任務沒有顯示封存按鈕
   - 管理員無法封存已完成的任務

2. **主題閃爍問題**
   - 登入頁面載入時會閃爍一下主題
   - 主題設置不同步

3. **主題持久化問題**
   - 用戶的主題偏好沒有保存到資料庫
   - 下次登入時需要重新設置主題

## 修復內容

### 1. 封存按鈕顯示邏輯修復

**文件**: `src/components/ItemCard.tsx`

**變更**:
```typescript
// 修改前
const canArchive = item.type === 'task' && onUpdate && item.hasBeenInProgress && (isOwner || isModerator)

// 修改後
const canArchive = item.type === 'task' && onUpdate && (item.status === 'completed' || item.hasBeenInProgress) && (isOwner || isModerator)
```

**說明**:
- 現在已完成的任務（`status === 'completed'`）即使沒有 `hasBeenInProgress` 標記也會顯示封存按鈕
- 保持了原有的權限控制（owner 或 moderator）

### 2. 主題閃爍問題修復

**文件**: `src/components/LoginForm.tsx`

**變更**:
- 添加 `useEffect` hook 在組件掛載時立即應用主題
- 從 localStorage 讀取保存的主題設置
- 如果沒有保存的設置，則根據系統偏好應用主題

**代碼**:
```typescript
useEffect(() => {
  const savedTheme = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark)
  
  if (shouldBeDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}, [])
```

**說明**:
- LoginForm 現在會在首次渲染時立即應用主題
- 與 App.tsx 中的主題初始化邏輯保持一致
- 消除了從淺色到深色（或相反）的閃爍

### 3. 主題持久化實現

#### 3.1 後端支持

**文件**: `services/auth/index.js`

**變更**:
1. 添加 `theme` 欄位的驗證和更新邏輯
2. 在 GET `/auth/me` 回應中包含 `theme` 屬性
3. 在 PATCH `/auth/me` 回應中包含更新後的 `theme` 屬性

**代碼片段**:
```javascript
// 驗證 theme 更新
if (body.theme !== undefined) {
  if (typeof body.theme !== 'string') {
    return createResponse(400, {
      error: 'ValidationError',
      message: 'theme must be a string',
    });
  }
  // Validate theme value
  if (!['light', 'dark', 'system'].includes(body.theme)) {
    return createResponse(400, {
      error: 'ValidationError',
      message: 'theme must be one of: light, dark, system',
    });
  }
  updates.theme = body.theme;
}
```

#### 3.2 前端類型定義

**文件**: `src/lib/types.ts`

**變更**:
```typescript
export interface User {
  // ... 其他屬性
  theme?: 'light' | 'dark' | 'system'
}
```

#### 3.3 登入時應用主題

**文件**: `src/hooks/use-auth.ts`

**變更**:
- 在加載用戶 profile 後，檢查並應用用戶的主題偏好
- 更新 localStorage 以保持一致性

**代碼片段**:
```typescript
if (data.user) {
  // Apply user's theme preference
  if (data.user.theme && data.user.theme !== 'system') {
    if (data.user.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', data.user.theme)
  }
  
  setUser(prevUser => {
    if (!prevUser) return null
    return {
      ...prevUser,
      // ... 其他屬性
      theme: data.user.theme,
    }
  })
}
```

#### 3.4 主題切換同步到後端

**文件**: `src/components/Header.tsx`

**變更**:
- 添加 `idToken` 作為 prop
- 在 `toggleTheme` 函數中調用後端 API 更新主題偏好

**代碼片段**:
```typescript
const toggleTheme = async () => {
  const newIsDark = !isDark
  setIsDark(newIsDark)
  
  const newTheme = newIsDark ? 'dark' : 'light'
  
  if (newIsDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  localStorage.setItem('theme', newTheme)
  
  // Update theme preference in backend
  if (idToken) {
    try {
      const apiUrl = import.meta.env.VITE_API_URL
      await fetch(`${apiUrl}/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': idToken,
        },
        body: JSON.stringify({ theme: newTheme }),
      })
    } catch (error) {
      console.error('Failed to update theme preference:', error)
    }
  }
}
```

**文件**: `src/App.tsx`

**變更**:
- 從 `useAuth` hook 中提取 `idToken`
- 將 `idToken` 傳遞給 Header 組件

## 測試計劃

### 1. 封存功能測試
- [ ] 創建一個新任務
- [ ] 將任務標記為完成
- [ ] 確認封存按鈕出現
- [ ] 點擊封存按鈕
- [ ] 確認任務被正確封存

### 2. 主題閃爍測試
- [ ] 登出系統
- [ ] 切換到深色主題（如果當前是淺色）
- [ ] 重新登入
- [ ] 確認登入頁面沒有閃爍
- [ ] 確認登入後保持深色主題

### 3. 主題持久化測試
- [ ] 登入系統
- [ ] 切換主題（淺色 ↔ 深色）
- [ ] 確認主題立即更新
- [ ] 登出並重新登入
- [ ] 確認主題保持之前的選擇
- [ ] 在不同瀏覽器/設備登入
- [ ] 確認主題設置同步

## 資料庫結構更新

### USER_PROFILE 實體

```javascript
{
  PK: "USER#<userId>",
  SK: "PROFILE",
  entityType: "USER_PROFILE",
  userId: "<userId>",
  email: "user@example.com",
  username: "用戶名",
  bio: "個人簡介",
  avatarUrl: "https://...",
  theme: "dark", // 新增欄位: 'light' | 'dark' | 'system'
  createdAt: "2025-11-18T...",
  updatedAt: "2025-11-18T..."
}
```

## API 變更

### PATCH /auth/me

**請求體新增欄位**:
```json
{
  "theme": "dark" // 可選: 'light' | 'dark' | 'system'
}
```

**回應新增欄位**:
```json
{
  "success": true,
  "user": {
    // ... 其他欄位
    "theme": "dark"
  }
}
```

### GET /auth/me

**回應新增欄位**:
```json
{
  "success": true,
  "user": {
    // ... 其他欄位
    "theme": "dark"
  }
}
```

## 部署注意事項

1. **後端部署**:
   - 需要重新部署 `services/auth` Lambda 函數
   - 無需資料庫遷移，新欄位是可選的

2. **前端部署**:
   - 需要重新構建並部署前端應用
   - 確保環境變數正確設置

3. **向後兼容性**:
   - 所有變更都是向後兼容的
   - 現有用戶的 theme 欄位為 undefined，系統會使用 'system' 作為預設值
   - 現有的封存邏輯保持不變，只是擴展了顯示條件

## 潛在影響

### 正面影響
1. **用戶體驗改善**:
   - 消除主題閃爍
   - 主題設置在不同設備間同步
   - 已完成的任務可以被封存

2. **資料一致性**:
   - 用戶偏好保存在資料庫中
   - 減少對 localStorage 的依賴

### 可能的問題
1. **舊用戶資料**:
   - 現有用戶沒有 theme 設置
   - 解決方案: 使用 'system' 作為預設值

2. **API 呼叫增加**:
   - 每次切換主題都會調用 API
   - 影響: 可忽略（用戶不會頻繁切換主題）

## 回滾計劃

如果出現問題，可以通過以下步驟回滾：

1. **前端回滾**:
   ```bash
   git revert <commit-hash>
   npm run build
   # 重新部署前端
   ```

2. **後端回滾**:
   ```bash
   git revert <commit-hash>
   cd services/auth
   # 重新部署 Lambda 函數
   ```

3. **資料清理**（如果需要）:
   - theme 欄位可以保留，不會影響系統運作
   - 如果需要刪除，可以運行 DynamoDB 更新腳本

## 文件更新

- [x] ARCHITECTURE.md - 更新 USER_PROFILE 結構說明
- [x] BUGFIX_SUMMARY.md - 新增此修復總結文件
- [ ] API 文件 - 更新 /auth/me 端點說明（如果存在）
