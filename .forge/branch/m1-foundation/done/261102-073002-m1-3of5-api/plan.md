<!-- forge-slug: m1-3of5-api -->
<!-- task: 6 -->
<!-- part: 3/5 -->
<!-- tdd: off -->
# M1 3/5 — apps/api: 인증·CRUD·작업 테이블·SSE·이미지·사용 기록

## Goal / Non-goals
- Goal: apps/api를 Hono + Drizzle(SQLite)로 구현해 M1 수락 기준의 서버 쪽 동작을 모두 제공한다. 테스트용 앱 팩토리(임시 DB 경로·이미지 디렉터리·가짜 공급자 주입)를 내보내 qa가 쓸 수 있게 한다. 관리자 계정 생성·초대 코드 발급 CLI(시드 스크립트)를 둔다.
- 담당: backend 역할.
- Non-goals: 화면(4/5), 수락 테스트 작성(5/5), 실제 API 키, 엔진 내부 수정(필요 시 보고), docs/·.forge/ 수정.

## Source of truth
- Glossary terms: .forge/CONTEXT.md 전체
- Related ADRs: .forge/adr/261101-231535-drizzle-sqlite-with-portability-rules.md, .forge/adr/261101-232141-single-vps-docker-compose-single-instance.md
- 문서: docs/02-architecture.md(백엔드, 인증과 초대, AI 작업 실행 방식), docs/03-data-model.md 전체, docs/05-image-engine.md(이미지 파일 저장소), docs/06-editor-and-ai-ux.md(AI 제안과 수락, 회차 스냅샷과 복원)
- 수락 기준: .forge/checks/m1-acceptance.md AC-01~AC-15의 서버 쪽 동작
- 블록 JSON 파생: 에디터 라이브러리는 스파이크 전이라 미정 — 파생기(블록 JSON → 일반 텍스트·Markdown)를 교체 가능한 인터페이스로 두고 임시 일반 구현을 넣는다(docs/03-data-model.md 회차 본문 저장).
- Definition of Done:
  - `pnpm --filter ./apps/api test && pnpm --filter ./apps/api build` → exit 0, 테스트가 초대 가입 거절·소유권 거부·설정 필드 검증·작업 상태 전이·SSE 스트리밍·이미지 권한·사용 기록 1건을 확인 (사전 상태: 스캐폴드만 있어 실패)
  - `node .forge/checks/m1-check.mjs K4` → exit 0 (사전 상태: drizzle-orm 의존성은 1/5에서 설치됨, 스키마 미작성)
  - `node .forge/checks/m1-check.mjs K5` → exit 0 (회귀 방지)
  - 로컬 커밋 1개 이상

## Work slices
- [ ] S1. Drizzle 스키마·마이그레이션(문자열 ULID, 시간 형식 통일, SQLite 전용 기능 금지)과 저장소 계층 — completion criterion: K4 exit 0
- [ ] S2. 인증(이메일+비밀번호, 초대 코드 가입·재사용 불가, 관리자 비밀번호 재설정)·작가 소유권 확인·시드 CLI — completion criterion: 관련 테스트 통과 (depends: S1)
- [ ] S3. 작품·컨셉·시놉시스·회차(블록 JSON + 파생 텍스트·Markdown)·스냅샷·설정 4종·고정 설정·플롯 메모·자료 CRUD — completion criterion: 관련 테스트 통과 (depends: S2)
- [ ] S4. 작업 테이블 + api 프로세스 내 워커(대기→실행중→완료/실패, 재요청), SSE 스트리밍 기능 엔드포인트(story-engine 가짜 공급자), 이미지 생성 작업(image-engine 가짜 공급자 + 로컬 디스크 ImageStorage, 권한 확인 후 제공), AI 사용 기록, 앱 팩토리 export — completion criterion: `pnpm --filter ./apps/api test` exit 0 (depends: S3)
