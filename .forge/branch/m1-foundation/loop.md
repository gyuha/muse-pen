# LOOP — M1 기반 구축: docs·ADR 기반 골격·API·엔진(가짜 공급자)·기본 화면·배포 파일·수락 테스트
started: 2026-11-02
replan-round: 0
replan-cap: 3
budget-tokens: none
budget-spent: 0 · since: 2026-11-02T00:20:00+09:00
wall: none

## Stop-condition checks (ALL must pass)
- [x] K1. `node .forge/checks/m1-check.mjs K1` → exit 0 (6개 패키지 스크립트 존재 + `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm -r --filter "!./tests" build` 성공)
- [ ] K2. `node .forge/checks/m1-check.mjs K2` → exit 0 (5개 패키지 각각 테스트 파일 1개 이상 + `pnpm -r --filter "!./tests" test` 통과)
- [ ] K3. `node .forge/checks/m1-check.mjs K3` → exit 0 (qa 수락 테스트: .forge/checks/m1-acceptance.md의 AC-01~AC-16 각각 통과 테스트 1개 이상, 실패·건너뜀 0)
- [x] K4. `node .forge/checks/m1-check.mjs K4` → exit 0 (apps/api에 drizzle-orm, SQLite 전용 기능·자동 증가 0건)
- [x] K5. `node .forge/checks/m1-check.mjs K5` → exit 0 (공급자 SDK import는 providers/ 안에만, 추적 파일에 API 키 형태 0건 — 회귀 방지)
- [ ] K6. `node .forge/checks/m1-check.mjs K6` → exit 0 (infra/docker-compose.yml config 유효, caddy·api·litestream, api 단일 인스턴스, SQLite·이미지 볼륨)
- [x] K7. `node .forge/checks/m1-check.mjs K7` → exit 0 (docs-check all 통과 + M1 계약 파일 해시 일치 — 회귀 방지)

## Check progress
- K1: pass · regressed: ×0 · last-evidence: "K1 pass — install·typecheck·build 성공 (task 4 봉인 후)"
- K2: fail ×1 · regressed: ×0 · last-evidence: "K2 fail — web·api·story-engine·image-engine 테스트 파일 0개 (shared 해소)"
- K3: fail ×1 · regressed: ×0 · last-evidence: "K3 fail — 리포트 생성됨, AC-01~16 통과 테스트 없음 (tests 미작성, task 8 담당)"
- K4: pass · regressed: ×0 · last-evidence: "K4 pass — drizzle-orm 의존성 있음, 금지 패턴 0건 (주의: 스키마 미작성이라 공허한 통과 — 실제 증명은 K3 AC)"
- K5: pass · regressed: ×0 · last-evidence: "K5 pass — 추적 파일 85개에 키 형태 0건"
- K6: fail ×1 · regressed: ×0 · last-evidence: "K6 fail — infra/docker-compose.yml 없음 (task 7 담당)"
- K7: pass · regressed: ×0 · last-evidence: "K7 pass — docs-check 통과 · 계약 해시 일치"

## Authorized replan scope
- 실패한 검사에 직접 연결되는 코드·테스트·설정 파일(apps/, packages/, tests/, infra/, .github/workflows/, 루트 워크스페이스 설정) 수정만 자동 생성한다. 수정은 담당 역할 에이전트(.agents/teams/orchestrator.json)에게 맡긴다.
- 수정 금지: docs/ · .forge/adr/ · .forge/agenda.md · .forge/CONTEXT.md · .forge/checks/ (검사 스크립트·AC 목록·기준 해시). 결정을 바꾸거나 검사를 느슨하게 하거나 테스트 기대값을 약하게 고쳐 통과시키지 않는다.
- 실제 API 키 사용·저장 금지, 원격 push 금지, 실제 배포 금지. 커밋은 m1-foundation(및 qa의 m1-qa) 브랜치 로컬 커밋만.
- always-halt action classes: prod data mutation/deletion · deploy/release/publish · outbound external comms (email · messaging · third-party write APIs) · irreversible VCS/file destruction (force-push · history rewrite · mass deletion) · financial/payment · secret/permission change · privacy-data exposure

## Tasks
- m1-1of5-skeleton-contract
- m1-2of5-engines
- m1-3of5-api
- m1-4of5-web-infra
- m1-5of5-acceptance
