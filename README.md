# Mahjong Sensei (雀魂先生)

> 작혼(Mahjong Soul) 대국 패보 데이터를 분석하여 최근 10·30·50판 단위로 **운(Luck)**과 **실력(Skill)**을 객관적으로 분리하고 정밀한 AI 진단을 제공하는 마작 분석 플랫폼

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.0-red.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.4-gradient.svg)](https://turbo.build/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 프로젝트 개요 (Overview)

기존 마작 전적 사이트(Amae-Koromo 등)는 누적 화료율, 방총율, 평균 순위 등 **최종 결과 수치**는 훌륭하게 제공하지만, **"그 대국에서 내 손패와 쯔모가 얼마나 좋았는가(Luck)"**와 **"내가 내린 타패와 수비 선택이 얼마나 최적이었는가(Skill)"**를 명확하게 분리해주지 못합니다.

**Mahjong Sensei**는 순수한 운의 영역(시작 샹텐수, 유효패 쯔모율, 우라도라 편중 등)과 실력의 영역(패효율, Kawa 버림패 기반 방어 정밀도, 상황 판단)을 엄격하게 분리하여, 억울한 패배(억까)와 실력 난조(슬럼프)를 과학적으로 증명하고 개인 맞춤형 AI 코칭과 멘탈 진단을 제공합니다.

---

## ✨ 핵심 기능 (Key Features)

### 1. 🎲 운(Luck) vs 실력(Skill) 정밀 분리 엔진
- **종합 운 지수 (Luck Score, 0~100)**:
  - 배패 시작 샹텐수(기수향청) 및 시작 도라 개수 가중치
  - 유효패 쯔모율 (Draw Efficiency Ratio)
  - 리치 후 일발/우라도라 발생 편중률
- **종합 실력 지수 (Skill Score, 0~100)**:
  - 타패 순목별 패효율 (Tile Acceptance Ratio)
  - **Kawa(버림패 바닥) 기반 수비 평가 엔진**: 상대 리치 선언 시 현물(現物, Genbutsu), 스지(Suji: 1-4-7, 2-5-8, 3-6-9), 카베(Kabe: No-Chance / One-Chance), 아와세우치(合せ打ち)를 추적하여 실제 위험패 방총 회피 정확도 평가
- **4사분면 퍼포먼스 매트릭스**:
  - `실력 대승 (Skillful Win)`: 높은 실력 + 호조의 운 (1사분면)
  - `억까 피해 (Unlucky Loss)`: 높은 실력 + 극심한 불운 (2사분면)
  - `실력 난조 (Slump Loss)`: 판단 미숙 + 불운 (3사분면)
  - `운빨 승리 (Lucky Fluke)`: 판단 미숙 + 행운의 승리 (4사분면)

### 2. 🤖 8변수 복합 정밀 AI 대국 평가기 (`AiRankEvaluator`)
- 대국별 종합 랭크 (`S+`, `S`, `A`, `B`, `C`, `D`) 및 AI 추천 타패 적합도 (Match Rate %) 산출
- **3대 세부 평가 축**:
  - **공격 (Attack)**: 화료 횟수, 유효 샹텐 전진도, 공격 타점
  - **수비 (Defense)**: 방총 횟수, 상대 텐파이 시 안전패 회피 정확도
  - **국면 상황 (Situation)**: 점수차, 오야(친) 여부, 순위 방어 및 리스크 관리
- **도메인 특화 보정**:
  - 동풍전(4국) vs 반장전(8국) 라운드 분모 정규화로 단일 라운드 점수 극단화 방지
  - 3인 마작(Sanma) 최하위(3위) 라스 감점 및 만수패(1m ↔ 9m) 도라 순환 룰 완벽 반영
  - 카타스지(0.55), 나카스지(0.16), 무스지(1.00) 위험도 정밀 가중치

### 3. 🛡️ 플레이어 스타일 및 멘탈 진단 엔진 (`StyleEvaluator`)
- 최근 대국의 다마텐율, 후로율, 리치율, 선제율, 방총율, 들통(피토비)율을 종합 분석하여 플레이어의 성향을 100% 동적으로 진단:
  - `카운터 다마텐 & 철벽 수비`: 침착한 다마텐 공략과 상위 5% 수준의 철벽 수비
  - `단단한 멘젠 선제형`: 안정적인 멘젠 유지와 빠른 선제권 장악
  - `속공 후로 어태커`: 치/퐁을 활용한 빠른 속공 국면 주도
  - `공수겸비 밸런서`: 공격과 수비의 균형 잡힌 정석 플레이
- 대시보드 상단 KPI 요약 카드에 실시간 맞춤형 멘탈/전술 코멘트 제공

### 4. 🔄 Amae-Koromo 지능형 전적 동기화 파이프라인 (`AmaeKoromoService`)
- 4개 글로벌 미러 서버(`5-data`, `1.data`, `2.data`, `4.data`) 자동 순환 폴백으로 고가용성 보장
- 3인마/4인마 동풍전(`21,23,25`) 및 반장전(`22,24,26`) 개별 모드 쿼리로 실제 방 명칭(예: `'3인 옥탁 동풍전'`) 완벽 보존
- 브레젠험(Bresenham) 결정론적 알고리즘을 통한 일관된 순위 및 대국 분포 생성 (`Math.random()` 완전 배제)

### 5. ⚡ 순수 TypeScript 작혼 Protobuf 역직렬화 엔진 (`LiqiBinaryDecoder`)
- 외부 라이브러리 없이 순수 TS로 작성된 작혼 와이어 포맷(Varint / Packed / Message) 디코더
- 실전 패보의 0x1B86 XOR 역난독화 및 3인마 북패(Kita, 拔北) `RecordBaBei` 전용 파싱 지원

### 6. 🎯 치명적 타패 탐색 및 AI 코칭 리포트 (`CoachingAdvisor`)
- 대국 내에서 패효율을 급격히 떨어뜨리거나 치명적인 방총으로 이어진 최악의 타패 톱 3(Top 3 Critical Mistakes) 자동 검출
- 순목, 손패 상황, 실수 타패, AI 추천 정수 타패 및 상세 해설 제공

### 7. 🏆 작혼 티어 벤치마크 및 SNS 소셜 공유 카드 (`TierBenchmarkService`)
- 작사, 작걸, 작호, 작성 티어별 운/실력 점수 정규 분포 백분위(Percentile) 비교
- 유저의 최근 30판 퍼포먼스 매트릭스를 고해상도 SVG 카드(OpenGraph/SNS)로 내보내는 공유 API 지원

---

## 🏗️ 시스템 아키텍처 & 모노레포 구조

```plaintext
mahjong-sensei/
├── apps/
│   ├── api/                     # NestJS 백엔드 서비스
│   │   ├── prisma/              # Prisma 스키마 & DDL 마이그레이션 (PostgreSQL)
│   │   └── src/modules/
│   │       ├── analysis/        # 롤링 윈도우 통계, 티어 벤치마크, SNS 공유 카드
│   │       ├── sync/            # Amae-Koromo 미러 동기화 및 결정론적 라운드 생성
│   │       └── paipu/           # 실전 패보 파싱 및 일괄 등록 파이프라인
│   └── web/                     # Next.js 15 (App Router) 웹 대시보드
│       └── src/app/             # 10/30/50판 윈도우, KPI 요약 카드, 산점도, 트렌드 차트
├── packages/
│   ├── mahjong-core/            # 순수 TS 마작 도메인 핵심 엔진
│   │   ├── src/metrics/         # 샹텐수, 운/실력 점수, Kawa 수비, AI 랭크, 스타일 진단
│   │   ├── src/parser/          # PaipuParser, LiqiBinaryDecoder (Protobuf/XOR)
│   │   └── src/coaching/        # CoachingAdvisor (Top 3 치명적 타패 분석)
│   └── types/                   # 도메인 모델, 지표, 패보 공통 타입 인터페이스
├── docker/                      # 컨테이너 멀티스테이지 Dockerfile
├── docs/                        # 시스템 아키텍처, 코딩 컨벤션, 마작 도메인 헌법
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## 🚀 빠른 시작 가이드 (Getting Started)

### 1. 사전 요구사항 (Prerequisites)
- **Node.js**: v20 이상
- **패키지 매니저**: `pnpm` (v10 이상 권장)
- **컨테이너 환경**: Docker Desktop 또는 Colima

### 2. 의존성 설치 및 데이터베이스 기동
```bash
# 전체 모노레포 의존성 설치
pnpm install

# PostgreSQL 컨테이너 기동 (Docker / Colima)
pnpm db:up

# Prisma DB 스키마 및 마이그레이션 적용
pnpm db:push
```

### 3. 개발 서버 실행
```bash
# NestJS 백엔드(포트 4000) 및 Next.js 웹(포트 3000) 동시 기동
pnpm dev
```
- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000](http://localhost:4000)

### 4. 테스트 및 프로덕션 빌드
```bash
# 전 패키지 단위 테스트 실행 (92개 테스트 통과)
pnpm test

# Turborepo 기반 전 패키지 프로덕션 빌드
pnpm build
```

---

## 📏 엔지니어링 및 코딩 컨벤션 (Code Conventions)

프로젝트의 모든 코드는 [`AGENTS.md`](file:///Users/kimshiwoo/projects/mahjong-sensei/AGENTS.md) 및 [`docs/coding-conventions.md`](file:///Users/kimshiwoo/projects/mahjong-sensei/docs/coding-conventions.md)의 엄격한 원칙을 준수합니다:

1. **포맷팅**: 공백 4칸 들여쓰기, 세미콜론(`;`) 사용 금지, 엄격한 동등 비교(`===`, `!==`).
2. **타입 안전성**: `any`, `unknown`, `as unknown as` 이중 단언 일체 배제.
3. **객체지향 설계**: 클래스의 모든 프로퍼티와 메서드에 명시적 접근 제어자(`private`, `protected`, `public`) 및 `readonly` 적용.
4. **테스트 격리**: `private` 메서드 강제 접근 금지 ➔ `protected` 선언 후 테스트 파일 내 Mock 서브클래스를 생성하여 검증.
5. **Git 정책**: `main` 브랜치 직접 푸시 전면 차단 (`.githooks/pre-push`), 기능 브랜치를 통한 자율 푸시 및 Greptile PR 리뷰(신뢰도 5/5) 후 머지.

---

## 📄 라이선스 (License)

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
