# Test Uploads API endpoint
# Usage: .\test-upload-api.ps1

$API_URL = "https://994mxyt7tl.execute-api.ap-northeast-1.amazonaws.com/prod"
$endpoint = "$API_URL/uploads/presign"

Write-Host "Testing Uploads API endpoint..." -ForegroundColor Cyan
Write-Host "Endpoint: $endpoint" -ForegroundColor Yellow

# Test without authentication (should return 401)
Write-Host "`nTest 1: Request without authentication" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri $endpoint -Method POST -ContentType "application/json" -Body '{"fileName":"test.jpg","contentType":"image/jpeg","fileSize":1024}' -ErrorAction Stop
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.Value__)" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nNote: You need a valid JWT token to test authenticated requests." -ForegroundColor Yellow
Write-Host "Check your browser console for the token after logging in." -ForegroundColor Yellow
