# 🚀 War of SpaceX - Cloudflare 배포 완전 가이드

## 📋 빠른 시작

```bash
bash auto-deploy.sh
```

이 명령어가 배포 준비를 완료합니다!

---

## 🎯 배포 방법 선택

### 방법 1: Cloudflare Pages (추천) ⭐⭐⭐
**가장 간단한 방법 - 정적 파일 호스팅**

- 장점: 무료, 자동 배포, CDN 포함
- 시간: 5분 이내
- URL: `https://war-of-spacex.pages.dev`

### 방법 2: Cloudflare Workers (고급) ⭐⭐
**프론트엔드 + 백엔드 모두 Cloudflare에서 실행**

- 장점: 한 곳에서 관리, Durable Objects 사용
- 시간: 10분
- URL: `https://war-of-spacex.workers.dev`

### 방법 3: 하이브리드 배포 (최적) ⭐⭐⭐
**프론트엔드: Cloudflare Pages + 백엔드: Railway/Render**

- 장점: 최적 성능, 확장성 좋음
- 시간: 15분
- 비용: 무료 (Railway 무료 크레딧)

---

## 🔧 Step-by-Step: Cloudflare Pages 배포

### 1단계: GitHub 준비

```bash
# 현재 위치: /workspaces/War-of-SpaceX

# 변경사항 커밋
git add -A
git commit -m "Prepare for Cloudflare Pages deployment"
git push origin main
```

**확인**: https://github.com/matzipcom/War-of-SpaceX 에서 커밋 확인

### 2단계: Cloudflare 계정 생성/로그인

1. https://dash.cloudflare.com 방문
2. 계정 생성 또는 로그인

### 3단계: Cloudflare Pages 프로젝트 생성

1. 좌측 메뉴에서 **Pages** 클릭
2. **Create a project** 버튼 클릭
3. **Connect to Git** 선택

### 4단계: GitHub 연결

1. **GitHub** 선택
2. "Install & Authorize" 클릭
3. GitHub 계정으로 로그인
4. War-of-SpaceX 저장소 선택

### 5단계: 배포 설정

| 항목 | 설정값 |
|------|--------|
| Project name | `war-of-spacex` |
| Production branch | `main` |
| Build command | **(빈칸)** |
| Build output directory | `public` |
| Environment variables | (필요 없음) |

**중요**: Build output directory는 반드시 `public`으로 설정!

### 6단계: 배포!

1. **Save and Deploy** 클릭
2. 자동 배포 시작 (1-2분 소요)
3. 배포 완료 후 URL 받음

---

## ✅ 배포 확인

배포 후 다음 URL로 접속하여 게임이 정상 작동하는지 확인하세요:

### 프론트엔드 확인
```
https://war-of-spacex.pages.dev
```

체크리스트:
- [ ] 게임 시작 화면 표시됨
- [ ] 온라인 플레이어 카운터 표시됨 (0 또는 숫자)
- [ ] 언어 설정 (Settings)에서 English 기본값
- [ ] 팀 선택 버튼 작동

### 멀티플레이 테스트 (선택사항)
1. 배포된 URL을 2개 브라우저 탭/창에서 열기
2. 각각 다른 팀(DEFENSE/ATTACK) 선택
3. 게임 시작 후 원격 플레이어 표시 확인

---

## 🖥️ 추가: 백엔드 배포 (선택사항)

### Railway에 Node.js 백엔드 배포

#### 1. Railway 계정 생성
```bash
npm install -g railway
railway login
```

#### 2. 백엔드 배포
```bash
cd /workspaces/War-of-SpaceX
railway init
railway up
```

#### 3. 환경 변수 설정
```
PORT=8080
NODE_ENV=production
```

#### 4. 프론트엔드 업데이트
`public/js/network.js` 수정:

```javascript
// 약 18-24줄 근처
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = 'your-railway-url.up.railway.app'; // Railway URL로 변경
const wsUrl = `${protocol}//${host}`;
```

---

## 🎮 게임 플레이

### 싱글플레이
1. https://war-of-spacex.pages.dev 접속
2. 팀 선택 (DEFENSE 또는 ATTACK)
3. 게임 시작

### 멀티플레이 (백엔드 필요)
1. 두 개 이상의 브라우저에서 접속
2. 각각 다른 팀 선택
3. 실시간 3D 멀티플레이 시작!

---

## 🔗 배포된 리소스

### 프론트엔드
- **URL**: https://war-of-spacex.pages.dev
- **제공자**: Cloudflare Pages
- **상태**: 자동 배포

### 백엔드 (선택사항)
- **제공자**: Railway / Render / Heroku
- **방식**: Node.js WebSocket 서버
- **포트**: 8080

---

## 📊 배포 아키텍처

```
┌─────────────────────────────────────┐
│      사용자의 웹 브라우저             │
└────────────────┬────────────────────┘
                 │
                 │ HTTP/HTTPS
                 ▼
┌─────────────────────────────────────┐
│   Cloudflare Pages (프론트엔드)      │
│   - index.html                      │
│   - js/ (game.js, network.js 등)   │
│   - css/                            │
│                                     │
│   URL: war-of-spacex.pages.dev     │
└──────────────┬──────────────────────┘
               │
               │ WebSocket (ws://)
               ▼
┌─────────────────────────────────────┐
│   Backend Server (선택사항)          │
│   - Node.js + Express              │
│   - WebSocket 게임 서버             │
│   - 플레이어 상태 관리              │
│                                     │
│   제공자: Railway / Render          │
└─────────────────────────────────────┘
```

---

## 🚨 문제 해결

### 1. 배포 페이지가 비어있음
**원인**: Build output directory 설정 오류
**해결**:
1. Cloudflare Pages 설정 확인
2. "Build settings" → "Build output directory" = `public`
3. 재배포

### 2. 게임이 로드되지만 멀티플레이가 안 됨
**원인**: 백엔드 서버 미배포
**해결**:
- 싱글플레이만 가능
- 멀티플레이가 필요하면 Railway 백엔드 배포

### 3. 정적 파일(CSS, JS) 로드 실패
**원인**: 경로 오류
**해결**:
- `public/` 디렉토리 확인
- 상대 경로 확인 (`/css/style.css`, `/js/game.js`)

### 4. 콘솔에 오류 메시지 표시됨
**확인 방법**:
1. F12 (개발자 도구) 열기
2. Console 탭에서 오류 확인
3. Network 탭에서 요청 상태 확인

---

## 📚 참고 문서

- **Cloudflare Pages**: https://pages.cloudflare.com
- **Cloudflare Workers**: https://workers.cloudflare.com
- **Railway**: https://railway.app
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler

---

## 🎯 배포 후 커스텀 도메인 (선택사항)

1. **도메인 구입** (GoDaddy, Namecheap 등)
2. **Cloudflare에 추가**
   - https://dash.cloudflare.com 로그인
   - Websites → Add a site
   - 도메인 입력
3. **Pages 프로젝트에 연결**
   - Pages 프로젝트 설정
   - Custom domains → Add a custom domain
   - 도메인 입력
4. **DNS 설정 완료**

---

## 💡 팁

1. **첫 배포**: 프론트엔드만 배포 후 테스트
2. **멀티플레이**: 이후 백엔드 배포 (Railway 권장)
3. **도메인**: 프리미엄 기능 (선택사항)
4. **모니터링**: Cloudflare Analytics로 트래픽 확인 가능

---

## ✨ 완료!

**축하합니다! 🎉 War of SpaceX가 인터넷에 배포되었습니다!**

친구들과 공유하고 멀티플레이를 즐기세요! 🚀🎮

---

**배포 문제가 있으신가요?**
- GitHub Issues: https://github.com/matzipcom/War-of-SpaceX/issues
- Cloudflare 지원: https://support.cloudflare.com
