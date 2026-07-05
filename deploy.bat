@echo off
echo ============================================
echo   NowCart Deploy Script
echo ============================================
echo.

:: Step 1: Build frontend
echo [1/4] Building frontend...
cd /d "e:\Secondary download\NowCart\client"
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)
echo       Frontend built successfully.
echo.

:: Step 2: Upload to S3
echo [2/4] Uploading to S3...
aws s3 sync dist s3://nowcart-frontend-strizzy --delete
if %errorlevel% neq 0 (
    echo ERROR: S3 upload failed!
    pause
    exit /b 1
)
echo       S3 upload complete.
echo.

:: Step 3: Invalidate CloudFront
echo [3/4] Invalidating CloudFront cache...
aws cloudfront create-invalidation --distribution-id E12DWQGXBDIMR3 --paths "/*"
if %errorlevel% neq 0 (
    echo       WARNING: CloudFront invalidation failed.
    echo       Run manually: aws cloudfront create-invalidation --distribution-id E12DWQGXBDIMR3 --paths "/*"
) else (
    echo       CloudFront invalidation started - takes 1-2 min to propagate.
)
echo.

:: Step 4: Reminder for backend
echo [4/4] BACKEND: SSH into EC2 and run:
echo.
echo       cd /opt/nowcart ^&^& git pull origin master ^&^& sudo systemctl restart nowcart
echo.
echo ============================================
echo   Frontend deployed! Backend needs SSH step.
echo ============================================
pause
