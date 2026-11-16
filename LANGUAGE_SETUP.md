# 🌐 War of SpaceX - Multi-Language Setup

## 기능 설명 (Features)

### English (기본값)
- 게임 시작 시 자동으로 **English**로 설정됨
- localStorage에 사용자 선택 언어 저장

### 지원 언어 (Supported Languages)
- 🇺🇸 **English** (기본값)
- 🇰🇷 **한국어** (Korean)
- 🇯🇵 **日本語** (Japanese)
- 🇨🇳 **中文** (Chinese)

## 사용 방법 (How to Use)

### 1. 게임 시작
게임을 시작하면 **English**로 기본 설정됨

### 2. 언어 변경
1. 게임 시작 화면에서 **"⚙️ Settings"** 버튼 클릭
2. **Language** 드롭다운에서 원하는 언어 선택
3. **APPLY** 버튼 클릭
4. 게임이 선택한 언어로 변경됨

### 3. 설정 저장
- 선택한 언어는 **localStorage**에 저장됨
- 다음 방문 시 마지막 선택 언어로 자동 설정됨

## 기술 상세 (Technical Details)

### 번역 시스템
```javascript
// 1. TRANSLATIONS 객체: 모든 번역 텍스트 저장
const TRANSLATIONS = {
    en: { 'title': 'WAR OF SPACEX', ... },
    ko: { 'title': 'WAR OF SPACEX', ... },
    ja: { 'title': 'WAR OF SPACEX', ... },
    zh: { 'title': 'WAR OF SPACEX', ... }
}

// 2. t() 함수: 번역 텍스트 조회
function t(key, lang = null)
```

### HTML 마크업
```html
<!-- data-i18n 속성으로 번역 가능하도록 마킹 -->
<h1 data-i18n="title">WAR OF SPACEX</h1>
```

### 초기화 순서
1. `constructor()`: currentLanguage 설정 (localStorage 또는 기본값 'en')
2. `initLanguage()`: HTML lang 속성 설정
3. `updateUILanguage()`: 모든 UI 텍스트 번역

### 언어 변경 과정
1. Settings 모달에서 언어 선택
2. `setLanguage()` 함수 호출
3. localStorage에 저장
4. `updateUILanguage()` 호출하여 전체 UI 업데이트

## 지원되는 텍스트 요소

### 시작 화면 (Start Screen)
- 타이틀, 부제목
- 콜사인 라벨, 온라인 상태
- 설정 버튼
- 진영 카드 (수비팀/공격팀)
- 온라인 안내문

### 설정 화면 (Settings)
- 제목, 부제목
- 볼륨 라벨 (마스터, BGM, SFX)
- 언어 선택 드롭다운
- 조작 설정 가이드
- 적용 버튼

### 게임 중 메시지
- 상태 메시지 (Settings applied)
- 언어 변경 알림

## 향후 확장 (Future Enhancements)

- [ ] 추가 언어 지원 (예: 스페인어, 프랑스어)
- [ ] 게임 중 언어 변경 (현재는 설정 화면에서만 가능)
- [ ] 더 많은 UI 요소 번역
- [ ] 번역 파일 분리 (i18n.json 파일로 관리)
