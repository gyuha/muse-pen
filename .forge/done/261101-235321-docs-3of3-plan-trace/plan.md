<!-- forge-slug: docs-3of3-plan-trace -->
<!-- task: 3 -->
<!-- part: 3/3 -->
<!-- tdd: off -->
# 제작 문서 3/3 — 제작 계획·결정 추적표·전체 검사 통과

## Goal / Non-goals
- Goal: docs/08-build-plan.md와 docs/09-decisions.md를 한국어로 작성하고, docs/ 10개 문서 전체가 `node .forge/checks/docs-check.mjs all`을 통과하도록 링크·앵커·흐름도를 마무리한다.
- 작성 규칙: 결정 원본(.forge/agenda.md "결정됨", .forge/adr/*, .forge/CONTEXT.md)과 .agents/teams/orchestrator.json에 있는 내용만 쓰고, 미정 사항은 "담당 역할이 정할 것"으로 명시한다. 흐름이 있는 섹션은 텍스트 설명을 먼저 쓰고 그 아래 흐름도(분기·다중 레인은 mermaid + style/classDef). TODO·TBD·FIXME·"작성 예정"·"추후 작성" 문구 금지. 앞선 파트가 쓴 01~07 문서의 결정 서술은 바꾸지 않는다 — 고치는 것은 C3·C6가 지적한 링크·앵커 불일치뿐이다.
- Non-goals: 결정 원본(.forge/ 아래) 수정, 검사 스크립트 수정, 새 결정 추가, 실제 빌드 작업 실행.

## Source of truth
- Glossary terms: .forge/CONTEXT.md 전체
- Related ADRs: .forge/adr/ 7개 전부
- 역할 정의: .agents/teams/orchestrator.json — frontend(apps/web), backend(apps/api, packages/shared), story(packages/story-engine), imagery(packages/image-engine), qa(tests, 별도 qa 워크스페이스, 커밋된 코드만 검증·실패 시 재현 절차 보고), deploy(infra, .github/workflows, 프로덕션 배포 전 qa 통과 확인·되돌릴 수 없는 작업은 오케스트레이터 확인)
- 문서별 내용:
  - 08-build-plan.md: (1) 빌드 전 검증 스파이크 3개 — 에디터 한국어 IME 스파이크(frontend, BlockNote vs Plate, 06 문서 링크), 이미지 일관성·검열 오탐 시험(imagery, Gemini 실패 시 FLUX, 05 문서 링크), 자료 조사 한국어 검색 품질 비교(story, Claude 검색 vs Tavily, 07 문서 링크) — 각 스파이크의 통과 기준과 결과에 따라 바뀌는 결정. (2) 역할별 첫 빌드 작업: 결정에서 직접 도출되는 것만(모노레포 골격·공용 설정은 다른 역할보다 먼저 순차로 깐다는 점 포함 — 루트 package.json·lockfile·tsconfig는 어느 역할 폴더에도 속하지 않아 병렬 수정 시 충돌), 역할 6개(frontend·backend·story·imagery·qa·deploy) 모두. (3) 의존 순서 흐름도(mermaid + style/classDef): 골격 → 스파이크 → shared 타입·DB 스키마 → 엔진·api·web → qa 검증 → deploy. (4) qa 흐름(공유 워크스페이스에서 커밋 → qa 워크스페이스가 받아 검증 → 실패 시 재현 절차 보고)과 deploy 게이트(qa 통과·프로덕션 반영 전 확인), 운영 작업(공급자 콘솔 월 지출 한도, Litestream 백업).
  - 09-decisions.md: 결정 추적표 하나. 열: `| ID | 결정 | 문서 위치 | ADR |`. 행은 정확히 28개, ID는 D01~D28이며 .forge/agenda.md "결정됨" 목록의 위에서부터의 순서와 일치. 각 행의 "문서 위치"는 그 결정을 서술한 01~07 문서의 실제 제목 앵커로 상대 링크(`[02 아키텍처](02-architecture.md#<앵커>)` 형식 — 앵커는 GitHub 방식: 소문자, 문자·숫자·공백·`-`·`_` 외 제거, 공백은 `-`). "ADR" 열은 해당 ADR이 있으면 `../.forge/adr/<파일명>` 상대 링크, 없으면 "—". ADR 7개는 모두 최소 한 번 링크. 표 위에 "결정 원본은 .forge/agenda.md이며 이 표는 추적용"이라는 설명 문단.
- Definition of Done:
  - `node .forge/checks/docs-check.mjs all` → exit 0, C1~C9 모두 pass (사전 상태: C9만 pass)
  - `node .forge/checks/docs-check.mjs C9` → exit 0 (회귀 방지 — 사전 상태 pass가 정상)

## Work slices
- [ ] S1. docs/08-build-plan.md 작성(의존 순서 mermaid 흐름도) — completion criterion: C2 출력에 "B(08-build-plan.md)" 누락 없음, C8 출력에 08 지적 없음
- [ ] S2. docs/09-decisions.md 작성(28행 추적표, ADR 7개 링크) — completion criterion: `node .forge/checks/docs-check.mjs C3` exit 0 그리고 `C4` exit 0
- [ ] S3. 전체 링크·앵커·자리표시자·흐름도 마무리 — completion criterion: `node .forge/checks/docs-check.mjs all` exit 0 (depends: S1, S2)
