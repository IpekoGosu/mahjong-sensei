# Mahjong Sensei Code Review Style Guide (코드 리뷰 스타일 가이드)

이 문서는 **Mahjong Sensei (雀魂先生)** 프로젝트의 GitHub Pull Request 자동 코드 리뷰를 위한 공식 스타일 가이드입니다. Gemini Code Assist 및 모든 리뷰어는 PR 코드 변경 사항을 검토할 때 본 가이드라인을 최우선 기준으로 적용해야 합니다.

This document serves as the official code review style guide for automated GitHub Pull Request reviews on the **Mahjong Sensei** project. Gemini Code Assist and all reviewers must enforce these guidelines with the highest priority.

---

## 1. 포맷팅 및 구문 규칙 (Formatting & Syntax Rules)

### 1.1 들여쓰기 (Indentation)
- **4칸 공백 (4 spaces)** 들여쓰기를 사용합니다. 탭(Tab)이나 2칸 공백은 허용되지 않습니다.
- **Use 4 spaces for indentation.** Tabs and 2-space indentation are strictly prohibited.

### 1.2 세미콜론 사용 금지 (No Semicolons)
- 문장 끝에 **세미콜론(`;`)을 일체 사용하지 않습니다.**
- **Do not end statements with semicolons (`;`).**

```typescript
// ❌ Bad (Semicolons present)
const score: number = 100;
import { MetricCalculator } from './metrics';

// ✅ Good (No semicolons)
const score: number = 100
import { MetricCalculator } from './metrics'
```

### 1.3 엄격한 동등 비교 (Strict Equality Only)
- 느슨한 동등 비교(`==`, `!=`)는 금지되며, 항상 **엄격한 동등 비교(`===`, `!==`)**를 사용합니다.
- **Always use strict equality (`===`, `!==`).** Never use loose equality (`==`, `!=`).

```typescript
// ❌ Bad (Loose equality)
if (shanten == 0) { ... }
if (tile != null) { ... }

// ✅ Good (Strict equality)
if (shanten === 0) { ... }
if (tile !== null && tile !== undefined) { ... }
```

---

## 2. 엄격한 TypeScript 타입 안전성 (Strict TypeScript Rules)

본 프로젝트는 `@typescript-eslint/eslint-plugin`의 가장 엄격한 룰셋을 준수합니다.

### 2.1 `any` 및 `unknown` 타입 사용 절대 금지 (Never Use `any` or `unknown`)
- `any` 및 `unknown` 타입의 선언, 할당, 함수 인자 및 반환형 사용을 전면 금지합니다.
- 정밀한 인터페이스, 제네릭, 유니온 타입, 타입 가드(`item is TargetType`)를 사용하여 타입을 안전하게 좁혀야 합니다.
- **Never assign, declare, or use `any` or `unknown` types.** Use explicit interfaces, generics, union types, or user-defined type guards instead.

### 2.2 이중 타입 단언 금지 (No Double Type Assertion)
- `... as unknown as TargetType` 형태의 타입 시스템 우회 캐스팅을 엄격히 금지합니다.
- **Never bypass the type system using `... as unknown as TargetType`.**

```typescript
// ❌ Bad (Using any, unknown, double casting)
function parseAction(raw: any): any {
    return raw as unknown as PaipuAction
}

// ✅ Good (Safe type guards and explicit interfaces)
function isPaipuAction(item: Record<string, string | number>): item is PaipuAction {
    return typeof item.step === 'number' && typeof item.type === 'string'
}
```

### 2.3 안전하지 않은 연산 방지 (Unsafe Operations Prevention)
- 에러 타입(`error`)이나 미해결 타입에 대한 안전하지 않은 멤버 접근(`error.message`), 비안전 함수 호출, 비안전 할당을 금지합니다.
- `catch (error)` 블록에서는 반드시 `error instanceof Error` 검증을 거친 후 프로퍼티에 접근합니다.
- **Prevent unsafe member access or calls on error/unresolved types.** Always verify `error instanceof Error` before accessing error properties in catch blocks.

```typescript
// ❌ Bad (Unsafe member access on caught error)
try {
    await service.sync()
} catch (error) {
    logger.error(error.message)
}

// ✅ Good (Type-narrowed error handling)
try {
    await service.sync()
} catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown exception occurred'
    logger.error(message)
}
```

### 2.4 미사용 변수 및 Import 정리 (Remove Unused Variables & Imports)
- 파일 수정 후 미사용 변수(`no-unused-vars`)와 불필요한 import는 즉시 제거해야 합니다.
- **Always clean up unused variables, parameters, and imports after updating files.**

---

## 3. 객체지향 클래스 설계 및 캡슐화 (OOP & Class Design)

### 3.1 명시적 접근 제어자 및 불변성 (Explicit Access Modifiers & `readonly`)
- 클래스의 모든 프로퍼티와 메서드에는 접근 제어자(`private`, `protected`, `public`)를 반드시 명시합니다.
- 기본적으로 **가장 엄격한 접근 제어자(`private`)**를 적용하며, 상속 확장이 필요한 경우에만 최소한으로 `protected`로 완화합니다.
- 재할당되지 않는 모든 프로퍼티에는 `readonly` 키워드를 부여합니다.
- **Explicit access modifiers (`private`, `protected`, `public`) and `readonly` must be specified on all class properties and methods.** Always default to `private` unless inheritance is intentionally designed.

```typescript
// ❌ Bad (Missing access modifiers and readonly)
class MetricCalculator {
    shantenCalc = new ShantenCalculator()
    calculate() { ... }
}

// ✅ Good (Strict encapsulation and readonly immutability)
export class MetricCalculator {
    private readonly shantenCalc: ShantenCalculator = new ShantenCalculator()

    public calculateStartingShanten(hand: readonly string[]): number {
        return this.shantenCalc.calculate(hand)
    }
}
```

### 3.2 Private 메서드 테스트 패턴 (Testing Encapsulated Methods)
- `private` 메서드를 테스트하기 위해 `(instance as any).privateMethod()` 처럼 타입 단언으로 우회하거나, 테스트를 위해 무분별하게 `public`으로 열어두지 않습니다.
- **권장 패턴**:
  1. 테스트 대상 메서드를 `protected`로 설정합니다.
  2. 테스트 파일(`*.test.ts`) 내부에서 해당 클래스를 상속하는 **테스트 전용 Mock 서브클래스**를 정의합니다.
  3. 서브클래스의 공개 메서드를 통해 검증합니다.
- **Do not bypass private methods in tests using `as any` or exposing them as `public`.** Instead, mark the method `protected`, create a Mock subclass in the test file, and test through the subclass's public methods.

```typescript
// Target class (src/calculator.ts)
export class GameCalculator {
    protected evaluateInternalLuck(doraCount: number): number {
        return doraCount * 10
    }
}

// Test file (src/calculator.test.ts)
class TestableGameCalculator extends GameCalculator {
    public testEvaluateInternalLuck(doraCount: number): number {
        return this.evaluateInternalLuck(doraCount)
    }
}

describe('GameCalculator', () => {
    it('calculates internal luck score based on dora count', () => {
        const calculator = new TestableGameCalculator()
        expect(calculator.testEvaluateInternalLuck(2)).toBe(20)
    })
})
```

---

## 4. 비동기 처리 및 DB 트랜잭션 (Async & Database Transactions)

### 4.1 Promise 처리 및 Floating Promise 금지 (Proper Await & No Floating Promises)
- Promise를 반환하는 함수는 반드시 `async`를 명시하고 호출부에서 `await`로 처리해야 합니다.
- 결과를 기다리지 않는 Floating Promise를 방치하지 않습니다.
- **Always await promises properly.** Never leave unhandled floating promises.

### 4.2 Prisma 트랜잭션 내 대량 작업 최적화 (Batch Operations in Prisma Transactions)
- `prisma.$transaction` 내부에서 반복문(`for ... of`, `Promise.all(list.map(...))`)을 통해 개별 `create`/`update`를 실행하면 N+1 쿼리 및 DB 락(Lock) 경합이 발생합니다.
- 반드시 **`createMany`**, **`updateMany`** 등 대량(Batch) 연산을 사용하여 단일 배치 쿼리로 트랜잭션 실행 시간을 최소화하고 원자성(Atomicity)을 보장해야 합니다.
- **Always use batch operations (`createMany`, `updateMany`) inside Prisma transactions to avoid N+1 query lock contention and latency.** Never execute iterative individual inserts inside transactions.

```typescript
// ❌ Bad (N+1 lock contention inside transaction)
await prisma.$transaction(async (tx) => {
    for (const metric of roundMetrics) {
        await tx.roundMetric.create({ data: metric })
    }
})

// ✅ Good (Batch insert with createMany)
await prisma.$transaction(async (tx) => {
    await tx.roundMetric.createMany({
        data: roundMetrics,
        skipDuplicates: true
    })
})
```

---

## 5. 마작 도메인 규칙 및 불변식 (Mahjong Domain Invariants)

Mahjong Sensei의 핵심 도메인 로직을 검토할 때 다음의 불변식을 반드시 확인해야 합니다.

### 5.1 4인마(4P) vs 3인마(3P) 룰셋 불변식 (4-Player vs 3-Player Differences)
1. **3인마 (3-Player Mahjong / 3P / 삼총)**:
   - **패 구성 및 만수패 제약 (Manzu Tiles & Sequences)**: 만수패 중 **`2m` ~ `8m`은 완전히 제외**됩니다 (만수패는 `1m`, `9m`만 사용). `1m`과 `9m`은 또이츠(Pairs)나 커츠(Triplets / koutsu)만 구성할 수 있으며, 결코 순츠(Sequences / shuntsu)나 타츠(Partial sequences / taatsu)를 구성할 수 없습니다.
   - **3P 도라 표시패 워프 규칙 (3P Dora Indicator Warp)**: 도라 및 우라도라 표시패가 `1m`일 때 실제 도라패는 `2m`이 아니라 **`9m`**으로 워프(Warp) 판정됩니다 (1m indicator -> 9m dora, not 2m).
   - **북패 (4z)**: 일반 자패가 아니며 **키타(Kita / 拔北 / RecordBaBei)** 빼기 도라로 사용됩니다.
   - **순위 (Placement)**: 참여 인원이 3명이므로 **최대 순위는 3위(1위, 2위, 3위 라스)**입니다. **절대로 4위가 존재할 수 없습니다.**
   - **울기 규칙**: 치(Chi)는 불가능하며, 퐁(Pon)과 깡(Kan)만 허용됩니다.
2. **4인마 (4-Player Mahjong / 4P / 사총)**:
   - **패 구성**: 모든 136장의 패(`1m-9m`, `1p-9p`, `1s-9s`, `1z-7z` 각 4장)를 사용합니다.
   - **북패 (4z)**: 일반 객풍/자풍 자패로 취급됩니다.
   - **순위 (Placement)**: 4인 참여로 **최대 순위는 4위(1위, 2위, 3위, 4위 라스)**입니다.
   - **울기 규칙**: 치(Chi), 퐁(Pon), 깡(Kan) 모두 가능합니다.

### 5.2 운(Luck)과 실력(Skill) 메트릭의 명확한 분리 (Luck vs Skill Metric Separation)
Mahjong Sensei의 철학은 **운과 실력의 철저한 수학적 분리**입니다. 두 지표의 속성이 뒤섞이지 않도록 엄격히 리뷰합니다.

1. **운 지표 (Luck Metrics, 0~100점)**:
   - **배패 샹텐수 (Starting Hand Shanten)**: 초기 배패의 완성도 (배패 샹텐수 베이스라인은 4인마 4P `3.50`, 3인마 3P `3.25`로 상이 — Starting shanten baselines differ between 4P (3.50) and 3P (3.25)).
   - **도라 보유량 (Starting Dora & Aka-dora)**: 배패에 포함된 도라(`dora`) 및 적도라(`0m`, `0p`, `0s`) 매수.
   - **유효 츠모 획득률 (Draw Luck)**: 샹텐수를 줄여주는 유효패를 얼마나 이른 순번에 츠모했는가.
   - **뒷도라 적중 횟수 (Uradora Jackpot)**: 리치 화료 시 획득한 뒷도라 매수.
   - **불가항력 실점 (Unavoidable Damage)**: 타가의 이른 츠모/배만 츠모 화료로 지불한 실점.
2. **실력 지표 (Skill Metrics, 0~100점)**:
   - **패효율 준수율 (Tile Efficiency)**: 매 순마다 유효패 잔여 매수를 극대화하는 정석 타패를 선택했는가.
   - **방총 회피율 및 페널티 (Deal-in Avoidance / Penalty)**: 상대의 텐파이/리치 상태에서 위험패를 무리하게 타패하여 쏘였는지 여부.
   - **수비 및 내리기 정확도 (Defense & Fold Accuracy)**: 카와(Kawa)의 안전패 원리에 입각하여 타패했는가. 상대 리치 하에서 현물(Genbutsu, 1.0 safety)은 리치자 본인이 버린 패(tiles discarded by the Riichi player)뿐만 아니라, 리치 선언 이후 타가가 버려 통과된 모든 패(tiles discarded by any other player after the Riichi declaration / post-Riichi Furiten / Awase-uchi)를 모두 포함합니다. 스지(Suji), 카베(Kabe) 등 통계적 안전패 판정 원칙도 함께 엄격히 준수합니다.
3. **4사분면 퍼포먼스 매트릭스 (Performance Quadrants)**:
   - `SKILLFUL_WIN` (1사분면): 높은 실력 + 높은 운 (완벽한 승리)
   - `UNLUCKY_LOSS` (2사분면): 높은 실력 + 낮은 운 (억까 패배, 멘탈 케어 대상)
   - `SLUMP_LOSS` (3사분면): 낮은 실력 + 낮은 운 (슬럼프/틸트 경고)
   - `LUCKY_FLUKE` (4사분면): 낮은 실력 + 높은 운 (운빨 승리, 피드백 대상)

---

## 6. 아키텍처 및 계층 간 경계 (Architecture & Boundaries)

- **순수 도메인 모듈 (`packages/mahjong-core`)**:
  - NestJS, Next.js, Prisma, 브라우저 DOM API 등에 절대 의존하지 않는 순수 TypeScript 계산 모듈이어야 합니다.
  - 외부 프레임워크 임포트가 발견되면 즉시 리팩터링을 요구해야 합니다.
- **타입 단일 진실 공급원 (`packages/types`)**:
  - 프론트엔드와 백엔드가 공유하는 모든 DTO, 모델, 메트릭 인터페이스는 `packages/types`에 정의되어야 합니다.

---

## 7. 주석 및 기타 협업 규칙 (Annotations & Workflow)

- **임시 생각 주석 마커**:
  - 복잡한 로직이나 알고리즘 구상 중 작성하는 주석 상단에는 반드시 **`/*_ GEMINI THINKING _*/`** 마커를 표기합니다.
- **패키지 매니저**:
  - 본 프로젝트는 오직 **`pnpm`**만을 사용합니다 (`npm`, `yarn` 사용 금지).
- **Git 푸시 정책**:
  - `main` 브랜치 직접 푸시는 금지되며, 모든 변경은 기능 브랜치를 통한 Pull Request로 진행됩니다.
