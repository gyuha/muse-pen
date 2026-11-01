<!-- forge-slug: docs-1of3-foundation -->
<!-- task: 1 -->
<!-- part: 1/3 -->
<!-- tdd: off -->
<!-- priority: high -->
# 제작 문서 1/3 — 안내·제품·아키텍처·데이터 모델

## Goal / Non-goals
- Goal: docs/README.md, docs/01-product.md, docs/02-architecture.md, docs/03-data-model.md를 한국어로 작성해, 각 역할(frontend·backend·story·imagery·qa·deploy)이 MVP 첫 빌드를 시작할 때 필요한 제품 범위·구조·데이터 모델을 결정 원본에서 그대로 옮긴다.
- 작성 규칙: 결정 원본(.forge/agenda.md "결정됨", .forge/adr/*, .forge/CONTEXT.md)에 있는 내용만 쓰고, 미정 사항은 "담당 역할이 정할 것"으로 명시한다. 흐름(절차·아키텍처·상태 전이)이 있는 섹션은 텍스트 설명을 먼저 쓰고 그 아래에 흐름도를 둔다(5단계 이하 선형은 `A → B → C` 텍스트 흐름도 코드블록, 분기·다중 레인은 mermaid + style/classDef 색상). 용어는 CONTEXT.md의 용어를 쓰고 _Avoid_ 단어를 쓰지 않는다. 문서 간 링크는 상대 경로(예: `03-data-model.md#...`)로 건다. TODO·TBD·FIXME·"작성 예정"·"추후 작성" 문구 금지.
- Non-goals: 04~09 문서 작성(다른 파트). API 엔드포인트 목록·테이블 컬럼 타입 같은 미결정 세부를 지어내기. .forge/ 아래 파일 수정.

## Source of truth
- Glossary terms: .forge/CONTEXT.md 전체(작가·작품·회차·컨셉·화풍 프리셋·설정·캐릭터·장소·소품·세계관·정형 필드·설정 본문·AI 제안·회차 스냅샷·고정 설정·설정 점검·회차 요약·시놉시스·플롯 메모·자료·대표 이미지)
- Related ADRs: .forge/adr/261101-223930-setting-structured-fields-plus-free-body.md, .forge/adr/261101-230415-typescript-monorepo-web-api-split.md, .forge/adr/261101-231535-drizzle-sqlite-with-portability-rules.md, .forge/adr/261101-232141-single-vps-docker-compose-single-instance.md, .forge/adr/261101-225940-claude-single-provider-thin-interface.md
- 역할·폴더 정의: .agents/teams/orchestrator.json (frontend: apps/web · backend: apps/api, packages/shared · story: packages/story-engine · imagery: packages/image-engine · qa: tests, 별도 qa 워크스페이스 · deploy: infra, .github/workflows)
- 문서별 담을 결정 (agenda.md "결정됨"의 순서 번호 D01~D28 기준):
  - README.md: 문서 목적, 읽는 순서, 10개 문서 각각 한 줄 설명과 상대 링크, 결정 원본 위치(.forge/agenda.md·ADR)
  - 01-product.md: 목적지, D01(작가 1명 + AI, 공동 집필 없음), D02(초대받은 소수 작가, 자기 작품만), D03(MVP AI 기능 전체 목록), "용어" 섹션(CONTEXT.md의 용어 21개 전부를 정의와 함께), "범위 밖" 섹션(agenda.md 범위 밖 5개: 결제·독자 공개·DBMS 실제 이전·모바일·공동 집필/동시 편집, 각 이유), "아직 흐림" 섹션(agenda.md 흐림 6개: 회차 시점별 설정 값·장면 삽화·외부 연재 내보내기·프롬프트 템플릿 버전 관리·장편 일관성 평가·캐릭터별 LoRA)
  - 02-architecture.md: D18(pnpm 모노레포, apps/web·apps/api·packages/shared·packages/story-engine·packages/image-engine와 역할 매핑), D19(Vite + React SPA), D20(Hono, zod, SSE, RPC 타입 공유), D04(이메일+비밀번호, 관리자 발급 초대 코드, 인증 라이브러리, 관리자 비밀번호 재설정·메일 발송 없음), D16(서비스 키 운영자 부담, BYOK 없음), D23(대화형 텍스트는 SSE, 긴 작업은 SQLite 작업 테이블 + api 프로세스 내 워커, Redis 없음), D24(단일 VPS + Docker Compose, Caddy, 호스트 볼륨, Litestream 백업·이미지 주기 동기화, api 단일 인스턴스 제약, 공급자 콘솔 지출 한도는 deploy 운영 작업). 요청 흐름도(브라우저 → Caddy → api → 엔진/DB/외부 API)와 긴 작업 흐름도 포함.
  - 03-data-model.md: 엔티티와 관계(작가, 초대 코드, 작품[컨셉 속성 포함], 시놉시스, 회차, 플롯 메모, 회차 요약, 회차 스냅샷, 설정 4종과 고정 필드, 고정 설정, 자료, 이미지[모델 ID], 작업, AI 사용 기록), D05(정형 필드 + 설정 본문), D06(고정 4종 + 종류별 정형 필드: 캐릭터 이름·별칭·성별·나이대·외형 키워드·상태·대표 이미지 / 장소 이름·유형·시대·분위기 키워드·대표 이미지 / 소품 이름·소유자·외형 키워드·대표 이미지 / 세계관 이름·규칙 요약, 작가 정의 필드 없음, 컨셉은 작품 속성), D17(모든 AI 호출의 사용 기록: 작가·기능·모델·토큰/장수·추정 비용, 앱 내 한도 없음), D21(Drizzle + 이식성 규칙: 저장소 계층 경유, SQLite 전용 기능(FTS5·JSON1 함수 쿼리) 금지, 문자열 ULID/UUID, 시간 형식 통일, PostgreSQL 이전 시 스키마 재작성). 엔티티 관계는 mermaid erDiagram 또는 flowchart(앞에 설명 문단, style/classDef 포함). 컬럼 타입·인덱스 세부는 backend가 정할 것으로 명시.
- Definition of Done: 아래 명령이 모두 기대값을 낸다.
  - `test -s docs/README.md && test -s docs/01-product.md && test -s docs/02-architecture.md && test -s docs/03-data-model.md && echo ok` → `ok` (사전 상태: 실패)
  - `node .forge/checks/docs-check.mjs C2 | grep -oE 'D(0[1-6]|1[6-9]|2[0134])\(' | wc -l` → `0` (사전 상태: 14. 이 명령이 실제로 실행됨은 같은 출력에 "C2" 줄이 찍히는 것으로 확인)
  - `node .forge/checks/docs-check.mjs C5` → exit 0 (사전 상태: fail)
  - `node .forge/checks/docs-check.mjs C7 | grep -cE 'README|0[123]-'` → `0` (사전 상태: 파일 없음으로 C7 전체 fail, 해당 파일 지적은 0 — 파일 생성 후에도 0이어야 함)
  - `node .forge/checks/docs-check.mjs C8 | grep -cE '0[123]-|README'` → `0` (사전 상태: 1 — 02 흐름도 없음)
  - `node .forge/checks/docs-check.mjs C9` → exit 0 (회귀 방지 — 사전 상태 pass가 정상)

## Work slices
- [ ] S1. docs/01-product.md 작성 — completion criterion: `node .forge/checks/docs-check.mjs C5` exit 0, D01~D03 핵심어 누락 없음
- [ ] S2. docs/02-architecture.md 작성(흐름도 2개 이상) — completion criterion: C2 출력에 D04·D16·D18·D19·D20·D23·D24 누락 없음, C8 출력에 02 지적 없음
- [ ] S3. docs/03-data-model.md 작성(엔티티 관계도) — completion criterion: C2 출력에 D05·D06·D17·D21 누락 없음, C8 출력에 03 지적 없음
- [ ] S4. docs/README.md 작성(10개 문서 상대 링크) — completion criterion: 파일이 비어 있지 않고 01~09 파일명 10개를 모두 링크 (depends: S1, S2, S3)
