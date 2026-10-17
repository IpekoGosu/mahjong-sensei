# Mahjong Sensei 발전 로드맵 (Evolution Roadmap)

이 문서는 **Mahjong Sensei (雀魂先生)** 프로젝트의 시스템 안정성 강화, 도메인 계산 정밀화, 그리고 사용자 경험 극대화를 위한 **단계별 발전 계획**을 정의합니다. 심층 코드 리뷰를 통해 발견된 개선점들이 포함되어 있습니다.

---

## 1. 단계별 로드맵 개요 (Phased Overview)

```
[Phase 1: 신뢰성 & 도메인 무결성 복구 (단기: 즉시 적용)]
  ├── winCount 화료 판정 왜곡 수정 (luckScore > 65 판정 제거)
  ├── Amae-Koromo 동기화 시 Round/RoundMetric 파이프라인 정합성 복구
  ├── 프론트엔드 Race Condition 제거 및 닉네임 상태 보존
  ├── PaipuService.getPaipuDetail()의 라운드 데이터 유실 복구
  └── 3인 마작(3P) 랭킹 산정 불변식 준수 (4위 기본값 방지)

[Phase 2: 성능 최적화 & 도메인 엔진 고도화 (중기)]
  ├── Prisma createMany 벌크 인서트 전환 (N+1 트랜잭션 락 완화)
  ├── DTO 런타임 유효성 검증 체계 구축 (Zod / class-validator)
  ├── Kawa(버림패 바닥) 기반 현물·스지 방총 회피 판정 엔진
  └── 3인 마작(3P) 키타(Kita, 拔北) 및 2m~8m 배제 샹텐수 분기

[Phase 3: 프로덕션 기능 확장 (장기)]
  ├── 실제 작혼 Protobuf 패보 직렬화/역직렬화 엔진 완성
  ├── AI 기반 틸트(Tilt) 타패 하이라이트 및 코칭 리포트
  └── 작혼 티어별(작사·작걸·작호·작성) 벤치마크 및 SNS 리포트 카드
```

---

## 2. Phase 1: 신뢰성 & 도메인 무결성 복구 (단기 당면 과제)

### 2.1 `winCount` 판정 로직 정상화
- **현상**: `analysis.service.ts`에서 각 국의 승리(`winCount`)를 `metric.luckScore > 65`로 판별하여 손패가 좋은 미화료 국이 승리로 카운트되고, 험난한 패에서 실력으로 화료한 국이 누락됨.
- **해결 방안**:
  - `RoundMetric` 및 지표 산출 계층에 실제 화료 득점(`winScore`) 또는 화료 여부(`isWin`)를 명확히 기록.
  - `AnalysisService`에서 `dealInScore === 0`이면서 실제 화료 득점이 있는 경우를 정확히 판정하여 카운트.

### 2.2 Amae-Koromo 동기화 파이프라인 정합성 복구
- **현상**: 전적 동기화 시 `Game`과 `GameParticipant`만 생성하고 `Round`/`RoundMetric`을 생성하지 않아, 롤링 윈도우 대시보드 표에서 `방총 0회 / 화료 0회 / 평균 샹텐 3.5`로 고정됨.
- **해결 방안**:
  - `AmaeKoromoService`에서 대국을 생성할 때, 해당 게임의 순위/운/실력 점수와 방총 여부에 부합하는 대표 `Round` 및 `RoundMetric`을 함께 생성하여 하류 파이프라인의 데이터 연속성 보장.

### 2.3 프론트엔드 마운트 Race Condition 제거 & 닉네임 상태 보존
- **현상**: `apps/web/src/app/page.tsx` 마운트 시 `handleSync`와 `fetchStats`가 동시에 트리거되어 DB 삭제/재생성 간 충돌이 발생하며, 3마/4마 모드 전환 시 닉네임이 `'서울불빛'`으로 강제 초기화됨.
- **해결 방안**:
  - 모드 전환 시 현재 `nickname` 상태를 유지하여 동기화 호출.
  - 마운트 시 중복 `fetchStats` 호출을 제거하고, 동기화 완료 시점에만 통계를 갱신하도록 라이프사이클 정리.

### 2.4 `PaipuService.getPaipuDetail()` 라운드 데이터 유실 복구
- **현상**: DB에서 `rounds`를 include하여 조회했음에도 반환 객체에 `rounds: []` 빈 배열이 하드코딩되어 있음.
- **해결 방안**:
  - `game.rounds` 및 연관 `roundMetrics`를 `PaipuRound` 인터페이스에 맞게 매핑하여 정상 반환.

### 2.5 3인 마작(3P) 랭킹 산정 불변식 준수
- **현상**: `paipu-parser.ts`에서 기본 랭킹이 `seatRanks[seat] ?? 4`로 설정되어 3인 마작에서 불가능한 4위가 발생할 수 있음.
- **해결 방안**:
  - `playerCount === 3`일 경우 기본 라스를 3위로 제한 (`seatRanks[seat] ?? (playerCount === 3 ? 3 : 4)`).

---

## 3. Phase 2: 성능 최적화 & 도메인 엔진 고도화 (중기 과제)

### 3.1 Prisma `createMany` 일괄 트랜잭션 전환
- 단일 `$transaction` 블록 내에서 50개 대국을 루프로 순차 `create`하는 구조를 `createMany` 벌크 인서트로 개편.
- DB 커넥션 락 점유 시간을 90% 이상 단축하여 동시 요청 처리 안정성 확보.

### 3.2 DTO 런타임 유효성 검증 체계 구축
- `ImportPaipuDto` 등 백엔드 입력 인터페이스를 `class-validator` 기반 DTO 클래스로 전환.
- 대용량 악의적 배열 입력 방지(`@ArrayMaxSize(100)`) 및 UUID 형식 검증(`@IsString()`) 추가.

### 3.3 Kawa(버림패 바닥) 기반 수비 정확도 평가 고도화
- 현재 `safePostRiichiDiscards`가 방총을 당하지 않은 모든 타패를 안전패로 간주하는 단순 휴리스틱을 개선.
- 상대의 리치 선언패 및 이전 버림패(현물, Genbutsu), 스지(Suji: 1-4-7, 2-5-8, 3-6-9), 카베(Kabe: 벽) 데이터를 추적하여 실제 안전패를 냈는지를 평가하는 방어 지표 구현.

### 3.4 3인 마작(3P) 전용 샹텐수 및 키타(Kita) 룰셋 완성
- 만수패 2m~8m가 존재하지 않는 3인마의 특수성을 `ShantenCalculator`에 반영하여 유효패 범위 조정.
- 북패(4z) 키타 빼기도라 선언 액션(`RecordBaBei`) 및 전용 도라 계산 추가.

---

## 4. Phase 3: 프로덕션 기능 확장 (장기 과제)

### 4.1 실제 작혼 Protobuf 역직렬화 엔진 완성
- 작혼 클라이언트 패보 프로토콜(`liqi.json` / protobuf 스키마)을 파싱하여 샘플 목데이터가 아닌 실제 전 대국 액션을 100% 재현.

### 4.2 AI 기반 틸트(Tilt) 타패 하이라이트 & 코칭
- `SLUMP_LOSS` 및 `LUCKY_FLUKE` 대국에서 패효율을 크게 떨어뜨린 최악의 타패(Critical Mistake) 3개를 선정하여 시각적으로 해설하는 자동 피드백 제공.

### 4.3 작혼 티어별 벤치마크 및 소셜 공유 카드
- 작사, 작걸, 작호, 작성 구간별 평균 운 점수와 실력 점수 분포도를 오버레이로 제공.
- 유저의 최근 30판 퍼포먼스 매트릭스를 이미지 카드(OpenGraph/SNS)로 내보내는 공유 기능 제공.
