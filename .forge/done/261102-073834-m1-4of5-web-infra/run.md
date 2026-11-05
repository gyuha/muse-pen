# RUN — M1 4/5 — apps/web 기본 화면과 배포 파일 (수리 r1 후)

## Failed attempts
- r1: UAT failed — 목표의 "Hono RPC 클라이언트로 연결"(결정 D20) 미충족, web이 `/api/api/...` 호출 / 수리: backend AppType export → frontend hc 클라이언트·BASE `/api` → Vite·Caddy 접두사 유지

## 슬라이스 결과
- S1 web 화면·컴포넌트 테스트 — ⚠ 1차에 RPC 미사용·이중 접두사 → 수리 후 `hc<AppType>('/')` 사용, better-auth 경로(/api/auth/*)만 일반 fetch (커밋 7bbe6cd, 503f0e5)
- S2 deploy Compose·Caddy·Dockerfile·Litestream·CI — ✅ as planned, 수리로 Caddy 접두사 유지 (e13a5ed, 7701c74)

## 계획과 실제의 차이
- 1차 결과가 DoD 명령은 통과했지만 플랜 목표(RPC 클라이언트, D20)를 어겨 UAT failed. fg-loop 규칙에 따라 같은 작업을 제자리 수리(재계획 1/3): backend#33A1이 AppType export(caf9f2c, api 테스트 41→42), frontend#1763이 hc 클라이언트 전환·hono와 @muse-pen/api 의존성 추가(503f0e5), deploy#CAAB이 Caddy strip_prefix 제거(7701c74).
- RPC 타입 밖 경로: /api/auth/*(better-auth), /api/health, 이미지 파일(바이너리), SSE(스트림으로 읽음), 화풍 레퍼런스 업로드(raw body).
- 브라우저 화면 자체는 아직 띄워 보지 않음(curl로 가입→작품→캐릭터 흐름만 확인) — AC-16(Playwright)이 실제 확인.
- Pretendard는 CDN 정적 빌드 CSS로 로드(의존성 없음).

## DoD baseline → after
- web test·build: 0개(통과) → 8 passed, build exit 0
- K6: fail → pass (서비스 api·caddy·image-backup·litestream, api 단일 인스턴스, 볼륨)
- K5: pass → pass (회귀 방지)
- 수리 확인: `grep hc<AppType> apps/web/src` 1건, `/api/api` 0건, Caddy strip_prefix 0건, api 42 passed, typecheck exit 0

## Rulings
- 실행기: frontend#1763(claude-sonnet-5-5), deploy#CAAB(codex/gpt-6.1-sol) 병렬 위임, 수리 시 backend#33A1 포함 기존 에이전트에 send.
- UAT 판정: DoD 통과에도 플랜 목표(D20) 미충족을 failed로 판정하고 제자리 수리 — 오케스트레이터 판단.
