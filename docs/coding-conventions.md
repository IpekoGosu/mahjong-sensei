# Mahjong Sensei 코딩 컨벤션 & 좋은 엔지니어링 Practice

이 문서는 **Mahjong Sensei** 프로젝트 전반에서 일관된 코드 품질과 엄격한 타입 안전성을 유지하기 위해 정의된 **필수 코딩 규칙**입니다. 모든 개발자 및 AI 에이전트는 본 가이드를 엄격히 준수해야 합니다.

---

## 1. 포맷팅 및 구문 규칙 (Formatting & Syntax)

### 1.1 들여쓰기 (Indentation)
- 모든 파일은 **4칸 공백 (4 spaces)** 들여쓰기를 사용합니다 (탭 사용 금지).

### 1.2 세미콜론 (No Semicolons)
- 문장 끝에 **세미콜론(`;`)을 사용하지 않습니다.**

```typescript
// ❌ 잘못된 예시
const score = 100;
import { MetricCalculator } from './metrics';

// ✅ 올바른 예시
const score = 100
import { MetricCalculator } from './metrics'
```

### 1.3 엄격한 동등 비교 (Strict Equality)
- 동등 비교 시 느슨한 비교(`==`, `!=`)는 절대로 금지하며, 항상 **엄격한 비교(`===`, `!==`)**를 사용합니다.

```typescript
// ❌ 잘못된 예시
if (shanten == 0) { ... }
if (tile != null) { ... }

// ✅ 올바른 예시
if (shanten === 0) { ... }
if (tile !== null && tile !== undefined) { ... }
```

---

## 2. 엄격한 TypeScript 타입 규칙 (Strict Type Safety)

TypeScript-ESLint의 권장 규칙([@typescript-eslint/eslint-plugin](https://typescript-eslint.io/rules))을 가장 엄격한 수준으로 적용합니다.

### 2.1 `any` 및 `unknown` 사용 절대 금지
- `any` 타입을 일체 할당, 인자, 반환형에 사용하지 않습니다.
- `unknown` 타입을 일체 할당하거나 사용하지 않습니다.
- 타입을 우회하기 위해 `... as unknown as TargetType` 형태로 이중 타입캐스팅하는 행위를 엄격히 금지합니다.
- 반드시 정확한 유니온 타입, 제네릭, 혹은 명시적 인터페이스를 설계하여 타입을 좁혀야(Type Narrowing) 합니다.

```typescript
// ❌ 절대 금지
function parseData(raw: any): any { ... }
const result = (input as unknown as PaipuDetail)

// ✅ 올바른 예시: 정밀한 인터페이스 및 타입 가드 정의
function isPaipuAction(item: Record<string, string | number>): item is PaipuAction {
    return typeof item.step === 'number' && typeof item.type === 'string'
}
```

### 2.2 Unsafe 연산 방지
- 에러 타입(`error`)이나 해결되지 않은 타입에 대한 비안전한 멤버 접근, 비안전한 함수 호출, 비안전한 할당을 금지합니다.
- `catch (error)` 블록에서는 반드시 `error instanceof Error` 검증 후 프로퍼티에 접근합니다.

```typescript
// ❌ 잘못된 예시
try {
    await service.sync()
} catch (error) {
    logger.error(error.message) // Unsafe member access
}

// ✅ 올바른 예시
try {
    await service.sync()
} catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown exception occurred'
    logger.error(message)
}
```

### 2.3 미사용 변수 및 Import 정리
- 코드를 추가/수정한 후에는 미사용 변수(`no-unused-vars`)와 불필요한 import 구문을 즉시 제거합니다.

---

## 3. 객체지향 클래스 설계 및 캡슐화 규칙

### 3.1 접근 제어자(Access Modifiers) 명시 필수
- 클래스의 모든 프로퍼티와 메서드에는 접근 제어자(`private`, `protected`, `public`)를 반드시 명시합니다.
- 접근 제어자는 **가능한 가장 엄격한 수준(`private`)**부터 부여하며, 상속이나 확장이 명확히 필요한 경우에만 최소한으로 완화(`protected`)합니다.
- 불변 상태는 `readonly` 키워드를 반드시 함께 사용합니다.

```typescript
// ❌ 접근 제어자 누락
class MetricCalculator {
    shantenCalc = new ShantenCalculator()
    calculate() { ... }
}

// ✅ 올바른 예시: 명시적이고 엄격한 캡슐화
export class MetricCalculator {
    private readonly shantenCalc: ShantenCalculator = new ShantenCalculator()

    public calculateStartingShanten(hand: readonly string[]): number {
        return this.shantenCalc.calculate(hand)
    }
}
```

### 3.2 Private 메서드에 대한 단위 테스트 패턴
- 클래스 내부의 핵심 로직을 테스트하기 위해 `private` 메서드를 강제로 우회하여 접근하거나(`(instance as any).privateMethod()`), 외부로 `public` 노출하지 않습니다.
- **해결 패턴**:
  1. 테스트 대상 메서드를 `protected`로 변경합니다.
  2. 테스트 파일 내부에서 해당 클래스를 상속하는 **테스트 전용 Mock 서브클래스**를 정의합니다.
  3. 서브클래스의 공개 메서드를 통해 안전하게 검증합니다.

```typescript
// 대상 클래스 (src/calculator.ts)
export class GameCalculator {
    protected evaluateInternalLuck(doraCount: number): number {
        return doraCount * 10
    }
}

// 테스트 파일 (src/calculator.test.ts)
class TestableGameCalculator extends GameCalculator {
    public testEvaluateInternalLuck(doraCount: number): number {
        return this.evaluateInternalLuck(doraCount)
    }
}

describe('GameCalculator', () => {
    it('도라 개수에 따른 내부 운 점수를 정확히 계산한다', () => {
        const calculator = new TestableGameCalculator()
        expect(calculator.testEvaluateInternalLuck(2)).toBe(20)
    })
})
```

---

## 4. 비동기 프로그래밍 및 에러 처리 (Async & Await)

- Promise를 반환하는 모든 비동기 함수는 명시적으로 `async`를 선언하고, 호출부에서 적절한 `await` 표현식을 사용합니다.
- `void` 처리되지 않은 Floating Promise(결과를 기다리지 않는 비동기 호출)를 남겨두지 않습니다.
- 트랜잭션(`prisma.$transaction`) 작업 시 내부 예외 발생 시 롤백이 완벽히 보장되도록 단일 트랜잭션 클라이언트를 전달합니다.

---

## 5. 생각 과정 및 임시 주석 마커

- 복잡한 알고리즘이나 설계 상의 의사결정 생각 과정을 코드에 주석으로 기록할 때는 상단에 반드시 **`/*_ GEMINI THINKING _*/`** 마커를 추가합니다.
- 이를 통해 추후 코드 클린업 대상 주석임을 한눈에 식별할 수 있습니다.

```typescript
/*_ GEMINI THINKING _*/
// 시작 샹텐수 베이스라인은 평균 3.5샹텐으로 가정.
// 샹텐수가 1 감소할 때마다 12점의 운 가산점을 부여함.
const shantenLuck = (3.5 - startingShanten) * 12
```

---

## 6. 패키지 매니저 및 명령어 규칙

- 본 프로젝트는 **`pnpm`**을 전용 패키지 매니저로 사용합니다.
- `npm`이나 `yarn` 명령어를 실행하지 마세요.
  - 의존성 설치: `pnpm install`
  - 특정 패키지 실행: `pnpm --filter <app-or-package> <command>`
  - 빌드 및 테스트: `pnpm build`, `pnpm test`
