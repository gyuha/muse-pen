<!-- forge-slug: m1-1of5-skeleton-contract -->
<!-- task: 11 -->
<!-- part: 1/5 -->
<!-- tdd: off -->
<!-- priority: high -->
# M1 1/5 — 모노레포 골격과 공용 계약(packages/shared)

## Goal / Non-goals
- Goal: pnpm 모노레포 골격(루트 설정 + 6개 패키지의 빈 설정·스크립트·M1에 필요한 의존성 일괄 설치)과 packages/shared의 도메인 zod 스키마·타입(설정 4종 고정 필드, 컨셉, 자료 등)·이미지 저장소 인터페이스 타입을 만든다. 이후 병렬 작업에서 lockfile 충돌이 없도록 M1 의존성을 여기서 한 번에 확정한다.
- 담당: backend 역할 에이전트(루트 설정은 어느 역할 폴더에도 속하지 않아 오케스트레이터가 backend에 지정 — docs/08-build-plan.md 0단계).
- Non-goals: API 라우트·DB 구현(3/5), 엔진 로직(2/5), 화면(4/5), 수락 테스트(5/5). docs/·.forge/ 수정.

## Source of truth
- Glossary terms: .forge/CONTEXT.md (설정·정형 필드·설정 본문·컨셉·화풍 프리셋·자료·대표 이미지)
- Related ADRs: .forge/adr/261101-230415-typescript-monorepo-web-api-split.md, .forge/adr/261101-223930-setting-structured-fields-plus-free-body.md, .forge/adr/261101-231535-drizzle-sqlite-with-portability-rules.md
- 문서: docs/02-architecture.md(저장소 구조와 역할), docs/03-data-model.md(설정 종류와 고정 필드, 작품과 컨셉, 자료), docs/08-build-plan.md(0단계)
- 루프 계약: .forge/checks/m1-check.mjs(K1이 요구하는 스크립트: 5개 패키지 typecheck·build·test, tests 패키지 typecheck·test:accept), .forge/checks/m1-acceptance.md
- Definition of Done:
  - `test -f pnpm-workspace.yaml && test -f pnpm-lock.yaml && for p in apps/web apps/api packages/shared packages/story-engine packages/image-engine tests; do test -f $p/package.json || echo miss $p; done` → 출력 없음 (사전 상태: 전부 miss)
  - `pnpm install --frozen-lockfile && pnpm -r typecheck` → exit 0 (사전 상태: 실패)
  - `pnpm --filter ./packages/shared test` → exit 0, 설정 4종 스키마 테스트(정의되지 않은 필드 거부, 캐릭터 상태 3값) 포함 (사전 상태: 패키지 없음)
  - `node .forge/checks/m1-check.mjs K5` → exit 0, `node .forge/checks/m1-check.mjs K7` → exit 0 (회귀 방지 — 사전 상태 pass가 정상)
  - m1-foundation 브랜치에 로컬 커밋 1개 이상(`git log main..m1-foundation --oneline` 1줄 이상)

## Work slices
- [ ] S1. 루트 설정(package.json, pnpm-workspace.yaml: apps/* packages/* tests, tsconfig.base.json, .gitignore: node_modules·dist·data·.reports·.env) — completion criterion: pnpm-workspace.yaml이 6개 패키지를 포함
- [ ] S2. 6개 패키지 package.json·tsconfig·스크립트와 M1 의존성 일괄 설치(hono, zod, drizzle-orm, better-sqlite3, 인증 라이브러리, react·react-dom·vite·라우터, vitest, @playwright/test 등) — completion criterion: `pnpm install --frozen-lockfile && pnpm -r typecheck` exit 0 (depends: S1)
- [ ] S3. packages/shared 도메인 zod 스키마·타입(작품·컨셉, 회차, 설정 4종 고정 필드·캐릭터 상태 3값·소품 소유자, 자료·출처 150자 제한, 이미지 기록·모델 ID, 작업 상태, AI 사용 기록)과 ImageStorage 인터페이스 타입 + 단위 테스트 — completion criterion: `pnpm --filter ./packages/shared test` exit 0 (depends: S2)
- [ ] S4. m1-foundation 브랜치 로컬 커밋 — completion criterion: `git log main..m1-foundation --oneline` 1줄 이상 (depends: S3)
