#!/bin/bash

# War of SpaceX - 완전 자동 Cloudflare 배포 (GitHub Actions 스타일)

set -e

echo "🚀 War of SpaceX - Cloudflare 자동 배포 시작"
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: 환경 확인
echo -e "${BLUE}[1/5]${NC} 환경 확인 중..."

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git이 설치되지 않았습니다${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm이 설치되지 않았습니다${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 기본 도구 확인됨${NC}"

# Step 2: Wrangler 설치
echo ""
echo -e "${BLUE}[2/5]${NC} Wrangler CLI 설치..."

if ! command -v wrangler &> /dev/null; then
    npm install -g wrangler
    echo -e "${GREEN}✓ wrangler 설치 완료${NC}"
else
    WRANGLER_VERSION=$(wrangler --version 2>/dev/null | cut -d' ' -f1)
    echo -e "${GREEN}✓ wrangler $WRANGLER_VERSION 사용 중${NC}"
fi

# Step 3: Git 저장소 준비
echo ""
echo -e "${BLUE}[3/5]${NC} Git 저장소 준비..."

cd "$(dirname "$0")" || exit 1

# Git 설정
git config user.email "copilot@github.com" || true
git config user.name "Copilot" || true

# 변경사항 커밋
if ! git diff-index --quiet HEAD --; then
    echo "📝 변경사항 커밋 중..."
    git add -A
    git commit -m "🚀 Deploy to Cloudflare Pages - $(date '+%Y-%m-%d %H:%M:%S')" || true
fi

echo -e "${GREEN}✓ Git 준비 완료${NC}"

# Step 4: 배포 정보 출력
echo ""
echo -e "${BLUE}[4/5]${NC} 배포 정보"

echo -e "${YELLOW}════════════════════════════════════════${NC}"
echo -e "${YELLOW}📦 프로젝트: War of SpaceX${NC}"
echo -e "${YELLOW}📍 저장소: matzipcom/War-of-SpaceX${NC}"
echo -e "${YELLOW}🌐 배포 대상: Cloudflare Pages${NC}"
echo -e "${YELLOW}════════════════════════════════════════${NC}"

# Step 5: 배포 지시사항
echo ""
echo -e "${BLUE}[5/5]${NC} 배포 단계"
echo ""
echo -e "${YELLOW}✅ 자동 준비 완료! 다음 단계를 수행하세요:${NC}"
echo ""
echo -e "${GREEN}1️⃣  GitHub 확인${NC}"
echo "   https://github.com/matzipcom/War-of-SpaceX"
echo "   변경사항이 정상 커밋되었는지 확인하세요"
echo ""
echo -e "${GREEN}2️⃣  Cloudflare 계정 로그인${NC}"
echo "   https://dash.cloudflare.com/sign-up"
echo ""
echo -e "${GREEN}3️⃣  Cloudflare Pages 프로젝트 생성${NC}"
echo "   - https://dash.cloudflare.com 로그인"
echo "   - 'Pages' 메뉴 선택"
echo "   - 'Create a project' 클릭"
echo "   - 'Connect to Git' 선택"
echo ""
echo -e "${GREEN}4️⃣  GitHub 연결 및 배포 설정${NC}"
echo "   - GitHub 계정 인증"
echo "   - 'matzipcom/War-of-SpaceX' 저장소 선택"
echo "   - 프로젝트 이름: war-of-spacex"
echo "   - Production branch: main"
echo "   - Build command: (빈칸 - 정적 파일만)"
echo "   - Build output directory: public"
echo "   - 'Save and Deploy' 클릭"
echo ""
echo -e "${GREEN}5️⃣  배포 완료 및 테스트${NC}"
echo "   - 자동으로 배포됨 (1-2분 소요)"
echo "   - 배포 URL: https://war-of-spacex.pages.dev"
echo ""
echo -e "${YELLOW}════════════════════════════════════════${NC}"
echo ""

# 추가 옵션
echo -e "${BLUE}📝 추가 옵션:${NC}"
echo ""
echo "• Cloudflare Workers 백엔드 배포:"
echo "  ${YELLOW}wrangler login && wrangler deploy${NC}"
echo ""
echo "• 로컬에서 테스트:"
echo "  ${YELLOW}wrangler dev${NC}"
echo ""
echo "• 배포 상태 확인:"
echo "  ${YELLOW}wrangler deployments list${NC}"
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}🎮 배포 준비 완료! 이제 Cloudflare에서 진행하세요.${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
