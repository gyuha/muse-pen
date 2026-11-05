# 실행 기록 — 개발 전용 Claude Code 텍스트 공급자 (#17)

실행: 2026-11-05, 브랜치 `dev-claude-code-provider`. 팀 규칙에 따라 Paseo 역할에 순차로 맡겼다. story(claude-sonnet-5-5, agent `f5fb8815`)가 S1을, backend(claude-sonnet-5-5, agent `1cc12bc0`)가 S2를 했다. 오케스트레이터는 교차 검증과 UAT를 했다.

## 슬라이스별 결과
- S1 story-engine `ClaudeCodeTextProvider` — ✅ 계획대로 (`e053a38`). 덧붙인 것: `packages/story-engine/tsconfig.json`에 `"types": ["node"]` 추가(이 패키지가 처음으로 `node:` 모듈을 써서 typecheck에 필요. image-engine과 같은 설정)
- S2 api `TEXT_PROVIDER` 연결과 운영 시작 거부 — ✅ 계획대로 (`a694fe7`). `selectTextProvider(env)`는 미설정·`fake`이면 undefined를 돌려 기존 기본값(가짜)을 그대로 쓴다

## 계획과 달라진 점
- 실행 수단: Dynamic Workflow 대신 Paseo 역할에 맡겼다(팀 규칙).
- stream-json 형식은 story가 실제 호출 1회로 확인하고 구현했다. `stream_event`의 `content_block_delta`/`text_delta`를 token으로, `message_start`의 모델을 modelId로, `result`의 usage를 usage 이벤트로 바꾼다.
- 두 에이전트 모두 시작할 때 forge 훅이 "task 17이 다른 세션에서 실행 중"이라고 알렸다. 그 실행이 바로 이 작업이라 무시하게 했다.
- UAT 중 관찰: 초대 코드로 가입(`/api/auth/sign-up/email`, 200)한 직후의 쿠키로 `POST /api/works`를 부르면 `401 unauthorized`가 났다. 같은 작가로 다시 로그인하면 정상이었다. 가입 후 자동 로그인이 꺼진 설계인지 결함인지는 확인하지 않았다[알 수 없음]. 이번 범위 밖이다.
- 추정 비용이 0으로 기록되는 것은 설계대로다. `apps/api/src/pricing.ts`의 `DEFAULT_PRICING`이 비어 있고 운영자가 채운다.

## DoD 기준값 → 실행 후
1. story-engine `-t claude-code` 0개(28 skip) → 8개 통과. 전체 36개 통과
2. api `-t TEXT_PROVIDER` 0개(42 skip) → 4개 통과. 전체 46개 통과
3. `pnpm -r typecheck` 통과 → 통과(회귀 방지, 기준값부터 통과)
4. `grep -c TEXT_PROVIDER apps/api/src/server.ts` 0 → 1
5. UAT(실제 구독 호출): `TEXT_PROVIDER=claude-code`로 로컬 api(:3999, 임시 DB)를 띄워 초대 → 가입 → 로그인 → 작품·회차 생성 → 이어쓰기 SSE를 호출했다. 결과는 token 이벤트 198개 → suggestion → done, 약 9초, 한국어 본문 정상, AI 사용 기록 1건(`text_generation`, `claude-sonnet-5-5`, 입력 1,657·출력 737토큰). 입력 크기로 보아 전역 CLAUDE.md는 들어가지 않았고, 출력에도 페르소나 흔적이 없다.

## 후속 작업 후보

<!-- followup: fu-846d69fd39f6 | source: dev-claude-code-text-provider | task: 17 | date: 2026-11-05 | status: open | taken: - -->
- 가입 직후 세션 확인: 초대 코드 가입(200) 직후 쿠키로 작품 생성이 401이고, 다시 로그인하면 정상이다. 가입 후 자동 로그인이 꺼진 의도된 설계인지 확인하고, 아니라면 고친다(backend, 인증).
  Evidence: 2026-11-05 UAT 스크립트에서 재현(가입 200 → POST /api/works 401 → 로그인 200 → 정상).
