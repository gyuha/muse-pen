<!-- forge-slug: m1-5of5-acceptance -->
<!-- task: 8 -->
<!-- part: 5/5 -->
<!-- tdd: off -->
# M1 5/5 — qa 수락 테스트(AC-01~AC-16)

## Goal / Non-goals
- Goal: qa 역할이 별도 qa 워크스페이스(m1-foundation에서 갈라진 m1-qa 브랜치의 worktree)에서 커밋된 코드를 대상으로 .forge/checks/m1-acceptance.md의 AC 16개 수락 테스트를 tests/에 작성하고 `test:accept`로 실행한다. 실패한 AC는 재현 절차를 붙여 보고한다. 오케스트레이터가 m1-qa를 m1-foundation에 병합한다.
- 담당: qa 역할(qa 워크스페이스).
- Non-goals: 구현 코드 수정(실패는 보고만), AC 목록·검사 스크립트 수정, 테스트 기대값을 약하게 고쳐 통과시키기, docs/·.forge/ 수정.

## Source of truth
- Glossary terms: .forge/CONTEXT.md
- Related ADRs: 7개 전부(.forge/adr/)
- 수락 기준과 실행 계약: .forge/checks/m1-acceptance.md (tests/.reports/vitest.json, tests/.reports/playwright.json)
- 문서: docs/01~07
- Definition of Done:
  - tests/에 AC-01~AC-16 각각 `[AC-xx]` 태그 테스트가 1개 이상: `for i in $(seq -w 1 16); do grep -rq "\[AC-$i\]" tests --include=*.ts || echo miss $i; done` → 출력 없음 (사전 상태: 전부 miss)
  - `pnpm --filter ./tests run test:accept` 실행 후 tests/.reports/vitest.json과 tests/.reports/playwright.json이 생성됨 (사전 상태: 없음)
  - 실패한 AC가 있으면 각각 재현 절차가 run.md에 기록됨 — 통과 여부 자체는 루프 검사 K3가 판정
  - m1-qa 브랜치가 m1-foundation에 병합됨

## Work slices
- [ ] S1. qa 워크스페이스 생성(worktree, m1-qa 브랜치)과 tests 패키지 구성(vitest + Playwright, test:accept 리포트 계약) — completion criterion: `pnpm --filter ./tests run test:accept`가 리포트 2개를 생성
- [ ] S2. AC-01~AC-15 API·엔진 수락 테스트(동작 단언: 응답 본문·DB 상태·부작용) — completion criterion: 각 AC 태그 테스트 존재 (depends: S1)
- [ ] S3. AC-16 Playwright 브라우저 E2E(web+api 서버 기동) — completion criterion: AC-16 태그 테스트 존재 (depends: S1)
- [ ] S4. 실행·실패 재현 절차 보고·m1-qa 커밋, 오케스트레이터가 m1-foundation에 병합 — completion criterion: `git log m1-foundation --oneline -- tests` 1줄 이상 (depends: S2, S3)
