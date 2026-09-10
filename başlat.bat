@echo off
chcp 65001 >nul
title TTCoinPP - Sunucu
color 0A

echo ========================================
echo   TTCoinPP - Sunucu Başlatılıyor
echo ========================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [1/2] Bağımlılıklar yükleniyor (npm install)...
    call npm install
    if errorlevel 1 (
        echo.
        echo HATA: Bağımlılıklar yüklenemedi!
        pause
        exit /b 1
    )
    echo.
    echo [OK] Bağımlılıklar başarıyla yüklendi.
    echo.
) else (
    echo [1/2] Bağımlılıklar zaten yüklü, atlanıyor.
    echo.
)

echo [2/2] Sunucu başlatılıyor...
echo.
echo ----------------------------------------
echo   Sunucu: http://localhost:3001
echo   Profil API: http://localhost:3001/api/profile?username=tiktok
echo   Durum: http://localhost:3001/health
echo ----------------------------------------
echo.
echo Sunucuyu durdurmak için Ctrl+C tuşlarına basın.
echo.

call npm start
pause
