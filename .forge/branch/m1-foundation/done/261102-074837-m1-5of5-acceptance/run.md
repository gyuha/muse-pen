# RUN — M1 5/5 — qa 수락 테스트(AC-01~AC-16)

## 슬라이스 결과
- S1 qa 워크스페이스(worktree wks_f9f150b8fa0dabd3, 브랜치 m1-qa)와 tests 패키지·test:accept 리포트 계약 — ✅ as planned
- S2 AC-01~AC-15 vitest 수락 테스트(createApp + 가짜 공급자, 113개) — ✅ as planned
- S3 AC-16 Playwright E2E(api 3000 + web 5173, 가입→재로그인→작품→캐릭터→새로고침) — ✅ as planned
- S4 실행·커밋(3224697)·m1-foundation 병합 — ✅ as planned (실패 AC 없음 → 재현 절차 보고 대상 없음)

## 계획과 실제의 차이
- qa가 test:accept를 수정: vitest가 실패해도 Playwright까지 실행해 두 리포트를 항상 남기고, 둘 중 하나라도 실패하면 non-zero.
- qa는 apps/api의 test-utils를 쓰지 않고 독립 하네스(tests/accept/helpers.ts)를 따로 만들었다(검증 독립성).
- AC-05 파생본 단언은 임시 파생기 수준(본문 포함, heading → `#`)까지만 — 에디터 확정 후 강화 필요.
- AC-15: 공급자 실패 호출의 사용 기록 여부는 문서에 없어 단언하지 않음. 스트림 중단 시 기록 누락(3/5 보고)도 AC에서 다루지 않음.
- AC-16은 3000·5173 포트가 비어 있어야 함(reuseExistingServer: false).

## DoD baseline → after
- AC 태그 누락: 16 → 0
- test:accept 리포트: 없음 → vitest.json·playwright.json 생성, 114 passed
- `git log m1-foundation -- tests`: 골격 커밋만 → 3224697 포함
- 루프 검사 K1~K7: K3 fail → 전부 pass

## Rulings
- 실행기: qa#A337(claude-sonnet-5-5)을 새 qa 워크스페이스(worktree)에서 실행, 오케스트레이터가 m1-qa를 m1-foundation에 fast-forward 병합.
