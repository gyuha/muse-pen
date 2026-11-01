<!-- forge-slug: docs-2of3-engines-ux -->
<!-- task: 2 -->
<!-- part: 2/3 -->
<!-- tdd: off -->
# 제작 문서 2/3 — 스토리 엔진·이미지 엔진·에디터·자료 조사

## Goal / Non-goals
- Goal: docs/04-story-engine.md, docs/05-image-engine.md, docs/06-editor-and-ai-ux.md, docs/07-research.md를 한국어로 작성해 story·imagery·frontend 역할이 바로 구현에 들어갈 수 있는 동작 규칙을 결정 원본에서 그대로 옮긴다.
- 작성 규칙: 결정 원본(.forge/agenda.md "결정됨", .forge/adr/*, .forge/CONTEXT.md)과 아래 "조사 근거 요약"에 있는 내용만 쓰고, 미정 사항은 "담당 역할이 정할 것"으로 명시한다. 조사 근거의 가격·이슈 번호는 "2026-11-01 조사 기준, 미검증 항목 있음"을 함께 적는다. 흐름이 있는 섹션은 텍스트 설명을 먼저 쓰고 그 아래 흐름도(5단계 이하 선형은 `A → B → C` 텍스트 흐름도 코드블록, 분기·다중 레인은 mermaid + style/classDef). CONTEXT.md 용어를 쓰고 _Avoid_ 단어를 쓰지 않는다. 다른 문서 링크는 상대 경로. TODO·TBD·FIXME·"작성 예정"·"추후 작성" 문구 금지.
- Non-goals: 01~03·08·09 문서 작성(다른 파트). 프롬프트 문구 자체 작성(story가 정할 것). .forge/ 아래 파일 수정.

## Source of truth
- Glossary terms: .forge/CONTEXT.md 전체
- Related ADRs: .forge/adr/261101-225940-claude-single-provider-thin-interface.md, .forge/adr/261101-233441-reference-conditioned-images-gemini.md, .forge/adr/261101-233610-editor-ime-spike-gate-block-json.md, .forge/adr/261101-223930-setting-structured-fields-plus-free-body.md
- 문서별 담을 결정 (agenda.md "결정됨"의 순서 번호 D01~D28 기준):
  - 04-story-engine.md: 컨텍스트 조립 규칙 한 곳에 정리 — D09(모든 설정의 정형 필드·컨셉은 항상, 설정 본문은 현재 회차에 이름·별칭이 언급된 설정과 고정 설정만, 임베딩 검색 미룸), D12(직전 N화 전문 + 이전 회차 요약), D14(시놉시스 항상, 플롯 메모는 해당 회차만, 사이드 패널 대화는 저장만·컨텍스트 제외), D26의 자료 주입 규칙은 07로 링크. 기능별 동작: 이어쓰기·다시쓰기·문체 다듬기·회차 초안·줄거리 구상·ghost text·설정 점검. D10(AI 제안마다 정형 필드 기반 자동 경고: 사망·행방불명 캐릭터 등장, LLM 호출 없음 / 작가 요청 "설정 점검"), D11(ghost text: 입력 멈춤 + 한글 조합 종료 후 자동, 한 문장 이내, 빠르고 싼 하위 모델, 작가별 켜기·끄기, 수치는 빌드 때 조정), D13(회차 완료 시 회차 요약과 정형 필드 변경 후보를 AI 제안으로, 필드는 현재 값만, 과거 회차 퇴고 시 잘못된 경고 감수), D15(Claude 단일 공급자, 상위 모델 본 집필·하위 모델 ghost text, story-engine 내부 얇은 인터페이스, 다중 공급자 추상화 계층 미사용 이유). 컨텍스트 조립 흐름도와 회차 완료 처리 흐름도 포함.
  - 05-image-engine.md: D27(대표 이미지 + 화풍 프리셋(문구·화풍 레퍼런스 1~3장)을 매 요청에 넣는 레퍼런스 조건부 생성, 이전 결과물을 다음 입력으로 쓰지 않음, Gemini Nano Banana 2.1 초안·Nano Banana Pro 최종, image-engine 인터페이스, 이미지마다 모델 ID 기록, 빌드 전 일관성·검열 오탐 검증, 실패 시 FLUX로 교체, 모델 은퇴 위험), D22(저장소 인터페이스(저장·읽기·삭제·접근 URL), 첫 구현 로컬 디스크, api가 작가 권한 확인 후 제공, S3 호환 교체 경로). 생성 작업은 SQLite 작업 테이블 + 워커로 처리(02-architecture.md 링크).
  - 06-editor-and-ai-ux.md: D07(선택 영역 메뉴, "/" 명령 블록 생성(/이어쓰기·/초안), 사이드 AI 패널, ghost text), D08(AI 제안은 원문과 비교해 보여 주고 수락·거절·다시 생성, 수락 시점·자동 저장 때 회차 스냅샷, 시점 복원만, 버전 diff 화면 미룸), D28(BlockNote·Plate 한국어 IME 스파이크로 결정: 하나만 통과 시 그것, 둘 다 통과 시 Plate, 둘 다 실패 시 Lexical 검토 / 저장 원본은 라이브러리 블록 JSON, 일반 텍스트·Markdown 파생 저장 / ghost text는 조합 중 숨김 / Pretendard 정적 빌드). 스파이크 시험 매트릭스 표 포함. AI 제안 수락 흐름도 포함.
  - 07-research.md: D25(Claude web_search + web_fetch를 story-engine 인터페이스 뒤에, 빌드 전 한국어 질문 20~30개로 Claude 검색 vs Tavily 비교 검증 후 크게 뒤지면 교체, 네이버 블로그·뉴스·지식백과 robots.txt AI 봇 금지로 근거 출처 제외), D26(작가가 저장할 때만 자료, 저장 형태: 제목·질문·작가 편집 가능 요약(AI 초안은 미검증 표시)·출처[URL·제목·150자 이내 인용·조회 시각]·태그, 웹 원문 저장 안 함, 출처 항상 표시, 고정되었거나 제목·태그가 언급된 자료의 제목·요약만 토큰 상한 안에서 주입, 웹 원문 미주입으로 프롬프트 인젝션 차단).
- 조사 근거 요약 (2026-11-01 조사 에이전트 보고, 오케스트레이터 미재검증):
  - Claude web_search: 1천 검색당 $10 + 결과 토큰, 인용(url·title·cited_text ≤150자) 기본 제공, 페이지 본문은 encrypted_content, allowed_domains/blocked_domains·max_uses·user_location 옵션(KR 허용 여부 미확인). web_fetch: 도구 자체 무료·토큰 과금, 대화에 나온 URL만 조회. 질문당 약 $0.05~0.15 추정.
  - 대안: Tavily 1천 기본 검색 약 $8(country 가중치, raw_content), Exa $4~7/1천, Brave $5/1천(결과 보관은 별도 유료 플랜), Google Programmable Search 2027-01-01 종료. 나무위키·한국민족문화대백과는 크롤러 허용.
  - 이미지: Anthropic은 이미지 생성 API 없음. Nano Banana 2.1 레퍼런스 최대 14장(캐릭터 4), 1K $0.0336·2K $0.0504. Nano Banana Pro 캐릭터 5·화풍 3 슬롯, 1K/2K $0.134. OpenAI gpt-image 레퍼런스 입력 지원·시드 미문서화. BFL FLUX.2 레퍼런스 최대 8장·시드·safety_tolerance. fal.ai FLUX.2 LoRA 학습 약 $6.40·10장 이상. Nano Banana 2는 2026-10-29 은퇴. 시드+프리셋만으로는 정체성 유지 불가. 애니메이션풍 10대 캐릭터는 공급자 검열 오탐 가능 — 실측 필요.
  - 에디터: BlockNote 0.57(MPL, AI 패키지 xl-ai는 GPL-3.0 또는 월 $195, ghost text 미제공), Plate(platejs 53, 전부 MIT, AI 메뉴·Copilot ghost text·제안 모드 내장, Slate IME 수정 2026-10 반영·plitejs 엔진 교체 진행 중), Lexical 0.53(MIT, 한국어 수정 다수, UI·AI 직접 구현), Tiptap 3.32(AI·Notion 템플릿 유료). 열린 한국어 IME 이슈: BlockNote #1679·Tiptap #4108(Enter 시 마지막 음절 사라짐), Tiptap #8626(조합 중 Backspace). 커서 옆 위젯은 IME 조합을 깨뜨리는 알려진 원인. Lexical #4753: Pretendard 동적 서브셋이 Chromium 조합 커서를 어긋나게 함.
- Definition of Done: 아래 명령이 모두 기대값을 낸다.
  - `test -s docs/04-story-engine.md && test -s docs/05-image-engine.md && test -s docs/06-editor-and-ai-ux.md && test -s docs/07-research.md && echo ok` → `ok` (사전 상태: 실패)
  - `node .forge/checks/docs-check.mjs C2 | grep -oE 'D(0[7-9]|1[0-5]|2[2578])\(' | wc -l` → `0` (사전 상태: 13. 같은 출력에 "C2" 줄이 찍히는 것으로 명령 실행 확인)
  - `node .forge/checks/docs-check.mjs C7 | grep -cE '0[4-7]-'` → `0` (생성 후에도 0이어야 함)
  - `node .forge/checks/docs-check.mjs C8 | grep -cE '0[4-7]-'` → `0` (사전 상태: 2 — 04·06 흐름도 없음)
  - `node .forge/checks/docs-check.mjs C9` → exit 0 (회귀 방지 — 사전 상태 pass가 정상)

## Work slices
- [ ] S1. docs/04-story-engine.md 작성(컨텍스트 조립·회차 완료 흐름도) — completion criterion: C2 출력에 D09~D15 누락 없음, C8 출력에 04 지적 없음
- [ ] S2. docs/05-image-engine.md 작성 — completion criterion: C2 출력에 D22·D27 누락 없음
- [ ] S3. docs/06-editor-and-ai-ux.md 작성(스파이크 시험 매트릭스·AI 제안 수락 흐름도) — completion criterion: C2 출력에 D07·D08·D28 누락 없음, C8 출력에 06 지적 없음
- [ ] S4. docs/07-research.md 작성 — completion criterion: C2 출력에 D25·D26 누락 없음
