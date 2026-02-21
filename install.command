#!/bin/bash

# 현재 스크립트가 있는 경로로 이동
cd "$(dirname "$0")"

echo "======================================================"
echo "🚀 Mac용 쿠팡 리뷰 크롤러 설치 스크립트"
echo "======================================================"

# Homebrew 설치 확인 및 설치
if ! command -v brew &> /dev/null; then
    echo "📦 Homebrew가 설치되어 있지 않습니다. 설치를 진행합니다..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Apple Silicon (M1/M2)의 경우 PATH 경로 자동 추가
    if [[ $(uname -m) == 'arm64' ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
else
    echo "✅ Homebrew가 이미 설치되어 있습니다."
fi

# Node.js 설치 확인 및 설치
if ! command -v node &> /dev/null; then
    echo "📦 Node.js를 설치합니다..."
    brew install node
else
    echo "✅ Node.js가 이미 설치되어 있습니다. (버전: $(node -v))"
fi

# Google Chrome 설치 확인 및 설치
if [ -d "/Applications/Google Chrome.app" ]; then
    echo "✅ Google Chrome이 이미 설치되어 있습니다."
else
    echo "📦 Google Chrome을 설치합니다..."
    brew install --cask google-chrome
fi

# 프로젝트 패키지 설치
echo "📦 프로젝트 패키지를 설치합니다 (npm install)..."
npm install

echo "📦 Playwright 내부 브라우저를 설치합니다..."
npx playwright install chromium

echo "======================================================"
echo "✅ 모든 설치가 완료되었습니다!"
echo "이제 'run.command' (또는 'Crawl.command')를 실행하세요."
echo "======================================================"
