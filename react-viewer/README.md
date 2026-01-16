# 3Dmol.js React Viewer

React + TypeScript 기반의 3D 분자 구조 뷰어입니다. 기존 Vanilla JavaScript 버전을 React로 완전히 변환했습니다.

## 🚀 기능

- **RCSB PDB 데이터베이스에서 직접 로드**: PDB ID로 구조 검색 및 로드
- **다양한 시각화 스타일**: Cartoon, Stick, Sphere, Line, Ribbon
- **색상 구성표**: Spectrum, Chain, Element, Secondary Structure, B-factor
- **잔기 선택 및 하이라이팅**: 클릭, Ctrl+클릭, Shift+클릭으로 선택
- **주변 잔기 표시**: 선택된 잔기로부터 4Å 이내 자동 하이라이트
- **수소결합 및 염다리 시각화**: 선택된 잔기 간 상호작용 표시
- **영역 관리**: 여러 선택 영역 저장 및 관리
- **서열 패널**: 아미노산 서열 표시 및 선택
- **HETATM 시각화**: 리간드, 이온, 보조인자 자동 표시

## 📦 설치

```bash
cd react-viewer
npm install
```

## 🛠️ 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 으로 접속합니다.

## 🏗️ 빌드

```bash
npm run build
```

빌드된 파일은 `dist/` 폴더에 생성됩니다.

## 📂 프로젝트 구조

```
react-viewer/
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── MoleculeViewer.tsx      # 메인 뷰어 컴포넌트
│   │   ├── PDBInput.tsx            # PDB ID 입력
│   │   ├── ViewerControls.tsx      # 뷰어 컨트롤 (스타일, 색상, 줌)
│   │   ├── RegionManager.tsx       # 영역 관리
│   │   └── SequencePanel.tsx       # 서열 패널
│   ├── hooks/               # Custom React Hooks
│   │   ├── use3DMol.ts             # 3Dmol 뷰어 초기화
│   │   ├── useViewerState.ts       # 상태 관리 (useReducer)
│   │   ├── useViewerStyling.ts     # 스타일링 로직
│   │   └── useResidueSelection.ts  # 잔기 선택 로직
│   ├── types/               # TypeScript 타입 정의
│   │   └── index.ts
│   ├── utils/               # 유틸리티 함수
│   │   ├── constants.ts            # 상수 (색상, 아미노산 등)
│   │   ├── api.ts                  # API 호출
│   │   └── pdbParser.ts            # PDB 파싱
│   ├── styles/              # CSS 모듈
│   │   ├── App.css
│   │   ├── MoleculeViewer.module.css
│   │   ├── PDBInput.module.css
│   │   ├── ViewerControls.module.css
│   │   ├── RegionManager.module.css
│   │   └── SequencePanel.module.css
│   ├── App.tsx              # 메인 App 컴포넌트
│   └── main.tsx             # 엔트리 포인트
├── index.html               # HTML 템플릿
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🎯 사용법

### 1. PDB 구조 로드

**RCSB PDB에서 로드:**
- 좌측 패널에 PDB ID 입력 (예: 1CRN)
- "구조 불러오기" 버튼 클릭

**URL 파라미터로 로드:**
```
http://localhost:3000/?pdb=/path/to/structure.pdb
```

### 2. 뷰어 조작

**마우스 조작:**
- 좌클릭 드래그: 회전
- 우클릭 드래그: 이동
- 스크롤: 줌 인/아웃

**컨트롤 버튼:**
- 🏠 홈: 초기 뷰로 리셋
- 🔄 회전: 자동 회전 토글
- ➕ 확대
- ➖ 축소

### 3. 잔기 선택

- **일반 클릭**: 단일 잔기 선택
- **Ctrl+클릭**: 여러 잔기 추가/제거
- **Shift+클릭**: 범위 선택
- **서열 패널**: 아미노산 클릭으로 선택

### 4. 시각화 설정

**A 버튼 (전역 뷰):**
- 스타일: Cartoon, Stick, Sphere, Line, Ribbon
- 색상: Spectrum, Chain, Element, Secondary Structure, B-factor

### 5. 영역 관리

- **➕ 버튼**: 새 영역 생성 (현재 선택을 저장)
- **숫자 버튼**: 저장된 영역 활성화
- 각 영역은 독립적인 선택을 유지

## 🔧 기술 스택

- **React 18**: UI 프레임워크
- **TypeScript**: 타입 안정성
- **Vite**: 빌드 도구
- **3Dmol.js**: 3D 분자 시각화
- **CSS Modules**: 스타일 모듈화

## 🔄 Vanilla JS 버전과의 차이점

### 아키텍처
- **Vanilla JS**: 전역 상태, 이벤트 리스너
- **React**: 컴포넌트 기반, Hooks, useReducer 상태 관리

### 상태 관리
- **Vanilla JS**: `viewerState` 전역 객체
- **React**: `useViewerState` hook with `useReducer`

### 렌더링
- **Vanilla JS**: 직접 DOM 조작
- **React**: 선언적 렌더링, Virtual DOM

### 코드 구조
- **Vanilla JS**: 단일 파일 (viewer.js, 1654 lines)
- **React**: 모듈화된 컴포넌트와 hooks

## 📝 API 서버 연동

백엔드 API 서버와 연동하려면 `src/utils/constants.ts`에서 API URL을 변경하세요:

```typescript
export const API_BASE_URL = 'http://your-server:8082/api';
```

## 🐛 트러블슈팅

### 3Dmol.js 로드 오류
- 브라우저 콘솔에서 3Dmol CDN 연결 확인
- `index.html`의 스크립트 태그 확인

### 스타일이 적용되지 않음
- CSS 모듈 import 경로 확인
- Vite 개발 서버 재시작

### TypeScript 오류
- `npm run build`로 타입 체크
- `tsconfig.json` 설정 확인

## 📄 라이선스

이 프로젝트는 원본 Vanilla JS 버전에서 React로 변환되었습니다.

## 🤝 기여

버그 리포트와 기능 제안은 Issues에 등록해주세요.

## 🔗 참고 링크

- [3Dmol.js Documentation](https://3dmol.csb.pitt.edu/)
- [RCSB PDB](https://www.rcsb.org/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
