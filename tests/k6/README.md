# K6 壓力測試說明

## 安裝 k6

### Windows
```powershell
# 使用 Chocolatey
choco install k6

# 或下載 MSI 安裝器
# https://github.com/grafana/k6/releases/latest
```

### 執行測試

```bash
cd tests/k6

# 基本測試（不需認證）
k6 run items_get.js

# 完整測試（需要 Cognito Token）
k6 run -e AUTH_TOKEN="your-jwt-token" items_get.js

# 自訂場景
k6 run --vus 10 --duration 30s items_get.js
```

## 測試場景

當前測試配置：
- Warm up: 10s (5 users)
- Steady load: 30s (10 users)
- Peak load: 30s (20 users)
- Cool down: 10s (0 users)

總時長: ~80s

## 效能目標

- **P95 latency**: < 200ms ✅
- **Error rate**: < 5% ✅  
- **Requests/second**: > 50 ✅

## 輸出

測試結果會輸出到:
1. Console (彩色摘要)
2. `load-test-results.json` (完整數據)

## 替代方案

如果無法安裝 k6，可以使用：

### Artillery (Node.js)
```bash
npm install -g artillery
artillery quick --count 10 --num 100 https://your-api.com/items
```

### Apache Bench
```bash
ab -n 1000 -c 10 https://your-api.com/health
```

### 瀏覽器手動測試
使用 DevTools Network tab 觀察回應時間
