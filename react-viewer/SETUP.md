# React Viewer 설치 및 실행 가이드

## 📋 사전 요구사항

- Node.js 16 이상
- npm 또는 yarn

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
cd /home/connects_md/MODEL/3dmol/react-viewer
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

개발 서버가 http://localhost:3000 에서 시작됩니다.

### 3. 프로덕션 빌드

```bash
npm run build
npm run preview  # 빌드 결과 미리보기
```

## 📦 설치되는 패키지

### 핵심 의존성
- `react ^18.2.0` - UI 라이브러리
- `react-dom ^18.2.0` - React DOM 렌더링

### 개발 의존성
- `vite ^5.0.0` - 빌드 도구
- `typescript ^5.0.2` - TypeScript 컴파일러
- `@vitejs/plugin-react ^4.2.0` - Vite React 플러그인
- `@types/react ^18.2.0` - React 타입 정의
- `@types/react-dom ^18.2.0` - React DOM 타입 정의
- `eslint` - 코드 린팅

### 외부 라이브러리 (CDN)
- `3Dmol.js` - 3D 분자 시각화 (index.html에서 로드)
- `Font Awesome` - 아이콘
- `Google Fonts (Inter)` - 폰트

## 🔧 프로젝트 구조

```
react-viewer/
├── src/
│   ├── components/          # React 컴포넌트
│   ├── hooks/               # Custom Hooks
│   ├── types/               # TypeScript 타입
│   ├── utils/               # 유틸리티 함수
│   ├── styles/              # CSS 모듈
│   ├── App.tsx              # 메인 App
│   └── main.tsx             # 엔트리 포인트
├── public/                  # 정적 자산
├── index.html               # HTML 템플릿
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🎨 주요 기능

### 1. 컴포넌트 구조
- **MoleculeViewer**: 메인 뷰어 컨테이너
- **PDBInput**: PDB ID 입력 인터페이스
- **ViewerControls**: 스타일, 색상, 줌 컨트롤
- **RegionManager**: 선택 영역 관리
- **SequencePanel**: 아미노산 서열 표시

### 2. Custom Hooks
- **use3DMol**: 3Dmol 뷰어 초기화 및 관리
- **useViewerState**: 전역 상태 관리 (useReducer)
- **useViewerStyling**: 시각화 스타일 적용
- **useResidueSelection**: 잔기 선택 로직

### 3. 타입 안정성
- 모든 컴포넌트와 함수에 TypeScript 타입 정의
- 3Dmol.js 타입은 `any`로 처리 (공식 타입 정의 미제공)

## ⚙️ 설정 커스터마이징

### API 서버 URL 변경
`src/utils/constants.ts`:
```typescript
export const API_BASE_URL = 'http://localhost:8082/api';
```

### 포트 번호 변경
`vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    port: 3000  // 원하는 포트로 변경
  }
})
```

### 색상 팔레트 변경
`src/utils/constants.ts`:
```typescript
export const cmykColors: CMYKColors = {
  spectrum: ['#ca4a4a', ...],  // 원하는 색상으로 변경
  // ...
}
```

## 🐛 문제 해결

### 설치 오류
```bash
# 캐시 정리
rm -rf node_modules package-lock.json
npm install
```

### TypeScript 오류
```bash
# 타입 체크
npm run build

# tsconfig.json 확인
```

### 3Dmol.js 로드 실패
- 인터넷 연결 확인 (CDN에서 로드)
- 브라우저 콘솔에서 네트워크 오류 확인

### 개발 서버가 시작되지 않음
```bash
# 포트 3000이 사용 중인지 확인
lsof -i :3000

# 다른 포트 사용
npm run dev -- --port 3001
```

## 📝 개발 팁

### Hot Module Replacement (HMR)
Vite는 자동으로 HMR을 지원합니다. 코드 변경 시 브라우저가 자동으로 업데이트됩니다.

### TypeScript 자동 완성
VSCode나 다른 IDE에서 TypeScript IntelliSense가 작동합니다.

### CSS 모듈
각 컴포넌트는 독립적인 CSS 모듈을 가지며, 클래스 이름 충돌이 자동으로 방지됩니다.

### 디버깅
- React DevTools 확장 프로그램 사용 권장
- `console.log`는 개발 모드에서만 출력됩니다

## 🚀 배포

### 정적 호스팅
```bash
npm run build
# dist/ 폴더를 정적 호스팅 서비스에 업로드
# (Netlify, Vercel, GitHub Pages 등)
```

### 환경 변수
`.env` 파일 생성:
```
VITE_API_BASE_URL=https://your-api.com/api
```

코드에서 사용:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082/api';
```

## 📚 추가 자료

- [Vite 가이드](https://vitejs.dev/guide/)
- [React 공식 문서](https://react.dev/)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
- [3Dmol.js 문서](https://3dmol.csb.pitt.edu/)

## ✅ 체크리스트

설치 후 확인:
- [ ] `npm install` 성공
- [ ] `npm run dev` 실행됨
- [ ] 브라우저에서 http://localhost:3000 접속 가능
- [ ] PDB ID 입력 및 구조 로드 테스트
- [ ] 뷰어 조작 (회전, 줌, 선택) 작동
- [ ] 서열 패널 표시
- [ ] 영역 추가 및 전환 작동

문제가 있으면 README.md의 트러블슈팅 섹션을 참고하세요!
