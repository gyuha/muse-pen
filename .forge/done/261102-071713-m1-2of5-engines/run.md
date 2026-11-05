# RUN — M1 2/5 — 스토리 엔진·이미지 엔진(가짜 공급자)

## 슬라이스 결과
- S1 story-engine — ✅ as planned (테스트 5파일 28개, 커밋 92afdf1, story#9490)
- S2 image-engine — ✅ as planned (테스트 7개, 커밋 5d65fd3, imagery#AFB8)

## 계획과 실제의 차이
- 두 역할이 같은 작업 트리에서 병렬로 작업했고 커밋 충돌은 없었다.
- shared에 회차 요약·플롯 메모·고정 지정 타입이 없어 story-engine이 `src/types.ts`에 ContextInput 등을 자체 정의(shared 수정 금지 규칙 준수). api가 DB → 엔진 입력으로 매핑해야 한다.
- 설정 본문 이름·별칭 매칭은 현재 회차 본문만 본다(플롯 메모 제외). 자료 제목·태그 매칭은 본문과 플롯 메모를 모두 본다 — docs/04 표 문구("현재 회차에 이름·별칭")와 docs/07("회차·플롯 메모에 언급")에 맞음.
- story-engine 기본 모델 ID: main claude-sonnet-5-5, light claude-haiku-5-5. image-engine 모델 상수는 논리 식별자(실제 연결 시 매핑).
- DoD baseline 불일치: 플랜은 엔진 테스트 사전 상태를 "실패"로 적었으나 실제로는 `--passWithNoTests`라 0개로 통과 상태였다(1/5에서 들어간 설정). 진행에는 영향 없음.
- K3 실행이 남긴 `tests/test-results/`(Playwright 산출물)가 추적되지 않은 채 남아 있다 — .gitignore 보강은 qa(5/5) 몫.

## DoD baseline → after
- story-engine·image-engine test: 0개(통과) → 28 + 7 passed
- story·image build: — → exit 0
- `pnpm -r typecheck`: exit 0 → exit 0
- K5: pass → pass (회귀 방지)
- 역할별 커밋: 0 → 각 1개

## Rulings
- 실행기: paseo story#9490(claude-sonnet-5-5), imagery#AFB8(codex/gpt-6.1-sol, auto-review) 병렬 위임.
- story-engine이 shared 대신 자체 타입을 둔 결정을 수용(규칙대로 보고됨).
