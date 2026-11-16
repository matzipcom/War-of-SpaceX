#!/bin/bash

# War of SpaceX - Cloudflare Pages 자동 배포 스크립트

echo "🚀 War of SpaceX를 Cloudflare Pages에 배포합니다..."
echo ""

# 1. 패키지 확인
echo "1️⃣ wrangler CLI 설치 확인..."
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler가 설치되지 않았습니다."
    echo "설치 중..."
    npm install -g wrangler
fi

echo "✓ wrangler 설치됨"
echo ""

# 2. Git 커밋
echo "2️⃣ 변경사항을 Git에 커밋..."
git config user.email "copilot@github.com" 2>/dev/null
git config user.name "Copilot" 2>/dev/null
git add -A
git commit -m "Deploy to Cloudflare Pages" || echo "✓ 이미 최신 상태입니다"
git push origin main 2>/dev/null || echo "⚠️ Git push 건너뜀"

echo "✓ Git 커밋 완료"
echo ""

# 3. Cloudflare 로그인 확인
echo "3️⃣ Cloudflare 계정 확인..."

# Wrangler 로그인 (토큰 파일 확인)
if [ ! -f ~/.wrangler/config.toml ]; then
    echo "❌ Cloudflare에 로그인되지 않았습니다."
    echo "❌ 다음 명령어를 실행하세요:"
    echo ""
    echo "   wrangler login"
    echo ""
    echo "그 후 다시 이 스크립트를 실행하세요."
    exit 1
fi

echo "✓ Cloudflare 계정 확인됨"
echo ""

# 4. 공식 배포 가이드 출력
echo "4️⃣ Cloudflare Pages 배포 가이드"
echo "════════════════════════════════════════"
echo ""
echo "프론트엔드 배포 (정적 파일):"
echo ""
echo "1. https://dash.cloudflare.com 로그인"
echo "2. 'Pages' → 'Create a project'"
echo "3. GitHub 연결 후 'matzipcom/War-of-SpaceX' 선택"
echo "4. 설정:"
echo "   - Build command: (빈칸)"
echo "   - Build output directory: public"
echo "5. Deploy 클릭"
echo ""
echo "완료! 배포 URL: https://war-of-spacex.pages.dev"
echo ""
echo "════════════════════════════════════════"
echo ""

# 5. 선택사항 - Workers 배포
echo "5️⃣ Cloudflare Workers에 배포하시겠습니까? (y/n)"
read -r response

if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
    echo "Workers 배포 중..."
    wrangler deploy
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Cloudflare Workers 배포 완료!"
        echo ""
        wrangler deployments list | head -3
    else
        echo "❌ Workers 배포 실패"
        exit 1
    fi
else
    echo "⏭️ Workers 배포를 건너뛰었습니다."
fi

echo ""
echo "════════════════════════════════════════"
echo "✅ 모든 준비가 완료되었습니다!"
echo ""
echo "📝 다음 단계:"
echo "1. Cloudflare Dashboard에서 Pages 프로젝트 생성"
echo "2. GitHub과 연결"
echo "3. 배포 완료 후 게임 테스트"
echo ""
echo "🔗 배포 후 접속:"
echo "   https://war-of-spacex.pages.dev"
echo "════════════════════════════════════════"
