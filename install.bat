@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ======================================================
echo 🚀 Windows용 쿠팡 리뷰 크롤러 설치 스크립트
echo ======================================================

:: 1. Winget(Windows 패키지 관리자) 명령줄 도구 확인
where winget >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ [오류] winget(Windows 패키지 관리자)을 찾을 수 없습니다.
    echo Windows 10(버전 1809 이상) 또는 Windows 11 최신 업데이트가 필요합니다.
    echo 혹은 수동으로 Node.js를 설치해주세요: https://nodejs.org/
    pause
    exit /b
)

:: 2. Node.js 설치 확인 및 설치
node -v >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ Node.js가 이미 설치되어 있습니다.
    node -v
) else (
    echo 📦 Node.js(LTS)를 설치합니다...
    winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
    
    echo 🔄 환경 변수 적용을 위해 PATH를 수동으로 새로고침합니다...
    set "PATH=%PATH%;C:\Program Files\nodejs\"
)

:: 3. Google Chrome 설치 확인 및 설치
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo ✅ Google Chrome이 이미 설치되어 있습니다.
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    echo ✅ Google Chrome이 이미 설치되어 있습니다.
) else (
    echo 📦 Google Chrome을 설치합니다...
    winget install Google.Chrome --silent --accept-source-agreements --accept-package-agreements
)

:: 4. 프로젝트 패키지 설치
echo 📦 프로젝트 패키지를 설치합니다 (npm install)...
call npm install

echo 📦 Playwright 내부 브라우저를 설치합니다...
call npx playwright install chromium

echo ======================================================
echo ✅ 모든 설치가 완료되었습니다!
echo 이제 'run.bat' (또는 'Crawl.bat')를 실행하세요.
echo ======================================================

pause
