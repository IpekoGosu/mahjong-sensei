# Mahjong Sensei (雀魂先生)

> 작혼(Mahjong Soul) 대국 패보 데이터를 분석하여 최근 10·30·50판 단위로 운(Luck)과 실력(Skill)을 객관적으로 분리해주는 경량 웹 서비스

---

## 🚀 기술 스택 & 인프라

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide React, Recharts
- **Backend**: NestJS 10, TypeScript
- **Database**: PostgreSQL 16 (Colima / Docker 기반 컨테이너 격리), Prisma ORM
- **Core Engine**: `@mahjong-sensei/mahjong-core` (독립 순수 TS 마작 샹텐수/운·실력 지표 계산기)
- **Monorepo**: Turborepo, pnpm workspace
- **Container / Orchestration**: Colima, Docker Compose

---

## 📂 프로젝트 구조

```plaintext
mahjong-sensei/
├── docker/
│   ├── Dockerfile.api           # NestJS 멀티스테이지 컨테이너
│   └── Dockerfile.web           # Next.js standalone 멀티스테이지 컨테이너
├── docker-compose.yml           # Colima 기반 PostgreSQL & 앱 통합 오케스트레이션
├── apps/
│   ├── web/                     # Next.js 15 대시보드 (최근 10/30/50판, 사분면 매트릭스, 차트)
│   └── api/                     # NestJS 백엔드 (패보 수집, Prisma, 통계 집계)
├── packages/
│   ├── mahjong-core/            # 샹텐수 계산기, 운/실력 점수 산출 엔진
│   └── types/                   # 공통 타입 인터페이스
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## 🛠️ 시작하기 (Colima & Docker 환경)

### 1. Colima 실행 확인
```bash
# Colima 구동 확인 (brew services)
brew services list | grep colima
docker ps
```

### 2. 의존성 설치 & DB 컨테이너 실행
```bash
# 전체 워크스페이스 의존성 설치
pnpm install

# PostgreSQL 컨테이너 기동 (백그라운드)
pnpm docker:up

# Prisma DB 스키마 반영
pnpm db:push
```

### 3. 개발 서버 실행
```bash
pnpm dev
```

- **Frontend (Web)**: [http://localhost:3000](http://localhost:3000)
- **Backend (API)**: [http://localhost:4000](http://localhost:4000)

### 4. 전체 빌드 & 테스트
```bash
# 모노레포 전체 빌드
pnpm build

# 마작 코어 엔진 단위 테스트
pnpm test
```
