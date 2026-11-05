<!-- forge-slug: dev-claude-code-text-provider -->
<!-- task: 17 -->
<!-- tdd: off -->
# 개발 전용 Claude Code 텍스트 공급자 — 구독으로 로컬에서 실제 AI 글 확인

## 목표 / 하지 않을 것
- 목표: story-engine의 `TextProvider` 인터페이스 뒤에 `claude -p`(Claude Code CLI 헤드리스 모드)를 하위 프로세스로 부르는 개발 전용 공급자를 둔다. 로컬 개발에서 `TEXT_PROVIDER=claude-code`로 켜면 텍스트 작업 9종(continue·rewrite·polish·expand·shrink·draft·ghost·setting_check·episode_completion)이 사용자 본인의 구독으로 실제 Claude 출력을 낸다. 운영에서는 켜질 수 없게 막는다.
- 하지 않을 것:
  - 운영용 Claude API 어댑터(API 키 기반). 별도 작업이다.
  - 자료 조사 `SearchProvider`. 검색 스파이크(`fu-d4befa24d1b1`)를 미뤘다.
  - 이미지 공급자 변경.
  - 스트림 중단(클라이언트 연결이 끊길 때 프로세스 종료), 재시도, 동시 실행 제한. `TextProvider`에 중단 신호가 없고, 개발 전용이라 미룬다.
  - 프롬프트 템플릿·출력 스키마 변경. 엔진의 기존 system/prompt를 그대로 넘긴다.
  - `--bare` 모드. 구독 OAuth를 읽지 않아 쓸 수 없다(측정).

## 근거 문서
- 용어: `.forge/CONTEXT.md`의 작가, AI 제안. 새 용어 없음.
- 관련 ADR: `.forge/adr/261101-225940-claude-single-provider-thin-interface.md`(Claude 단일 공급자, story-engine 내부의 얇은 인터페이스).
- 이번 그릴링에서 정한 것(2026-11-05):
  - **비용 방식:** 개발은 구독, 운영은 API 키(2026-11-03 결정). Anthropic은 제3자 제품에 claude.ai 로그인·구독 한도를 쓰는 것을 허용하지 않는다(code.claude.com/docs/en/agent-sdk/overview). 그래서 이 공급자는 개발자 본인 컴퓨터에서만 쓰고 운영에서는 시작을 거부한다.
  - **호출 형태(측정으로 확정):** `claude -p --tools "" --setting-sources "" --strict-mcp-config --no-session-persistence --model <request.model> --system-prompt <request.system> --output-format stream-json --include-partial-messages --verbose`(stream-json에 `--verbose`가 필요하면 포함). 프롬프트는 길 수 있으므로 stdin으로 넘긴다. 작업 디렉터리는 저장소 밖(예: OS 임시 디렉터리)으로 둔다.
    - `--setting-sources ""`는 필수다. 빠지면 사용자 전역 `~/.claude/CLAUDE.md`가 컨텍스트에 들어가 입력이 40,464토큰이 되고 출력 문체가 오염된다. 넣으면 1,461토큰이다(2026-11-05 측정).
    - `--bare`는 쓸 수 없다. 도움말 기준 "OAuth and keychain are never read".
  - **적용 범위:** 텍스트 작업 9종 전부. ghost text는 개발에서 약 3.6초(API 1.4초 + 프로세스 기동 약 2초, 측정) 지연을 감수한다.
  - **운영 차단:** 기본은 가짜 공급자. `TEXT_PROVIDER=claude-code`일 때만 켠다. `NODE_ENV=production`과 함께 설정되면 api가 시작 단계에서 에러로 멈춘다(`AUTH_SECRET` 검사와 같은 방식).
  - **사용량:** 결과 이벤트의 usage를 `TokenUsage`로 보고한다. inputTokens는 input + cache_creation + cache_read 합, modelId는 실제 응답 모델(없으면 request.model). 구독이라 추정 비용은 실제 청구가 아니며, 기존 `recordUsage` 경로를 그대로 쓴다.
- 담당: story(`packages/story-engine`: 공급자와 단위 테스트) → backend(`apps/api`: 환경 변수 연결과 운영 차단, 테스트). backend는 story가 끝난 뒤 진행한다.
- 완료 정의(DoD):
  1. `pnpm --filter @muse-pen/story-engine test`가 통과하고, `pnpm --filter @muse-pen/story-engine exec vitest run -t claude-code`가 1개 이상 실행·통과한다. 테스트는 프로세스 실행 함수를 주입해 실제 `claude`를 부르지 않고 다음을 확인한다: (a) stream-json 출력 → token 이벤트들 + usage 이벤트 정확히 1회(`generate`는 이어 붙인 text + usage), (b) 0이 아닌 종료 코드나 결과 이벤트의 `is_error`는 오류로 던짐, (c) 인자에 `--setting-sources ""`와 `--tools ""`가 반드시 포함, (d) 프롬프트가 stdin으로 전달. 작성 시점 상태: 해당 테스트 0개(28개 모두 skip, 측정 — 전방 확인).
  2. `pnpm --filter @muse-pen/api test`가 통과하고, `pnpm --filter @muse-pen/api exec vitest run -t TEXT_PROVIDER`가 1개 이상 통과한다. 테스트는 (a) 미설정이면 가짜 공급자, (b) `claude-code`면 Claude Code 공급자 선택, (c) `NODE_ENV=production` + `claude-code`면 시작 거부, (d) 알 수 없는 값이면 시작 거부를 확인한다. 작성 시점 상태: 해당 테스트 0개(42개 모두 skip, 측정 — 전방 확인).
  3. `pnpm -r typecheck`가 통과한다. 회귀 방지용이라 작성 시점에도 통과하는 것이 정상이다.
  4. `grep -c "TEXT_PROVIDER" apps/api/src/server.ts` ≥ 1(환경 변수 설명 주석 포함). 작성 시점 상태: 0(측정).
  5. UAT(사람 확인, 실제 구독 호출): 로컬에서 `TEXT_PROVIDER=claude-code`로 api를 띄우고 작품·회차를 만든 뒤 이어쓰기 SSE 요청을 보내면, 한국어 본문 토큰이 순서대로 흘러나오고 정상 종료되며 AI 사용 기록이 1건 남는다. 출력에 사용자 전역 CLAUDE.md 페르소나의 흔적이 없다.

## 작업 조각
- [ ] S1. story-engine에 `ClaudeCodeTextProvider` 추가 — `packages/story-engine/src/providers/claude-code.ts`. `TextProvider`의 `generate`·`stream`을 위 호출 형태로 구현한다. stream-json을 줄 단위로 파싱해 텍스트 델타를 token 이벤트로, 결과 이벤트의 usage를 마지막 usage 이벤트로 바꾼다. 실행 파일 경로(기본 `claude`), 프로세스 실행 함수, 시간 제한(기본 120초)을 생성자에서 주입 가능하게 한다. `providers/index.ts`에서 내보낸다. — 완료 기준: DoD 1 통과.
- [ ] S2. api에 환경 변수 연결과 운영 차단 — 공급자 선택을 작은 함수로 분리해 테스트 가능하게 하고, `apps/api/src/server.ts`에서 `TEXT_PROVIDER`를 읽어 `createApp({ textProvider })`에 넘긴다. 운영 + `claude-code`, 알 수 없는 값은 시작 거부. 서버 주석에 환경 변수 설명을 추가한다. — 완료 기준: DoD 2·3·4 통과. (depends: S1)
