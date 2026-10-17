# Mahjong Sensei 시스템 아키텍처 (System Architecture)

이 문서는 **Mahjong Sensei (雀魂先生)** 프로젝트의 전체 시스템 설계, 모노레포 구조, 계층별 책임 및 데이터 파이프라인을 정의합니다.

---

## 1. 아키텍처 개요 및 설계 철학

Mahjong Sensei는 작혼(Mahjong Soul)의 대국 패보(Paipu) 데이터를 분석하여 **운(Luck)과 실력(Skill)을 분리**하고, 유저에게 객관적인 지표와 4사분면 매트릭스를 제공하는 웹 서비스입니다.

### 핵심 설계 원칙
1. **클린 아키텍처 및 단방향 의존성 (Unidirectional Dependency)**:
   - 비즈니스 도메인 및 수학적 계산 엔진(`mahjong-core`)은 어떤 외부 웹 프레임워크나 ORM에도 의존하지 않는 **순수 TypeScript 모듈**로 유지합니다.
   - 계층 간 의존성은 항상 `UI (web) -> API (api) -> Core (mahjong-core) -> Types (types)` 단방향으로만 흐릅니다.
2. **타입 기반 단일 진실 공급원 (Single Source of Truth)**:
   - 모든 엔티티, DTO, 지표 인터페이스는 `@mahjong-sensei/types`에 정의되어 프론트엔드와 백엔드가 완벽히 공유합니다.
3. **컨테이너 격리 및 재현성**:
   - 개발 환경과 데이터베이스(PostgreSQL 16)는 Colima 및 Docker Compose를 통해 일관되게 관리됩니다.

---

## 2. 모노레포 토폴로지 (Monorepo Topology)

본 프로젝트는 **Turborepo**와 **pnpm workspace** 기반의 모노레포로 구성되어 있습니다.

```mermaid
graph TD
    subgraph Apps
        Web["apps/web<br/>(Next.js 15 App Router)"]
        Api["apps/api<br/>(NestJS 10)"]
    end

    subgraph Packages
        Core["packages/mahjong-core<br/>(도메인 계산 엔진)"]
        Types["packages/types<br/>(공통 타입 정의)"]
    end

    subgraph Infrastructure
        DB[("PostgreSQL 16<br/>(Prisma ORM)")]
        Docker["Docker / Colima"]
    end

    Web -->|HTTP / React Query| Api
    Web -->|Shared Types| Types
    Api -->|Imports| Core
    Api -->|Imports| Types
    Api -->|ORM Access| DB
    Core -->|Implements| Types
    DB -.->|Managed by| Docker
```

---

## 3. 계층별 상세 책임과 경계 (Layer Boundaries)

### 3.1 `packages/types` (공통 타입)
- **책임**: 도메인 엔티티, 패보 구조, 메트릭스(운/실력 점수, 4사분면, 롤링 윈도우)의 타입 인터페이스 정의.
- **의존성**: 순수 TypeScript 정의 파일(`*.ts`)만 포함하며, 런타임 라이브러리 의존성이 일체 없습니다.
- **주요 모델**:
  - `PaipuDetail`, `PaipuRound`, `PaipuAction`: 작혼 패보 원본 파싱 데이터
  - `RoundLuckMetric`, `RoundSkillMetric`: 라운드별 세부 지표
  - `GameMetricSummary`, `RollingWindowStats`: 10·30·50판 집계 통계
  - `PerformanceQuadrant`: `SKILLFUL_WIN` | `UNLUCKY_LOSS` | `SLUMP_LOSS` | `LUCKY_FLUKE`

### 3.2 `packages/mahjong-core` (도메인 엔진)
- **책임**: 마작 알고리즘 및 수학적 지표 계산.
  - **샹텐수 계산기 (`ShantenCalculator`)**: 일반형, 치또이츠, 국사무쌍 샹텐수 산출.
  - **패 변환기 (`TileConverter`)**: 만·통·삭·자패 및 적도라(0m, 0p, 0s) 정규화.
  - **메트릭 계산기 (`MetricCalculator`)**:
    - 라운드별 배패 샹텐수, 도라 보유수, 유효 츠모율 기반 운 점수(`luckScore`) 계산.
    - 패효율(타패 최적성), 방총(Deal-in) 페널티, 회피율 기반 실력 점수(`skillScore`) 계산.
    - 4사분면 분류 로직.
- **금기 사항**: NestJS, Next.js, Prisma, 브라우저 DOM API 등을 절대 임포트하지 않습니다.

### 3.3 `apps/api` (NestJS 백엔드)
- **책임**:
  - 작혼 패보 수집 및 Amae-Koromo 연동 (`SyncModule`)
  - 패보 데이터 직렬화/역직렬화 및 유효성 검증 (`PaipuModule`)
  - `@mahjong-sensei/mahjong-core`를 호출하여 점수 산출 및 Prisma를 통한 DB 영속화 (`AnalysisModule`)
  - 클라이언트 대시보드를 위한 롤링 윈도우(10/30/50판) 집계 API 서빙
- **데이터베이스 모델 (Prisma)**:
  - `Player` ➔ `Game` ➔ `GameParticipant` ➔ `Round` ➔ `RoundMetric`

### 3.4 `apps/web` (Next.js 프론트엔드)
- **책임**:
  - Next.js 15 (App Router, React 19) 기반 유저 인터페이스
  - Tailwind CSS v4를 활용한 모던 다크/라이트 UI
  - Recharts를 활용한 운/실력 추세 차트 및 사분면 산점도 시각화
  - 최근 10·30·50판 토글 필터링 및 방총률/화료율 분석 뷰

---

## 4. 데이터 파이프라인 (Data Pipeline Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as 사용자
    participant Web as Next.js Web
    participant API as NestJS API
    participant Sync as Koromo / Paipu Sync
    participant Core as Mahjong Core Engine
    participant DB as PostgreSQL (Prisma)

    User->>Web: 대국 분석 요청 (유저 ID / 패보 링크)
    Web->>API: POST /api/sync or /api/paipu/import
    API->>Sync: 패보 원본 수집 (Protobuf / JSON)
    Sync-->>API: 파싱된 PaipuDetail 반환
    
    API->>Core: calculateRoundLuckScore() / calculateRoundSkillScore()
    Core-->>API: 운 점수, 실력 점수, 사분면 판정 반환
    
    API->>DB: Game, Round, Participant, RoundMetric 일괄 저장 (Transaction)
    DB-->>API: 저장 완료
    
    User->>Web: 대시보드 조회 (최근 30판 롤링 윈도우)
    Web->>API: GET /api/analysis/rolling?window=30
    API->>DB: 최근 30개 GameParticipant 조회
    DB-->>API: 참가 기록 반환
    API-->>Web: RollingWindowStats 반환
    Web->>User: 사분면 산점도 & 운/실력 추세 그래프 렌더링
```

---

## 5. 인프라 및 실행 환경

- **로컬 런타임**: Node.js v20+, pnpm v10+
- **컨테이너**: Colima 환경에서 Docker Compose 구동
- **환경 변수 관리**:
  - `apps/api/.env`: `DATABASE_URL=postgresql://mahjong:mahjong123@localhost:5432/mahjong_sensei?schema=public`
  - `apps/web/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000`
