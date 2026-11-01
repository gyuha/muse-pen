# 제작 문서 — AI 협업 웹소설 집필 플랫폼 MVP

이 폴더는 MVP 첫 빌드에 필요한 내용을 역할(frontend·backend·story·imagery·qa·deploy)이 바로 쓸 수 있게 정리한 제작 문서다. 모든 내용은 2026-11-01에 결정한 사항을 옮긴 것이며, 결정 원본은 [`.forge/agenda.md`](../.forge/agenda.md)의 "결정됨" 목록, [`.forge/CONTEXT.md`](../.forge/CONTEXT.md)의 용어집, `.forge/adr/`의 ADR이다. 문서와 원본이 다르면 원본이 우선한다.

## 읽는 순서

처음 읽는 사람은 제품 정의 → 아키텍처 → 데이터 모델 순서로 전체 그림을 잡은 뒤, 자기 역할에 해당하는 엔진·화면 문서와 제작 계획을 읽는다.

```
01 제품 → 02 아키텍처 → 03 데이터 모델 → 04~07 중 담당 문서 → 08 제작 계획
```

## 문서 목록

| 문서 | 내용 | 주로 읽을 역할 |
|---|---|---|
| [01-product.md](01-product.md) | MVP 범위, AI 기능 목록, 용어, 범위 밖, 아직 흐린 항목 | 전체 |
| [02-architecture.md](02-architecture.md) | 모노레포 구조, Vite·Hono 런타임, 인증과 초대, AI 작업 실행, 배포 | 전체, 특히 backend·deploy |
| [03-data-model.md](03-data-model.md) | 엔티티와 관계, 설정 정형 필드, AI 사용 기록, DB 이식성 규칙 | backend, story, imagery |
| [04-story-engine.md](04-story-engine.md) | AI 컨텍스트 조립 규칙, 텍스트 기능 동작, ghost text, 설정 충돌 검사, 회차 완료 처리 | story, backend |
| [05-image-engine.md](05-image-engine.md) | 대표 이미지 참조 방식, 화풍 프리셋, 공급자, 이미지 저장소 | imagery, backend |
| [06-editor-and-ai-ux.md](06-editor-and-ai-ux.md) | 에디터 AI 협업 방식, AI 제안 수락, 회차 스냅샷, 에디터 IME 스파이크 | frontend |
| [07-research.md](07-research.md) | 자료 조사 검색 백엔드, 자료 저장과 주입 규칙 | story, frontend |
| [08-build-plan.md](08-build-plan.md) | 빌드 전 검증 스파이크, 역할별 첫 작업, 의존 순서, qa·deploy 흐름 | 전체 |
| [09-decisions.md](09-decisions.md) | 결정 28개가 어느 문서에 서술됐는지와 ADR 연결 추적표 | 전체 |

## 문서 작성 규칙

- 결정되지 않은 세부(엔드포인트 경로, 컬럼 타입 등)는 지어내지 않고 "담당 역할이 정할 것"으로 적는다.
- 용어는 [01 제품의 용어](01-product.md#용어)를 따른다.
- 흐름이 있는 내용은 설명을 먼저 쓰고 흐름도를 아래에 둔다.
