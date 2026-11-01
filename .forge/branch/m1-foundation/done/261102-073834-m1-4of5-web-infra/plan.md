<!-- forge-slug: m1-4of5-web-infra -->
<!-- repaired-by: fg-loop -->
<!-- task: 7 -->
<!-- part: 4/5 -->
<!-- tdd: off -->
# M1 4/5 — apps/web 기본 화면과 배포 파일

## Goal / Non-goals
- Goal: apps/web에 Vite + React SPA 기본 화면(초대 코드 가입·로그인, 작품 목록, 작품 생성(컨셉), 설정 화면에서 캐릭터 등 4종 생성)을 api의 Hono RPC 클라이언트로 연결하고, infra/에 Docker Compose(caddy·api·litestream)·Caddyfile·Dockerfile·litestream 설정·.env.example(키 없음)과 .github/workflows CI를 만든다.
- 담당: frontend 역할(apps/web)과 deploy 역할(infra, .github/workflows)을 병렬로.
- Non-goals: 회차 에디터(에디터 라이브러리는 IME 스파이크 전이라 미정), 실제 배포·push·시크릿 등록, 의존성 추가(필요 시 보고), docs/·.forge/ 수정.

## Source of truth
- Glossary terms: .forge/CONTEXT.md
- Related ADRs: .forge/adr/261101-232141-single-vps-docker-compose-single-instance.md, .forge/adr/261101-230415-typescript-monorepo-web-api-split.md
- 문서: docs/06-editor-and-ai-ux.md(화면 구성), docs/02-architecture.md(프론트엔드, 배포 구성), docs/03-data-model.md(설정 종류와 고정 필드)
- 수락 기준: .forge/checks/m1-acceptance.md AC-16(브라우저 E2E 흐름이 가능한 화면)
- Definition of Done:
  - `pnpm --filter ./apps/web test && pnpm --filter ./apps/web build` → exit 0 (사전 상태: 스캐폴드만 있어 실패)
  - `node .forge/checks/m1-check.mjs K6` → exit 0 (사전 상태: infra/docker-compose.yml 없음)
  - `node .forge/checks/m1-check.mjs K5` → exit 0 (회귀 방지 — .env.example에 실제 키 없음)
  - 역할별 로컬 커밋 각 1개 이상

## Work slices
- [ ] S1. web: 가입(초대 코드)·로그인, 작품 목록, 작품 생성(컨셉 5항목), 설정 화면(4종 정형 필드 폼 + 생성·목록), Pretendard 정적 빌드, 컴포넌트 테스트 — completion criterion: `pnpm --filter ./apps/web test && pnpm --filter ./apps/web build` exit 0
- [ ] S2. deploy: infra/docker-compose.yml(caddy·api 단일 인스턴스·litestream, SQLite·이미지 호스트 볼륨), Caddyfile, Dockerfile, litestream.yml, .env.example, .github/workflows/ci.yml(typecheck·build·test) — completion criterion: K6 exit 0
