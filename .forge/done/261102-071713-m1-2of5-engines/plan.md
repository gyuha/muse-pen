<!-- forge-slug: m1-2of5-engines -->
<!-- task: 12 -->
<!-- part: 2/5 -->
<!-- tdd: off -->
# M1 2/5 — 스토리 엔진·이미지 엔진(가짜 공급자)

## Goal / Non-goals
- Goal: packages/story-engine과 packages/image-engine을 외부 API 키 없이 동작하는 형태로 구현한다. 공급자는 인터페이스 뒤에 두고 결정적 가짜 공급자(fake provider)를 제공하며, 실제 SDK 연동 자리는 `src/providers/` 아래로만 둔다.
- 담당: story 역할(story-engine)과 imagery 역할(image-engine)을 병렬로. 서로의 폴더와 packages/shared는 고치지 않는다(필요한 공용 타입이 없으면 오케스트레이터에 보고).
- Non-goals: 실제 Claude·Gemini 호출, API 라우트·DB(3/5), 의존성 추가(필요 시 보고), docs/·.forge/ 수정.

## Source of truth
- Glossary terms: .forge/CONTEXT.md (고정 설정·회차 요약·시놉시스·플롯 메모·자료·대표 이미지·화풍 프리셋·AI 제안·설정 점검)
- Related ADRs: .forge/adr/261101-225940-claude-single-provider-thin-interface.md, .forge/adr/261101-233441-reference-conditioned-images-gemini.md
- 문서: docs/04-story-engine.md(컨텍스트 조립 규칙·텍스트 기능별 동작·ghost text·설정 충돌 검사·회차 완료 처리), docs/05-image-engine.md, docs/07-research.md(자료를 집필에 쓰는 규칙)
- 수락 기준: .forge/checks/m1-acceptance.md AC-10·AC-11·AC-12·AC-14·AC-15에 해당하는 엔진 쪽 동작(컨텍스트 조립 순수 함수, 자동 충돌 경고, 토큰 스트림, 이미지 생성·모델 ID, 호출당 사용량 보고 콜백)
- Definition of Done:
  - `pnpm --filter ./packages/story-engine test && pnpm --filter ./packages/image-engine test` → exit 0 (사전 상태: 스캐폴드만 있어 테스트 0개로 실패)
  - story-engine 테스트가 컨텍스트 조립 규칙을 포함·제외 양쪽으로 확인(정형 필드 항상, 본문은 이름·별칭 언급 또는 고정 시만, 플롯 메모는 그 회차만, 직전 N 전문 + 이전 요약, 패널 대화 제외, 자료는 제목·요약만)하고 자동 충돌 경고가 가짜 공급자 호출 0회임을 확인
  - image-engine 테스트가 정형 필드→결정적 프롬프트, 대표 이미지만 참조 입력(이전 결과 이어 쓰기 없음), 결과 기록에 모델 ID, 저장은 ImageStorage 인터페이스로만 함을 확인
  - `pnpm -r typecheck` → exit 0, `node .forge/checks/m1-check.mjs K5` → exit 0(회귀 방지)
  - 역할별 로컬 커밋 각 1개 이상

## Work slices
- [ ] S1. story-engine: 공급자 인터페이스(생성·스트리밍·사용량 보고) + 가짜 공급자, 컨텍스트 조립기, 자동 충돌 경고, 기능별 생성(이어쓰기·다시쓰기·문체 다듬기·늘리기/줄이기·회차 초안·ghost text 한 문장·설정 점검·회차 완료 처리[요약+필드 변경 후보]·자료 조사 인터페이스) + 단위 테스트 — completion criterion: `pnpm --filter ./packages/story-engine test` exit 0
- [ ] S2. image-engine: 공급자 인터페이스 + 가짜 공급자, 정형 필드·화풍 프리셋 결정적 프롬프트 조립, 대표 이미지 참조 생성, 모델 ID 기록, ImageStorage 인터페이스로 저장, 사용량 보고 + 단위 테스트 — completion criterion: `pnpm --filter ./packages/image-engine test` exit 0
