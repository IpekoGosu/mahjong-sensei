# Mahjong Sensei Agent Instructions & Project Index

이 파일은 **Mahjong Sensei** 프로젝트에서 협업하는 모든 AI 에이전트(Antigravity 등)가 항상 최우선으로 준수해야 하는 **핵심 헌법 및 도메인 색인**입니다.

---

## 1. 프로젝트 주요 문서 색인 (Documentation Index)

자세한 세부 지침 및 도메인 지식은 아래의 전용 문서들을 반드시 참조하세요:

- [docs/architecture.md](file:///Users/kimshiwoo/projects/mahjong-sensei/docs/architecture.md): 시스템 모노레포 아키텍처, 계층별 책임 및 데이터 파이프라인
- [docs/coding-conventions.md](file:///Users/kimshiwoo/projects/mahjong-sensei/docs/coding-conventions.md): TypeScript/JavaScript 엄격 코딩 규칙, 포맷팅, 클래스 설계 원칙
- [docs/mahjong-domain.md](file:///Users/kimshiwoo/projects/mahjong-sensei/docs/mahjong-domain.md): 리치 마작 규칙, 패 표기법(1-9m/p/s/z), 샹텐수 원리, 4마 vs 3마 차이
- [docs/project-vision.md](file:///Users/kimshiwoo/projects/mahjong-sensei/docs/project-vision.md): 프로젝트 목표, 운/실력 분리 철학, 4사분면 퍼포먼스 매트릭스
- [docs/roadmap.md](file:///Users/kimshiwoo/projects/mahjong-sensei/docs/roadmap.md): 단계별 발전 계획 (단기/중기/장기 과제)

---

## 2. 필수 코딩 및 엔지니어링 규칙 요약 (Critical Guidelines)

코드 작성 및 수정 시 다음 규칙을 예외 없이 준수해야 합니다.

1. **포맷팅 & 스타일**:
   - 들여쓰기: **공백 4칸 (4 spaces)**
   - 문장 끝 **세미콜론(`;`) 사용 금지**
   - 비교 연산자: 반드시 **엄격한 동등 비교(`===`, `!==`)** 사용 (느슨한 `==`, `!=` 금지)
2. **타입 안전성 (Strict TypeScript)**:
   - `any`, `unknown` 타입 할당/사용 절대 금지
   - `... as unknown as ...` 형태의 이중 타입 단언 금지
   - 해결되지 않은 타입이나 error 타입에 대한 안전하지 않은 멤버 접근/호출 금지
   - 파일 수정 후 미사용 변수 및 import는 즉시 정리
3. **클래스 및 객체지향 설계**:
   - 클래스의 모든 프로퍼티와 메서드에 **접근 제어자(`private`, `protected`, `public`)** 및 `readonly` 명시
   - 접근 제어자는 가장 엄격한 수준(`private`)을 기본으로 적용
   - `private` 메서드 테스트 시 강제 접근(`as any`) 금지 ➔ `protected`로 변경 후 테스트 파일 내 Mock 서브클래스 생성하여 검증
4. **비동기 & 트랜잭션**:
   - Promise를 반환하는 함수는 `async` 명시 및 반드시 적절한 `await` 사용
   - Prisma DB 작업 시 트랜잭션 무결성 보장
5. **도구 및 주석**:
   - 패키지 매니저는 반드시 **`pnpm`** 사용
   - 복잡한 생각 과정이나 임시 기록 주석 작성 시 상단에 **`/*_ GEMINI THINKING _*/`** 마커 표기
