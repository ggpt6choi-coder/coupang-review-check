@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ======================================================
echo 🚀 쿠팡 리뷰 크롤러 원클릭 실행기 시작 (Windows)
echo ======================================================

:: 1. 브라우저 실행 (9222 포트 확인)
echo [1/3] 🌐 브라우저 상태를 확인하는 중...
netstat -ano | find "9222" > nul
if %errorlevel% equ 0 (
    echo [1/3] ✅ 브라우저가 이미 실행 중입니다.
) else (
    echo [1/3] 🌐 디버그 브라우저를 시작합니다...
    
    :: 크롬 설치 경로 찾기
    set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not exist "%CHROME_PATH%" (
        set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    )
    
    start "" "%CHROME_PATH%" --remote-debugging-port=9222 --user-data-dir="C:\chrome_dev_test"
    timeout /t 3 /nobreak > nul
)

:: 2. 크롤러 서버 실행
echo [2/3] ⚙️ 서버를 구동합니다...
:: 3000번 포트를 사용하는 기존 프로세스(Node.js) 종료
for /f "tokens=5" %%a in ('netstat -ano ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a > nul 2>&1
)

:: Node.js 서버를 백그라운드로 실행
start /b node unified_crawler.js > nul 2>&1
timeout /t 2 /nobreak > nul

:: 3. 대시보드 열기
echo [3/3] 🎨 관리 화면을 엽니다...
start http://localhost:3000

echo ======================================================
echo ✅ 실행 완료! 브라우저의 대시보드 화면을 확인하세요.
echo 명령 프롬프트 창을 닫아도 서버는 백그라운드에서 계속 실행됩니다.
echo ======================================================

:: 3초 뒤 창 자동 닫기 (출력을 보기 원한다면 pause로 변경)
timeout /t 3 > nul
