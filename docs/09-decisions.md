# 09. 결정 추적표

결정 원본은 [`.forge/agenda.md`](../.forge/agenda.md)의 "결정됨" 목록이며, 이 표는 추적용이다. 2026-11-01에 정한 결정 28개가 제작 문서의 어느 절에 서술됐는지, 그리고 ADR(되돌리기 어려운 설계 결정 기록)이 있는지 보여 준다. ID는 "결정됨" 목록의 위에서부터의 순서다. 문서와 원본이 다르면 원본이 우선한다.

| ID | 결정 | 문서 위치 | ADR |
|---|---|---|---|
| D01 | 작가 1명 + AI 협업, 공동 집필 없음 | [01 제품 · 작가 1명 + AI 협업](01-product.md#작가-1명--ai-협업) | — |
| D02 | 초대받은 소수 작가, 각자 자기 작품만 | [01 제품 · 초대받은 소수 작가](01-product.md#초대받은-소수-작가) | — |
| D03 | MVP AI 기능 — 집필 보조·구상·초안·이미지·자료 조사 모두 포함 | [01 제품 · MVP에 들어가는 AI 기능](01-product.md#mvp에-들어가는-ai-기능) | — |
| D04 | 이메일+비밀번호, 관리자 발급 초대 코드, 관리자 비밀번호 재설정 | [02 아키텍처 · 인증과 초대](02-architecture.md#인증과-초대) | — |
| D05 | 설정은 정형 필드 + 설정 본문 혼합 | [03 데이터 모델 · 설정](03-data-model.md#설정--정형-필드와-설정-본문) | [설정 구조](../.forge/adr/261101-223930-setting-structured-fields-plus-free-body.md) |
| D06 | 고정 4종 설정과 고정 필드, 컨셉은 작품 속성 | [03 데이터 모델 · 설정 종류와 고정 필드](03-data-model.md#설정-종류와-고정-필드), [작품과 컨셉](03-data-model.md#작품과-컨셉) | — |
| D07 | 선택 영역 메뉴·"/" 명령·사이드 패널·ghost text 모두 포함 | [06 에디터 · AI 협업 방식](06-editor-and-ai-ux.md#ai-협업-방식) | — |
| D08 | AI 제안 수락·거절·다시 생성, 회차 스냅샷 시점 복원 | [06 에디터 · AI 제안과 수락](06-editor-and-ai-ux.md#ai-제안과-수락), [회차 스냅샷과 복원](06-editor-and-ai-ux.md#회차-스냅샷과-복원) | — |
| D09 | 정형 필드 항상, 설정 본문은 언급·고정 시만, 임베딩 미룸 | [04 스토리 엔진 · 컨텍스트 조립 규칙](04-story-engine.md#컨텍스트-조립-규칙) | — |
| D10 | 자동 필드 경고 + 작가 요청 설정 점검 | [04 스토리 엔진 · 설정 충돌 검사](04-story-engine.md#설정-충돌-검사) | — |
| D11 | ghost text — 조합 종료 후 자동, 한 문장, 하위 모델, 켜기·끄기 | [04 스토리 엔진 · ghost text](04-story-engine.md#ghost-text), [06 에디터 · ghost text 표시 규칙](06-editor-and-ai-ux.md#ghost-text-표시-규칙) | — |
| D12 | 직전 N개 회차 전문 + 이전 회차 요약 | [04 스토리 엔진 · 컨텍스트 조립 규칙](04-story-engine.md#컨텍스트-조립-규칙), [회차 완료 처리](04-story-engine.md#회차-완료-처리) | — |
| D13 | 회차 완료 시 정형 필드 변경 제안, 현재 값만 | [04 스토리 엔진 · 회차 완료 처리](04-story-engine.md#회차-완료-처리) | — |
| D14 | 시놉시스·플롯 메모에 저장, 패널 대화는 컨텍스트 제외 | [04 스토리 엔진 · 줄거리 구상 결과의 행방](04-story-engine.md#줄거리-구상-결과의-행방) | — |
| D15 | Claude 단일 공급자, 얇은 내부 인터페이스 | [04 스토리 엔진 · 텍스트 LLM 구성](04-story-engine.md#텍스트-llm-구성) | [텍스트 LLM](../.forge/adr/261101-225940-claude-single-provider-thin-interface.md) |
| D16 | 서비스 키로 운영자 부담, BYOK 없음 | [02 아키텍처 · AI 비용 부담](02-architecture.md#ai-비용-부담) | — |
| D17 | 모든 AI 호출 사용 기록, 앱 내 한도 없음 | [03 데이터 모델 · AI 사용 기록](03-data-model.md#ai-사용-기록) | — |
| D18 | TypeScript pnpm 모노레포, web/api 분리 | [02 아키텍처 · 저장소 구조와 역할](02-architecture.md#저장소-구조와-역할) | [모노레포](../.forge/adr/261101-230415-typescript-monorepo-web-api-split.md) |
| D19 | Vite + React SPA | [02 아키텍처 · 프론트엔드](02-architecture.md#프론트엔드--vite--react-spa) | — |
| D20 | Hono, zod, SSE, RPC 타입 공유 | [02 아키텍처 · 백엔드](02-architecture.md#백엔드--hono) | — |
| D21 | Drizzle + 이식성 규칙 | [03 데이터 모델 · DB 접근층과 이식성 규칙](03-data-model.md#db-접근층과-이식성-규칙) | [DB 접근층](../.forge/adr/261101-231535-drizzle-sqlite-with-portability-rules.md) |
| D22 | 저장소 인터페이스 + 로컬 디스크, api 권한 확인 | [05 이미지 엔진 · 이미지 파일 저장소](05-image-engine.md#이미지-파일-저장소) | — |
| D23 | 대화형 텍스트 SSE, 긴 작업은 SQLite 작업 테이블 + 워커 | [02 아키텍처 · AI 작업 실행 방식](02-architecture.md#ai-작업-실행-방식) | — |
| D24 | 단일 VPS + Docker Compose, Litestream 백업, 단일 인스턴스 | [02 아키텍처 · 배포 구성](02-architecture.md#배포-구성) | [배포](../.forge/adr/261101-232141-single-vps-docker-compose-single-instance.md) |
| D25 | Claude web_search + web_fetch, Tavily 비교 검증, 네이버 출처 제외 | [07 자료 조사 · 검색 백엔드](07-research.md#검색-백엔드) | — |
| D26 | 명시 저장, 요약·짧은 인용·URL만, 언급·고정 시 제목·요약 주입 | [07 자료 조사 · 자료 저장 규칙](07-research.md#자료-저장-규칙), [자료를 집필에 쓰는 규칙](07-research.md#자료를-집필에-쓰는-규칙) | — |
| D27 | 대표 이미지 레퍼런스 조건부 생성, Gemini, 모델 ID 기록 | [05 이미지 엔진 · 일관성 방식](05-image-engine.md#일관성-방식--대표-이미지-레퍼런스-조건부-생성), [공급자 구성](05-image-engine.md#공급자-구성) | [이미지 일관성](../.forge/adr/261101-233441-reference-conditioned-images-gemini.md) |
| D28 | 에디터는 IME 스파이크로 결정, 블록 JSON 원본 | [06 에디터 · 에디터 라이브러리](06-editor-and-ai-ux.md#에디터-라이브러리--한국어-ime-스파이크로-결정), [저장 포맷](06-editor-and-ai-ux.md#저장-포맷) | [에디터](../.forge/adr/261101-233610-editor-ime-spike-gate-block-json.md) |

## ADR 목록

ADR은 되돌리기 어렵고, 맥락 없이 보면 의아하며, 실제 대안 사이에서 고른 결정만 남긴 기록이다. 7개 모두 위 표에서 해당 결정과 연결된다.

| ADR | 내용 | 관련 결정 |
|---|---|---|
| [261101-223930](../.forge/adr/261101-223930-setting-structured-fields-plus-free-body.md) | 설정은 정형 핵심 필드 + 자유 본문 | D05 |
| [261101-225940](../.forge/adr/261101-225940-claude-single-provider-thin-interface.md) | Claude 단일 공급자, 얇은 인터페이스 | D15 |
| [261101-230415](../.forge/adr/261101-230415-typescript-monorepo-web-api-split.md) | TypeScript 모노레포, web/api 분리 | D18 |
| [261101-231535](../.forge/adr/261101-231535-drizzle-sqlite-with-portability-rules.md) | Drizzle + SQLite 이식성 규칙 | D21 |
| [261101-232141](../.forge/adr/261101-232141-single-vps-docker-compose-single-instance.md) | 단일 VPS Docker Compose, api 단일 인스턴스 | D24 |
| [261101-233441](../.forge/adr/261101-233441-reference-conditioned-images-gemini.md) | 대표 이미지 레퍼런스 조건부 생성, Gemini | D27 |
| [261101-233610](../.forge/adr/261101-233610-editor-ime-spike-gate-block-json.md) | 에디터 IME 스파이크 관문, 블록 JSON 원본 | D28 |
