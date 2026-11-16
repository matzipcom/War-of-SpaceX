# 🚀 Cloudflare 배포 가이드

War of SpaceX를 Cloudflare에 배포하는 방법입니다.

## 📋 필수 사항

1. **Cloudflare 계정** (무료 계정 가능)
   - https://dash.cloudflare.com/sign-up

2. **GitHub 계정**
   - 코드를 저장할 리포지토리

3. **wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

---

## 🎯 배포 전략

### 옵션 1: Cloudflare Pages (추천)
- **프론트엔드**: Cloudflare Pages (정적 호스팅)
- **백엔드**: Railway/Render (Node.js 서버)

### 옵션 2: 풀스택 Cloudflare Workers
- **프론트엔드 + 백엔드**: 모두 Cloudflare Workers

---

## 🔧 Step 1: GitHub에 푸시

```bash
cd /workspaces/War-of-SpaceX

git config user.email "your-email@example.com"
git config user.name "Your Name"

git add .
git commit -m "Prepare for Cloudflare deployment"
git push origin main
```

---

## 📦 Option 1: Cloudflare Pages 배포 (추천)

### 1.1 GitHub 계정 연결

1. https://dash.cloudflare.com 로그인
2. **Pages** 섹션 선택
3. **Create a project** → **Connect to Git**
4. GitHub 계정 인증
5. `matzipcom/War-of-SpaceX` 리포지토리 선택

### 1.2 배포 설정

- **Project name**: `war-of-spacex`
- **Production branch**: `main`
- **Build command**: (비워두기)
- **Build output directory**: `public`
- **Environment variables**: (필요 없음)

→ **Deploy site** 클릭

### 1.3 배포 확인

- Cloudflare Pages URL: `https://war-of-spacex.pages.dev`
- 몇 초 후 자동 배포됨

---

## 🖥️ Option 2: Node.js 백엔드 배포 (Railway)

### 2.1 Railway에 백엔드 배포

```bash
npm i -g railway

# Railway 로그인
railway login

# 프로젝트 초기화
railway init

# 배포
railway up
```

### 2.2 프론트엔드 환경 설정

`public/js/network.js`에서 서버 주소 수정:

```javascript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = 'your-railway-app.up.railway.app'; // Railway URL
const wsUrl = `${protocol}//${host}`;
```

---

## 🌐 Option 3: Cloudflare Workers (고급)

### 3.1 로그인

```bash
wrangler login
```

### 3.2 배포

```bash
cd /workspaces/War-of-SpaceX

# 개발 환경에서 테스트
wrangler dev

# 프로덕션에 배포
wrangler deploy
```

### 3.3 URL 확인

```bash
wrangler deployments list
```

---

## ✅ 배포 후 확인

1. 브라우저에서 배포된 URL 접속
2. 시작 화면에서 온라인 플레이어 카운터 표시 확인
3. 두 개 탭/브라우저에서 다른 팀 선택 후 멀티플레이 테스트

---

## 🔗 유용한 링크

- **Cloudflare Pages 대시보드**: https://dash.cloudflare.com/pages
- **Cloudflare Workers 대시보드**: https://dash.cloudflare.com/workers
- **Railway 대시보드**: https://railway.app/dashboard
- **Render 대시보드**: https://dashboard.render.com

---

## 📝 배포 후 커스텀 도메인 설정

1. Cloudflare 계정에서 도메인 추가
2. Pages 프로젝트 설정에서 **Custom domains**
3. 도메인 입력 후 연결

---

## 🚨 문제 해결

### WebSocket 연결 실패
- 백엔드 서버 URL 확인
- CORS 설정 확인
- 방화벽/보안 그룹 설정 확인

### 플레이어 카운터 표시 안 됨
- 서버 상태 확인
- 네트워크 탭에서 WebSocket 메시지 확인
- 브라우저 콘솔에서 오류 확인

### 정적 파일 로드 실패
- `public/` 디렉토리 확인
- Pages 설정에서 `public`이 build output directory인지 확인

---

## 💡 추천 사항

1. **최초 배포**: Cloudflare Pages (정적) + Railway (백엔드)
2. **고급 배포**: 모든 것을 Cloudflare Workers로 (복잡하지만 강력)
3. **개발**: `wrangler dev`로 로컬 테스트 후 배포

---

**배포 완료! 🎮 온라인에서 여러 친구들과 멀티플레이를 즐기세요!**
